import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { config } from '../config.js';

const scrypt = promisify(crypto.scrypt);

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url'); // 256 bits
export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const hmac = (s) => crypto.createHmac('sha256', config.SESSION_SECRET).update(s).digest('hex');

// Código curto digitável (Crockford base32, sem I/L/O/U): 10 caracteres ≈ 50 bits.
const ALPH = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function shortCode(len = 10) {
  const bytes = crypto.randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += ALPH[bytes[i] & 31];
  return s;
}
export function normalizeCode(input) {
  return String(input || '').toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
}
export const formatCode = (c) => `${c.slice(0, 5)}-${c.slice(5)}`;

export async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const N = 32768, r = 8, p = 1;
  const key = await scrypt(pw, salt, 64, { N, r, p, maxmem: 128 * N * r * 2 });
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${key.toString('base64')}`;
}
export async function verifyPassword(pw, stored) {
  const [alg, N, r, p, salt, hash] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await scrypt(pw, Buffer.from(salt, 'base64'), expected.length, { N: +N, r: +r, p: +p, maxmem: 128 * +N * +r * 2 });
  return crypto.timingSafeEqual(key, expected);
}

export function safeEqual(a, b) {
  const A = Buffer.from(String(a)); const B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

// Cifra para reexibir ao portador da sessão o token do próprio voucher (nunca em logs).
const encKey = () => crypto.createHash('sha256').update(`voucher-enc:${config.SESSION_SECRET}`).digest();
export function encrypt(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', encKey(), iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString('base64url')).join('.');
}
export function decrypt(s) {
  const [iv, tag, data] = s.split('.').map((x) => Buffer.from(x, 'base64url'));
  const d = crypto.createDecipheriv('aes-256-gcm', encKey(), iv);
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(data), d.final()]).toString('utf8'));
}
