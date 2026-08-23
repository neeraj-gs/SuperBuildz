/**
 * A stable port for every preview. Derived from the project id, checked free,
 * walked forward if taken. Stable rather than random because a number that
 * changes every restart breaks bookmarks and anything that wrote it into config.
 * Window 43000–44999: clear of framework defaults and of the ephemeral range.
 */

import { createServer, createConnection } from 'node:net';
import { createHash } from 'node:crypto';

const FIRST = 43_000;
const COUNT = 2_000;
const taken = new Map<string, number>();

/**
 * Can we bind it, and is nobody already listening?
 *
 * Both halves are needed, and getting this wrong is how a project's preview
 * silently stopped working. A dev server binds the wildcard (`::`, dual-stack);
 * this used to probe `127.0.0.1` specifically, which on Windows can succeed
 * while the wildcard bind fails. So the port read as free, `next dev` was
 * spawned, and it died with EADDRINUSE.
 *
 * The connect probe catches that case without binding anything: if a TCP
 * connection to the loopback port is accepted, somebody is listening, however
 * they bound it — including a wedged orphan that no longer answers HTTP.
 */
function free(port: number): Promise<boolean> {
  return canBind(port).then((ok) => (ok ? nobodyListening(port) : false));
}

function canBind(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(port, '127.0.0.1');
  });
}

function nobodyListening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: '127.0.0.1' });
    const done = (answer: boolean) => { socket.destroy(); resolve(answer); };
    socket.setTimeout(400);
    socket.once('connect', () => done(false));   // something is there
    socket.once('error', () => done(true));      // refused: nothing there
    socket.once('timeout', () => done(true));    // filtered: treat as free
  });
}

/**
 * `avoid` lets a caller re-ask after a port turned out to be unusable —
 * a preview that died with EADDRINUSE despite the probe, say — and get a
 * different one rather than the same answer again.
 */
export async function portFor(key: string, avoid: Iterable<number> = []): Promise<number | null> {
  const skip = new Set(avoid);
  const already = taken.get(key);
  if (already !== undefined && !skip.has(already)) return already;

  const digest = createHash('sha256').update(key).digest();
  const start = digest.readUInt32BE(0) % COUNT;
  const mine = new Set(taken.values());
  for (let i = 0; i < COUNT; i += 1) {
    const port = FIRST + ((start + i) % COUNT);
    if (skip.has(port)) continue;
    if (mine.has(port) && taken.get(key) !== port) continue;
    if (await free(port)) { taken.set(key, port); return port; }
  }
  return null;
}

export function releasePort(key: string): void { taken.delete(key); }
export function forgetPorts(): void { taken.clear(); }

export function portEnv(port: number): Record<string, string> {
  return { PORT: String(port), SUPERBUILDS_PREVIEW_PORT: String(port) };
}
