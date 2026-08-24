/**
 * The owner login. One credential, created when the site was scaffolded,
 * stored as `scrypt$N$salt$hash` in ADMIN_PASSWORD_HASH. Sessions are an
 * HMAC-signed, HttpOnly, SameSite=Lax cookie with a 12-hour expiry. No
 * native addon, no OAuth dependency, constant-time compares.
 */

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies, headers } from 'next/headers';

const COOKIE = 'sb_admin';
const TTL_MS = 12 * 60 * 60 * 1000;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error('SESSION_SECRET is missing or too short. It is written by Super Builds into .env.local.');
  return s;
}

export function verifyPassword(password: string, stored = process.env.ADMIN_PASSWORD_HASH ?? ''): boolean {
  // Colon-separated, never `$`: Next expands $VAR inside .env files, quotes or not.
  const [algo, nStr, saltB64, hashB64] = stored.trim().split(':');
  if (algo !== 'scrypt' || !nStr || !saltB64 || !hashB64) return false;
  try {
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    const actual = scryptSync(password, salt, expected.length, { N: Number(nStr), r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch { return false; }
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16); const N = 32768;
  return `scrypt:${N}:${salt.toString('base64')}:${scryptSync(password, salt, 64, { N, r: 8, p: 1, maxmem: 128 * 1024 * 1024 }).toString('base64')}`;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function makeSessionToken(email: string): string {
  const payload = Buffer.from(JSON.stringify({ e: email, x: Date.now() + TTL_MS, n: randomBytes(8).toString('hex') })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token: string | undefined): { email: string } | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { e: string; x: number };
    if (data.x < Date.now()) return null;
    return { email: data.e };
  } catch { return null; }
}

export async function currentAdmin(): Promise<{ email: string } | null> {
  const jar = await cookies();
  return readSessionToken(jar.get(COOKIE)?.value);
}

export async function setSessionCookie(email: string) {
  const jar = await cookies();
  jar.set(COOKIE, makeSessionToken(email), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: TTL_MS / 1000 });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
}

/** Mutations must be same-origin as well as authenticated. */
export async function sameOrigin(): Promise<boolean> {
  const h = await headers();
  const site = h.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return false;
  const origin = h.get('origin'); const host = h.get('host');
  if (origin && host && !origin.endsWith(`//${host}`)) return false;
  return true;
}

/**
 * The login, in the clear, while this site is still being built on somebody's
 * laptop.
 *
 * Super Builds writes ADMIN_DEV_PASSWORD beside the hash so it can show you
 * your own login instead of telling you to open a file in a text editor, and
 * strips the key before anything is pushed to a host. Two guards, because one
 * of them will eventually be wrong: the key has to exist, and NODE_ENV must not
 * be production. A built site that somehow still carries the key prefills
 * nothing.
 */
export function devLogin(): { email: string; password: string } | null {
  if (process.env.NODE_ENV === 'production') return null;
  const password = process.env.ADMIN_DEV_PASSWORD;
  if (!password) return null;
  return { email: process.env.ADMIN_EMAIL ?? '', password };
}
