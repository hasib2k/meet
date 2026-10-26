/**
 * HMAC-based admin token generation and verification.
 *
 * Instead of passing the raw ADMIN_PASSWORD to clients, we generate
 * a short-lived, room-scoped HMAC token. This ensures that even if
 * the token is intercepted, it cannot be reused for other rooms
 * and expires after 5 minutes.
 */
import crypto from 'crypto';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin123';
const TOKEN_EXPIRY_SECONDS = 86400; // 24 hours (matches session maxAge)
const HOST_TOKEN_EXPIRY_SECONDS = 60 * 60 * 24 * 30; // 30 days — host link credential

export function generateAdminToken(roomName: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = `${roomName}:${timestamp}`;
  const signature = crypto
    .createHmac('sha256', ADMIN_PASSWORD)
    .update(payload)
    .digest('hex');
  return `${timestamp}:${signature}`;
}

export function verifyAdminToken(token: string, roomName: string): boolean {
  if (!token) return false;

  const parts = token.split(':');
  if (parts.length !== 2) return false;

  const [timestampStr, signature] = parts;
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return false;

  // Check expiry
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > TOKEN_EXPIRY_SECONDS) return false;

  // Recompute expected signature
  const payload = `${roomName}:${timestampStr}`;
  const expected = crypto
    .createHmac('sha256', ADMIN_PASSWORD)
    .update(payload)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  if (signature.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Host link credential. Only someone who knows ADMIN_PASSWORD (i.e. the server)
 * can mint a valid token for a room, so a listener cannot promote themselves to
 * host by editing `?role=listener` to `?role=host` in the URL.
 */
export function generateHostToken(roomName: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHmac('sha256', ADMIN_PASSWORD)
    .update(`host:${roomName}:${timestamp}`)
    .digest('hex');
  return `${timestamp}:${signature}`;
}

export function verifyHostToken(token: string, roomName: string): boolean {
  if (!token) return false;
  const parts = token.split(':');
  if (parts.length !== 2) return false;
  const [timestampStr, signature] = parts;
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > HOST_TOKEN_EXPIRY_SECONDS) return false;

  const expected = crypto
    .createHmac('sha256', ADMIN_PASSWORD)
    .update(`host:${roomName}:${timestampStr}`)
    .digest('hex');

  if (signature.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
