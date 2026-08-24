/**
 * Reading a website somebody already has.
 *
 * ── Why a survey rather than "let Claude look at it" ────────────────────────
 *
 * Pointing an agent at a folder and asking "what is this?" burns twenty tool
 * calls rediscovering things a hundred lines of `readdir` know for certain: the
 * framework, the router, the routes, whether it is a git repository, whether
 * the working tree is clean. Those facts are cheap and exact here and expensive
 * and approximate there. So this file establishes everything that can be known
 * without a model, and the model is then asked the one question only it can
 * answer — what is this business, and what is this site trying to do.
 *
 * ── It is somebody's live website ───────────────────────────────────────────
 *
 * That is the whole difference from a new build, and every refusal below comes
 * from it. A folder that is not a web project is refused rather than
 * scaffolded over. A dirty working tree is reported before anything is touched.
 * `.env` files are never read into the survey — the whole point of a revamp is
 * that the data, the keys and the words are already theirs and stay theirs.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import type { Framework, SiteSurvey } from '@superbuilds/protocol';

export type { SiteSurvey };

const exec = promisify(execFile);

const SKIP = new Set(['node_modules', '.git', '.next', '.nuxt', 'dist', 'build', 'out', '.svelte-kit', '.astro', 'coverage', '.vercel', '.turbo', 'vendor']);
const PAGE_EXT = /\.(tsx|jsx|ts|js|astro|svelte|vue|html)$/i;
const IMAGE_EXT = /\.(png|jpe?g|webp|avif|gif|svg)$/i;

/**
 * Route prefixes that live behind a login.
 *
 * Not a security boundary — the site's own auth is that — but a design
 * boundary, and the one a redesign most needs. These pages get the new tokens
 * and keep their structure; nobody wants a full-bleed WebGL hero on the page
 * where they read their bookings.
 */
const PRIVATE = /^\/(admin|dashboard|account|portal|studio|cms|manage|app)(\/|$)/i;

function readJson(file: string): Record<string, unknown> | null {
  try { return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>; } catch { return null; }
}

function walk(root: string, onFile: (full: string, rel: string) => void, depth = 0) {
  if (depth > 7) return;
  let names: string[];
  try { names = readdirSync(root); } catch { return; }
  for (const name of names) {
    if (SKIP.has(name) || name.startsWith('.') && name !== '.') continue;
    const full = join(root, name);
    let st; try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full, onFile, depth + 1);
    else onFile(full, name);
  }
}

/** What kind of thing is this, and can the scene library be used as it stands? */
function detect(path: string, pkg: Record<string, unknown> | null): { framework: Framework; label: string; react: boolean } {
  const deps = { ...(pkg?.dependencies as object ?? {}), ...(pkg?.devDependencies as object ?? {}) } as Record<string, string>;
  const has = (name: string) => Object.prototype.hasOwnProperty.call(deps, name);
  const react = has('react');

  if (has('next')) return { framework: 'next', label: 'Next.js', react: true };
  if (has('@remix-run/react') || has('@remix-run/node')) return { framework: 'remix', label: 'Remix', react: true };
  if (has('nuxt')) return { framework: 'nuxt', label: 'Nuxt', react: false };
  if (has('@sveltejs/kit')) return { framework: 'sveltekit', label: 'SvelteKit', react: false };
  if (has('astro')) return { framework: 'astro', label: 'Astro', react };
  if (has('react-scripts')) return { framework: 'cra', label: 'Create React App', react: true };
  if (has('vite')) return { framework: 'vite', label: react ? 'Vite + React' : 'Vite', react };
  if (!pkg && existsSync(join(path, 'index.html'))) return { framework: 'static', label: 'A plain HTML site', react: false };
  return { framework: 'unknown', label: pkg ? 'A Node project' : 'Something else', react };
}

/** Turn a page file into the URL a visitor types. */
function routeOf(rel: string, framework: Framework): string | null {
  const p = rel.split(sep).join('/');

  if (framework === 'next') {
    let m = p.match(/^(?:src\/)?app\/(.*)page\.(tsx|jsx|ts|js)$/);
    if (m) {
      const segs = m[1].split('/').filter(Boolean)
        // Route groups are organisational and invisible to a visitor.
        .filter((s) => !(s.startsWith('(') && s.endsWith(')')));
      return '/' + segs.join('/');
    }
    m = p.match(/^(?:src\/)?pages\/(.*)\.(tsx|jsx|ts|js)$/);
    if (m && !m[1].startsWith('api/') && !m[1].startsWith('_')) {
      return '/' + m[1].replace(/\/?index$/, '');
    }
    return null;
  }

  if (framework === 'astro' || framework === 'sveltekit' || framework === 'nuxt') {
    const m = p.match(/^(?:src\/)?(?:pages|routes)\/(.*)\.(astro|svelte|vue|md)$/);
    if (!m) return null;
    return '/' + m[1].replace(/\/?(index|\+page)$/, '');
  }

  if (framework === 'static') {
    const m = p.match(/^(.*)\.html$/);
    return m ? '/' + m[1].replace(/\/?index$/, '') : null;
  }

  // Vite, CRA, Remix and anything else: a pages folder is the only reliable signal.
  const m = p.match(/^(?:src\/)?(?:pages|routes|views)\/(.*)\.(tsx|jsx|vue|svelte)$/);
  return m ? '/' + m[1].replace(/\/?index$/, '') : null;
}

/**
 * The site's own words.
 *
 * Not a parse — a sieve. Headings, sentences and anything that reads like copy
 * rather than code, capped hard. The model needs to know that this is a
 * wood-fired restaurant in Lisbon with six seats at the counter; it does not
 * need the import block.
 */
function copyFrom(files: Array<{ full: string; rel: string }>): string {
  const out: string[] = [];
  for (const f of files.slice(0, 14)) {
    let text: string;
    try { text = readFileSync(f.full, 'utf8'); } catch { continue; }
    if (text.length > 200_000) continue;
    const lines: string[] = [];

    for (const m of text.matchAll(/<h[1-3][^>]*>([\s\S]{2,300}?)<\/h[1-3]>/gi)) lines.push(strip(m[1]));
    for (const m of text.matchAll(/<(?:p|li|blockquote)[^>]*>([\s\S]{8,400}?)<\/(?:p|li|blockquote)>/gi)) lines.push(strip(m[1]));
    // JSX children and string props: the words most React sites keep inline.
    for (const m of text.matchAll(/>\s*([A-Z][^<>{}\n]{14,240}?)\s*</g)) lines.push(strip(m[1]));
    for (const m of text.matchAll(/(?:title|heading|headline|subtitle|description|label|blurb|tagline)\s*[:=]\s*["'`]([^"'`\n]{8,240})["'`]/gi)) lines.push(strip(m[1]));

    const kept = [...new Set(lines.map((l) => l.trim()).filter((l) => l.split(/\s+/).length >= 3 && !/^[{}<>/]/.test(l)))].slice(0, 18);
    if (kept.length) out.push(`--- ${f.rel} ---`, ...kept);
    if (out.join('\n').length > 12_000) break;
  }
  return out.join('\n').slice(0, 12_000);
}

function strip(s: string): string {
  return s.replace(/<[^>]*>/g, ' ').replace(/\{[^}]*\}/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

async function gitState(path: string): Promise<SiteSurvey['git']> {
  try {
    const { stdout: status } = await exec('git', ['status', '--porcelain'], { cwd: path, timeout: 20_000, maxBuffer: 8e6, windowsHide: true });
    const dirty = status.split('\n').filter((l) => l.trim()).length;
    let branch: string | undefined;
    try { branch = (await exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: path, timeout: 10_000, windowsHide: true })).stdout.trim(); } catch { /* no commits yet */ }
    return { repo: true, clean: dirty === 0, branch, dirty };
  } catch {
    return { repo: false, clean: false, dirty: 0 };
  }
}

export async function surveySite(input: string): Promise<SiteSurvey> {
  const blank: SiteSurvey = {
    path: input, ok: false, framework: 'unknown', frameworkLabel: 'Unknown', react: false,
    typescript: false, tailwind: false, routes: [], privateRoutes: [], routeFiles: [], images: 0, fileCount: 0,
    git: { repo: false, clean: false, dirty: 0 }, content: '', notes: [],
  };

  const path = input.trim();
  if (!path) return { ...blank, reason: 'Give a folder.' };
  let full: string;
  try { full = resolve(path); } catch { return { ...blank, reason: 'That is not a path.' }; }
  if (!existsSync(full)) return { ...blank, path: full, reason: 'There is no folder there.' };
  try { if (!statSync(full).isDirectory()) return { ...blank, path: full, reason: 'That is a file, not a folder.' }; }
  catch { return { ...blank, path: full, reason: 'That folder cannot be read.' }; }

  const pkg = readJson(join(full, 'package.json'));
  const { framework, label, react } = detect(full, pkg);
  if (framework === 'unknown' && !pkg) {
    return { ...blank, path: full, reason: 'That does not look like a website — no package.json and no index.html. Point at the folder the site itself lives in.' };
  }

  const pages: Array<{ full: string; rel: string }> = [];
  const routes: string[] = [];
  let images = 0;
  let fileCount = 0;
  walk(full, (file, name) => {
    fileCount++;
    if (IMAGE_EXT.test(name)) { images++; return; }
    if (!PAGE_EXT.test(name)) return;
    const rel = relative(full, file);
    const route = routeOf(rel, framework);
    if (route !== null && !routes.includes(route)) { routes.push(route); pages.push({ full: file, rel: rel.split(sep).join('/') }); }
  });

  // A single-page React app has no pages folder and one real route. Read the
  // entry file anyway: everything the site says is in it.
  if (!pages.length) {
    for (const candidate of ['src/App.tsx', 'src/App.jsx', 'src/main.tsx', 'index.html', 'app/page.tsx', 'src/app/page.tsx']) {
      const f = join(full, candidate);
      if (existsSync(f)) { pages.push({ full: f, rel: candidate }); if (!routes.length) routes.push('/'); break; }
    }
  }

  const scripts = (pkg?.scripts ?? {}) as Record<string, string>;
  const deps = { ...(pkg?.dependencies as object ?? {}), ...(pkg?.devDependencies as object ?? {}) } as Record<string, string>;
  const git = await gitState(full);

  const sorted = routes.sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)));
  const notes: string[] = [];
  if (!git.repo) notes.push('This folder is not a git repository. Super Builds will make one and commit what is there before it changes anything, so you can always get back.');
  else if (!git.clean) notes.push(`${git.dirty} file${git.dirty === 1 ? '' : 's'} ${git.dirty === 1 ? 'has' : 'have'} uncommitted changes. They will be committed on your current branch before the revamp starts, so nothing is lost.`);
  if (!react) notes.push(`The 3D scenes are written as React components and this is ${label}. The revamp still happens — it will be written in this project's own idiom — but the scene has to be ported rather than dropped in, which takes longer.`);
  if (!scripts.dev && !scripts.start) notes.push('There is no dev script, so the live preview may not start. Everything else works.');
  const publicCount = sorted.filter((r) => !PRIVATE.test(r)).length;
  if (publicCount > 24) notes.push(`${publicCount} public routes is a large site. Consider revamping the main pages first and the rest from the chat afterwards.`);
  const privateCount = sorted.length - publicCount;
  if (privateCount) notes.push(`${privateCount} page${privateCount === 1 ? '' : 's'} behind a login (${sorted.filter((r) => PRIVATE.test(r)).slice(0, 3).join(', ')}${privateCount > 3 ? ', …' : ''}). Those get the new colours and type; their layout and their data are left alone.`);

  return {
    path: full,
    ok: true,
    framework,
    frameworkLabel: label,
    react,
    packageName: typeof pkg?.name === 'string' ? pkg.name : undefined,
    devScript: scripts.dev ?? scripts.start,
    buildScript: scripts.build,
    typescript: existsSync(join(full, 'tsconfig.json')) || Object.prototype.hasOwnProperty.call(deps, 'typescript'),
    tailwind: Object.prototype.hasOwnProperty.call(deps, 'tailwindcss'),
    routes: sorted.filter((r) => !PRIVATE.test(r)).slice(0, 40),
    privateRoutes: sorted.filter((r) => PRIVATE.test(r)).slice(0, 40),
    routeFiles: pages.map((p) => p.rel).slice(0, 40),
    images,
    fileCount,
    git,
    content: copyFrom(pages),
    notes,
  };
}
