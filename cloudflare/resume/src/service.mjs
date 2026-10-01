import { validateEmail, hasMailRecords } from './email-policy.mjs';

export const PDF_KEY = 'resume:pdf:v1';
export const CONSENT_VERSION = 'resume-request-v1';
const MAX_BODY = 4096;
const MAX_PDF = 5 * 1024 * 1024;
const HOUR = 3600;
const DAY = 86400;
const genericFailure = 'Resume requests are temporarily unavailable. Please try again later.';

// One statement makes the admission check and reservation atomic across all edges.
// Pending, failed, and ambiguous sends also count toward the limits.
export const RESERVE_SQL = `INSERT INTO resume_requests
  (id, email, email_key, ip_hash, requested_at, consent_version, status, updated_at)
  SELECT ?, ?, ?, ?, ?, ?, 'pending', ?
  WHERE NOT EXISTS (SELECT 1 FROM resume_requests WHERE email_key = ? AND requested_at > ?)
  AND (SELECT COUNT(*) FROM resume_requests WHERE ip_hash = ? AND requested_at > ?) < 5
  AND (SELECT COUNT(*) FROM resume_requests WHERE requested_at > ?) < 50
  RETURNING id`;

function origins(env) {
  return (env.ALLOWED_ORIGINS || '').split(',').map(origin => origin.trim()).filter(Boolean);
}

function ready(env) {
  return Boolean(env.DB && env.RESUME_FILES && env.RESEND_API_KEY && env.RESUME_FROM
    && env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY && env.IP_HASH_SECRET
    && origins(env).length && !/^[123]x0{8}/.test(env.TURNSTILE_SITE_KEY)
    && !/^[123]x0{8}/.test(env.TURNSTILE_SECRET_KEY));
}

function reply(request, env, body, status = 200, extraHeaders = {}) {
  const origin = request.headers.get('Origin');
  const headers = {
    'Content-Type': 'application/json', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', Vary: 'Origin', ...extraHeaders,
  };
  if (origins(env).includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return new Response(JSON.stringify(body), { status, headers });
}

async function readBody(request) {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
    return { error: 'Expected a JSON request.', status: 415 };
  }
  if (Number(request.headers.get('Content-Length')) > MAX_BODY) return { error: 'Request too large.', status: 413 };
  if (!request.body) return { error: 'Invalid request.', status: 400 };
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) {
        await reader.cancel();
        return { error: 'Request too large.', status: 413 };
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const body = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid body');
    return { body };
  } catch {
    return { error: 'Invalid request.', status: 400 };
  } finally {
    reader.releaseLock();
  }
}

async function hashIp(ip, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(ip));
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
}

function encodePdf(pdf) {
  if (!(pdf instanceof ArrayBuffer) || pdf.byteLength < 5 || pdf.byteLength > MAX_PDF) throw new Error('Invalid resume');
  const bytes = new Uint8Array(pdf);
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('Invalid resume');
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}

export function createResumeService({ fetcher = fetch, now = () => Date.now(), uuid = () => crypto.randomUUID(), logger = console } = {}) {
  async function update(env, id, status, providerId = null) {
    try {
      await env.DB.prepare('UPDATE resume_requests SET status = ?, provider_id = ?, updated_at = ? WHERE id = ?')
        .bind(status, providerId, Math.floor(now() / 1000), id).run();
    } catch {
      // Log only our opaque request ID, never the address or provider response.
      logger.error('resume_status_update_failed', { id, status });
    }
  }

  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      const pathname = url.pathname.startsWith('/api/resume/')
        ? url.pathname.slice('/api/resume'.length) : url.pathname;
      const origin = request.headers.get('Origin');
      if (request.method === 'OPTIONS' && ['/request', '/config'].includes(pathname)) {
        if (!origins(env).includes(origin)) return reply(request, env, { error: 'Origin not allowed.' }, 403);
        return reply(request, env, {}, 200, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' });
      }
      if (pathname === '/config' && request.method === 'GET') {
        return reply(request, env, { available: ready(env), siteKey: ready(env) ? env.TURNSTILE_SITE_KEY : null });
      }
      if (pathname !== '/request') return reply(request, env, { error: 'Not found.' }, 404);
      if (request.method !== 'POST') return reply(request, env, { error: 'Method not allowed.' }, 405, { Allow: 'POST' });
      if (!origins(env).includes(origin)) return reply(request, env, { error: 'Origin not allowed.' }, 403);
      if (!ready(env)) return reply(request, env, { error: genericFailure }, 503);
      const parsed = await readBody(request);
      if (parsed.error) return reply(request, env, { error: parsed.error }, parsed.status);
      const body = parsed.body;
      if (body.website) return reply(request, env, { error: 'Unable to process this request.' }, 400);
      if (body.consent !== true) return reply(request, env, { error: 'Please agree to storing your email for this resume request.' }, 400);
      const address = validateEmail(body.email, env.EMAIL_POLICY);
      if (!address || address.error) return reply(request, env, { error: address?.error || 'Enter a valid email address.' }, 400);
      if (typeof body.turnstileToken !== 'string' || !body.turnstileToken || body.turnstileToken.length > 2048) {
        return reply(request, env, { error: 'Please complete the security check.' }, 400);
      }
      // Cloudflare sets this header. Never trust client-supplied forwarded-for.
      const ip = request.headers.get('CF-Connecting-IP');
      if (!ip) return reply(request, env, { error: genericFailure }, 503);
      let id;
      let sending = false;
      try {
        const check = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: body.turnstileToken, remoteip: ip }),
          signal: AbortSignal.timeout(8000),
        });
        if (!check.ok) throw new Error('Verification unavailable');
        const verification = await check.json();
        if (verification.success !== true || verification.action !== 'resume_request'
          || verification.hostname !== new URL(origin).hostname) {
          return reply(request, env, { error: 'The security check expired or failed. Please try again.' }, 400);
        }
        if (!await hasMailRecords(address.domain, fetcher)) {
          return reply(request, env, { error: 'This domain cannot receive email. Please check your address.' }, 400);
        }
        const timestamp = Math.floor(now() / 1000);
        const ipHash = await hashIp(ip, env.IP_HASH_SECRET);
        // Ensure the private file exists before reserving a request.
        const attachment = encodePdf(await env.RESUME_FILES.get(PDF_KEY, 'arrayBuffer'));
        id = uuid();
        const admission = await env.DB.prepare(RESERVE_SQL).bind(
          id, address.email, address.emailKey, ipHash, timestamp, CONSENT_VERSION, timestamp,
          address.emailKey, timestamp - HOUR, ipHash, timestamp - HOUR, timestamp - DAY,
        ).first();
        if (!admission) return reply(request, env, { error: 'A sending limit has been reached. Please check your inbox or try again in an hour.' }, 429, { 'Retry-After': '3600' });
        sending = true;
        const response = await fetcher('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `resume/${id}` },
          body: JSON.stringify({
            from: env.RESUME_FROM, to: [address.email], subject: 'Petar Juric — resume',
            text: 'Thanks for your interest in my work. My resume is attached.\n\nPetar Juric\nhttps://juric.dev\n\nYou received this one-time email because this address was entered into the resume request form on juric.dev. If you did not request it, you can ignore this message.',
            attachments: [{ filename: 'Petar_Juric_Resume.pdf', content: attachment, content_type: 'application/pdf' }],
          }), signal: AbortSignal.timeout(12000),
        });
        if (!response.ok) {
          await update(env, id, response.status >= 500 ? 'unknown' : 'failed');
          return reply(request, env, { error: genericFailure }, 503);
        }
        const sent = await response.json();
        if (typeof sent.id !== 'string' || !sent.id) throw new Error('Unknown send result');
        await update(env, id, 'accepted', sent.id);
        return reply(request, env, { message: 'Your resume email has been queued. Check your inbox and spam folder shortly.' }, 202);
      } catch {
        if (id) await update(env, id, sending ? 'unknown' : 'failed');
        return reply(request, env, { error: genericFailure }, 503);
      }
    },
  };
}

export default createResumeService();
