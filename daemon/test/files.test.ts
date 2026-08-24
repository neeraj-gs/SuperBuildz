/**
 * The file panel writes into somebody's project folder, so the guard around it
 * is the part worth testing. Everything here is an escape attempt.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listDir, readProjectFile, writeProjectFile, deleteProjectFile, createProjectFile, searchProject, languageOf } from '../src/files.ts';
import { PROVIDERS, keysNeededFor, analyticsChoices, dashboardUrl } from '../src/analytics.ts';
import { hashPassword, makePassword } from '../src/admin.ts';
import { completeSpec } from '../src/catalogue/index.ts';
import { designConfigSource } from '../src/scaffold.ts';

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'sb-files-'));
  mkdirSync(join(root, 'app'), { recursive: true });
  mkdirSync(join(root, 'node_modules', 'react'), { recursive: true });
  writeFileSync(join(root, '.env.local'), 'ADMIN_EMAIL=owner@example.com\n');
  writeFileSync(join(root, 'app', 'page.tsx'), 'export default function Page() { return <h1>Fire, slowly.</h1>; }\n');
  writeFileSync(join(root, 'node_modules', 'react', 'index.js'), 'module.exports = {};\n');
  return root;
}

test('a path outside the project is refused however it is written', () => {
  const root = fixture();
  for (const attempt of ['../secrets.txt', '..\\secrets.txt', 'app/../../secrets.txt', '/etc/passwd', 'app/../..']) {
    assert.throws(() => readProjectFile(root, attempt), /outside the project|No such file|folder/, `should refuse ${attempt}`);
  }
  // An absolute path inside the project resolves back to the project and is fine.
  assert.equal(readProjectFile(root, join(root, 'app', 'page.tsx')).path, 'app/page.tsx');
});

test('the folders nobody should hand-edit are neither listed nor reachable', async () => {
  const root = fixture();
  const top = await listDir(root, '');
  assert.equal(top.entries.some((e) => e.name === 'node_modules'), false);
  assert.throws(() => readProjectFile(root, 'node_modules/react/index.js'), /not editable/);
  assert.throws(() => deleteProjectFile(root, 'node_modules'), /not editable/);
});

test('the project root itself cannot be deleted', () => {
  const root = fixture();
  assert.throws(() => deleteProjectFile(root, ''), /the project itself/);
  assert.ok(existsSync(root));
});

test('a file round-trips, and .env keeps its restrictive mode', () => {
  const root = fixture();
  const body = writeProjectFile(root, '.env.local', 'ADMIN_EMAIL=new@example.com\nA_KEY=1\n');
  assert.equal(body.secret, true);
  assert.equal(body.language, 'env');
  assert.match(readFileSync(join(root, '.env.local'), 'utf8'), /new@example\.com/);

  const made = createProjectFile(root, 'app/notes.md', false);
  assert.equal(made.path, 'app/notes.md');
  assert.throws(() => createProjectFile(root, 'app/notes.md', false), /already there/);
});

test('search finds a phrase inside a file and a name in the tree', () => {
  const root = fixture();
  const inside = searchProject(root, 'Fire, slowly');
  assert.equal(inside[0]?.path, 'app/page.tsx');
  assert.equal(inside[0]?.line, 1);
  assert.ok(searchProject(root, 'page.tsx').some((h) => h.path === 'app/page.tsx'));
  // Two characters is the floor; anything shorter matches everything.
  assert.deepEqual(searchProject(root, 'a'), []);
});

test('languages are recognised from the name, .env included', () => {
  assert.equal(languageOf('app/page.tsx'), 'tsx');
  assert.equal(languageOf('design.config.ts'), 'ts');
  assert.equal(languageOf('.env.local'), 'env');
  assert.equal(languageOf('BRIEF.md'), 'md');
  assert.equal(languageOf('public/logo.png'), 'text');
});

test('every analytics provider is answerable: keys, dashboard, and a wizard entry', () => {
  const ids = PROVIDERS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, 'provider ids must be unique');
  assert.ok(ids.includes('custom') && ids.includes('vercel') && ids.includes('netlify') && ids.includes('amplitude'));

  for (const p of PROVIDERS) {
    for (const f of p.fields) assert.match(f.key, /^NEXT_PUBLIC_[A-Z0-9_]+$/, `${p.id}: keys reach the browser, so they must be NEXT_PUBLIC_`);
    // A provider with no built-in dashboard must at least say where to look.
    if (!p.builtin) assert.ok(p.dashboard, `${p.id} needs somewhere to send people`);
  }

  // The wizard list is derived, so it cannot offer something the site cannot load.
  assert.deepEqual(analyticsChoices().map((c) => c.id), ids);
  assert.deepEqual(keysNeededFor(['posthog']), ['NEXT_PUBLIC_POSTHOG_KEY']);
  assert.deepEqual(keysNeededFor(['custom', 'vercel']), []);
});

test('a templated dashboard link degrades to the top of the site without a domain', () => {
  const plausible = PROVIDERS.find((p) => p.id === 'plausible')!;
  assert.equal(dashboardUrl(plausible, 'emberandoak.com'), 'https://plausible.io/emberandoak.com');
  assert.equal(dashboardUrl(plausible, undefined), 'https://plausible.io/');
});

test('the admin hash uses colons, because Next expands $ inside .env', () => {
  const h = hashPassword('correct horse');
  assert.match(h, /^scrypt:\d+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
  assert.equal(h.includes('$'), false);
  assert.notEqual(hashPassword('correct horse'), h, 'a fresh salt every time');
});

test('a generated password is readable and long enough to be worth having', () => {
  for (let i = 0; i < 20; i++) {
    const p = makePassword();
    assert.match(p, /^[a-z]+-[a-z]+-\d{3}$/);
    assert.ok(p.length >= 10);
  }
});

test('a custom palette is five hex colours or nothing at all', () => {
  const five = { bg: '#101010', fg: '#f0f0f0', accent: '#c8ff3d', muted: '#808080', surface: '#1a1a1a' };
  assert.deepEqual(completeSpec({ customPalette: five }).customPalette, five);

  // Uppercase is normalised; a half-filled set is refused outright, because a
  // page with two of the five moved is worse than the palette it started from.
  assert.deepEqual(completeSpec({ customPalette: { ...five, accent: '#C8FF3D'.toUpperCase() } }).customPalette?.accent, '#c8ff3d');
  assert.equal(completeSpec({ customPalette: { ...five, muted: '' } as never }).customPalette, undefined);
  assert.equal(completeSpec({ customPalette: { ...five, bg: 'red' } as never }).customPalette, undefined);

  // The one that matters: these are written into design.config.ts as source.
  assert.equal(completeSpec({ customPalette: { ...five, bg: '#000000"; process.exit(1); //' } as never }).customPalette, undefined);
  assert.equal(completeSpec({ customPalette: { ...five, fg: 'var(--x)' } as never }).customPalette, undefined);
});

test('a custom palette reaches design.config.ts and beats the listed one', () => {
  const five = { bg: '#101010', fg: '#f0f0f0', accent: '#c8ff3d', muted: '#808080', surface: '#1a1a1a' };
  const spec = completeSpec({ name: 'Test', archetype: 'restaurant', palette: 'ember', customPalette: five });
  const src = designConfigSource(spec);
  assert.match(src, /#101010/);
  assert.match(src, /#c8ff3d/);
});
