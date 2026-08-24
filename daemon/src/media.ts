/**
 * Bringing somebody's photographs into their project.
 *
 * They point at a folder on their own machine; its usable images are copied
 * into `public/media/` and listed in the README so the build knows what it
 * has. Nothing is uploaded anywhere — the file never leaves the laptop, which
 * is the same promise the rest of Super Builds makes.
 *
 * Copying rather than referencing is deliberate. A generated site is an
 * ordinary Next.js project the person owns; a project that breaks because
 * somebody tidied their Pictures folder is not one they own in any useful
 * sense.
 */

import { readdirSync, statSync, mkdirSync, copyFileSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join, extname, basename, resolve, sep } from 'node:path';
import { superbuildsHome } from './paths.ts';

/** Only what `next/image` and a `<video>` can actually use. */
const ALLOWED = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.svg', '.mp4', '.webm']);
const MAX_FILES = 60;
const MAX_BYTES = 25 * 1024 * 1024;

export interface MediaCheck {
  ok: boolean;
  /** How many files would be copied. */
  count: number;
  /** A few names, so the person can see it found the right folder. */
  sample: string[];
  totalBytes: number;
  reason?: string;
}

export function checkMediaFolder(input: string): MediaCheck {
  const empty: MediaCheck = { ok: false, count: 0, sample: [], totalBytes: 0 };
  const path = input.trim();
  if (!path) return { ...empty, reason: 'Give a folder.' };

  let full: string;
  try { full = resolve(path); } catch { return { ...empty, reason: 'That is not a path.' }; }
  if (!existsSync(full)) return { ...empty, reason: 'There is no folder there.' };
  try {
    if (!statSync(full).isDirectory()) return { ...empty, reason: 'That is a file, not a folder.' };
  } catch { return { ...empty, reason: 'That folder cannot be read.' }; }

  const found = usableFiles(full);
  if (!found.length) {
    return { ...empty, reason: 'No images or video in there. JPEG, PNG, WebP, AVIF, SVG, MP4 and WebM.' };
  }
  const totalBytes = found.reduce((n, f) => n + f.size, 0);
  if (totalBytes > MAX_BYTES) {
    return {
      ok: false, count: found.length, sample: found.slice(0, 4).map((f) => f.name), totalBytes,
      reason: `That is ${(totalBytes / 1024 / 1024).toFixed(0)}MB. Keep it under 25MB — a site that ships 200MB of photographs is a slow site.`,
    };
  }
  return { ok: true, count: found.length, sample: found.slice(0, 6).map((f) => f.name), totalBytes };
}

function usableFiles(dir: string) {
  const out: Array<{ name: string; full: string; size: number }> = [];
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (name.startsWith('.')) continue;
    if (!ALLOWED.has(extname(name).toLowerCase())) continue;
    const full = join(dir, name);
    try {
      const st = statSync(full);
      // One level only: a nested tree usually means somebody pointed at their
      // whole Pictures library, and quietly copying all of it is not helpful.
      if (!st.isFile()) continue;
      out.push({ name, full, size: st.size });
    } catch { /* unreadable, skip */ }
    if (out.length >= MAX_FILES) break;
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Copy into `public/media/`. Returns the web paths, for the README. */
export function copyMedia(sourceFolder: string, projectPath: string): string[] {
  const check = checkMediaFolder(sourceFolder);
  if (!check.ok) return [];
  const dest = join(projectPath, 'public', 'media');
  mkdirSync(dest, { recursive: true });
  const paths: string[] = [];
  for (const f of usableFiles(resolve(sourceFolder))) {
    // Web-safe, lowercase, no spaces — these end up in markup.
    const safe = basename(f.name).toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/-+/g, '-');
    try { copyFileSync(f.full, join(dest, safe)); paths.push(`/media/${safe}`); }
    catch { /* one unreadable file should not fail the scaffold */ }
  }
  return paths;
}

/* ---------------------------------------------------------------------------
   Pictures that are not already in a folder
--------------------------------------------------------------------------- */

/**
 * Three ways to have photographs, and the wizard used to know only one.
 *
 * "Point at a folder" is right for somebody with a Pictures directory full of
 * their own shots, and useless for somebody holding a phone, or looking at a
 * Google Drive link, or with the four images they already use on Instagram.
 * Both of the other two land in the same place: a staging folder under
 * ~/.superbuilds/uploads that the scaffold copies from exactly as if it had
 * been pointed at. One code path afterwards, three ways in.
 *
 * Nothing here is uploaded anywhere. A drop lands on this daemon on loopback;
 * a fetched URL is fetched by this daemon, from this machine, and written to
 * this disk.
 */

const MAX_ONE_FILE = 20 * 1024 * 1024;

export function uploadsRoot(): string {
  const dir = join(superbuildsHome(), 'uploads');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** A staging folder for one wizard session. Handed back so the spec can name it. */
export function newUploadFolder(): string {
  const dir = join(uploadsRoot(), randomUUID().slice(0, 8));
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** The folder must be one of ours, or this is a write-anywhere endpoint. */
function ourUploadFolder(folder: string): string {
  const full = resolve(folder);
  const root = resolve(uploadsRoot());
  if (!full.startsWith(root + sep) && full !== root) throw new Error('That is not an upload folder.');
  if (!existsSync(full)) mkdirSync(full, { recursive: true });
  return full;
}

/** A filename that is safe in a URL, in markup and on every filesystem. */
function safeName(name: string): string {
  const base = basename(name).toLowerCase().replace(/[^a-z0-9.-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return base || `image${Date.now()}`;
}

/** Write one dropped file into a staging folder. `data` is base64, without a data: prefix. */
export function saveUpload(folder: string, name: string, data: string): { name: string; size: number } {
  const dir = ourUploadFolder(folder);
  const ext = extname(name).toLowerCase();
  if (!ALLOWED.has(ext)) throw new Error(`${ext || 'That'} is not a kind of picture a website can use.`);
  const buf = Buffer.from(data, 'base64');
  if (!buf.length) throw new Error('That file came through empty.');
  if (buf.length > MAX_ONE_FILE) throw new Error(`${(buf.length / 1024 / 1024).toFixed(0)}MB is too big for one image. Keep each under 20MB.`);
  if (usableFiles(dir).length >= MAX_FILES) throw new Error(`${MAX_FILES} files is plenty. A site that ships more is a slow site.`);
  const safe = safeName(name);
  writeFileSync(join(dir, safe), buf);
  return { name: safe, size: buf.length };
}

export function removeUpload(folder: string, name: string): { ok: true } {
  const dir = ourUploadFolder(folder);
  const safe = safeName(name);
  try { rmSync(join(dir, safe), { force: true }); } catch { /* already gone */ }
  return { ok: true };
}

/**
 * Fetch pictures the person linked to.
 *
 * Only http and https, only the extensions a site can use, only into a folder
 * of ours, and never to a private address — a URL field that will fetch
 * `http://169.254.169.254/` on request is a server-side request forgery, and it
 * does not stop being one because the server is a laptop.
 */
export async function fetchImages(folder: string, urls: string[]): Promise<Array<{ url: string; name?: string; error?: string }>> {
  const dir = ourUploadFolder(folder);
  const out: Array<{ url: string; name?: string; error?: string }> = [];
  for (const raw of urls.slice(0, MAX_FILES)) {
    let parsed: URL;
    try { parsed = new URL(raw); } catch { out.push({ url: raw, error: 'That is not a web address.' }); continue; }
    if (!/^https?:$/.test(parsed.protocol)) { out.push({ url: raw, error: 'Only http and https.' }); continue; }
    if (isPrivateHost(parsed.hostname)) { out.push({ url: raw, error: 'That address is on your own network.' }); continue; }

    const ext = extname(parsed.pathname).toLowerCase();
    if (!ALLOWED.has(ext)) { out.push({ url: raw, error: 'That link does not end in an image.' }); continue; }

    try {
      const res = await fetch(parsed, { redirect: 'follow', signal: AbortSignal.timeout(20_000) });
      if (!res.ok) { out.push({ url: raw, error: `The site answered ${res.status}.` }); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length) { out.push({ url: raw, error: 'Nothing came back.' }); continue; }
      if (buf.length > MAX_ONE_FILE) { out.push({ url: raw, error: 'That image is over 20MB.' }); continue; }
      const name = safeName(basename(parsed.pathname));
      writeFileSync(join(dir, name), buf);
      out.push({ url: raw, name });
    } catch (err) {
      out.push({ url: raw, error: (err as Error).name === 'TimeoutError' ? 'It took too long.' : 'It could not be fetched.' });
    }
  }
  return out;
}

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h === '::1' || h.endsWith('.local') || h.endsWith('.internal')) return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/** What is in a staging folder now, for the wizard to show back. */
export function listUploads(folder: string): Array<{ name: string; size: number }> {
  const dir = ourUploadFolder(folder);
  return usableFiles(dir).map((f) => ({ name: f.name, size: f.size }));
}
