/**
 * Why the preview is white.
 *
 * ── The gap this closes ─────────────────────────────────────────────────────
 *
 * The preview panel could tell you three things: the server is starting, the
 * server would not start, or here is your site. There was no fourth, and the
 * fourth is the one that actually happens: the server started, it answered
 * 200, the frame loaded — and the page inside it drew nothing. A white
 * rectangle, indistinguishable from a site whose hero has a white background,
 * for as long as the person is prepared to keep looking at it.
 *
 * In the report that produced this file the site was blank because Clerk
 * refuses to mount without its publishable key and that checkout had no
 * `.env.local`. That is a fifteen-second fix once you know, and unknowable from
 * outside the frame — the preview runs on its own port, so it is a different
 * origin, and nothing of ours can read into it.
 *
 * ── So it is read from outside, by something that is allowed to look ────────
 *
 * The daemon opens the same URL in the headless browser that is already here
 * for reference captures and thumbnails, and reports what a browser sees: the
 * status, whether the body drew any text at all, and what was logged on the
 * way. Two seconds, once, when there is a reason to ask — not a loop.
 *
 * ── And it is translated ────────────────────────────────────────────────────
 *
 * "Uncaught Error: @clerk/clerk-react: Missing publishableKey" is not an
 * answer for the person this tool is for. The name of the variable and the
 * file to put it in is. `explain()` is pure and is where that judgement lives,
 * so it can be tested without a browser — which is the only way this stays
 * honest as the list of causes grows.
 */

import type { SiteHealth } from '@superbuilds/protocol';
import { playwrightBrowserPresent } from './detection.ts';

/** How long to let a page settle before deciding it has drawn nothing. */
const SETTLE_MS = 2_500;

/**
 * The package a bundler is complaining about.
 *
 * The opening quote has to follow whitespace, and that is the whole trick:
 * webpack writes "Module not found: Can't resolve 'framer-motion'", and a
 * pattern that takes the first quote it sees reports that the missing package
 * is `t resolve `.
 */
const MODULE = /(?:Module not found|Cannot find module)[^\n]*?(?:^|\s)['"]([^'"\n]+)['"]/i;

/**
 * The variable a message is complaining about.
 *
 * Framework errors name it in shouting case, and the useful one is almost
 * never the first token in the sentence — so the ones that look like
 * configuration are preferred over any other capitalised word.
 */
export function missingVariable(text: string): string | undefined {
  const tokens = text.match(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g);
  if (!tokens?.length) return undefined;
  const configish = tokens.find((t) => /^(NEXT_PUBLIC_|VITE_|PUBLIC_)/.test(t))
    ?? tokens.find((t) => /(KEY|SECRET|TOKEN|URL|_ID|DSN|PASSWORD)$/.test(t));
  return configish ?? tokens[0];
}

/**
 * What to say about a page that answered but drew nothing.
 *
 * Ordered by how actionable the answer is, not by how common the cause is: a
 * missing key names a variable and a file, a missing module names a package,
 * and everything below that is progressively closer to "here is what the
 * browser said, make of it what you will" — which is still better than white.
 */
export function explain(input: { status: number; textLength: number; errors: string[]; serverBody?: string }): SiteHealth {
  const { status, textLength, errors } = input;
  const at = Date.now();
  const first = errors[0] ?? '';
  const all = errors.join('\n');

  if (status >= 500) {
    // The browser only ever sees "the server responded with 500". What the
    // server actually said is in the body it sent, so that is read too.
    const said = `${all}\n${input.serverBody ?? ''}`;
    return { at, state: 'error', status, errors, reason: serverError(said) ?? `The dev server answered ${status}. Its own error page will say more than this can.` };
  }
  if (status >= 400) {
    return { at, state: 'error', status, errors, reason: `The dev server answered ${status} for the home page. Either there is no page at the root yet, or its route is named something else.` };
  }

  // It drew something. Whatever was logged is a detail, not a verdict.
  if (textLength > 0) {
    return { at, state: 'ok', status, errors: errors.slice(0, 4) };
  }

  // Blank. Now the logs are the whole story.
  const clerk = /clerk/i.test(all) && /publishable|Missing/i.test(all);
  if (clerk) {
    const name = missingVariable(all) ?? 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY';
    return { at, state: 'empty', status, errors: errors.slice(0, 4), missingEnv: name, reason: `The page is blank because its sign-in library will not start without a key. Put ${name} into .env.local and it will draw.` };
  }

  const envish = /Missing|not defined|is required|undefined|invalid/i.test(all) && missingVariable(all);
  if (envish) {
    return { at, state: 'empty', status, errors: errors.slice(0, 4), missingEnv: envish, reason: `The page is blank because ${envish} is missing. Put it into .env.local and it will draw.` };
  }

  const mod = MODULE.exec(all);
  if (mod) {
    return { at, state: 'empty', status, errors: errors.slice(0, 4), reason: `The page is blank because the package ${mod[1]} is not installed. Open the folder and run npm install.` };
  }

  if (/Hydration failed|did not match|Minified React error #4\d\d/i.test(all)) {
    return { at, state: 'empty', status, errors: errors.slice(0, 4), reason: 'The page is blank because what the server drew and what the browser drew disagreed, and React threw the page away rather than show either.' };
  }

  if (first) {
    return { at, state: 'empty', status, errors: errors.slice(0, 4), reason: `The page loaded and then drew nothing. The browser said: ${trim(first)}` };
  }

  return {
    at, state: 'empty', status, errors: [],
    reason: 'The page loaded, said nothing was wrong, and drew nothing. Usually that means the home page is still being written — it should fill in as the build goes on.',
  };
}

function serverError(log: string): string | undefined {
  const mod = MODULE.exec(log);
  if (mod) return `The dev server could not build the page: the package ${mod[1]} is not installed. Open the folder and run npm install.`;
  const name = /Missing|not defined|is required/i.test(log) ? missingVariable(log) : undefined;
  if (name) return `The dev server could not build the page because ${name} is missing. Put it into .env.local.`;
  return undefined;
}

function trim(s: string): string {
  return s.replace(/\s+/g, ' ').trim().slice(0, 180);
}

/**
 * Look at the site the way a person would, and say what is there.
 *
 * The HTTP request comes first and on its own: it is cheap, it is the only
 * check that works when no browser is installed, and a server that is not
 * answering is not a rendering question.
 */
export async function checkSite(url: string): Promise<SiteHealth> {
  const at = Date.now();

  let status = 0;
  let serverBody = '';
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(10_000) });
    status = res.status;
    // Kept only when it is an error page: that is the one case where the body
    // says something a browser's console never will.
    if (status >= 400) serverBody = (await res.text().catch(() => '')).slice(0, 8_000);
  } catch {
    return { at, state: 'down', reason: 'The dev server is not answering on its own address. It may still be starting, or it may have stopped.' };
  }

  const pw = await loadPlaywright();
  if (!pw || !playwrightBrowserPresent().present) {
    // Without a browser there is no way to know what rendered, and guessing
    // from HTML would be wrong for every client-rendered site — which is all
    // of them here. Say what is known and no more.
    if (status >= 400) return explain({ status, textLength: 1, errors: [], serverBody });
    return { at, state: 'unknown', status, reason: 'The site is answering. Whether it draws anything cannot be checked without the Playwright browser — install it from the requirements screen.' };
  }

  let browser: import('playwright-core').Browser | undefined;
  try {
    browser = await pw.chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message.split('\n')[0]));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    const textLength = await page.evaluate(() => (document.body?.innerText ?? '').trim().length).catch(() => 0);

    return explain({ status: res?.status() ?? status, textLength, errors: dedupe(errors), serverBody });
  } catch (err) {
    return { at, state: 'down', status, reason: `The page could not be opened: ${trim((err as Error).message)}` };
  } finally {
    try { await browser?.close(); } catch { /* it is going away anyway */ }
  }
}

/** React logs the same error on every attempted render. Four copies is not four errors. */
function dedupe(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const line = trim(raw);
    if (!line || seen.has(line)) continue;
    seen.add(line);
    out.push(line);
  }
  return out;
}

type Playwright = typeof import('playwright-core');
async function loadPlaywright(): Promise<Playwright | null> {
  try { return await import('playwright-core'); } catch { return null; }
}
