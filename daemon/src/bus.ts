/** Typed broadcast to every connected UI client, and to listeners inside the daemon. */

import type { WebSocket } from 'ws';
import type { ServerEvent } from '@superbuilds/protocol';

const clients = new Set<WebSocket>();
type Listener = (event: ServerEvent) => void;
const listeners = new Set<Listener>();

export function addClient(ws: WebSocket) { clients.add(ws); }
export function removeClient(ws: WebSocket) { clients.delete(ws); }
export function clientCount() { return clients.size; }

export function onEvent(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function broadcast(event: ServerEvent) {
  for (const fn of listeners) { try { fn(event); } catch { /* a broken listener is not the socket's problem */ } }
  const payload = JSON.stringify(event);
  for (const ws of clients) {
    if (ws.readyState === 1) { try { ws.send(payload); } catch { /* cleaned up on close */ } }
  }
}

export function send(ws: WebSocket, event: ServerEvent) {
  if (ws.readyState === 1) ws.send(JSON.stringify(event));
}
