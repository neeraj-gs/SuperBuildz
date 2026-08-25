/**
 * One store: the route, the socket, and everything the daemon pushes.
 * Zustand, because a tool with five screens does not need a router library
 * or a state framework — it needs one place that is true.
 */

import { create } from 'zustand';
import type {
  Detection, Project, Session, GenerationState, PreviewState, DeployState, ReferenceCapture, ServerEvent, Catalogue, Turn, ToolCall, TweakState, AnalyticsState, Capacity,
} from '@superbuilds/protocol';
import { api, setToken } from './api';

export type Route =
  | { name: 'landing' }
  | { name: 'setup' }
  | { name: 'projects' }
  | { name: 'new'; from?: string }
  | { name: 'revamp' }
  // The board, optionally narrowed to one project — which is how the workspace
  // opens it, and why the filter is in the path rather than in a component's
  // own state: it survives a reload and can be linked to.
  | { name: 'sessions'; project?: string }
  // `session` is which conversation to land on, set when the board opens one.
  | { name: 'project'; id: string; session?: string };

function parseRoute(path: string): Route {
  if (path === '/setup') return { name: 'setup' };
  if (path === '/projects') return { name: 'projects' };
  if (path === '/new') return { name: 'new' };
  if (path === '/revamp') return { name: 'revamp' };
  if (path === '/sessions') return { name: 'sessions' };
  const b = path.match(/^\/sessions\/p\/([^/]+)/);
  if (b) return { name: 'sessions', project: b[1] };
  const m = path.match(/^\/p\/([^/]+)(?:\/c\/([^/]+))?/);
  if (m) return { name: 'project', id: m[1], session: m[2] };
  return { name: 'landing' };
}
export function pathFor(r: Route): string {
  switch (r.name) {
    case 'setup': return '/setup';
    case 'projects': return '/projects';
    case 'new': return '/new';
    case 'revamp': return '/revamp';
    case 'sessions': return r.project ? `/sessions/p/${r.project}` : '/sessions';
    case 'project': return r.session ? `/p/${r.id}/c/${r.session}` : `/p/${r.id}`;
    default: return '/';
  }
}

export interface Toast { id: number; text: string; kind: 'info' | 'error' | 'ok' }

/**
 * A question the interface asks and waits for.
 *
 * `window.confirm` was doing this job, and it is the one piece of the product
 * nobody designed: it says "127.0.0.1:5180 says", it cannot show what will
 * happen, it cannot be styled, and on a page about how a site should look it
 * is the loudest possible admission that this part was not thought about. It
 * also blocks the whole tab, which matters here — several conversations may be
 * mid-turn behind it.
 */
export interface Ask {
  id: number;
  title: string;
  body?: string;
  /** Extra lines under the body, each a fact about what is about to happen. */
  points?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  icon?: string;
  /** Present when the answer is a line of text rather than yes or no. */
  input?: { label?: string; placeholder?: string; value?: string };
  resolve: (v: string | boolean | null) => void;
}

/**
 * What the socket is doing.
 *
 * `connected` used to be the whole story, and the whole interface it bought was
 * the word "daemon offline" in the corner — true, useless, and hidden on a
 * phone. It was showing for a reason nothing on screen could have told anybody:
 * the interface had moved to another port and the daemon was refusing the
 * socket on the old one. So the state now carries what a probe found, and the
 * badge says it.
 */
export type Link = 'connecting' | 'live' | 'down';

interface State {
  route: Route;
  connected: boolean;
  link: Link;
  /** What is wrong, in a sentence, when `link` is 'down'. */
  linkNote: string;
  /** Attempts since the last time it was live. Shown so a long outage looks like one. */
  linkTries: number;
  token: string;
  detection?: Detection;
  catalogue?: Catalogue;
  projects: Record<string, Project>;
  sessions: Record<string, Session>;
  /** Streaming text per turn, before the turn is finalised. */
  streaming: Record<string, string>;
  thinking: Record<string, string>;
  generations: Record<string, GenerationState>;
  previews: Record<string, PreviewState>;
  deploys: Record<string, DeployState>;
  captures: Record<string, ReferenceCapture>;
  tweaks: Record<string, TweakState>;
  analytics: Record<string, AnalyticsState>;
  capacity?: Capacity;
  toasts: Toast[];
  dialogs: Ask[];
  navigate: (r: Route) => void;
  toast: (text: string, kind?: Toast['kind']) => void;
  dismissToast: (id: number) => void;
  answer: (id: number, value: string | boolean | null) => void;
  loadCatalogue: () => Promise<Catalogue>;
  loadDetection: () => Promise<Detection>;
  loadProjects: () => Promise<void>;
  loadSession: (id: string) => Promise<Session>;
  apply: (ev: ServerEvent) => void;
}

let toastSeq = 1;

export const useStore = create<State>((set, get) => ({
  route: parseRoute(window.location.pathname),
  connected: false,
  link: 'connecting',
  linkNote: '',
  linkTries: 0,
  token: '',
  projects: {},
  sessions: {},
  streaming: {},
  thinking: {},
  generations: {},
  previews: {},
  deploys: {},
  captures: {},
  tweaks: {},
  analytics: {},
  toasts: [],
  dialogs: [],

  navigate: (r) => {
    const path = pathFor(r);
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
    set({ route: r });
    window.scrollTo({ top: 0 });
  },
  toast: (text, kind = 'info') => {
    const id = toastSeq++;
    set((s) => ({ toasts: [...s.toasts, { id, text, kind }] }));
    setTimeout(() => get().dismissToast(id), kind === 'error' ? 8000 : 4200);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  answer: (id, value) => {
    const d = get().dialogs.find((x) => x.id === id);
    set((s) => ({ dialogs: s.dialogs.filter((x) => x.id !== id) }));
    d?.resolve(value);
  },

  loadCatalogue: async () => { const c = get().catalogue ?? await api.catalogue(); set({ catalogue: c }); return c; },
  loadDetection: async () => { const d = await api.detect(); set({ detection: d }); return d; },
  loadProjects: async () => { const list = await api.projects(); set({ projects: Object.fromEntries(list.map((p) => [p.id, p])) }); },
  loadSession: async (id) => { const s = await api.session(id); set((st) => ({ sessions: { ...st.sessions, [s.id]: s } })); return s; },

  apply: (ev) => {
    switch (ev.type) {
      case 'hello': setToken(ev.token); set({ token: ev.token, connected: true, link: 'live', linkNote: '', linkTries: 0 }); break;
      case 'detection': set({ detection: ev.detection }); break;
      case 'project.upsert': set((s) => ({ projects: { ...s.projects, [ev.project.id]: ev.project } })); break;
      case 'project.remove': set((s) => { const p = { ...s.projects }; delete p[ev.projectId]; return { projects: p }; }); break;
      case 'session.upsert': set((s) => ({ sessions: { ...s.sessions, [ev.session.id]: ev.session } })); break;
      case 'session.delta': set((s) => ({ streaming: { ...s.streaming, [ev.turnId]: (s.streaming[ev.turnId] ?? '') + ev.text } })); break;
      case 'session.thinking': set((s) => ({ thinking: { ...s.thinking, [ev.turnId]: ((s.thinking[ev.turnId] ?? '') + ev.text).slice(-2000) } })); break;
      case 'session.tool': set((s) => {
        const sess = s.sessions[ev.sessionId]; if (!sess) return {};
        const turns = sess.turns.map((t) => {
          if (t.id !== ev.turnId) return t;
          const tools: ToolCall[] = [...(t.tools ?? [])];
          const i = tools.findIndex((x) => x.id === ev.tool.id);
          if (i === -1) tools.push(ev.tool); else tools[i] = ev.tool;
          return { ...t, tools };
        });
        // A tool can arrive before the partial assistant turn has been seen by this client.
        if (!turns.some((t) => t.id === ev.turnId)) turns.push({ id: ev.turnId, role: 'assistant', text: '', at: Date.now(), partial: true, tools: [ev.tool] } as Turn);
        return { sessions: { ...s.sessions, [sess.id]: { ...sess, turns } } };
      }); break;
      case 'session.turn': set((s) => {
        const sess = s.sessions[ev.sessionId];
        if (!sess) return {};
        const turns = sess.turns.some((t) => t.id === ev.turn.id) ? sess.turns.map((t) => (t.id === ev.turn.id ? { ...t, ...ev.turn, tools: ev.turn.tools ?? t.tools } : t)) : [...sess.turns, ev.turn];
        const streaming = { ...s.streaming }; if (!ev.turn.partial) delete streaming[ev.turn.id];
        return { sessions: { ...s.sessions, [sess.id]: { ...sess, turns } }, streaming };
      }); break;
      case 'generation.update': set((s) => ({ generations: { ...s.generations, [ev.state.projectId]: ev.state } })); break;
      case 'preview.update': set((s) => ({ previews: { ...s.previews, [ev.state.projectId]: ev.state } })); break;
      case 'deploy.update': set((s) => ({ deploys: { ...s.deploys, [ev.state.projectId]: ev.state } })); break;
      case 'reference.update': set((s) => ({ captures: { ...s.captures, [ev.capture.id]: ev.capture } })); break;
      case 'tweaks.update': set((s) => ({ tweaks: { ...s.tweaks, [ev.state.projectId]: ev.state } })); break;
      case 'analytics.update': set((s) => ({ analytics: { ...s.analytics, [ev.state.projectId]: ev.state } })); break;
      case 'capacity.update': set({ capacity: ev.capacity }); break;
      case 'session.remove': set((s) => { const sessions = { ...s.sessions }; delete sessions[ev.sessionId]; return { sessions }; }); break;
      default: break;
    }
  },
}));

/* Socket */

let socket: WebSocket | null = null;
let backoff = 500;
let retry: ReturnType<typeof setTimeout> | undefined;

/**
 * Why the socket is not up, asked of the daemon rather than guessed.
 *
 * The two cases look identical from inside the interface and want completely
 * different sentences: nothing is listening at all, or something is listening
 * and would not take the socket. The second is what a port change produces, and
 * it is the one that used to be unexplainable.
 */
const GONE = 'Nothing is answering on this address. The daemon has stopped — start it again with npm run dev in the project folder.';

async function diagnose(): Promise<string> {
  try {
    const res = await fetch('/api/health', { cache: 'no-store' });
    // Only the daemon's own answer counts as the daemon answering. In
    // development the interface is served by Vite, which proxies to the daemon
    // and answers 500 itself when there is nothing to proxy to — so a status
    // code alone reported a dead daemon as a daemon returning an error, which
    // is precisely the sort of confident wrong sentence this whole thing exists
    // to stop.
    const alive = res.ok && (await res.text()).includes('"ok"');
    return alive
      ? 'The daemon is running, but it would not take the live connection. Reloading the page usually settles it; if it does not, stop and restart with npm run dev.'
      : GONE;
  } catch {
    return GONE;
  }
}

export function connect() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
  clearTimeout(retry);
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  socket = new WebSocket(`${proto}://${window.location.host}/ws`);
  socket.onopen = () => { backoff = 500; };
  socket.onmessage = (m) => { try { useStore.getState().apply(JSON.parse(m.data) as ServerEvent); } catch { /* ignore */ } };
  socket.onclose = () => {
    const tries = useStore.getState().linkTries + 1;
    useStore.setState({ connected: false, link: 'down', linkTries: tries });
    // Only ask on the first failure and then occasionally: the point is one
    // good sentence, not a health check every second of an outage.
    if (tries === 1 || tries % 5 === 0) void diagnose().then((linkNote) => { if (!useStore.getState().connected) useStore.setState({ linkNote }); });
    retry = setTimeout(connect, backoff);
    backoff = Math.min(backoff * 1.8, 8000);
  };
  socket.onerror = () => { try { socket?.close(); } catch {} };
}

/** Try again now, rather than at the end of the backoff. */
export function reconnect() {
  backoff = 500;
  useStore.setState({ link: 'connecting' });
  try { socket?.close(); } catch {}
  socket = null;
  connect();
}

/*
  A laptop that slept, or wifi that came back, has a dead socket and no event
  to tell it so — the close arrives when the tab wakes and the backoff may be at
  its eight-second ceiling. Both of these are the moment somebody is looking at
  the screen again, which is exactly when waiting is least acceptable.
*/
window.addEventListener('online', () => { if (!useStore.getState().connected) reconnect(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !useStore.getState().connected) reconnect();
});

window.addEventListener('popstate', () => useStore.setState({ route: parseRoute(window.location.pathname) }));

export const navigate = (r: Route) => useStore.getState().navigate(r);
export const toast = (text: string, kind?: Toast['kind']) => useStore.getState().toast(text, kind);

let askSeq = 1;
function open(a: Omit<Ask, 'id' | 'resolve'>): Promise<string | boolean | null> {
  return new Promise((resolve) => {
    const id = askSeq++;
    useStore.setState((s) => ({ dialogs: [...s.dialogs, { ...a, id, resolve }] }));
  });
}

/** Yes or no, with the consequence spelled out. Resolves false if dismissed. */
export async function ask(a: Omit<Ask, 'id' | 'resolve' | 'input'>): Promise<boolean> {
  return (await open(a)) === true;
}

/** One line of text, or null if dismissed. */
export async function askText(a: Omit<Ask, 'id' | 'resolve'> & { input: NonNullable<Ask['input']> }): Promise<string | null> {
  const v = await open(a);
  return typeof v === 'string' ? v : null;
}
