/**
 * Reading somebody else's website.
 *
 * The survey is what a revamp is built on, so a route it invents or a route it
 * misses is a redesign pointed at the wrong page. These fixtures are the four
 * shapes that actually turn up.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { surveySite } from '../src/survey.ts';
import { revampBrief, revampStagesFor, REVAMP_BRANCH } from '../src/revamp.ts';
import { completeSpec } from '../src/catalogue/index.ts';

function site(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'sb-site-'));
  for (const [rel, body] of Object.entries(files)) {
    const full = join(root, ...rel.split('/'));
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
  return root;
}

const NEXT_APP = {
  'package.json': JSON.stringify({ name: 'oak', scripts: { dev: 'next dev', build: 'next build' }, dependencies: { next: '15.0.0', react: '19.0.0' } }),
  'tsconfig.json': '{}',
  'app/page.tsx': 'export default function Home() { return <h1>Fire, slowly.</h1>; }',
  'app/menu/page.tsx': 'export default function Menu() { return <><h1>The menu</h1><p>Everything comes off the oak fire, all evening, every evening.</p></>; }',
  'app/(marketing)/about/page.tsx': 'export default function About() { return <h1>Six seats at the counter</h1>; }',
  'app/api/forms/route.ts': 'export async function POST() { return new Response("ok"); }',
  'public/room.jpg': 'x',
};

test('a Next app router site is read route by route, groups and api excluded', async () => {
  const s = await surveySite(site(NEXT_APP));
  assert.equal(s.ok, true);
  assert.equal(s.framework, 'next');
  assert.equal(s.react, true);
  assert.equal(s.typescript, true);
  assert.deepEqual(s.routes.sort(), ['/', '/about', '/menu']);
  // A route group is a folder for the developer and invisible to a visitor.
  assert.equal(s.routes.includes('/(marketing)/about'), false);
  // An API handler is not a page.
  assert.equal(s.routes.some((r) => r.includes('api')), false);
  assert.equal(s.images, 1);
  assert.equal(s.devScript, 'next dev');
});

test('the survey reads the words the site actually says', async () => {
  const s = await surveySite(site(NEXT_APP));
  assert.match(s.content, /Everything comes off the oak fire/);
  assert.match(s.content, /Six seats at the counter/);
  // Never the code around them.
  assert.equal(s.content.includes('export default'), false);
});

test('Vite, Astro and a plain HTML folder are each recognised', async () => {
  const vite = await surveySite(site({
    'package.json': JSON.stringify({ name: 'v', devDependencies: { vite: '6' }, dependencies: { react: '19' }, scripts: { dev: 'vite' } }),
    'src/pages/index.tsx': '<h1>Hello there everyone</h1>',
    'src/pages/work.tsx': '<h1>Selected work</h1>',
  }));
  assert.equal(vite.framework, 'vite');
  assert.equal(vite.react, true);
  assert.deepEqual(vite.routes.sort(), ['/', '/work']);

  const astro = await surveySite(site({
    'package.json': JSON.stringify({ name: 'a', dependencies: { astro: '5' }, scripts: { dev: 'astro dev' } }),
    'src/pages/index.astro': '<h1>A studio in Lisbon</h1>',
  }));
  assert.equal(astro.framework, 'astro');
  assert.equal(astro.react, false);
  assert.deepEqual(astro.routes, ['/']);
  // Not React, so the person is told the scene has to be ported rather than copied.
  assert.ok(astro.notes.some((n) => /React/.test(n)));

  const plain = await surveySite(site({ 'index.html': '<h1>The corner shop</h1><p>Open every day from seven in the morning.</p>' }));
  assert.equal(plain.framework, 'static');
  assert.deepEqual(plain.routes, ['/']);
});

test('pages behind a login are kept apart from pages a visitor sees', async () => {
  const s = await surveySite(site({
    ...NEXT_APP,
    'app/admin/page.tsx': 'export default function Admin() { return <h1>Leads</h1>; }',
    'app/admin/leads/page.tsx': 'export default function Leads() { return <h1>Every lead</h1>; }',
    'app/dashboard/page.tsx': 'export default function D() { return <h1>Numbers</h1>; }',
  }));
  assert.deepEqual(s.routes.sort(), ['/', '/about', '/menu']);
  assert.deepEqual(s.privateRoutes.sort(), ['/admin', '/admin/leads', '/dashboard']);
  assert.ok(s.notes.some((n) => /behind a login/.test(n)));

  // And the brief has to say the two are different jobs, or the redesign puts
  // a full-bleed hero on the page where somebody reads their bookings.
  const brief = revampBrief(completeSpec({ name: 'x', mode: 'revamp' }), s);
  assert.match(brief, /behind a login/);
  assert.match(brief, /Do not add a 3D scene there/);
  assert.ok(brief.includes('/admin/leads'));
});

test('a folder that is not a website is refused rather than scaffolded over', async () => {
  const notASite = await surveySite(site({ 'notes.txt': 'shopping list' }));
  assert.equal(notASite.ok, false);
  assert.match(notASite.reason ?? '', /does not look like a website/);

  const missing = await surveySite(join(tmpdir(), 'sb-definitely-not-here-9f2a'));
  assert.equal(missing.ok, false);
  assert.equal(await surveySite('').then((r) => r.ok), false);
});

test('a folder with no git repository is flagged before anything is changed', async () => {
  const s = await surveySite(site(NEXT_APP));
  assert.equal(s.git.repo, false);
  assert.ok(s.notes.some((n) => /git repository/.test(n)), 'the person must be told there is no way back yet');
});

test('the revamp brief names the URLs as fixed and keeps the same rubric', async () => {
  const survey = await surveySite(site(NEXT_APP));
  const spec = completeSpec({ name: 'Ember and Oak', mode: 'revamp', archetype: 'restaurant', folder: survey.path });
  const brief = revampBrief(spec, survey);

  for (const route of survey.routes) assert.ok(brief.includes(route), `${route} must be named as fixed`);
  assert.match(brief, /must not change/i);
  assert.match(brief, /Never read or edit a `\.env` file/);
  // The same seventeen lines a new build is scored against.
  assert.match(brief, /Meaningful 3D/);
  assert.match(brief, new RegExp(REVAMP_BRANCH.replace('/', '\\/')));
});

test('the jury stage is skippable and nothing else is', () => {
  const on = revampStagesFor(completeSpec({ name: 'x', mode: 'revamp', review: true })).map((s) => s.id);
  const off = revampStagesFor(completeSpec({ name: 'x', mode: 'revamp', review: false })).map((s) => s.id);
  assert.deepEqual(on, ['foundation', 'identity', 'pages', 'motion', 'review']);
  assert.deepEqual(off, ['foundation', 'identity', 'pages', 'motion']);
});
