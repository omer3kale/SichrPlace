import crypto from 'crypto';

/**
 * Create a SHA-256 hash of a token for safe storage.
 * Returns a lowercase hex string.
 */
export function hashToken(token) {
  if (!token || typeof token !== 'string') return '';
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Constant-time equality check for two hex strings.
 */
export function safeEqualHex(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}
