/**
 * The daemon's API, typed. Every mutating call carries the per-boot token the
 * socket handed us; a 401 means reload.
 */

import type {
  Catalogue, Detection, InstallRecipeView, Plan, Project, Session, Spec, GenerationState, PreviewState, DeployState,
  ReferenceCapture, Choice, TweakState, Tweaks, Direction, FileEntry, FileBody, AdminLogin, AnalyticsState, EngineInfo, SiteSurvey, Understanding, Capacity, ProjectMemory,
} from '@superbuilds/protocol';

let token = '';
export function setToken(t: string) { token = t; }

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  // No content-type without a body: Fastify answers 400 to an empty JSON body,
  // which turned every bodiless POST (start preview, stop, sign in) into a failure.
  const res = await fetch(path, {
    method,
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { 'x-superbuilds-token': token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data as { error?: string })?.error ?? `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return data as T;
}

const get = <T,>(p: string) => call<T>('GET', p);
const post = <T,>(p: string, b?: unknown) => call<T>('POST', p, b);
const patch = <T,>(p: string, b?: unknown) => call<T>('PATCH', p, b);
const del = <T,>(p: string) => call<T>('DELETE', p);

export interface Question { id: string; question: string; why?: string; options: Array<{ label: string; hint?: string }>; multi?: boolean }

export interface FolderEntry { name: string; path: string; site?: boolean }
export interface FolderListing { ok: boolean; path: string; up?: string; entries: FolderEntry[]; places: FolderEntry[]; reason?: string; truncated?: boolean }

export const api = {
  health: () => get<{ ok: boolean }>('/api/health'),
  detect: () => get<Detection>('/api/detect'),
  installPlan: () => get<{ platform: string; recipes: InstallRecipeView[] }>('/api/install/plan'),
  install: (ids: string[]) => post<{ ok: boolean; message: string }>('/api/install', { ids }),
  authLogin: () => post<{ ok: boolean; message: string }>('/api/auth/login'),
  provision: (ids: string[]) => post<{ sessionId: string; busy?: boolean }>('/api/provision', { ids }),
  models: () => get<string[]>('/api/models'),

  catalogue: () => get<Catalogue>('/api/catalogue'),
  changes: () => get<Choice[]>('/api/changes'),
  defaults: (archetype: string) => get<Omit<Spec, 'name' | 'folder'>>(`/api/spec/defaults?archetype=${encodeURIComponent(archetype)}`),
  suggestFolder: (name: string) => get<{ folder: string }>(`/api/folder/suggest?name=${encodeURIComponent(name)}`),
  checkFolder: (path: string) => post<{ ok: boolean; reason?: string }>('/api/folder/check', { path }),
  pickFolder: (start?: string) => post<{ ok: boolean; path?: string; reason?: string }>('/api/folder/pick', { start }),
  browseFolder: (path?: string) => post<FolderListing>('/api/folder/browse', { path }),
  checkMedia: (path: string) => post<{ ok: boolean; count: number; sample: string[]; totalBytes: number; reason?: string }>('/api/media/check', { path }),
  mediaFolder: () => post<{ folder: string }>('/api/media/folder'),
  mediaList: (folder: string) => get<{ files: Array<{ name: string; size: number }> }>(`/api/media/list?folder=${encodeURIComponent(folder)}`),
  mediaUpload: (folder: string, name: string, data: string) => post<{ name: string; size: number }>('/api/media/upload', { folder, name, data }),
  mediaRemove: (folder: string, name: string) => post<{ ok: true }>('/api/media/remove', { folder, name }),
  mediaFetch: (folder: string, urls: string[]) => post<{ results: Array<{ url: string; name?: string; error?: string }> }>('/api/media/fetch', { folder, urls }),
  plan: (spec: Partial<Spec>) => post<Plan>('/api/plan', spec),
  questions: (spec: Partial<Spec>) => post<{ questions: Question[]; error?: string }>('/api/questions', spec),
  names: (spec: Partial<Spec>) => post<{ names: Array<{ name: string; why?: string }>; error?: string }>('/api/names', spec),

  /* Revamping a site that already exists */
  survey: (path: string) => post<SiteSurvey>('/api/revamp/survey', { path }),
  understand: (path: string, shots: string[] = []) => post<{ survey: SiteSurvey; understanding?: Understanding; error?: string }>('/api/revamp/understand', { path, shots }),

  projects: () => get<Project[]>('/api/projects'),
  project: (id: string) => get<Project>(`/api/projects/${id}`),
  createProject: (spec: Partial<Spec>) => post<Project>('/api/projects', spec),
  patchProject: (id: string, body: { name?: string; spec?: Partial<Spec> }) => patch<Project>(`/api/projects/${id}`, body),
  deleteProject: (id: string) => del<{ ok: boolean }>(`/api/projects/${id}`),
  openFolder: (id: string) => post<{ ok: boolean }>(`/api/projects/${id}/open-folder`),
  openEditor: (id: string) => post<{ ok: boolean; message?: string }>(`/api/projects/${id}/open-editor`),

  generate: (id: string) => post<GenerationState>(`/api/projects/${id}/generate`),
  cancelGenerate: (id: string) => post<{ ok: boolean }>(`/api/projects/${id}/generate/cancel`),
  generation: (id: string) => get<GenerationState | null>(`/api/projects/${id}/generation`),

  projectSession: (id: string) => get<Session>(`/api/projects/${id}/session`),

  /* Several conversations at once, and the notebook they share */
  capacity: () => get<Capacity>('/api/capacity'),
  sessions: (id: string) => get<Session[]>(`/api/projects/${id}/sessions`),
  newSession: (id: string, title?: string) => post<Session>(`/api/projects/${id}/sessions`, { title }),
  renameSession: (sid: string, title: string) => patch<Session>(`/api/sessions/${sid}`, { title }),
  deleteSession: (sid: string) => del<{ ok: boolean }>(`/api/sessions/${sid}`),
  memory: (id: string) => get<ProjectMemory>(`/api/projects/${id}/memory`),
  setMemory: (id: string, text: string) => post<ProjectMemory>(`/api/projects/${id}/memory`, { text }),
  session: (id: string) => get<Session>(`/api/sessions/${id}`),
  turn: (sid: string, text: string, model?: string) => post<{ ok: boolean }>(`/api/sessions/${sid}/turn`, { text, model }),
  change: (sid: string, kind: string, targets: string[], notes?: string) => post<{ ok: boolean }>(`/api/sessions/${sid}/change`, { kind, targets, notes }),
  stop: (sid: string) => post<{ how: string }>(`/api/sessions/${sid}/stop`),
  rewind: (sid: string, turnId: string) => post<{ ok: boolean; message: string }>(`/api/sessions/${sid}/rewind`, { turnId }),

  preview: (id: string) => get<PreviewState>(`/api/projects/${id}/preview`),
  startPreview: (id: string) => post<PreviewState>(`/api/projects/${id}/preview/start`),
  stopPreview: (id: string) => post<PreviewState>(`/api/projects/${id}/preview/stop`),
  thumbnail: (id: string) => post<{ thumbnail?: string }>(`/api/projects/${id}/thumbnail`),

  referenceAvailable: () => get<{ ok: boolean; reason?: string }>('/api/reference/available'),
  capture: (url: string) => post<ReferenceCapture>('/api/reference', { url }),
  captureState: (id: string) => get<ReferenceCapture>(`/api/reference/${id}`),

  directions: (id: string) => get<{ directions: Direction[] }>(`/api/projects/${id}/directions`),
  proposeDirections: (id: string) => post<{ directions: Direction[] }>(`/api/projects/${id}/directions`),
  chooseDirection: (id: string, direction: string) => post<TweakState>(`/api/projects/${id}/directions/choose`, { id: direction }),

  tweaks: (id: string) => get<TweakState>(`/api/projects/${id}/tweaks`),
  setTweaks: (id: string, values: Record<string, unknown> | Tweaks, replace = false) =>
    post<TweakState>(`/api/projects/${id}/tweaks`, { values, replace }),
  shuffleTweaks: (id: string) => post<TweakState>(`/api/projects/${id}/tweaks/shuffle`),

  /* The project's own files. `path` is always project-relative. */
  files: (id: string, path = '') => get<{ path: string; entries: FileEntry[] }>(`/api/projects/${id}/files?path=${encodeURIComponent(path)}`),
  file: (id: string, path: string) => get<FileBody>(`/api/projects/${id}/file?path=${encodeURIComponent(path)}`),
  saveFile: (id: string, path: string, text: string) => post<FileBody>(`/api/projects/${id}/file`, { path, text }),
  newFile: (id: string, path: string, dir = false) => post<FileEntry>(`/api/projects/${id}/file/new`, { path, dir }),
  deleteFile: (id: string, path: string) => post<{ ok: true }>(`/api/projects/${id}/file/delete`, { path }),
  revertFile: (id: string, path: string) => post<{ ok: boolean; message: string }>(`/api/projects/${id}/file/revert`, { path }),
  searchFiles: (id: string, q: string) => get<{ hits: Array<{ path: string; line?: number; text?: string }> }>(`/api/projects/${id}/search?q=${encodeURIComponent(q)}`),

  /* Under the hood */
  engine: (id: string) => get<EngineInfo>(`/api/projects/${id}/engine`),
  saveBrief: (id: string, text: string) => post<{ ok: true }>(`/api/projects/${id}/brief`, { text }),

  /* The CRM login */
  adminLogin: (id: string) => get<AdminLogin>(`/api/projects/${id}/admin`),
  setAdminPassword: (id: string, password?: string) => post<{ email: string; password: string }>(`/api/projects/${id}/admin/password`, { password }),
  setAdminEmail: (id: string, email: string) => post<AdminLogin>(`/api/projects/${id}/admin/email`, { email }),
  forgetAdminPassword: (id: string) => post<AdminLogin>(`/api/projects/${id}/admin/forget`),

  /* Analytics destinations */
  analytics: (id: string) => get<AnalyticsState>(`/api/projects/${id}/analytics`),
  setAnalytics: (id: string, ids: string[]) => post<AnalyticsState>(`/api/projects/${id}/analytics`, { ids }),
  setAnalyticsKeys: (id: string, values: Record<string, string>) => post<AnalyticsState>(`/api/projects/${id}/analytics/keys`, { values }),

  deployStatus: (id: string) => get<DeployState>(`/api/projects/${id}/deploy`),
  deployLogin: (id: string) => post<{ ok: boolean; message: string }>(`/api/projects/${id}/deploy/login`),
  deploy: (id: string, target: 'production' | 'preview' = 'production') => post<DeployState>(`/api/projects/${id}/deploy`, { target }),
  setEnv: (id: string, key: string, value: string) => post<{ ok: boolean }>(`/api/projects/${id}/env`, { key, value }),
};
