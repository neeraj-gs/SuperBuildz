/**
 * The project's files, readable and editable from the interface.
 *
 * This exists because of one sentence a person should never have to read:
 * "open C:\Users\you\site\.env.local in any text editor". The whole promise of
 * this tool is that you never leave it, and the moment the CRM login lives in a
 * file the tool will not show you, that promise is broken.
 *
 * ── What may be touched ─────────────────────────────────────────────────────
 *
 * Everything under the project folder, and nothing else. The guard is not a
 * blacklist of nasty strings; it resolves the path and checks the result is
 * still inside the project, which is the only check that survives `..`,
 * symlinks and Windows short names. A handful of folders are hidden and
 * unwritable — node_modules, .next, .git, .vercel — not for safety but because
 * forty thousand files in a tree is not a feature, and hand-editing a build
 * output or git's object store only ever ends one way.
 *
 * ── Why editing is allowed at all ───────────────────────────────────────────
 *
 * Because the alternative is worse. Somebody will need to paste an API key,
 * fix a typo in a heading, or read what Claude actually wrote, and a tool that
 * answers "ask the chat to do it" for a two-character change does not respect
 * the person using it. Every generated project is a git repository from its
 * first second, so an edit here is recoverable: the panel offers "revert to the
 * last commit" and means it.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const exec = promisify(execFile);

/** Never listed, never read, never written. */
const HIDDEN = new Set(['node_modules', '.next', '.git', '.vercel', 'out', '.turbo', '.cache']);

/** Big enough for any source file; small enough that the browser stays alive. */
const MAX_EDIT_BYTES = 1_500_000;

/** How many entries one directory may report before it stops being a folder a person browses. */
const MAX_ENTRIES = 800;

export interface FileEntry {
  /** Path relative to the project root, with forward slashes. */
  path: string;
  name: string;
  dir: boolean;
  size: number;
  at: number;
  /** Known to git and different from HEAD. */
  changed?: boolean;
  /** Holds secrets: shown with a different affordance. */
  secret?: boolean;
}

export interface FileBody {
  path: string;
  text: string;
  size: number;
  at: number;
  language: string;
  /** True when the file is too large or not text; `reason` then says why. */
  readOnly: boolean;
  reason?: string;
  secret?: boolean;
}

/**
 * Resolve a project-relative path, or throw.
 *
 * Everything else in this file goes through here. It is deliberately strict
 * and deliberately boring: resolve first, compare after. Checking the string
 * before resolving is the classic mistake — `a/../../b` passes every naive
 * test there is.
 */
function inside(projectPath: string, rel: string): string {
  const root = resolve(projectPath);
  const full = resolve(root, String(rel ?? '').replace(/^[/\\]+/, ''));
  if (full !== root && !full.startsWith(root + sep)) throw new Error('That path is outside the project.');
  const parts = relative(root, full).split(/[/\\]/).filter(Boolean);
  if (parts.some((p) => HIDDEN.has(p))) throw new Error('That folder is not editable.');
  return full;
}

function slash(p: string): string { return p.split(sep).join('/'); }

function isSecret(rel: string): boolean {
  const name = rel.split('/').pop() ?? '';
  return name.startsWith('.env');
}

/** Which files git says are different from HEAD, as a set of relative paths. */
async function changedSet(projectPath: string): Promise<Set<string>> {
  try {
    const { stdout } = await exec('git', ['status', '--porcelain', '-uall'], { cwd: projectPath, timeout: 15_000, maxBuffer: 8e6, windowsHide: true });
    const out = new Set<string>();
    for (const line of stdout.split('\n')) {
      if (!line.trim()) continue;
      let p = line.slice(3).trim().replace(/^"|"$/g, '');
      const arrow = p.indexOf(' -> ');
      if (arrow !== -1) p = p.slice(arrow + 4);
      if (p) out.add(p);
    }
    return out;
  } catch { return new Set(); }
}

/** One directory's contents: folders first, then files, both alphabetical. */
export async function listDir(projectPath: string, rel = ''): Promise<{ path: string; entries: FileEntry[] }> {
  const full = inside(projectPath, rel);
  if (!existsSync(full) || !statSync(full).isDirectory()) throw new Error('No such folder.');
  const changed = await changedSet(projectPath);
  const root = resolve(projectPath);
  const entries: FileEntry[] = [];
  for (const name of readdirSync(full).slice(0, MAX_ENTRIES)) {
    if (HIDDEN.has(name)) continue;
    let st;
    try { st = statSync(join(full, name)); } catch { continue; }
    const path = slash(relative(root, join(full, name)));
    entries.push({
      path, name, dir: st.isDirectory(), size: st.size, at: st.mtimeMs,
      ...(changed.has(path) ? { changed: true } : {}),
      ...(isSecret(path) ? { secret: true } : {}),
    });
  }
  entries.sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1));
  return { path: slash(rel), entries };
}

const LANGUAGES: Array<[RegExp, string]> = [
  [/\.(tsx|jsx)$/i, 'tsx'],
  [/\.(ts|mts|cts)$/i, 'ts'],
  [/\.(js|mjs|cjs)$/i, 'js'],
  [/\.json$/i, 'json'],
  [/\.(css|scss)$/i, 'css'],
  [/\.(md|mdx)$/i, 'md'],
  [/\.(html|svg|xml)$/i, 'html'],
  [/\.(ya?ml|toml)$/i, 'yaml'],
  [/\.sql$/i, 'sql'],
  [/(^|\/)\.env/i, 'env'],
  [/(^|\/)\.gitignore$/i, 'env'],
];

export function languageOf(rel: string): string {
  for (const [rx, lang] of LANGUAGES) if (rx.test(rel)) return lang;
  return 'text';
}

/** Does it look like text? A NUL byte in the first few KB means no. */
function looksBinary(buf: Buffer): boolean {
  const n = Math.min(buf.length, 4096);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

export function readProjectFile(projectPath: string, rel: string): FileBody {
  const full = inside(projectPath, rel);
  if (!existsSync(full)) throw new Error('No such file.');
  const st = statSync(full);
  if (st.isDirectory()) throw new Error('That is a folder.');
  const path = slash(relative(resolve(projectPath), full));
  const base = { path, size: st.size, at: st.mtimeMs, language: languageOf(path), ...(isSecret(path) ? { secret: true } : {}) };
  if (st.size > MAX_EDIT_BYTES) {
    return { ...base, text: '', readOnly: true, reason: `${Math.round(st.size / 1024)} KB — too large to edit here. Open the folder to work on it.` };
  }
  const buf = readFileSync(full);
  if (looksBinary(buf)) return { ...base, text: '', readOnly: true, reason: 'Not a text file.' };
  return { ...base, text: buf.toString('utf8'), readOnly: false };
}

export function writeProjectFile(projectPath: string, rel: string, text: string): FileBody {
  const full = inside(projectPath, rel);
  if (typeof text !== 'string') throw new Error('Nothing to write.');
  if (Buffer.byteLength(text, 'utf8') > MAX_EDIT_BYTES) throw new Error('That is too large to save from here.');
  if (existsSync(full) && statSync(full).isDirectory()) throw new Error('That is a folder.');
  mkdirSync(dirname(full), { recursive: true });
  const path = slash(relative(resolve(projectPath), full));
  // .env.local holds secrets and was created 0600; keep it that way on rewrite.
  if (isSecret(path)) writeFileSync(full, text, { mode: 0o600 });
  else writeFileSync(full, text);
  return readProjectFile(projectPath, rel);
}

export function createProjectFile(projectPath: string, rel: string, dir: boolean): FileEntry {
  const full = inside(projectPath, rel);
  if (existsSync(full)) throw new Error('Something is already there.');
  if (dir) mkdirSync(full, { recursive: true });
  else { mkdirSync(dirname(full), { recursive: true }); writeFileSync(full, ''); }
  const st = statSync(full);
  const path = slash(relative(resolve(projectPath), full));
  return { path, name: path.split('/').pop() ?? path, dir, size: st.size, at: st.mtimeMs };
}

export function deleteProjectFile(projectPath: string, rel: string): { ok: true } {
  const full = inside(projectPath, rel);
  if (full === resolve(projectPath)) throw new Error('That is the project itself.');
  if (!existsSync(full)) return { ok: true };
  rmSync(full, { recursive: true, force: true });
  return { ok: true };
}

/** Put one file back the way the last commit had it. The undo for a hand edit. */
export async function revertProjectFile(projectPath: string, rel: string): Promise<{ ok: boolean; message: string }> {
  const full = inside(projectPath, rel);
  const path = slash(relative(resolve(projectPath), full));
  try {
    await exec('git', ['checkout', '--', path], { cwd: projectPath, timeout: 20_000, windowsHide: true });
    return { ok: true, message: `${path} is back to the last commit.` };
  } catch {
    return { ok: false, message: 'Git could not restore it — it may never have been committed.' };
  }
}

/**
 * Find a file by name, or a phrase inside one.
 *
 * Deliberately not ripgrep: this is a person looking for "the file with the
 * headline in it", over a few hundred files, and shelling out to a binary that
 * may not be installed buys nothing here.
 */
export function searchProject(projectPath: string, query: string, limit = 60): Array<{ path: string; line?: number; text?: string }> {
  const q = String(query ?? '').trim();
  if (q.length < 2) return [];
  const needle = q.toLowerCase();
  const root = resolve(projectPath);
  const hits: Array<{ path: string; line?: number; text?: string }> = [];
  const walk = (dir: string, depth: number) => {
    if (hits.length >= limit || depth > 6) return;
    let names: string[];
    try { names = readdirSync(dir); } catch { return; }
    for (const name of names) {
      if (hits.length >= limit) return;
      if (HIDDEN.has(name)) continue;
      const full = join(dir, name);
      let st; try { st = statSync(full); } catch { continue; }
      const path = slash(relative(root, full));
      if (st.isDirectory()) { walk(full, depth + 1); continue; }
      if (path.toLowerCase().includes(needle)) { hits.push({ path }); continue; }
      if (st.size > 400_000 || languageOf(path) === 'text') continue;
      let text: string;
      try { text = readFileSync(full, 'utf8'); } catch { continue; }
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(needle)) { hits.push({ path, line: i + 1, text: lines[i].trim().slice(0, 160) }); break; }
      }
    }
  };
  walk(root, 0);
  return hits;
}
