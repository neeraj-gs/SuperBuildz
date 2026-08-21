/**
 * Installing what is missing, by id, never by command.
 *
 * The browser names a recipe id; the daemon looks up the vendor's documented
 * command for this platform and opens a terminal the person can watch. Nothing
 * a browser typed reaches a shell. Ported from PowerHouz and re-scoped to what
 * Super Builds actually needs: Claude Code, Node, git, the Vercel CLI, the
 * Playwright browser for reference capture, ffmpeg for recordings.
 */

import { findOnPath, execBin } from './binaries.ts';
import { openTerminal, shellQuote } from './terminal.ts';
import { resolveClaudeBin } from './claude.ts';
import type { InstallRecipeView, InstallStep } from '@superbuilds/protocol';

export type Platform = 'windows' | 'mac' | 'linux';

export interface Recipe {
  id: string;
  label: string;
  why: string;
  docs?: string;
  steps: Record<Platform, InstallStep[]>;
  run: Record<Platform, string[]>;
  attended?: boolean;
}

export function currentPlatform(): Platform {
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'darwin') return 'mac';
  return 'linux';
}

const NPM_CLAUDE = 'npm install -g @anthropic-ai/claude-code';
const NPM_VERCEL = 'npm install -g vercel';
const PW_INSTALL = 'npx --yes playwright@1 install chromium';

export const RECIPES: Recipe[] = [
  {
    id: 'claude',
    label: 'Claude Code',
    why: 'Super Builds runs your own Claude Code. Without it there is nothing to build with.',
    docs: 'https://claude.com/product/claude-code',
    steps: {
      windows: [{ text: 'Install with npm, which ships with Node.js:' }, { command: NPM_CLAUDE }, { text: 'Then close and reopen your terminal so the new command is on PATH.' }],
      mac: [{ text: 'Install with npm:' }, { command: NPM_CLAUDE }, { text: 'Or with Homebrew:' }, { command: 'brew install --cask claude-code' }],
      linux: [{ text: 'Install with npm:' }, { command: NPM_CLAUDE }],
    },
    run: { windows: [NPM_CLAUDE], mac: [NPM_CLAUDE], linux: [NPM_CLAUDE] },
  },
  {
    id: 'node',
    label: 'Node.js',
    why: 'Runs Super Builds, Claude Code, and every website it generates.',
    docs: 'https://nodejs.org',
    steps: {
      windows: [{ text: 'Install the LTS release with winget:' }, { command: 'winget install --id OpenJS.NodeJS.LTS -e' }, { text: 'Then close and reopen your terminal.' }],
      mac: [{ text: 'Install with Homebrew:' }, { command: 'brew install node' }],
      linux: [{ text: 'Use your package manager or nvm:' }, { command: 'curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - && sudo apt-get install -y nodejs' }],
    },
    run: {
      windows: ['winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements'],
      mac: ['brew install node'],
      linux: ['curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - && sudo apt-get install -y nodejs'],
    },
    attended: true,
  },
  {
    id: 'git',
    label: 'Git',
    why: 'Every generated site is a git repository, which is what makes "undo that" possible.',
    docs: 'https://git-scm.com/downloads',
    steps: {
      windows: [{ text: 'Install with winget:' }, { command: 'winget install --id Git.Git -e' }],
      mac: [{ text: 'Install the command line tools:' }, { command: 'xcode-select --install' }],
      linux: [{ command: 'sudo apt-get install -y git' }],
    },
    run: {
      windows: ['winget install --id Git.Git -e --accept-package-agreements --accept-source-agreements'],
      mac: ['xcode-select --install'],
      linux: ['sudo apt-get install -y git'],
    },
    attended: true,
  },
  {
    id: 'vercel',
    label: 'Vercel CLI',
    why: 'Publishes a finished site to Vercel from this machine. You sign in through your own browser; Super Builds never sees the token.',
    docs: 'https://vercel.com/docs/cli',
    steps: {
      windows: [{ command: NPM_VERCEL }],
      mac: [{ command: NPM_VERCEL }],
      linux: [{ command: NPM_VERCEL }],
    },
    run: { windows: [NPM_VERCEL], mac: [NPM_VERCEL], linux: [NPM_VERCEL] },
  },
  {
    id: 'playwright',
    label: 'Playwright browser',
    why: 'Captures a reference website you point at, and takes the thumbnails on the dashboard. About 150MB, once.',
    docs: 'https://playwright.dev/docs/browsers',
    steps: {
      windows: [{ command: PW_INSTALL }],
      mac: [{ command: PW_INSTALL }],
      linux: [{ command: PW_INSTALL }, { text: 'Linux may also need system libraries:' }, { command: 'npx --yes playwright@1 install-deps chromium' }],
    },
    run: { windows: [PW_INSTALL], mac: [PW_INSTALL], linux: [PW_INSTALL] },
  },
  {
    id: 'ffmpeg',
    label: 'ffmpeg',
    why: 'Turns a reference capture into a small video you can scrub.',
    docs: 'https://ffmpeg.org',
    steps: {
      windows: [{ command: 'winget install --id Gyan.FFmpeg -e' }],
      mac: [{ command: 'brew install ffmpeg' }],
      linux: [{ command: 'sudo apt-get install -y ffmpeg' }],
    },
    run: {
      windows: ['winget install --id Gyan.FFmpeg -e --accept-package-agreements --accept-source-agreements'],
      mac: ['brew install ffmpeg'],
      linux: ['sudo apt-get install -y ffmpeg'],
    },
  },
];

export function getRecipe(id: string): Recipe | undefined {
  return RECIPES.find((r) => r.id === id);
}

export function installPlan(): { platform: Platform; recipes: InstallRecipeView[] } {
  const platform = currentPlatform();
  return { platform, recipes: RECIPES.map(({ run, ...rest }) => ({ ...rest, run: run[platform] })) };
}

/** Install by id, in a terminal the person can watch. */
export async function runInstall(ids: string[]): Promise<{ ok: boolean; message: string; commands: string[]; unknown: string[] }> {
  const platform = currentPlatform();
  const unknown: string[] = [];
  const commands: string[] = [];
  const labels: string[] = [];
  for (const id of ids) {
    const r = getRecipe(id);
    if (!r) { unknown.push(id); continue; }
    commands.push(...r.run[platform]);
    labels.push(r.label);
  }
  if (!commands.length) {
    return { ok: false, commands: [], unknown, message: unknown.length ? `Nothing installable is registered under ${unknown.join(', ')}.` : 'Nothing to install.' };
  }
  const res = await openTerminal({ title: `Super Builds: installing ${labels.join(', ')}`, commands, hold: true });
  return {
    ok: res.ok, commands, unknown,
    message: res.ok
      ? `A terminal opened with ${commands.length} command${commands.length === 1 ? '' : 's'}. Watch it there — it may ask for permission. Press Check again when it finishes.`
      : res.message,
  };
}

/** Anthropic's own sign-in, in a visible terminal. We only launch it. */
export async function runAuthLogin(): Promise<{ ok: boolean; message: string }> {
  const bin = resolveClaudeBin();
  const res = await openTerminal({
    title: 'Sign in to Claude Code',
    commands: [`${shellQuote(bin)} auth login`],
    say: ['Signing in to your Anthropic account.', 'Finish in your browser, then come back to Super Builds and press Check again.'],
    hold: true,
  });
  return { ok: res.opened, message: res.opened ? 'Sign-in opened in a terminal window. Return here and press Check again.' : `No terminal window opened. Run this yourself: ${bin} auth login` };
}

/**
 * The prompt handed to Claude Code when the person asks it to sort the machine
 * out. A package manager either works or prints an error; a missing dependency
 * is very often a PATH that needs reopening or a Store alias shadowing a real
 * binary, and those need somebody to look.
 */
export function provisionPrompt(ids: string[]): string {
  const platform = currentPlatform();
  const recipes = ids.map(getRecipe).filter((r): r is Recipe => !!r);
  return [
    `Please install ${recipes.length === 1 ? 'this' : `these ${recipes.length}`} on this machine, then prove ${recipes.length === 1 ? 'it works' : 'each one works'}. This machine is ${process.platform}.`,
    '',
    ...recipes.flatMap((r) => [
      `${r.label}`,
      `  what it is for: ${r.why}`,
      `  the documented command here: ${r.run[platform].join(' && ')}`,
      ...(r.docs ? [`  vendor documentation: ${r.docs}`] : []),
      ...(r.attended ? ['  this one may prompt for permission.'] : []),
    ]),
    '',
    'How to go about it:',
    '  1. Look before installing. It may already be here and simply not on PATH, or shadowed by something answering to the same name. On Windows a Microsoft Store alias answers to `python` and is not an interpreter.',
    '  2. Prefer the command above; it is what the vendor documents. Deviate only with a reason, and say what it was.',
    '  3. After each one, run its version command yourself and paste what it printed. An installer exiting zero is not evidence.',
    '  4. If PATH needs reopening before it takes effect, say so plainly, and say that Super Builds has to be restarted to see it.',
    '',
    'Do not change anything in any project. You are setting up the machine.',
    'Finish with a list: what you installed, which version, and the command to check it again.',
  ].join('\n');
}

/* Probing — cached by promise, so a burst of checks spawns one process each. */

const PROBE_TTL = 20_000;
const probeCache = new Map<string, { at: number; promise: Promise<{ present: boolean; detail: string }> }>();

export function forgetProbes() { probeCache.clear(); }

export function probe(tool: string): Promise<{ present: boolean; detail: string }> {
  const hit = probeCache.get(tool);
  if (hit && Date.now() - hit.at < PROBE_TTL) return hit.promise;
  const promise = runProbe(tool);
  probeCache.set(tool, { at: Date.now(), promise });
  return promise;
}

const TOOL_PROBES: Record<string, Array<[string, string[]]>> = {
  node: [['node', ['--version']]],
  npm: [['npm', ['--version']]],
  git: [['git', ['--version']]],
  vercel: [['vercel', ['--version']]],
  ffmpeg: [['ffmpeg', ['-version']]],
  docker: [['docker', ['--version']]],
};

async function runProbe(tool: string): Promise<{ present: boolean; detail: string }> {
  const attempts = TOOL_PROBES[tool] ?? [[tool, ['--version']]];
  for (const [name, args] of attempts) {
    const bin = findOnPath(name) ?? name;
    const { ok, out } = await execBin(bin, args, { timeout: 12_000 });
    if (!ok || !out) continue;
    if (/was not found|microsoft store|not recognized|ENOENT/i.test(out)) continue;
    return { present: true, detail: out.split('\n')[0].slice(0, 120) };
  }
  return { present: false, detail: 'not found' };
}
