/**
 * Output sanitisation for user-supplied, crawled and AI-generated text.
 *
 * The API stores and returns plain text only — emails are sent as plain
 * text (no HTML mail), and the frontend renders stored text as text, never
 * as HTML. This module is defence in depth at the storage boundary: any
 * markup smuggled in through a crawled page, an AI reply, an inbound email
 * or a form field is stripped before it is stored, rendered or emailed, so
 * payloads such as `<script>alert(1)</script>`, `<img onerror=...>`,
 * `<svg onload=...>` or `javascript:` URLs can never survive as live markup.
 *
 * Nothing here is a substitute for the frontend never using
 * dangerouslySetInnerHTML (already audited: zero uses).
 */

/** Remove every HTML/XML tag, including <script>, <style>, <svg> and event-handler attributes. */
export function stripHtml(value: string): string {
  let out = String(value ?? '');
  // Remove script/style blocks with their contents first, then all tags.
  out = out.replace(/<(script|style|iframe|object|embed|form)[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  out = out.replace(/<[^>]*>/g, '');
  // Decode the common entities an attacker could use to re-form a tag.
  out = out
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;|&#39;/gi, "'");
  // If decoding re-formed a tag, strip again.
  out = out.replace(/<[^>]*>/g, '');
  return out;
}

/** Plain-text sanitiser: strip markup, drop dangerous URL schemes, strip control chars, cap length. */
export function sanitizeText(value: unknown, maxLength = 10000): string {
  if (value === null || value === undefined) return '';
  let out = stripHtml(String(value));
  // Neutralise dangerous URL schemes that could survive as a link href.
  out = out.replace(/(javascript|data|vbscript)\s*:/gi, '');
  // Strip control characters (keep tab / newline / carriage return).
  out = out.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  out = out.trim();
  if (out.length > maxLength) out = out.slice(0, maxLength);
  return out;
}

/** Like sanitizeText but keeps internal newlines/paragraph breaks for email bodies. */
export function sanitizeMultilineText(value: unknown, maxLength = 10000): string {
  if (value === null || value === undefined) return '';
  let out = stripHtml(String(value));
  out = out.replace(/(javascript|data|vbscript)\s*:/gi, '');
  out = out.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  // Collapse 3+ blank lines; trim leading/trailing whitespace.
  out = out.replace(/\n{3,}/g, '\n\n').trim();
  if (out.length > maxLength) out = out.slice(0, maxLength);
  return out;
}

/** True only for http(s) URLs — rejects javascript:, data:, vbscript: and relatives. */
export function isSafeHttpUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Escape a user string before it is used as a MongoDB $regex pattern. */
export function escapeRegExp(value: string): string {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Recursively sanitise every string in an AI/crawled JSON payload (objects,
 * arrays, nested values). Used on structured AI output before it is stored
 * or returned, so a model echoing attacker markup from crawled pages cannot
 * persist it.
 */
export function sanitizeAiValue<T>(value: T, maxStringLength = 8000): T {
  if (typeof value === 'string') return sanitizeText(value, maxStringLength) as T;
  if (Array.isArray(value)) return value.map((v) => sanitizeAiValue(v, maxStringLength)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeAiValue(v, maxStringLength);
    }
    return out as T;
  }
  return value;
}
