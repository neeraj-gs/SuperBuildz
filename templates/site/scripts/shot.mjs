/**
 * Screenshots of the running site, for the build to look at its own work.
 *
 *   npm run shot -- /            one route, desktop
 *   npm run shot -- /about --mobile --reduced
 *   npm run shot -- --all        every route in app/ (page.tsx files), desktop and mobile
 *
 * Needs the dev server running (Super Builds starts it) and the Playwright
 * Chromium installed through the requirements screen. Writes shots/<name>.png.
 */
import { chromium } from 'playwright-core';
import { mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const mobile = args.includes('--mobile');
const reduced = args.includes('--reduced');
const all = args.includes('--all');
const port = process.env.PORT ?? process.env.SUPERBUILDS_PREVIEW_PORT ?? '3000';
const base = process.env.SHOT_BASE ?? `http://127.0.0.1:${port}`;
let routes = args.filter((a) => a.startsWith('/'));

if (all || !routes.length) {
  const found = [];
  const walk = (dir, prefix) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) { if (name.startsWith('api') || name.startsWith('admin') || name.startsWith('(')) { if (name.startsWith('(')) walk(full, prefix); continue; } walk(full, `${prefix}/${name}`); }
      else if (name === 'page.tsx' && !prefix.includes('[')) found.push(prefix || '/');
    }
  };
  walk(join(process.cwd(), 'app'), '');
  routes = all ? [...new Set(found)] : routes.length ? routes : ['/'];
  if (all) routes.push('/admin');
}

mkdirSync('shots', { recursive: true });
const browser = await chromium.launch({ headless: true });
const sizes = all ? [{ w: 1440, h: 900, tag: '' }, { w: 390, h: 844, tag: '-mobile' }] : [mobile ? { w: 390, h: 844, tag: '-mobile' } : { w: 1440, h: 900, tag: '' }];
for (const size of sizes) {
  const context = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1, reducedMotion: reduced ? 'reduce' : 'no-preference', isMobile: size.w < 600 });
  const page = await context.newPage();
  for (const route of routes) {
    try {
      await page.goto(base + route, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(2500);
      const name = (route === '/' ? 'home' : route.replace(/^\//, '').replace(/\//g, '-')) + size.tag + (reduced ? '-reduced' : '');
      await page.screenshot({ path: `shots/${name}.png`, fullPage: false });
      // Reveal-on-scroll content is invisible until seen: walk the page first, so the
      // full-page shot shows what a reader would, not blank sections.
      await page.evaluate(async () => {
        const h = document.documentElement.scrollHeight; const step = Math.max(200, Math.round(window.innerHeight * 0.6));
        for (let y = 0; y <= h; y += step) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); }
        await new Promise((r) => setTimeout(r, 600));
        window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 400));
      });
      await page.screenshot({ path: `shots/${name}-full.png`, fullPage: true });
      console.log(`shots/${name}.png`);
    } catch (err) { console.error(`${route}: ${err.message.split('\n')[0]}`); }
  }
  await context.close();
}
await browser.close();
if (!existsSync('shots')) process.exit(1);
