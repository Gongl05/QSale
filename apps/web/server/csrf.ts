import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// This reads only a binding identifier. The upstream API still verifies the JWT and session.
export function sessionIdentity(token: unknown): string {
  if (typeof token !== 'string' || !token) return '';
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8'));
    if (typeof payload.sid === 'string' && payload.sid.length <= 100) return 'session:' + payload.sid;
  } catch { /* Invalid credentials are rejected by the API. */ }
  return 'opaque:' + createHash('sha256').update(token).digest('hex');
}

function signature(secret: string, nonce: string, session: string) {
  const binding = createHash('sha256').update(session).digest('hex');
  return createHmac('sha256', secret).update(binding + ':' + nonce).digest('hex');
}
export function equalTokens(left: unknown, right: unknown): boolean {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length > 256 || right.length > 256) return false;
  const a = Buffer.from(left), b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function validCsrf(secret: string, value: unknown, session: string): value is string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(value)) return false;
  const [nonce, mac] = value.split('.');
  return equalTokens(mac, signature(secret, nonce!, session));
}
export function issueCsrf(secret: string, session: string): string {
  const nonce = randomBytes(32).toString('hex');
  return nonce + '.' + signature(secret, nonce, session);
}
