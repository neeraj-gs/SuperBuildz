/**
 * One store: the route, the socket, and everything the daemon pushes.
 * Zustand, because a tool with five screens does not need a router library
 * or a state framework — it needs one place that is true.
 */

import { create } from 'zustand';
import type {
  Detection, Project, Session, GenerationState, PreviewState, DeployState, ReferenceCapture, ServerEvent, Catalogue, Turn, ToolCall,
} from '@superbuilds/protocol';
import { api, setToken } from './api';

export type Route =
  | { name: 'landing' }
  | { name: 'setup' }
  | { name: 'projects' }
  | { name: 'new'; from?: string }
  | { name: 'project'; id: string };

function parseRoute(path: string): Route {
  if (path === '/setup') return { name: 'setup' };
  if (path === '/projects') return { name: 'projects' };
  if (path === '/new') return { name: 'new' };
  const m = path.match(/^\/p\/([^/]+)/);
  if (m) return { name: 'project', id: m[1] };
  return { name: 'landing' };
}
export function pathFor(r: Route): string {
  switch (r.name) {
    case 'setup': return '/setup';
    case 'projects': return '/projects';
    case 'new': return '/new';
    case 'project': return `/p/${r.id}`;
    default: return '/';
  }
}

export interface Toast { id: number; text: string; kind: 'info' | 'error' | 'ok' }

interface State {
  route: Route;
  connected: boolean;
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
  toasts: Toast[];
  navigate: (r: Route) => void;
  toast: (text: string, kind?: Toast['kind']) => void;
  dismissToast: (id: number) => void;
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
  token: '',
  projects: {},
  sessions: {},
  streaming: {},
  thinking: {},
  generations: {},
  previews: {},
  deploys: {},
  captures: {},
  toasts: [],

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

  loadCatalogue: async () => { const c = get().catalogue ?? await api.catalogue(); set({ catalogue: c }); return c; },
  loadDetection: async () => { const d = await api.detect(); set({ detection: d }); return d; },
  loadProjects: async () => { const list = await api.projects(); set({ projects: Object.fromEntries(list.map((p) => [p.id, p])) }); },
  loadSession: async (id) => { const s = await api.session(id); set((st) => ({ sessions: { ...st.sessions, [s.id]: s } })); return s; },

  apply: (ev) => {
    switch (ev.type) {
      case 'hello': setToken(ev.token); set({ token: ev.token, connected: true }); break;
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
      default: break;
    }
  },
}));

/* Socket */

let socket: WebSocket | null = null;
let backoff = 500;

export function connect() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  socket = new WebSocket(`${proto}://${window.location.host}/ws`);
  socket.onopen = () => { backoff = 500; };
  socket.onmessage = (m) => { try { useStore.getState().apply(JSON.parse(m.data) as ServerEvent); } catch { /* ignore */ } };
  socket.onclose = () => { useStore.setState({ connected: false }); setTimeout(connect, backoff); backoff = Math.min(backoff * 1.8, 8000); };
  socket.onerror = () => { try { socket?.close(); } catch {} };
}

window.addEventListener('popstate', () => useStore.setState({ route: parseRoute(window.location.pathname) }));

export const navigate = (r: Route) => useStore.getState().navigate(r);
export const toast = (text: string, kind?: Toast['kind']) => useStore.getState().toast(text, kind);
