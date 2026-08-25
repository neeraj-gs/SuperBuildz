/**
 * The daemon's per-boot token, for the scripts that drive it.
 *
 * It is handed out over the socket and nowhere else, which used not to matter
 * to a script that only read things — reads were open. They are not any more:
 * anything under `/api/projects` or `/api/sessions` needs the token now, on GET
 * as well as on POST, because a loose CORS rule with open reads would have let
 * any local page read somebody's source. See `daemon/src/origins.ts`.
 *
 * So every script that asks the daemon about a project comes through here.
 */

import WebSocket from 'ws';

const DAEMON = Number(process.env.SUPERBUILDS_PORT ?? 7747);

/** Opens a socket, takes the token from the first frame, closes it. */
export function daemonToken({ port = DAEMON, keepOpen = false } = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin: `http://127.0.0.1:${port}` });
    const fail = (e) => reject(new Error(`No token from the daemon on ${port}. Is it running? (${e?.message ?? e})`));
    ws.on('error', fail);
    ws.on('close', () => reject(new Error(`The daemon on ${port} closed the socket without a token.`)));
    ws.on('message', (m) => {
      let ev; try { ev = JSON.parse(m.toString()); } catch { return; }
      if (ev.type !== 'hello') return;
      if (keepOpen) resolve({ token: ev.token, ws });
      else { ws.removeAllListeners('close'); ws.close(); resolve(ev.token); }
    });
  });
}

/** `fetch`, with the token already on it. */
export async function daemonFetch(path, init = {}, { port = DAEMON, token } = {}) {
  const t = token ?? await daemonToken({ port });
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    ...init,
    headers: { ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers, 'x-superbuilds-token': t },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}
