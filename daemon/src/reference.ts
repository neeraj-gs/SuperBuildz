/**
 * Reference websites: look, record, understand — then build something similar,
 * not a copy.
 *
 * Playwright is loaded lazily and its Chromium is installed through the
 * requirements screen; without it the rest of Super Builds works and this says
 * plainly what is missing. Screenshots and a short scroll recording are shown
 * in the wizard; a bounded Claude Code turn reads the screenshots and answers
 * a schema that becomes the "design DNA" in the brief.
 */

import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DesignDNA, ReferenceCapture } from '@superbuilds/protocol';
import { capturesDir, thumbsDir } from './store.ts';
import { broadcast } from './bus.ts';
import { askOnce } from './claude.ts';
import { dnaPrompt, DNA_SCHEMA } from './brief.ts';
import { legiblePalette } from './colour.ts';
import { playwrightBrowserPresent } from './detection.ts';
import { getProject, updateProject } from './projects.ts';
import { previewState } from './preview.ts';

const captures = new Map<string, ReferenceCapture>();

export function getCapture(id: string) { return captures.get(id); }

function push(id: string, patch: Partial<ReferenceCapture>) {
  const cur = captures.get(id); if (!cur) return;
  const next = { ...cur, ...patch };
  captures.set(id, next);
  broadcast({ type: 'reference.update', capture: next });
}

type Playwright = typeof import('playwright-core');
async function loadPlaywright(): Promise<Playwright | null> {
  try { return await import('playwright-core'); } catch { return null; }
}

export function captureAvailable(): { ok: boolean; reason?: string } {
  const pw = playwrightBrowserPresent();
  if (!pw.present) return { ok: false, reason: 'The Playwright browser is not downloaded. Install it from the requirements screen.' };
  return { ok: true };
}

/** Start a capture; returns immediately, progress arrives over the socket. */
export function startCapture(url: string): ReferenceCapture {
  const id = randomUUID().slice(0, 8);
  const cap: ReferenceCapture = { id, url, status: 'capturing', shots: [], at: Date.now() };
  captures.set(id, cap);
  broadcast({ type: 'reference.update', capture: cap });
  void runCapture(id, url);
  return cap;
}

async function runCapture(id: string, url: string) {
  const dir = join(capturesDir(), id);
  mkdirSync(dir, { recursive: true });
  const pw = await loadPlaywright();
  const avail = captureAvailable();
  if (!pw || !avail.ok) { push(id, { status: 'failed', error: avail.reason ?? 'playwright-core is not installed in the daemon.' }); return; }

  let browser: import('playwright-core').Browser | undefined;
  try {
    browser = await pw.chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1,
      recordVideo: { dir, size: { width: 1440, height: 900 } },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    try { await page.waitForLoadState('networkidle', { timeout: 12_000 }); } catch { /* busy sites never idle */ }
    await page.waitForTimeout(2500);

    const shots: string[] = [];
    const total = await page.evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));
    const stops = [0, 0.25, 0.5, 0.75, 1];
    for (let i = 0; i < stops.length; i++) {
      const y = Math.round((total - 900) * stops[i]);
      // Smooth-ish scroll so scroll-triggered sites actually trigger and the video is watchable.
      await page.evaluate(async (target) => {
        const start = window.scrollY; const steps = 18;
        for (let s = 1; s <= steps; s++) { window.scrollTo(0, start + (target - start) * (s / steps)); await new Promise((r) => setTimeout(r, 40)); }
      }, y);
      await page.waitForTimeout(900);
      const file = join(dir, `shot-${i}.png`);
      await page.screenshot({ path: file, fullPage: false });
      shots.push(`/captures/${id}/shot-${i}.png`);
      push(id, { shots: [...shots] });
    }

    // What the HTML says about itself, for the critic.
    const summary = await page.evaluate(() => {
      const fonts = new Set<string>();
      for (const sel of ['h1', 'h2', 'p', 'body', 'a', 'button']) {
        const el = document.querySelector(sel); if (el) fonts.add(getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim());
      }
      const scripts = [...document.scripts].map((s) => s.src).filter(Boolean).map((s) => s.replace(/^https?:\/\//, '').slice(0, 80));
      const libs = ['three', 'gsap', 'lenis', 'framer', 'motion', 'spline', 'webgl', 'pixi', 'curtains', 'locomotive', 'barba', 'swiper'].filter((l) => scripts.some((s) => s.toLowerCase().includes(l)) || document.documentElement.outerHTML.toLowerCase().includes(l));
      const canvases = document.querySelectorAll('canvas').length;
      const title = document.title; const desc = document.querySelector('meta[name=description]')?.getAttribute('content') ?? '';
      const bg = getComputedStyle(document.body).backgroundColor; const fg = getComputedStyle(document.body).color;
      return JSON.stringify({ title, desc, fonts: [...fonts], libs, canvases, bg, fg, scripts: scripts.slice(0, 12) });
    });
    writeFileSync(join(dir, 'summary.json'), summary);

    const video = page.video();
    await context.close();
    if (video) {
      const src = await video.path();
      const dst = join(dir, 'scroll.webm');
      try { renameSync(src, dst); } catch { /* leave where it is */ }
      if (existsSync(dst)) push(id, { video: `/captures/${id}/scroll.webm` });
    }
    await browser.close(); browser = undefined;

    push(id, { status: 'analysing' });
    const absShots = shots.map((s) => join(capturesDir(), ...s.replace('/captures/', '').split('/')));
    const dna = await askOnce<DesignDNA>({
      cwd: dir, prompt: dnaPrompt(url, absShots, summary), schema: DNA_SCHEMA, model: 'sonnet', maxBudgetUsd: 1.0,
      allowedTools: ['Read'], timeoutMs: 240_000,
    });
    /*
      The sampled five are repaired before anybody is offered them.

      Reading "the page ground" and "the body text" off a site that inverts
      halfway down is genuinely ambiguous, and what comes back can be a light
      ground with light text. Pressing "its colours" and getting a page nobody
      can read is not a design decision, so the arithmetic is done here rather
      than asked for in the prompt.
    */
    const fixed: DesignDNA = { ...dna, customPalette: legiblePalette(dna.customPalette) };
    writeFileSync(join(dir, 'dna.json'), JSON.stringify(fixed, null, 2));
    push(id, { status: 'done', dna: fixed });
  } catch (err) {
    push(id, { status: 'failed', error: `Could not capture ${url}: ${(err as Error).message.split('\n')[0]}` });
  } finally {
    try { await browser?.close(); } catch {}
  }
}

/** A dashboard thumbnail of the running preview, when a browser exists. */
export async function thumbnailFor(projectId: string): Promise<string | undefined> {
  const project = getProject(projectId);
  const url = previewState(projectId).url;
  if (!project || !url) return undefined;
  const pw = await loadPlaywright();
  if (!pw || !playwrightBrowserPresent().present) return undefined;
  const out = join(thumbsDir(), `${projectId}.png`);
  let browser: import('playwright-core').Browser | undefined;
  try {
    browser = await pw.chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: out });
    const served = `/thumbs/${projectId}.png?t=${Date.now()}`;
    updateProject(projectId, { thumbnail: served });
    return served;
  } catch { return undefined; } finally { try { await browser?.close(); } catch {} }
}

/** Old captures are not worth keeping; trim to the newest 20. */
export function pruneCaptures() {
  const root = capturesDir();
  if (!existsSync(root)) return;
  const dirs = readdirSync(root).map((n) => ({ n, full: join(root, n) })).filter((d) => { try { return statSync(d.full).isDirectory(); } catch { return false; } })
    .sort((a, b) => statSync(b.full).mtimeMs - statSync(a.full).mtimeMs);
  for (const d of dirs.slice(20)) { try { rmSync(d.full, { recursive: true, force: true }); } catch {} }
}
