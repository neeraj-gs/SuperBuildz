/**
 * Screenshots of Super Builds' own interface, so a change to it can be looked
 * at rather than assumed.
 *
 * The tool holds every generated site to "take a screenshot and read it";
 * the same standard has to apply here, and the whole reason the last round of
 * interface bugs shipped is that nobody looked. Console errors are reported
 * too — a blank screen and a working screen are the same length of HTML until
 * you check.
 *
 *   node scripts/shot.mjs                       every screen, against the dev server
 *   node scripts/shot.mjs --prod                against the daemon's built UI on :7747
 *   node scripts/shot.mjs /projects /new        only these routes
 *   node scripts/shot.mjs --full                full-page, after walking the page
 *   node scripts/shot.mjs --width 390           a phone
 *
 * Needs playwright-core's Chromium, which the requirements screen installs.
 */

import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const prod = args.includes('--prod');
const full = args.includes('--full');
const widthArg = args.indexOf('--width');
const width = widthArg === -1 ? 1440 : Number(args[widthArg + 1]) || 1440;
const base = process.env.SB_BASE ?? (prod ? 'http://127.0.0.1:7747' : 'http://127.0.0.1:5180');

const routes = args.filter((a) => a.startsWith('/'));
const ROUTES = routes.length ? routes : ['/', '/projects', '/setup', '/new'];

const out = join(root, 'shots');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ headless: true });
let failures = 0;

for (const route of ROUTES) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  const problems = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message.split('\n')[0]}`));
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text().slice(0, 200)}`); });
  page.on('requestfailed', (r) => problems.push(`request: ${r.url().slice(-60)} ${r.failure()?.errorText}`));

  const name = (route === '/' ? 'landing' : route.replace(/^\//, '').replace(/\//g, '-')) + (width < 600 ? '-mobile' : '');
  try {
    await page.goto(base + route, { waitUntil: 'networkidle', timeout: 45_000 });
    await page.waitForTimeout(2000);

    if (full) {
      // Reveal-on-scroll content is invisible to a naive full-page capture.
      await page.evaluate(async () => {
        const h = document.documentElement.scrollHeight;
        for (let y = 0; y <= h; y += Math.round(window.innerHeight * 0.6)) {
          window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 110));
        }
        window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 400));
      });
    }

    await page.screenshot({ path: join(out, `${name}.png`), fullPage: full });
    // An empty #root is the signature of a render loop or a crashed bundle,
    // and it is invisible in a 200 response.
    const rendered = await page.evaluate(() => document.getElementById('root')?.innerHTML.length ?? -1);
    if (rendered < 500) { problems.push(`#root rendered ${rendered} characters — the screen is blank`); }
    console.log(`${name.padEnd(14)} ${String(rendered).padStart(6)} chars  shots/${name}.png`);
  } catch (err) {
    problems.push(`goto: ${err.message.split('\n')[0]}`);
  }

  if (problems.length) { failures++; for (const p of problems) console.error(`  ! ${p}`); }
  await page.close();
}

await browser.close();
if (failures) { console.error(`\n${failures} of ${ROUTES.length} screens had problems.`); process.exit(1); }
console.log(`\n${ROUTES.length} screens, no console errors. shots/ is up to date.`);
