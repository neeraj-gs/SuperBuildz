/**
 * Where Super Builds keeps its own state, and where it puts what it makes.
 *
 * `SUPERBUILDS_HOME` exists for tests, which must never write into live data —
 * PowerHouz learned that with twenty-one phantom runs in a real board.
 */

import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function superbuildsHome(): string {
  const dir = process.env.SUPERBUILDS_HOME ?? join(homedir(), '.superbuilds');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/** Where generated sites go unless the person picks somewhere else. */
export function sitesRoot(): string {
  const dir = process.env.SUPERBUILDS_SITES ?? join(homedir(), 'SuperBuilds');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/** The repository root, from wherever this file is being run. */
export function repoRoot(): string {
  return resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
}

export function templateRoot(): string {
  return join(repoRoot(), 'templates', 'site');
}

export function designLibraryRoot(): string {
  return join(repoRoot(), 'design-library');
}

export function uiDist(): string {
  return join(repoRoot(), 'ui', 'dist');
}
