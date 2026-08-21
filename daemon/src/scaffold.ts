/**
 * Stage 0: the template becomes a project.
 *
 * Copies `templates/site`, writes the parts that depend on the choices —
 * `design.config.ts`, `app/fonts.ts`, `.env.local`, `BRIEF.md`, the scene
 * components, the skills — creates the owner login, initialises git, installs
 * dependencies. Everything Claude then does is design on top of something
 * that already runs.
 */

import { randomBytes, scryptSync } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Spec } from '@superbuilds/protocol';
import { templateRoot, designLibraryRoot } from './paths.ts';
import { PALETTES, sceneFor } from './catalogue/index.ts';
import { TYPE_DIRECTION, masterBrief, sceneComponent } from './brief.ts';
import { spawnBin, execPlain } from './binaries.ts';

const SKIP = new Set(['node_modules', '.next', 'data', '.env.local', 'shots', '.git']);

function copyTree(from: string, to: string) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const src = join(from, entry.name);
    const dst = join(to, entry.name);
    if (entry.isDirectory()) copyTree(src, dst);
    else cpSync(src, dst);
  }
}

/**
 * `scrypt:N:salt:hash`, the same shape templates/site/lib/auth.ts verifies.
 * Colons, never `$`: Next expands `$VAR` inside .env files, quoted or not,
 * and a hash full of `$` came out as `scrypt==+q08pEQ=`.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const N = 32768;
  const hash = scryptSync(password, salt, 64, { N, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });
  return `scrypt:${N}:${salt.toString('base64')}:${hash.toString('base64')}`;
}

function makePassword(): string {
  // Four words-ish chunks: readable over the phone, 60+ bits.
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const chunk = () => Array.from(randomBytes(5), (b) => alphabet[b % alphabet.length]).join('');
  return `${chunk()}-${chunk()}-${chunk()}`;
}

/** `design.config.ts`, written from the spec so every component reads the choices. */
export function designConfigSource(spec: Spec): string {
  const palette = PALETTES.find((p) => p.id === spec.palette) ?? PALETTES[0];
  const [bg, fg, accent, muted, surface] = palette.swatch ?? ['#0A0B0D', '#EDE9E0', '#C8FF3D', '#6C6F78', '#15171B'];
  const type = TYPE_DIRECTION[spec.typography] ?? TYPE_DIRECTION.grotesk;
  const light = isLight(bg);
  // A second theme derived honestly: swap ground and ink, keep the accent.
  const alt = { bg: fg, fg: bg, surface: light ? '#15171B' : '#F3F1EC', muted };
  const scene = sceneFor(spec.scene);
  return `/**
 * design.config.ts — the single source of truth for how this site looks and moves.
 *
 * Written by Super Builds from what was chosen. Change values here, not in
 * components: every colour, face, radius and duration is read from this file
 * and exposed as CSS variables by lib/tokens.ts. The CRM at /admin reads the
 * same tokens, which is how it stays in the site's identity.
 */

export const design = {
  name: ${JSON.stringify(spec.name)},
  archetype: ${JSON.stringify(spec.archetype)},
  theme: ${JSON.stringify(spec.theme)} as 'dark' | 'light' | 'both',
  palette: {
    id: ${JSON.stringify(palette.id)},
    /** The chosen theme's colours. */
    bg: ${JSON.stringify(bg)},
    fg: ${JSON.stringify(fg)},
    accent: ${JSON.stringify(accent)},
    muted: ${JSON.stringify(muted)},
    surface: ${JSON.stringify(surface)},
    /** The other theme, for a switch. */
    alt: { bg: ${JSON.stringify(alt.bg)}, fg: ${JSON.stringify(alt.fg)}, accent: ${JSON.stringify(accent)}, muted: ${JSON.stringify(alt.muted)}, surface: ${JSON.stringify(alt.surface)} },
  },
  type: {
    id: ${JSON.stringify(spec.typography)},
    display: ${JSON.stringify(type.display)},
    body: ${JSON.stringify(type.body)},
    mono: ${JSON.stringify(type.mono ?? 'JetBrains Mono')},
    /** Display size as a clamp; tweak the middle term to taste. */
    displaySize: 'clamp(3rem, 9vw, 9.5rem)',
    displayTracking: '-0.035em',
    displayLeading: '0.92',
    bodySize: '1.0625rem',
    bodyLeading: '1.65',
    measure: '66ch',
  },
  shape: {
    radius: ${JSON.stringify(radiusFor(spec.atmosphere))},
    radiusLg: ${JSON.stringify(radiusLgFor(spec.atmosphere))},
    hairline: '1px',
  },
  space: {
    /** Section padding, vertical. */
    section: 'clamp(5rem, 14vh, 11rem)',
    gutter: 'clamp(1rem, 3vw, 2.5rem)',
  },
  motion: {
    intensity: ${JSON.stringify(spec.motionIntensity)},
    scroll: ${JSON.stringify(spec.scrollStyle)},
    hover: ${JSON.stringify(spec.hoverStyle)},
    cursor: ${JSON.stringify(spec.cursorStyle)},
    transition: ${JSON.stringify(spec.transition)},
    /** The gesture. Name it, then use only these. */
    gesture: 'rise-and-settle',
    easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
    easeInOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
    fast: 160,
    base: ${spec.motionIntensity === 'calm' ? 420 : spec.motionIntensity === 'cinematic' ? 760 : 560},
    slow: ${spec.motionIntensity === 'calm' ? 700 : spec.motionIntensity === 'cinematic' ? 1200 : 900},
    stagger: 60,
    rise: ${spec.motionIntensity === 'calm' ? 10 : 24},
  },
  scene: {
    id: ${JSON.stringify(scene.id)},
    component: ${JSON.stringify(sceneComponent(scene.id))},
    weight: ${JSON.stringify(scene.weight ?? 'medium')},
  },
  layout: ${JSON.stringify(spec.layout)},
  atmosphere: ${JSON.stringify(spec.atmosphere)},
};

export type Design = typeof design;
`;
}

function isLight(hex: string): boolean {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 140;
}
function radiusFor(atmos: string) { return ['calm', 'warm-direct', 'appetite'].includes(atmos) ? '14px' : ['technical', 'futurist', 'plain-confident', 'bold-editorial'].includes(atmos) ? '2px' : '8px'; }
function radiusLgFor(atmos: string) { return ['calm', 'warm-direct', 'appetite'].includes(atmos) ? '28px' : ['technical', 'futurist', 'plain-confident', 'bold-editorial'].includes(atmos) ? '4px' : '16px'; }

/** `app/fonts.ts` — next/font/google needs static imports, so they are written per project. */
export function fontsSource(spec: Spec): string {
  const type = TYPE_DIRECTION[spec.typography] ?? TYPE_DIRECTION.grotesk;
  const ident = (name: string) => name.replace(/[^A-Za-z0-9]/g, '_');
  const faces = [...new Set([type.display, type.body, type.mono ?? 'JetBrains Mono'])];
  const imports = faces.map(ident).join(', ');
  const decls = faces.map((f) => `const ${ident(f).toLowerCase()}Font = ${ident(f)}({ subsets: ['latin'], display: 'swap', variable: '--font-${ident(f).toLowerCase()}' });`).join('\n');
  return `/** Written by Super Builds for the chosen typography. Fonts load at build time through next/font. */
import { ${imports} } from 'next/font/google';

${decls}

export const fontVariables = [${faces.map((f) => `${ident(f).toLowerCase()}Font.variable`).join(', ')}].join(' ');
export const fontFamilies = {
  display: \`var(--font-${ident(type.display).toLowerCase()}), ui-sans-serif, system-ui, sans-serif\`,
  body: \`var(--font-${ident(type.body).toLowerCase()}), ui-sans-serif, system-ui, sans-serif\`,
  mono: \`var(--font-${ident(type.mono ?? 'JetBrains Mono').toLowerCase()}), ui-monospace, SFMono-Regular, monospace\`,
};
`;
}

export interface ScaffoldResult { ok: boolean; log: string; adminEmail: string; adminPassword?: string; error?: string }

export async function scaffoldProject(spec: Spec, projectPath: string, onLog: (chunk: string) => void): Promise<ScaffoldResult> {
  let log = '';
  const say = (s: string) => { log += s + '\n'; onLog(s + '\n'); };
  const tpl = templateRoot();
  if (!existsSync(join(tpl, 'package.json'))) return { ok: false, log, adminEmail: '', error: `The site template is missing at ${tpl}.` };

  say(`Copying the template into ${projectPath}`);
  copyTree(tpl, projectPath);

  // Scenes and skills from the design library.
  const lib = designLibraryRoot();
  if (existsSync(join(lib, 'scenes'))) copyTree(join(lib, 'scenes'), join(projectPath, 'components', 'scenes'));
  if (existsSync(join(lib, 'skills'))) copyTree(join(lib, 'skills'), join(projectPath, '.claude', 'skills'));

  say('Writing design.config.ts, app/fonts.ts and BRIEF.md from your choices');
  writeFileSync(join(projectPath, 'design.config.ts'), designConfigSource(spec));
  writeFileSync(join(projectPath, 'app', 'fonts.ts'), fontsSource(spec));
  writeFileSync(join(projectPath, 'BRIEF.md'), masterBrief(spec) + '\n');

  // package.json name.
  try {
    const pkgPath = join(projectPath, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    pkg.name = (spec.name || 'site').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'site';
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  } catch { /* fine */ }

  // CLAUDE.md gets the name.
  try {
    const cm = join(projectPath, 'CLAUDE.md');
    writeFileSync(cm, readFileSync(cm, 'utf8').replaceAll('{{NAME}}', spec.name));
  } catch { /* fine */ }

  // The owner login and the secrets the site needs, written once, here only.
  const adminEmail = spec.details?.email?.trim() || 'owner@localhost';
  const adminPassword = makePassword();
  const env: string[] = [
    '# Written by Super Builds. Server-only unless prefixed NEXT_PUBLIC_. Never commit this file.',
    `SITE_NAME=${JSON.stringify(spec.name)}`,
    `SESSION_SECRET=${randomBytes(32).toString('base64url')}`,
    `ADMIN_EMAIL=${adminEmail}`,
    `ADMIN_PASSWORD_HASH=${hashPassword(adminPassword)}`,
    '# Leave DATABASE_URL unset to use the local SQLite file in data/. Set a Postgres URL (Neon, Supabase) before deploying.',
    '# DATABASE_URL=',
  ];
  const needs = new Set<string>();
  for (const id of spec.analytics) { if (id === 'posthog') { needs.add('NEXT_PUBLIC_POSTHOG_KEY'); needs.add('NEXT_PUBLIC_POSTHOG_HOST'); } if (id === 'ga4') needs.add('NEXT_PUBLIC_GA_ID'); if (id === 'plausible') needs.add('NEXT_PUBLIC_PLAUSIBLE_DOMAIN'); }
  if (spec.crm === 'email') { needs.add('RESEND_API_KEY'); needs.add('CONTACT_EMAIL'); }
  if (spec.features.includes('payments')) { needs.add('STRIPE_SECRET_KEY'); needs.add('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'); }
  for (const key of needs) env.push(`# ${key}=`);
  env.push(`NEXT_PUBLIC_ANALYTICS=${spec.analytics.join(',')}`);
  writeFileSync(join(projectPath, '.env.local'), env.join('\n') + '\n', { mode: 0o600 });

  say('Initialising git');
  await execPlain('git', ['-C', projectPath, 'init', '-q', '-b', 'main'], 30_000);
  await execPlain('git', ['-C', projectPath, 'add', '-A'], 60_000);
  await execPlain('git', ['-C', projectPath, '-c', 'user.name=Super Builds', '-c', 'user.email=superbuilds@localhost', 'commit', '-q', '-m', 'Super Builds: scaffold from template', '--no-verify'], 60_000);

  say('Installing dependencies (this is the slow part, a few minutes the first time)');
  const install = await run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], projectPath, onLog);
  log += install.out;
  if (!install.ok) return { ok: false, log, adminEmail, adminPassword, error: 'npm install failed. Read the log above: it usually says which package and why.' };

  say('Template ready.');
  return { ok: true, log, adminEmail, adminPassword };
}

function run(cmd: string, args: string[], cwd: string, onLog: (c: string) => void): Promise<{ ok: boolean; out: string }> {
  return new Promise((resolve) => {
    const child = spawnBin(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, FORCE_COLOR: '0' } });
    let out = '';
    const on = (c: string) => { out += c; onLog(c); };
    child.stdout?.setEncoding('utf8'); child.stdout?.on('data', on);
    child.stderr?.setEncoding('utf8'); child.stderr?.on('data', on);
    child.on('error', (e) => resolve({ ok: false, out: out + e.message }));
    child.on('close', (code) => resolve({ ok: code === 0, out }));
  });
}
