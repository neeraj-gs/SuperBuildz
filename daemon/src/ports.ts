/**
 * A stable port for every preview. Derived from the project id, checked free,
 * walked forward if taken. Stable rather than random because a number that
 * changes every restart breaks bookmarks and anything that wrote it into config.
 * Window 43000–44999: clear of framework defaults and of the ephemeral range.
 */

import { createServer } from 'node:net';
import { createHash } from 'node:crypto';

const FIRST = 43_000;
const COUNT = 2_000;
const taken = new Map<string, number>();

function free(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(port, '127.0.0.1');
  });
}

export async function portFor(key: string): Promise<number | null> {
  const already = taken.get(key);
  if (already !== undefined) return already;
  const digest = createHash('sha256').update(key).digest();
  const start = digest.readUInt32BE(0) % COUNT;
  const mine = new Set(taken.values());
  for (let i = 0; i < COUNT; i += 1) {
    const port = FIRST + ((start + i) % COUNT);
    if (mine.has(port)) continue;
    if (await free(port)) { taken.set(key, port); return port; }
  }
  return null;
}

export function releasePort(key: string): void { taken.delete(key); }
export function forgetPorts(): void { taken.clear(); }

export function portEnv(port: number): Record<string, string> {
  return { PORT: String(port), SUPERBUILDS_PREVIEW_PORT: String(port) };
}
