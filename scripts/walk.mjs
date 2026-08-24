/**
 * Walks the project workspace and photographs each panel.
 *
 * `shot.mjs` covers the routes; this covers the things behind buttons, which
 * is where every recent bug has been. It presses its way through Files, the
 * CRM login, Analytics and Under the hood, and reports console errors from
 * each — a panel that renders empty and a panel that renders are the same
 * length of HTML until you look.
 *
 *   node scripts/walk.mjs                 the first project
 *   node scripts/walk.mjs <projectId>
 */

import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.SB_BASE ?? 'http://127.0.0.1:5180';
const out = join(root, 'shots');
mkdirSync(out, { recursive: true });

const projects = await (await fetch('http://127.0.0.1:7747/api/projects')).json();
const id = process.argv[2] ?? projects[0]?.id;
if (!id) { console.error('No projects to walk. Build one first.'); process.exit(1); }

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });

const problems = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message.split('\n')[0]}`));
page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text().slice(0, 220)}`); });

let failures = 0;
async function shot(name, note) {
  problems.length = 0;
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(out, `panel-${name}.png`) });
  const bad = [...new Set(problems)];
  if (bad.length) { failures++; console.log(`  ${name}: ${note}\n    ${bad.join('\n    ')}`); }
  else console.log(`  ${name}: ${note}`);
}

/**
 * Press a control by its visible text, and say so when it is not there.
 *
 * Buttons first: getByText resolves to the innermost span, and clicking a span
 * that happens to sit under an overlay times out in a way that reads like the
 * control is missing when it is only covered.
 */
async function press(text, name) {
  const button = page.locator('button', { hasText: text }).first();
  const el = (await button.count()) ? button : page.getByText(text, { exact: false }).first();
  if (!(await el.count())) { console.log(`  MISSING: "${text}" (${name})`); failures++; return false; }
  try { await el.click({ timeout: 6000 }); } catch { console.log(`  BLOCKED: "${text}" (${name}) — something is covering it`); failures++; return false; }
  return true;
}

console.log(`Walking ${id} at ${base}`);
await page.goto(`${base}/p/${id}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await shot('site', 'the site tab');

if (await press('CRM /admin', 'admin tab')) await shot('admin', 'the CRM tab, with the login bar');
if (await press('Files', 'files tab')) {
  await page.waitForTimeout(700);
  await shot('files-empty', 'the file panel before a file is chosen');
  if (await press('.env.local', 'env shortcut')) await shot('files-env', 'the env file open in the editor');
  const tsx = page.getByText('design.config.ts', { exact: false }).first();
  if (await tsx.count()) { await tsx.click().catch(() => {}); await shot('files-tsx', 'a TypeScript file, highlighted'); }
}

await page.goto(`${base}/p/${id}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

// The menu is the only way into the rest, so a failure here hides four panels.
const gear = page.locator('button[title="Everything else"]').first();
if (await gear.count()) {
  await gear.click();
  await shot('menu', 'the options menu');
  if (await press('Analytics and where to read it', 'analytics')) await shot('analytics', 'the analytics panel');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await gear.click();
  if (await press('Under the hood', 'engine')) {
    await shot('engine-brief', 'the brief, editable');
    if (await press('What it was asked', 'stages tab')) await shot('engine-stages', 'the stage prompts');
    if (await press('What it is allowed to do', 'rules tab')) await shot('engine-rules', 'the rules and the plugin list');
  }
} else { console.log('  MISSING: the options menu'); failures++; }

/* The wizard: the screens that used to take thirteen presses to get back to. */

await page.goto(`${base}/new`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1600);
await shot('wizard-reference', 'the reference screen, asked first');

// The reference is optional, so Next moves straight on to the shape question.
await press('Next', 'past the reference');
await page.waitForTimeout(900);

// Choosing a shape is what unlocks the rest of the jump menu.
if (await press('Restaurant', 'archetype')) {
  await page.waitForTimeout(1000);
  for (const [label, name] of [['Colour', 'palette'], ['Pictures', 'pictures'], ['Motion', 'motion']]) {
    const jump = page.locator('button[title="Every screen"]').first();
    if (!(await jump.count())) { console.log('  MISSING: the jump menu'); failures++; break; }
    await jump.click().catch(() => {});
    await page.waitForTimeout(350);
    if (await press(label, `jump to ${name}`)) await shot(`wizard-${name}`, `${name}, reached in one press`);
  }
  // Back to colour, because the custom editor lives there and the loop above
  // left us on motion.
  await page.locator('button[title="Every screen"]').first().click().catch(() => {});
  await page.waitForTimeout(350);
  if (await press('Colour', 'back to colour')) {
    await page.waitForTimeout(700);
    if (await press('Or mix your own', 'custom palette')) await shot('wizard-custom-palette', 'five colours mixed by hand');
  }
}

await browser.close();
console.log(failures ? `\n${failures} problem(s). Look at shots/panel-*.png.` : '\nAll panels rendered clean. shots/panel-*.png');
process.exit(failures ? 1 : 0);
