/**
 * Running the site next to the conversation that is building it.
 *
 * Starts the project's own `npm run dev` on a stable port of its own and
 * reports the URL once it answers. The server is the project's; nothing is
 * proxied or rewritten.
 */

import type { ChildProcess } from 'node:child_process';
import type { PreviewState } from '@superbuilds/protocol';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnBin, execPlain } from './binaries.ts';
import { portFor, portEnv, releasePort } from './ports.ts';
import { broadcast } from './bus.ts';

interface Running { child: ChildProcess; state: PreviewState }
const previews = new Map<string, Running>();
const MAX_LOG = 30_000;

export function previewState(projectId: string): PreviewState {
  return previews.get(projectId)?.state ?? { projectId, running: false, log: '' };
}

function push(projectId: string, patch: Partial<PreviewState>) {
  const r = previews.get(projectId);
  if (!r) return;
  r.state = { ...r.state, ...patch };
  broadcast({ type: 'preview.update', state: r.state });
}

export async function startPreview(projectId: string, projectPath: string, avoid: number[] = []): Promise<PreviewState> {
  const existing = previews.get(projectId);
  if (existing && existing.child.exitCode === null) return existing.state;

  const port = await portFor(`preview:${projectId}`, avoid);
  if (!port) {
    const state: PreviewState = { projectId, running: false, log: '', error: 'No free port between 43000 and 44999.' };
    previews.set(projectId, { child: { exitCode: 0 } as ChildProcess, state });
    broadcast({ type: 'preview.update', state });
    return state;
  }

  const { script, args } = devCommand(projectPath, port);
  const child = spawnBin('npm', ['run', script, '--', ...args], {
    cwd: projectPath, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...portEnv(port), BROWSER: 'none', FORCE_COLOR: '0', NEXT_TELEMETRY_DISABLED: '1' },
  });
  const state: PreviewState = { projectId, running: true, port, log: '', startedAt: Date.now() };
  previews.set(projectId, { child, state });
  broadcast({ type: 'preview.update', state });

  const onData = (chunk: string) => {
    const r = previews.get(projectId); if (!r) return;
    const log = (r.state.log + chunk).slice(-MAX_LOG);
    const url = r.state.url ?? (/(https?:\/\/(?:localhost|127\.0\.0\.1)[^\s]*)/.exec(chunk)?.[1]?.replace('localhost', '127.0.0.1'));
    push(projectId, { log, url: url ? url.replace(/\/$/, '') : r.state.url });
  };
  child.stdout?.setEncoding('utf8'); child.stdout?.on('data', onData);
  child.stderr?.setEncoding('utf8'); child.stderr?.on('data', onData);
  child.on('error', (err) => push(projectId, { running: false, error: err.message }));
  child.on('close', (code) => {
    const r = previews.get(projectId);
    const log = r?.state.log ?? '';
    const startedOk = !!r?.state.url;
    releasePort(`preview:${projectId}`);

    // A dev server that dies before it ever answered has failed, and the
    // person pressed a button to make it happen. Saying only "the preview is
    // stopped" leaves them with a blank panel and no idea why — which is
    // exactly what a squatted port looked like.
    if (startedOk || code === 0 || code === null) {
      push(projectId, { running: false, exitCode: code ?? undefined, url: undefined, error: undefined });
      return;
    }

    if (portCollision(log) && avoid.length < 3) {
      // Something else already holds the port — usually a dev server orphaned
      // when a previous daemon was killed rather than closed. Move over rather
      // than making this project permanently un-previewable.
      push(projectId, { running: false, exitCode: code, url: undefined, error: `Port ${port} was taken. Trying another…` });
      previews.delete(projectId);
      void startPreview(projectId, projectPath, [...avoid, port]).catch(() => {});
      return;
    }

    push(projectId, { running: false, exitCode: code, url: undefined, error: explain(log, code) });
  });

  // Poll until it answers, so `url` means "will render" rather than "was printed".
  const target = `http://127.0.0.1:${port}`;
  void (async () => {
    for (let i = 0; i < 240; i++) {
      const r = previews.get(projectId);
      if (!r || r.child.exitCode !== null) return;
      try {
        const res = await fetch(target, { signal: AbortSignal.timeout(3000) });
        if (res.status < 500) { push(projectId, { url: target }); return; }
      } catch { /* not yet */ }
      await new Promise((r) => setTimeout(r, 1000));
    }
  })();

  return state;
}

export async function stopPreview(projectId: string): Promise<PreviewState> {
  const r = previews.get(projectId);
  if (!r) return previewState(projectId);
  await killTree(r.child);
  push(projectId, { running: false, url: undefined });
  releasePort(`preview:${projectId}`);
  previews.delete(projectId);
  return { projectId, running: false, log: r.state.log };
}

export async function stopAllPreviews() {
  for (const id of [...previews.keys()]) await stopPreview(id);
}

/** On Windows the dev server is a grandchild of cmd; kill the tree, not the shell. */
export async function killTree(child: ChildProcess) {
  if (child.exitCode !== null || !child.pid) return;
  if (process.platform === 'win32') {
    await execPlain('taskkill', ['/pid', String(child.pid), '/T', '/F'], 10_000);
  } else {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} }
  }
}

/** Did it fail because something already had the port? */
function portCollision(log: string): boolean {
  return /EADDRINUSE|address already in use|already in use/i.test(log);
}

/**
 * The last thing worth reading out of a dev server's output. People do not
 * read stack traces; they read one line and decide whether to try again.
 *
 * Known causes are matched against the whole log rather than a single line,
 * because the messages that matter wrap: Windows prints "'next' is not
 * recognized as an internal or external command," and then "operable program
 * or batch file." on the next line, and taking the last line alone produced
 * exactly that fragment as the explanation.
 */
function explain(log: string, code: number | null): string {
  const clean = log.replace(/\u001b\[[0-9;]*m/g, '');
  const flat = clean.replace(/\s+/g, ' ');

  if (portCollision(flat)) return 'Every port it tried was already in use. Something else is running.';
  if (/is not recognized as an internal or external command|command not found|ENOENT/i.test(flat)) {
    return "The dev server could not be started — the project's dependencies are missing. Open the folder and run npm install.";
  }
  if (/Cannot find module|MODULE_NOT_FOUND/i.test(flat)) {
    return 'A dependency is missing. Open the folder and run npm install.';
  }
  if (/Missing script: "?dev/i.test(flat)) return 'This folder has no `npm run dev` script, so there is nothing to preview.';
  if (/EACCES|permission denied/i.test(flat)) return 'Permission denied starting the dev server in that folder.';

  // Otherwise the last real sentence, joined with its continuation if it wrapped.
  const lines = clean
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('at ') && !/^[>|]/.test(l) && !/^[{}]/.test(l));
  const last = lines.at(-1);
  if (!last) return `The dev server exited with code ${code}.`;
  const prev = lines.at(-2);
  const wrapped = prev && /[,;]$/.test(prev) ? `${prev} ${last}` : last;
  return wrapped.slice(0, 220);
}


/**
 * How to start *this* project's dev server on a given port.
 *
 * Generated sites are always Next, where the flag is `-p`. A revamped site is
 * whatever somebody already had, and the flag is different in every framework:
 * Vite and Astro want `--port`, Next wants `-p`, and passing the wrong one
 * makes the server exit with a usage message that reads like our bug. PORT is
 * set in the environment as well, which several of them honour on their own and
 * none of them mind.
 *
 * `start` is the fallback because Create React App and a few older setups have
 * no `dev` script at all.
 */
function devCommand(projectPath: string, port: number): { script: string; args: string[] } {
  let pkg: { scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> } = {};
  try { pkg = JSON.parse(readFileSync(join(projectPath, 'package.json'), 'utf8')); } catch { /* no package.json: npm will say so */ }

  const scripts = pkg.scripts ?? {};
  const script = scripts.dev ? 'dev' : scripts.start ? 'start' : 'dev';
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const command = scripts[script] ?? '';

  // Read the script itself first: it says what is actually being run, which
  // beats guessing from the dependency list when a project has several.
  if (/\bnext\b/.test(command) || 'next' in deps) return { script, args: ['-p', String(port)] };
  if (/\b(vite|astro)\b/.test(command) || 'vite' in deps || 'astro' in deps) return { script, args: ['--port', String(port), '--strictPort'] };
  if (/\bnuxt\b/.test(command) || 'nuxt' in deps) return { script, args: ['--port', String(port)] };

  // Anything else: PORT in the environment is the only portable lever, and
  // adding a flag it does not understand would stop it starting at all.
  return { script, args: [] };
}
