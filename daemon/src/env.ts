/**
 * `.env.local`, read and written in one place.
 *
 * Both the deploy (which pushes these to a host) and the CRM panel (which
 * reads the owner login out of them) need this, and having them import each
 * other to get it was a cycle waiting to bite. One small module, no cycle.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Keys in .env.local, names only. Values never leave the daemon. */
export function envEntries(projectPath: string): Array<{ key: string; value: string }> {
  const file = join(projectPath, '.env.local');
  if (!existsSync(file)) return [];
  const out: Array<{ key: string; value: string }> = [];
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (key) out.push({ key, value });
  }
  return out;
}

/** Set or replace one key in .env.local. The value passes through memory and is not kept. */
export function setEnvValue(projectPath: string, key: string, value: string): boolean {
  if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(key)) return false;
  const file = join(projectPath, '.env.local');
  const lines = existsSync(file) ? readFileSync(file, 'utf8').split('\n') : [];
  const quoted = /[\s#"']/.test(value) ? JSON.stringify(value) : value;
  let done = false;
  const next = lines.map((l) => {
    const m = l.match(/^#?\s*([A-Z][A-Z0-9_]*)=/);
    if (m && m[1] === key && !done) { done = true; return `${key}=${quoted}`; }
    return l;
  });
  if (!done) next.push(`${key}=${quoted}`);
  writeFileSync(file, next.join('\n').replace(/\n*$/, '\n'), { mode: 0o600 });
  return true;
}
