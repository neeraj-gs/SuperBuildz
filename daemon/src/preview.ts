/**
 * Running the site next to the conversation that is building it.
 *
 * Starts the project's own `npm run dev` on a stable port of its own and
 * reports the URL once it answers. The server is the project's; nothing is
 * proxied or rewritten.
 */

import type { ChildProcess } from 'node:child_process';
import type { PreviewState } from '@superbuilds/protocol';
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

export async function startPreview(projectId: string, projectPath: string): Promise<PreviewState> {
  const existing = previews.get(projectId);
  if (existing && existing.child.exitCode === null) return existing.state;

  const port = await portFor(`preview:${projectId}`);
  if (!port) return { projectId, running: false, log: '', error: 'No free port between 43000 and 44999.' };

  const child = spawnBin('npm', ['run', 'dev', '--', '-p', String(port)], {
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
    push(projectId, { running: false, exitCode: code ?? undefined, url: undefined });
    releasePort(`preview:${projectId}`);
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
