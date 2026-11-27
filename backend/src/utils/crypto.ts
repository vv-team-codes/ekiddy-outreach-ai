import crypto from 'node:crypto';
import { env } from '../config/env.js';

function getAesKey(): Buffer {
  return crypto.createHash('sha256').update(env.encryptionKey).digest();
}

/**
 * Encrypts sensitive JSON credentials with AES-256-GCM.
 */
export function encryptObject(payload: Record<string, unknown>): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getAesKey(), iv);
  const plaintext = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts AES-256-GCM encrypted credentials back into an object.
 */
export function decryptObject<T extends Record<string, unknown> = Record<string, string>>(
  ciphertext: string
): T {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted credential payload format');
  }
  const [ivHex, tagHex, dataHex] = parts;
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getAesKey(),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final()
  ]);
  return JSON.parse(decrypted.toString('utf8')) as T;
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function generateRandomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function maskSecret(value: string | undefined): string {
  if (!value) return '';
  if (value.length <= 6) return '******';
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

export function verifyHmacSha256(rawPayload: string | Buffer, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');
  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

export function signHmacSha256(payload: string | Buffer, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}
