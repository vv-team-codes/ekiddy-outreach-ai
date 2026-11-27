// Work-email-only rule: sign-in and sign-up allow company (work) email
// addresses only. Every personal / free-mail provider is blocked, including
// any subdomain of a blocked domain (e.g. mail.gmail.com). Company-domain
// email — including Google Workspace accounts on a company domain — passes.
// This list lives here in shared/src so the frontend and the backend reuse
// the exact same rule; do not duplicate it anywhere else.

export const FREE_EMAIL_DOMAINS: readonly string[] = [
  // Google
  'gmail.com',
  'googlemail.com',
  // Yahoo
  'yahoo.com',
  'yahoo.co.in',
  'yahoo.co.uk',
  'yahoo.ca',
  'yahoo.com.au',
  'yahoo.com.br',
  'yahoo.com.mx',
  'yahoo.fr',
  'yahoo.de',
  'yahoo.in',
  'ymail.com',
  'rocketmail.com',
  // Microsoft
  'outlook.com',
  'outlook.co.uk',
  'outlook.com.br',
  'hotmail.com',
  'hotmail.co.uk',
  'hotmail.fr',
  'hotmail.com.br',
  'live.com',
  'live.co.uk',
  'live.com.au',
  'msn.com',
  // Apple
  'icloud.com',
  'me.com',
  'mac.com',
  // AOL / AIM
  'aol.com',
  'aol.co.uk',
  'aim.com',
  // Proton
  'protonmail.com',
  'protonmail.ch',
  'proton.me',
  'pm.me',
  // Zoho
  'zoho.com',
  'zoho.eu',
  'zohomail.com',
  'zohomail.eu',
  // GMX / Mail.com
  'gmx.com',
  'gmx.net',
  'gmx.de',
  'gmx.at',
  'gmx.ch',
  'mail.com',
  // Yandex / Mail.ru
  'yandex.com',
  'yandex.ru',
  'yandex.ua',
  'yandex.kz',
  'yandex.by',
  'mail.ru',
  'inbox.ru',
  'bk.ru',
  'list.ru',
  // Other free providers
  'inbox.com',
  'lycos.com',
  'fastmail.com',
  'fastmail.fm',
  'tutanota.com',
  'tutanota.de',
  'tuta.io',
  'hushmail.com',
  'rediffmail.com',
  'mailfence.com',
  'posteo.de',
  'mailbox.org',
  'runbox.com',
  'web.de',
  'freenet.de',
  't-online.de',
  'orange.fr',
  'wanadoo.fr',
  'sfr.fr',
  'libero.it',
  'virgilio.it',
  'alice.it',
  'tin.it',
  'naver.com',
  'daum.net',
  'hanmail.net',
  'qq.com',
  '163.com',
  '126.com',
  'sina.com',
  'sohu.com',
  'yeah.net'
];

/** Domain part of an email address, lower-cased and trimmed ('' when invalid). */
export function getEmailDomain(email: string): string {
  const cleaned = (email || '').trim().toLowerCase();
  const at = cleaned.lastIndexOf('@');
  if (at === -1) return '';
  return cleaned.slice(at + 1);
}

/** True when the domain is a blocked free provider, or a subdomain of one. */
export function isFreeEmailDomain(domain: string): boolean {
  const d = (domain || '').trim().toLowerCase();
  if (!d) return false;
  return FREE_EMAIL_DOMAINS.some((free) => d === free || d.endsWith(`.${free}`));
}

/**
 * True only for work (company-domain) email addresses.
 * Case-insensitive, trims whitespace, and rejects subdomains of blocked
 * free providers (e.g. mail.gmail.com). Returns false for malformed input.
 */
export function isWorkEmail(email: string): boolean {
  const domain = getEmailDomain(email);
  if (!domain) return false;
  return !isFreeEmailDomain(domain);
}

export const WORK_EMAIL_ONLY_MESSAGE =
  'Please sign in with your work email — personal email accounts are not allowed.';
