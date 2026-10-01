import { writeFile } from 'node:fs/promises';

const source = 'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf';
const response = await fetch(source, { signal: AbortSignal.timeout(15000) });
if (!response.ok) throw new Error(`Blocklist refresh failed (${response.status})`);
const domains = [...new Set((await response.text()).split(/\r?\n/).map(line => line.trim().toLowerCase()).filter(line => line && !line.startsWith('#'))) ].sort();
if (domains.length < 1000 || !domains.includes('mailinator.com') || domains.includes('gmail.com')
  || domains.some(domain => !/^[a-z0-9.-]+$/.test(domain))) throw new Error('Invalid upstream blocklist; keeping the current snapshot.');
const output = `// Source: https://github.com/disposable-email-domains/disposable-email-domains\n// CC0-1.0. Snapshot ${new Date().toISOString().slice(0, 10)}. Refresh with npm run update:email-blocklist.\nconst disposableDomains = new Set(${JSON.stringify(domains, null, 2)});\nexport default disposableDomains;\n`;
await writeFile(new URL('../cloudflare/resume/src/disposable-domains.mjs', import.meta.url), output);
console.log(`Updated ${domains.length} disposable domains. Review and deploy the Worker to activate.`);
