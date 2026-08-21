/**
 * The requirements screen, answered by asking each tool about itself.
 *
 * Guardrail: the sign-in check is `claude auth status`, never a credentials
 * file. We read the fields needed to render the row and keep none of them.
 */

import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Detection, DetectionCheck } from '@superbuilds/protocol';
import { resolveClaudeBin } from './claude.ts';
import { execBin, execPlain } from './binaries.ts';
import { currentPlatform, probe } from './install.ts';

export const MIN_CLAUDE_VERSION = '2.1.0';

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Whether a Playwright Chromium has been downloaded on this machine. */
export function playwrightBrowserPresent(): { present: boolean; detail: string } {
  const roots = process.platform === 'win32'
    ? [join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'ms-playwright')]
    : process.platform === 'darwin'
      ? [join(homedir(), 'Library', 'Caches', 'ms-playwright')]
      : [join(homedir(), '.cache', 'ms-playwright')];
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) roots.unshift(process.env.PLAYWRIGHT_BROWSERS_PATH);
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const found = readdirSync(root).filter((n) => /^chromium/i.test(n));
    if (found.length) return { present: true, detail: found.sort().at(-1)! };
  }
  return { present: false, detail: 'No Chromium downloaded for Playwright' };
}

export async function detect(): Promise<Detection> {
  const bin = resolveClaudeBin();
  const checks: DetectionCheck[] = [];

  const node = await execPlain(process.execPath, ['--version']);
  const nodeMajor = parseInt(node.out.replace(/^v/, ''), 10) || 0;
  checks.push({
    id: 'node', label: 'Node.js', ok: nodeMajor >= 22,
    detail: node.ok ? `${node.out}${nodeMajor < 22 ? ' — 22 or newer is needed' : ''}` : 'Not found',
    why: 'Runs Super Builds and every website it generates.',
    fixLabel: nodeMajor >= 22 ? undefined : 'Install Node.js', fixAction: nodeMajor >= 22 ? undefined : 'install',
  });

  const version = await execBin(bin, ['--version'], { timeout: 20_000 });
  const versionNumber = version.out.match(/(\d+\.\d+\.\d+)/)?.[1];
  checks.push({
    id: 'claude', label: 'Claude Code', ok: version.ok,
    detail: version.ok ? version.out.split('\n')[0] : 'Not found on PATH or in ~/.local/bin',
    why: 'The thing that actually builds. Your own copy, your own subscription.',
    fixLabel: version.ok ? undefined : 'Install Claude Code', fixAction: version.ok ? undefined : 'install',
    fixUrl: 'https://claude.com/product/claude-code',
  });

  const auth = version.ok ? await execBin(bin, ['auth', 'status'], { timeout: 20_000 }) : { ok: false, out: 'skipped', code: null };
  let info: { loggedIn?: boolean; email?: string; subscriptionType?: string } = {};
  try { info = JSON.parse(auth.out); } catch { /* older builds print text */ }
  const signedIn = info.loggedIn === true || (auth.ok && info.loggedIn === undefined && !/not (logged|signed) in|no credentials/i.test(auth.out));
  checks.push({
    id: 'auth', label: 'Signed in to Claude', ok: signedIn,
    detail: signedIn ? [info.email, info.subscriptionType && `${info.subscriptionType} plan`].filter(Boolean).join(' · ') || 'Signed in' : 'Not signed in',
    why: 'Generation runs on your Claude plan. Nothing is billed by Super Builds.',
    fixLabel: signedIn ? undefined : 'Sign in', fixAction: signedIn ? undefined : 'auth',
  });

  const versionOk = !!versionNumber && compareVersions(versionNumber, MIN_CLAUDE_VERSION) >= 0;
  checks.push({
    id: 'version', label: `Claude Code ${MIN_CLAUDE_VERSION} or newer`, ok: versionOk,
    detail: versionNumber ? (versionOk ? `${versionNumber} is fine` : `${versionNumber} is older than ${MIN_CLAUDE_VERSION} — update it`) : 'Unknown',
    why: 'Older builds stream a different shape and the conversation would not render.',
    fixLabel: versionOk ? undefined : 'Update Claude Code', fixAction: versionOk ? undefined : 'install',
  });

  const git = await execPlain('git', ['--version']);
  checks.push({
    id: 'git', label: 'Git', ok: git.ok, detail: git.ok ? git.out : 'Not found',
    why: 'Every site is a repository, which is what makes undo and publishing possible.',
    fixLabel: git.ok ? undefined : 'Install Git', fixAction: git.ok ? undefined : 'install',
  });

  const billingVars = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'].filter((n) => n in process.env);
  if (billingVars.length) {
    checks.push({
      id: 'billing', label: 'What your sessions are billed to', ok: false,
      detail: `${billingVars.join(' and ')} is set, so Claude Code bills the API per token instead of your plan. Unset it and restart Super Builds if that is not what you want. Super Builds never reads its value.`,
      why: 'One of the most-reported billing surprises, and easy to miss.',
    });
  }

  const [vercel, pw, ffmpeg] = await Promise.all([probe('vercel'), Promise.resolve(playwrightBrowserPresent()), probe('ffmpeg')]);
  checks.push({
    id: 'vercel', label: 'Vercel CLI', ok: vercel.present, optional: true, detail: vercel.present ? vercel.detail : 'Not installed',
    why: 'Publishes a site in one press. You sign in through your own browser.', unlocks: 'One-press publishing',
    fixLabel: vercel.present ? undefined : 'Install Vercel CLI', fixAction: vercel.present ? undefined : 'install',
  });
  checks.push({
    id: 'playwright', label: 'Playwright browser', ok: pw.present, optional: true, detail: pw.detail,
    why: 'Captures reference websites and takes dashboard thumbnails.', unlocks: 'Reference capture, thumbnails',
    fixLabel: pw.present ? undefined : 'Download browser', fixAction: pw.present ? undefined : 'install',
  });
  checks.push({
    id: 'ffmpeg', label: 'ffmpeg', ok: ffmpeg.present, optional: true, detail: ffmpeg.present ? ffmpeg.detail : 'Not installed',
    why: 'Makes the scrub video of a reference capture.', unlocks: 'Reference video',
    fixLabel: ffmpeg.present ? undefined : 'Install ffmpeg', fixAction: ffmpeg.present ? undefined : 'install',
  });

  return {
    ok: checks.every((c) => c.ok || c.optional),
    checks,
    claudeVersion: versionNumber,
    claudeBin: bin,
    checkedAt: Date.now(),
    account: signedIn ? { email: info.email, plan: info.subscriptionType } : undefined,
    platform: currentPlatform(),
  };
}
