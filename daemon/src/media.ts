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

import { readdirSync, statSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join, extname, basename, resolve } from 'node:path';

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
