/**
 * The CRM login, shown rather than lost.
 *
 * ── The bug this fixes is a design bug ──────────────────────────────────────
 *
 * The site stored a one-way hash of the owner's password and Super Builds
 * printed the plaintext once, as a note on a build stage, and then forgot it.
 * That is textbook correct and it is the wrong product. The person scrolled
 * past the note, came back a day later, pressed CRM, and there was no way back
 * in — not through the chat, which is not allowed to read env files, and not
 * through the tool, which did not have a file browser. The only remaining
 * answer was "open a text editor", which is the sentence this whole product
 * exists to avoid.
 *
 * ── The trade, stated plainly ───────────────────────────────────────────────
 *
 * While a site is being built on this machine, the plaintext lives beside the
 * hash in `.env.local` as ADMIN_DEV_PASSWORD. That file is 0600, is in
 * .gitignore from the first commit, and never leaves the machine — the deploy
 * step strips this one key before pushing anything to Vercel, so what runs in
 * production has the hash and nothing else.
 *
 * It is a real reduction in secrecy and it is worth it: the attacker who can
 * read a 0600 file in your home directory can already read the site's session
 * secret, its database and its source. There is no threat this key opens that
 * those do not. The person who cannot log in to their own CRM, meanwhile, is
 * not hypothetical — it already happened.
 *
 * "Forget it" removes the line and leaves the hash. Everything still works;
 * only the tool's ability to remind you goes away.
 */

import { randomBytes, scryptSync } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { envEntries, setEnvValue } from './env.ts';

/** The one key that must never reach a deploy. */
export const DEV_PASSWORD_KEY = 'ADMIN_DEV_PASSWORD';

export interface AdminLogin {
  email: string;
  /** Present only while the plaintext is still kept on this machine. */
  password?: string;
  /** A hash exists, so the login works even when the plaintext has been forgotten. */
  configured: boolean;
  /** Where the CRM lives, relative to the site. */
  path: string;
}

/**
 * Colon-separated, never `$`. Next.js expands `$VAR` inside .env files whether
 * or not the value is quoted, and a scrypt hash full of dollars came out the
 * other side as nonsense. `scaffold.ts` says the same thing at the same length,
 * because this is the kind of detail that gets "tidied" back into a bug.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const N = 32768;
  const hash = scryptSync(password, salt, 64, { N, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
  return `scrypt:${N}:${salt.toString('base64')}:${hash.toString('base64')}`;
}

/**
 * Readable, sayable over the phone, and still 60-odd bits.
 *
 * A password nobody can read is a password somebody writes on paper. These are
 * meant to be looked at once and pasted, so ambiguous glyphs are out.
 */
export function makePassword(): string {
  const words = ['amber', 'basalt', 'cedar', 'delta', 'ember', 'flint', 'gable', 'harbour', 'indigo', 'juniper', 'kiln', 'linen', 'marble', 'nectar', 'oak', 'pewter', 'quarry', 'rowan', 'slate', 'thistle', 'umber', 'vellum', 'walnut', 'yarrow'];
  const pick = () => words[randomBytes(1)[0] % words.length];
  const digits = String(100 + (randomBytes(2).readUInt16BE(0) % 900));
  return `${pick()}-${pick()}-${digits}`;
}

export function adminLogin(projectPath: string): AdminLogin {
  const env = new Map(envEntries(projectPath).map((e) => [e.key, e.value]));
  return {
    email: env.get('ADMIN_EMAIL') ?? '',
    password: env.get(DEV_PASSWORD_KEY) || undefined,
    configured: !!env.get('ADMIN_PASSWORD_HASH'),
    path: '/admin',
  };
}

/**
 * Set a new password and hand back the plaintext, once.
 *
 * Given nothing, it invents one. Given something, it checks it is long enough
 * to be worth having — this is the owner login for a live CRM, and "1234" is
 * not a preference, it is a mistake somebody will regret in public.
 */
export function setAdminPassword(projectPath: string, password?: string): { email: string; password: string } {
  const chosen = (password ?? '').trim() || makePassword();
  if (chosen.length < 8) throw new Error('At least eight characters, please. This is the login to your own customer data.');
  if (chosen.length > 200) throw new Error('That is longer than any login needs to be.');
  if (!setEnvValue(projectPath, 'ADMIN_PASSWORD_HASH', hashPassword(chosen))) throw new Error('Could not write the login.');
  setEnvValue(projectPath, DEV_PASSWORD_KEY, chosen);
  return { email: adminLogin(projectPath).email, password: chosen };
}

export function setAdminEmail(projectPath: string, email: string): AdminLogin {
  const value = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) throw new Error('That does not look like an email address.');
  setEnvValue(projectPath, 'ADMIN_EMAIL', value);
  return adminLogin(projectPath);
}

/** Drop the plaintext and keep the hash. The login still works; the reminder stops. */
export function forgetDevPassword(projectPath: string): AdminLogin {
  const file = join(projectPath, '.env.local');
  if (existsSync(file)) {
    const kept = readFileSync(file, 'utf8')
      .split('\n')
      .filter((l) => !new RegExp(`^\\s*#?\\s*${DEV_PASSWORD_KEY}\\s*=`).test(l));
    writeFileSync(file, kept.join('\n').replace(/\n*$/, '\n'), { mode: 0o600 });
  }
  return adminLogin(projectPath);
}
