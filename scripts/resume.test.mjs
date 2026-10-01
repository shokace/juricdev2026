import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { webcrypto } from 'node:crypto';
import { validateEmail, hasMailRecords } from '../cloudflare/resume/src/email-policy.mjs';
import { createResumeService, PDF_KEY, RESERVE_SQL } from '../cloudflare/resume/src/service.mjs';

globalThis.crypto ??= webcrypto;
const run = promisify(execFile);
const schema = await readFile(new URL('../cloudflare/resume/migrations/0001_resume_requests.sql', import.meta.url), 'utf8');
const clock = Date.parse('2026-10-01T00:00:00Z');
const python = `import sqlite3,sys,json
db=sqlite3.connect(sys.argv[1],timeout=20)
db.row_factory=sqlite3.Row
if sys.argv[2]=='schema':
 db.executescript(sys.argv[3]); print('[]')
else:
 result=db.execute(sys.argv[2],json.loads(sys.argv[3])); print(json.dumps([dict(row) for row in result.fetchall()]))
db.commit()
db.close()`;

async function database(t) {
  const dir = await mkdtemp(join(tmpdir(), 'juric-resume-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'requests.sqlite');
  const query = async (sql, params = []) => JSON.parse((await run('python3', ['-c', python, file, sql, typeof params === 'string' ? params : JSON.stringify(params)])).stdout);
  await query('schema', schema);
  return { query, prepare: sql => ({ bind: (...params) => ({ first: async () => (await query(sql, params))[0] || null, run: async () => { await query(sql, params); return { success: true }; } }) }) };
}

async function fixture(t, overrides = {}) {
  const db = await database(t);
  const emails = [];
  const calls = [];
  const logs = [];
  const pdf = new TextEncoder().encode('%PDF-1.7 test private attachment').buffer;
  const env = {
    DB: db, RESUME_FILES: { get: async (key, type) => { assert.equal(key, PDF_KEY); assert.equal(type, 'arrayBuffer'); return pdf; } },
    RESEND_API_KEY: 'test-resend-secret', RESUME_FROM: 'Petar Juric <resume@juric.dev>',
    TURNSTILE_SITE_KEY: 'real-site-key', TURNSTILE_SECRET_KEY: 'test-turnstile-secret', IP_HASH_SECRET: 'test-hash-secret',
    ALLOWED_ORIGINS: 'https://juric.dev,https://www.juric.dev', EMAIL_POLICY: 'business-and-personal', ...overrides.env,
  };
  const fetcher = async (input, options) => {
    const url = String(input);
    calls.push(url);
    if (url.includes('siteverify')) return Response.json(overrides.verification || { success: true, action: 'resume_request', hostname: 'juric.dev' });
    if (url.includes('dns-query')) return Response.json(overrides.dns || { Status: 0, Answer: [{ type: 15, data: '10 mx.example.org.' }] });
    assert.equal(url, 'https://api.resend.com/emails');
    emails.push({ body: JSON.parse(options.body), headers: options.headers });
    if (overrides.send) return overrides.send();
    return Response.json({ id: 'email-provider-id' });
  };
  const service = createResumeService({ fetcher, now: () => clock, logger: { error: (...args) => logs.push(args) } });
  const request = (body = {}, headers = {}, method = 'POST', pathname = '/request') => service.fetch(new Request(`https://resume.juric.dev${pathname}`, {
    method, headers: { Origin: 'https://juric.dev', 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.12', ...headers },
    ...(method === 'POST' ? { body: JSON.stringify({ email: 'recruiter@company.org', consent: true, website: '', turnstileToken: 'valid-token', ...body }) } : {}),
  }), env);
  return { db, env, request, service, emails, calls, logs, pdf };
}

test('normalizes real addresses; rejects injection, malformed and disposable domains including subdomains', () => {
  assert.equal(validateEmail(' Recruiter+Jobs@Company.org ').email, 'recruiter+jobs@company.org');
  assert.equal(validateEmail('first.last+jobs@googlemail.com').emailKey, 'firstlast@gmail.com');
  for (const value of [null, '', 'a@b', 'a@-test.org', 'a@com.', 'a..b@gmail.com', '.a@gmail.com', 'a@gmail.com\r\nBcc: b@c.org', 'a@b.org,c@d.org', `${'a'.repeat(65)}@gmail.com`, 'a@@gmail.com', 'a@b..com']) assert.equal(validateEmail(value), null, String(value));
  for (const domain of ['mailinator.com', 'sub.mailinator.com', 'guerrillamail.com', 'yopmail.com', '10minutemail.com']) assert.ok(validateEmail(`visitor@${domain}`).error, domain);
  assert.ok(validateEmail('visitor@gmail.com.evil.org', 'major-providers').error);
  assert.equal(validateEmail('visitor@gmail.com', 'major-providers').domain, 'gmail.com');
});

test('MX checks reject null MX, nonexistent and no-mail domains; DNS errors fail closed', async () => {
  for (const result of [{ Status: 3 }, { Status: 0 }, { Status: 0, Answer: [{ type: 15, data: '0 .' }] }, { Status: 0, Answer: [{ type: 1, data: '127.0.0.1' }] }]) {
    assert.equal(await hasMailRecords('company.org', async () => Response.json(result)), false);
  }
  await assert.rejects(hasMailRecords('company.org', async () => Response.json({ Status: 2 })));
  await assert.rejects(hasMailRecords('company.org', async () => new Response('', { status: 503 })));
});

test('logs before sending, attaches private bytes, hashes IP, and returns no file or recipient data', async t => {
  const f = await fixture(t, { send: async () => {
    const rows = await f.db.query('SELECT * FROM resume_requests');
    assert.equal(rows.length, 1); assert.equal(rows[0].status, 'pending');
    return Response.json({ id: 'accepted-by-resend' });
  } });
  const response = await f.request();
  assert.equal(response.status, 202);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://juric.dev');
  const body = await response.text();
  assert.doesNotMatch(body, /recruiter|base64|attachment|resume@/);
  const [row] = await f.db.query('SELECT * FROM resume_requests');
  assert.equal(row.email, 'recruiter@company.org');
  assert.equal(row.status, 'accepted');
  assert.equal(row.provider_id, 'accepted-by-resend');
  assert.match(row.ip_hash, /^[a-f0-9]{64}$/);
  assert.equal(row.consent_version, 'resume-request-v1');
  const [{ body: email, headers }] = f.emails;
  assert.deepEqual(email.to, ['recruiter@company.org']);
  assert.equal(email.attachments[0].content, Buffer.from(f.pdf).toString('base64'));
  assert.equal(email.attachments[0].filename, 'Petar_Juric_Resume.pdf');
  assert.equal(email.attachments[0].path, undefined);
  assert.equal(email.reply_to, undefined);
  assert.equal(headers['Idempotency-Key'], `resume/${row.id}`);
});

test('API rejects invalid inputs, cross-origin requests and missing consent without logging or sending', async t => {
  const f = await fixture(t);
  for (const body of [{ email: 'a@mailinator.com' }, { email: 'invalid' }, { consent: false }, { website: 'spam' }, { turnstileToken: '' }, { turnstileToken: 'x'.repeat(2049) }]) assert.equal((await f.request(body)).status, 400);
  assert.equal((await f.request({}, { Origin: 'https://attacker.test' })).status, 403);
  assert.equal((await f.request({}, { Origin: '' })).status, 403);
  assert.equal((await f.request({}, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await f.request({ padding: 'x'.repeat(5000) })).status, 413);
  assert.equal(f.emails.length, 0);
  assert.deepEqual(await f.db.query('SELECT * FROM resume_requests'), []);
});

test('Turnstile success must match the site hostname and form action', async t => {
  for (const verification of [{ success: false }, { success: true, hostname: 'attacker.test', action: 'resume_request' }, { success: true, hostname: 'juric.dev', action: 'different_form' }]) {
    const f = await fixture(t, { verification });
    assert.equal((await f.request()).status, 400);
    assert.equal(f.emails.length, 0);
    assert.equal(f.calls.length, 1);
  }
});

test('missing secrets, file, client IP and database failure never send mail', async t => {
  for (const env of [{ RESEND_API_KEY: '' }, { TURNSTILE_SECRET_KEY: '' }, { IP_HASH_SECRET: '' }, { RESUME_FILES: { get: async () => null } }, { DB: { prepare() { throw new Error('private db error'); } } }]) {
    const f = await fixture(t, { env });
    const response = await f.request();
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /private|secret|token|sqlite/i);
    assert.equal(f.emails.length, 0);
  }
  const f = await fixture(t);
  assert.equal((await f.request({}, { 'CF-Connecting-IP': '' })).status, 503);
  assert.equal(f.emails.length, 0);
});

test('concurrent requests and Gmail aliases get one atomic reservation and one send', async t => {
  const f = await fixture(t);
  const results = await Promise.all(['first.last@gmail.com', 'firstlast+jobs@googlemail.com', 'first.last+other@gmail.com'].map(email => f.request({ email })));
  assert.deepEqual(results.map(response => response.status).sort(), [202, 429, 429]);
  assert.equal(f.emails.length, 1);
  assert.equal((await f.db.query('SELECT * FROM resume_requests')).length, 1);
});

test('durable SQL admission enforces IP and global budgets with no cross-recipient race', async t => {
  const db = await database(t);
  const timestamp = Math.floor(clock / 1000);
  const reserve = (id, ip) => db.prepare(RESERVE_SQL).bind(id, `${id}@company.org`, `${id}@company.org`, ip, timestamp, 'v1', timestamp, `${id}@company.org`, timestamp - 3600, ip, timestamp - 3600, timestamp - 86400).first();
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) => reserve(`same-ip-${i}`, 'same-ip')));
  assert.equal(results.filter(Boolean).length, 5);
  for (let i = 0; i < 45; i++) assert.ok(await reserve(`other-${i}`, `ip-${i}`));
  assert.equal(await reserve('over-budget', 'new-ip'), null);
  assert.equal((await db.query('SELECT count(*) AS total FROM resume_requests'))[0].total, 50);
});

test('failed and ambiguous provider sends stay logged and do not claim delivery or bypass cooldown', async t => {
  for (const [send, status] of [[() => new Response('private provider error', { status: 422 }), 'failed'], [() => new Response('', { status: 500 }), 'unknown'], [() => { throw new Error('network timeout'); }, 'unknown']]) {
    const f = await fixture(t, { send });
    const response = await f.request();
    assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /provider|timeout/);
    assert.equal((await f.db.query('SELECT status FROM resume_requests'))[0].status, status);
    assert.equal((await f.request()).status, 429);
    assert.equal(f.emails.length, 1);
  }
});

test('public config exposes only the site key; every PDF/download path is unavailable', async t => {
  const f = await fixture(t);
  assert.deepEqual(await (await f.request({}, {}, 'GET', '/config')).json(), { available: true, siteKey: 'real-site-key' });
  const disabled = await fixture(t, { env: { RESEND_API_KEY: '' } });
  assert.deepEqual(await (await disabled.request({}, {}, 'GET', '/config')).json(), { available: false, siteKey: null });
  for (const path of ['/resume.pdf', '/download', '/resume:pdf:v1', '/']) assert.equal((await f.request({}, {}, 'GET', path)).status, 404);
  assert.equal((await f.request({}, {}, 'GET', '/request')).status, 405);
  assert.equal((await f.request({}, {}, 'OPTIONS')).headers.get('Access-Control-Allow-Origin'), 'https://juric.dev');
  assert.equal((await f.request({}, { Origin: 'https://evil.org' }, 'OPTIONS')).status, 403);
});

test('same-origin API paths support config and sending with identical security checks', async t => {
  const f = await fixture(t);
  const config = await f.service.fetch(new Request('https://juric.dev/api/resume/config'), f.env);
  assert.equal(config.status, 200);
  assert.deepEqual(await config.json(), { available: true, siteKey: 'real-site-key' });
  assert.equal((await f.request({}, {}, 'POST', '/api/resume/request')).status, 202);
  assert.equal(f.emails.length, 1);
  assert.equal((await f.request({}, { Origin: 'https://attacker.test' }, 'POST', '/api/resume/request')).status, 403);
  assert.equal((await f.request({}, { Origin: '' }, 'POST', '/api/resume/request')).status, 403);
  for (const path of ['/api/resumeevil/config', '/api/resume/resume.pdf', '/api/resume/download']) {
    assert.equal((await f.request({}, {}, 'GET', path)).status, 404);
  }
  assert.equal((await f.request({}, {}, 'OPTIONS', '/api/resume/request')).status, 200);
});
