import disposableDomains from './disposable-domains.mjs';

// Exact domains only: gmail.com.attacker.test is not a trusted provider.
const providers = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com',
  'msn.com', 'yahoo.com', 'ymail.com', 'rocketmail.com', 'icloud.com',
  'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'pm.me',
  'fastmail.com', 'hey.com', 'gmx.com', 'gmx.de', 'web.de', 'mail.com',
]);

export function validateEmail(value, policy = 'business-and-personal') {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || /[\s\x00-\x1f\x7f]/.test(email)) return null;
  const parts = email.split('@');
  if (parts.length !== 2) return null;
  const [local, domain] = parts;
  if (!local || local.length > 64 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)
    || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return null;
  const labels = domain.split('.');
  if (labels.length < 2 || !/^[a-z]{2,63}$/.test(labels.at(-1))
    || labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null;
  for (let i = 0; i < labels.length - 1; i++) {
    if (disposableDomains.has(labels.slice(i).join('.'))) return { error: 'Please use a permanent personal, work, or university email address.' };
  }
  if (policy === 'major-providers' && !providers.has(domain)) {
    return { error: 'Please use an established provider such as Gmail, Outlook, iCloud, or Proton Mail.' };
  }
  // Gmail dots and plus aliases share a mailbox; prevent cooldown bypass.
  const emailKey = ['gmail.com', 'googlemail.com'].includes(domain)
    ? `${local.split('+')[0].replaceAll('.', '')}@gmail.com`
    : `${local.split('+')[0]}@${domain}`;
  return { email, domain, emailKey };
}

export async function hasMailRecords(domain, fetcher = fetch) {
  const url = new URL('https://cloudflare-dns.com/dns-query');
  url.searchParams.set('name', domain);
  url.searchParams.set('type', 'MX');
  const response = await fetcher(url, {
    headers: { Accept: 'application/dns-json' }, signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('DNS unavailable');
  const result = await response.json();
  if (result.Status === 3) return false;
  if (result.Status !== 0) throw new Error('DNS unavailable');
  const records = Array.isArray(result.Answer) ? result.Answer.filter(record => record.type === 15) : [];
  if (records.some(record => /^0\s+\.$/.test(record.data))) return false;
  return records.some(record => /^\d+\s+[a-z0-9][a-z0-9.-]+\.?$/i.test(record.data));
}
