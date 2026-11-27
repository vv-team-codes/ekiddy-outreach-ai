import dns from 'node:dns/promises';
import net from 'node:net';
import { BadRequestError } from './errors.js';

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function inCidrV4(ip: string, base: string, prefix: number): boolean {
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

export function isPrivateOrReservedIp(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (net.isIPv4(normalized)) {
    return (
      inCidrV4(normalized, '0.0.0.0', 8) ||
      inCidrV4(normalized, '10.0.0.0', 8) ||
      inCidrV4(normalized, '100.64.0.0', 10) ||
      inCidrV4(normalized, '127.0.0.0', 8) ||
      inCidrV4(normalized, '169.254.0.0', 16) ||
      inCidrV4(normalized, '172.16.0.0', 12) ||
      inCidrV4(normalized, '192.0.0.0', 24) ||
      inCidrV4(normalized, '192.0.2.0', 24) ||
      inCidrV4(normalized, '192.168.0.0', 16) ||
      inCidrV4(normalized, '198.18.0.0', 15) ||
      inCidrV4(normalized, '198.51.100.0', 24) ||
      inCidrV4(normalized, '203.0.113.0', 24) ||
      inCidrV4(normalized, '224.0.0.0', 4) ||
      inCidrV4(normalized, '240.0.0.0', 4)
    );
  }

  if (net.isIPv6(normalized)) {
    if (normalized === '::' || normalized === '::1') return true;
    if (normalized.startsWith('::ffff:')) {
      const v4 = normalized.slice('::ffff:'.length);
      if (net.isIPv4(v4)) return isPrivateOrReservedIp(v4);
    }
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    if (/^fe[89ab]/.test(normalized)) return true;
    if (normalized.startsWith('ff')) return true;
  }

  return false;
}

export async function validateSafePublicUrl(rawUrl: string): Promise<URL> {
  const trimmed = rawUrl.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new BadRequestError('Invalid website URL format');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestError('Only HTTP and HTTPS protocols are permitted');
  }

  if (parsed.username || parsed.password) {
    throw new BadRequestError('Embedded URL credentials are not permitted');
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.localhost')
  ) {
    throw new BadRequestError('Internal or local hostnames are blocked by SSRF policy');
  }

  if (net.isIP(host)) {
    if (isPrivateOrReservedIp(host)) {
      throw new BadRequestError('Private or reserved IP addresses are blocked by SSRF policy');
    }
    return parsed;
  }

  let records: { address: string; family: number }[];
  try {
    records = await dns.lookup(host, { all: true });
  } catch {
    throw new BadRequestError('Unable to resolve public DNS for the requested host');
  }

  if (!records || records.length === 0) {
    throw new BadRequestError('No DNS records found for the requested host');
  }

  for (const record of records) {
    if (isPrivateOrReservedIp(record.address)) {
      throw new BadRequestError('Target host resolved to a private or reserved IP address');
    }
  }

  return parsed;
}

export interface SafeFetchResult {
  finalUrl: string;
  status: number;
  contentType: string;
  body: string;
}

/**
 * Fetches a public web page safely with SSRF redirect validation, timeout, and body size limit.
 */
export async function safeFetchPublicHtml(
  rawUrl: string,
  options: { maxRedirects?: number; timeoutMs?: number; maxBytes?: number } = {}
): Promise<SafeFetchResult> {
  const maxRedirects = options.maxRedirects ?? 3;
  const timeoutMs = options.timeoutMs ?? 8000;
  const maxBytes = options.maxBytes ?? 1_500_000;

  let currentUrl = (await validateSafePublicUrl(rawUrl)).toString();

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'ekiddyOutreachResearchBot/1.0 (+https://app.ekiddy.com)',
          Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9'
        }
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          throw new BadRequestError('Redirect response missing Location header');
        }
        const nextUrl = new URL(location, currentUrl).toString();
        currentUrl = (await validateSafePublicUrl(nextUrl)).toString();
        continue;
      }

      const contentType = response.headers.get('content-type') || 'text/html';
      if (
        !contentType.includes('text/html') &&
        !contentType.includes('text/plain') &&
        !contentType.includes('application/xhtml+xml')
      ) {
        throw new BadRequestError('Unsupported content type for company research');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        return {
          finalUrl: currentUrl,
          status: response.status,
          contentType,
          body: ''
        };
      }

      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.byteLength;
          if (totalBytes > maxBytes) {
            chunks.push(value.subarray(0, value.byteLength - (totalBytes - maxBytes)));
            await reader.cancel();
            break;
          }
          chunks.push(value);
        }
      }

      const body = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
      return {
        finalUrl: currentUrl,
        status: response.status,
        contentType,
        body
      };
    } finally {
      clearTimeout(timer);
    }
  }

  throw new BadRequestError('Maximum HTTP redirects exceeded');
}
