/**
 * The two ports, decided in one place.
 *
 * They used to be literals in four files — `ui/package.json`, `vite.config.ts`,
 * `dev.mjs` and two allowlists inside the daemon — which is fine right up until
 * one of them moves. Somebody ran a second project on 5180, Vite quietly took
 * 5181 instead, and three of the five still believed 5180.
 *
 * So: `dev.mjs` asks here once, finds a UI port that is actually free, and
 * hands the same number to both children. The daemon reads it to know where to
 * send anybody who opens :7747; Vite reads it to know where to listen. Neither
 * can be wrong about the other, because neither chose.
 */

import { createServer } from 'node:net';

export const DAEMON_PORT = Number(process.env.SUPERBUILDS_PORT ?? 7747);
export const UI_PORT_DEFAULT = Number(process.env.SUPERBUILDS_UI_PORT ?? 5180);

function canBind(port) {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(port, '127.0.0.1');
  });
}

/**
 * The preferred port if it is free, otherwise the next one that is.
 *
 * Walking forward rather than failing, because "port 5180 is busy" is not a
 * thing anybody using this tool should have to know about — and Vite would
 * have walked forward anyway. The difference is that now the daemon is told.
 */
export async function freeUiPort(preferred = UI_PORT_DEFAULT, tries = 24) {
  for (let i = 0; i < tries; i += 1) {
    const port = preferred + i;
    if (await canBind(port)) return port;
  }
  return preferred;
}
