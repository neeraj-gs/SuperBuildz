/**
 * The daemon. Fastify + ws on 127.0.0.1:7747, serving the built interface,
 * answering the API, pushing events, and answering Claude Code's hooks.
 *
 * Loopback only, and a per-boot token on everything that changes state or
 * answers a hook. The UI receives the token over the socket on connect.
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { WebSocketServer } from 'ws';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import type { Spec } from '@superbuilds/protocol';
import { addClient, removeClient, send, broadcast } from './bus.ts';
import { detect } from './detection.ts';
import { installPlan, runInstall, runAuthLogin, forgetProbes, provisionPrompt } from './install.ts';
import { CATALOGUE, defaultsFor, completeSpec } from './catalogue/index.ts';
import { planFor, questionsPrompt, QUESTIONS_SCHEMA, namesPrompt, NAMES_SCHEMA, CHANGES, changeBrief } from './brief.ts';
import { askOnce, listModels } from './claude.ts';
import { createProject, deleteProject, folderFor, folderIsUsable, getProject, listProjects, updateProject } from './projects.ts';
import { getSession, listSessions, capturesDir, thumbsDir } from './store.ts';
import { createSession, sendTurn, stopTurn, rewindTo, closeAll, configureHooks, sessionIsBusy, renameSession, deleteSession } from './sessions.ts';
import { runGeneration, cancelGeneration, generationState } from './generate.ts';
import { previewState, startPreview, stopPreview, stopAllPreviews } from './preview.ts';
import { startCapture, getCapture, captureAvailable, thumbnailFor } from './reference.ts';
import { deployStatus, vercelLogin, deployProject, setEnvValue } from './deploy.ts';
import { judge, hookResponse } from './policy.ts';
import { tweakState, setTweaks, shufflePalette } from './tweaks.ts';
import { proposeDirections, readDirections, chooseDirection } from './directions.ts';
import { checkMediaFolder, newUploadFolder, saveUpload, removeUpload, fetchImages, listUploads } from './media.ts';
import { listDir, readProjectFile, writeProjectFile, createProjectFile, deleteProjectFile, revertProjectFile, searchProject } from './files.ts';
import { adminLogin, setAdminPassword, setAdminEmail, forgetDevPassword } from './admin.ts';
import { analyticsState, setAnalytics, setAnalyticsKeys } from './analytics.ts';
import { engineInfo, setBrief } from './engine.ts';
import { ceiling, queued, onQueueChange } from './capacity.ts';
import { memory, setMemory } from './memory.ts';
import { surveySite } from './survey.ts';
import { browse, pickFolder } from './picker.ts';
import { understandPrompt, UNDERSTAND_SCHEMA, revampPlan } from './revamp.ts';
import { execPlain } from './binaries.ts';
import { superbuildsHome, uiDist } from './paths.ts';

const PORT = Number(process.env.SUPERBUILDS_PORT ?? 7747);
const HOST = '127.0.0.1';
const TOKEN = randomBytes(24).toString('base64url');
const DEV = process.env.SUPERBUILDS_DEV === '1';

const app = Fastify({ logger: false, bodyLimit: 4 * 1024 * 1024 });

await app.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const ok = [`http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`, 'http://127.0.0.1:5180', 'http://localhost:5180'].includes(origin);
    cb(ok ? null : new Error('origin not allowed'), ok);
  },
  credentials: false,
});

// Static: the built UI, captures and thumbnails. Nothing else on disk is reachable.
mkdirSync(capturesDir(), { recursive: true });
mkdirSync(thumbsDir(), { recursive: true });
await app.register(fastifyStatic, { root: capturesDir(), prefix: '/captures/', decorateReply: false });
await app.register(fastifyStatic, { root: thumbsDir(), prefix: '/thumbs/', decorateReply: false });
if (DEV) {
  // In development the interface is served by Vite with reload; the built
  // `ui/dist` here is whatever `npm run build` last produced, which is a trap
  // — you edit a screen, reload :7747, and see the old one. So don't serve it.
  const VITE = 'http://127.0.0.1:5180';
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api') || req.url.startsWith('/hooks')) return reply.code(404).send({ error: 'not found' });
    return reply.code(302).redirect(VITE + req.url);
  });
} else if (existsSync(join(uiDist(), 'index.html'))) {
  // `wildcard: true` resolves each request against the directory as it is now,
  // so rebuilding the interface while the daemon runs serves the new bundle.
  // Pinning routes at boot made a rebuild answer new asset URLs with the SPA
  // fallback, and the browser refused the HTML as a module script.
  await app.register(fastifyStatic, { root: uiDist(), prefix: '/', decorateReply: true, wildcard: true });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api') || req.url.startsWith('/hooks')) return reply.code(404).send({ error: 'not found' });
    // Only client routes fall back to the shell. A missing asset must 404, or
    // the browser gets HTML where it asked for JavaScript.
    const path = req.url.split('?')[0];
    if (/\.[a-z0-9]{2,5}$/i.test(path)) return reply.code(404).send({ error: 'not found' });
    return reply.sendFile('index.html');
  });
}

/** Mutating routes need the token. Read-only routes do not: the UI loads before it has one. */
function guarded(req: { headers: Record<string, unknown> }): boolean {
  return req.headers['x-superbuilds-token'] === TOKEN;
}
app.addHook('onRequest', async (req, reply) => {
  if (req.method === 'GET' || req.method === 'OPTIONS') return;
  if (req.url.startsWith('/api/') && !guarded(req as never)) return reply.code(401).send({ error: 'missing or wrong token — reload the page' });
});

/* Health, requirements */

app.get('/api/health', async () => ({ ok: true, version: '0.1.0', home: superbuildsHome() }));
app.get('/api/detect', async () => { forgetProbes(); const d = await detect(); broadcast({ type: 'detection', detection: d }); return d; });
app.get('/api/install/plan', async () => installPlan());
app.post('/api/install', async (req) => { const { ids } = (req.body ?? {}) as { ids?: string[] }; return runInstall(Array.isArray(ids) ? ids.map(String) : []); });
app.post('/api/auth/login', async () => runAuthLogin());
app.get('/api/models', async () => listModels());
app.post('/api/provision', async (req) => {
  // Hand the machine to Claude Code: a session in a scratch folder with the install prompt.
  const { ids } = (req.body ?? {}) as { ids?: string[] };
  const dir = join(superbuildsHome(), 'machine'); mkdirSync(dir, { recursive: true });
  let session = listSessions('machine')[0];
  if (!session) session = createSession('machine', 'Setting up this machine');
  if (sessionIsBusy(session.id)) return { sessionId: session.id, busy: true };
  void sendTurn(session.id, provisionPrompt(Array.isArray(ids) ? ids.map(String) : []), dir, 'this machine', { checkpoint: false }).catch(() => {});
  return { sessionId: session.id };
});

/* Catalogue, spec, plan, bounded asks */

app.get('/api/catalogue', async () => CATALOGUE);
app.get('/api/changes', async () => CHANGES);
app.get('/api/spec/defaults', async (req) => defaultsFor(String((req.query as { archetype?: string }).archetype ?? 'other')));
app.get('/api/folder/suggest', async (req) => ({ folder: folderFor(String((req.query as { name?: string }).name ?? 'site')) }));
app.post('/api/folder/check', async (req) => folderIsUsable(String((req.body as { path?: string })?.path ?? '')));

/*
  Choosing a folder.

  Both are POSTs so they sit behind the token guard, even though `browse` only
  reads directory names: a list of what is on somebody's disk is not secret,
  but it is theirs, and there is no reason for it to be the one route that
  answers anybody who finds the port.
*/
app.post('/api/folder/pick', async (req) => pickFolder(String((req.body as { start?: string })?.start ?? '') || undefined));
app.post('/api/folder/browse', async (req) => browse(String((req.body as { path?: string })?.path ?? '') || undefined));
// A folder of photographs is not a project folder: it exists, it is not empty,
// and what matters is what is in it.
app.post('/api/media/check', async (req) => checkMediaFolder(String((req.body as { path?: string })?.path ?? '')));
/* Pictures: a folder, a drop, or a link. All three land in one staging folder. */

app.post('/api/media/folder', async () => ({ folder: newUploadFolder() }));
app.get('/api/media/list', async (req, reply) => {
  try { return { files: listUploads(String((req.query as { folder?: string }).folder ?? '')) }; }
  catch (err) { return reply.code(400).send({ error: (err as Error).message }); }
});
// One file per request with a bigger ceiling than the rest of the API: a photograph
// is two orders of magnitude larger than any other body this daemon accepts, and
// raising the global limit to suit it would raise it for every other route too.
app.post('/api/media/upload', { bodyLimit: 28 * 1024 * 1024 }, async (req, reply) => {
  const { folder, name, data } = (req.body ?? {}) as { folder?: string; name?: string; data?: string };
  try { return saveUpload(String(folder ?? ''), String(name ?? ''), String(data ?? '')); }
  catch (err) { return reply.code(400).send({ error: (err as Error).message }); }
});
app.post('/api/media/remove', async (req, reply) => {
  const { folder, name } = (req.body ?? {}) as { folder?: string; name?: string };
  try { return removeUpload(String(folder ?? ''), String(name ?? '')); }
  catch (err) { return reply.code(400).send({ error: (err as Error).message }); }
});
app.post('/api/media/fetch', async (req, reply) => {
  const { folder, urls } = (req.body ?? {}) as { folder?: string; urls?: string[] };
  try { return { results: await fetchImages(String(folder ?? ''), (urls ?? []).map(String)) }; }
  catch (err) { return reply.code(400).send({ error: (err as Error).message }); }
});

/* Revamping a site that already exists */

app.post('/api/revamp/survey', async (req) => surveySite(String((req.body as { path?: string })?.path ?? '')));

/**
 * The one question the survey cannot answer: what is this business.
 *
 * Read and Glob are allowed because a route list is not the same as reading
 * the pages. Nothing may write, and .env is refused by the same PreToolUse
 * hook that guards every other session — the point of a revamp is that their
 * keys stay theirs, including from us.
 */
app.post('/api/revamp/understand', async (req, reply) => {
  const { path, shots } = (req.body ?? {}) as { path?: string; shots?: string[] };
  const survey = await surveySite(String(path ?? ''));
  if (!survey.ok) return reply.code(400).send({ error: survey.reason });
  try {
    const understanding = await askOnce<Record<string, unknown>>({
      cwd: survey.path,
      // The wizard holds served paths (/captures/<id>/shot-0.png); Read needs
      // the file on disk. Anything that is not one of ours is dropped rather
      // than turned into a path traversal.
      prompt: understandPrompt(survey, (shots ?? []).map(String).flatMap((s) => {
        const m = /^\/captures\/([A-Za-z0-9-]{1,64})\/([A-Za-z0-9._-]{1,64})$/.exec(s);
        return m ? [join(capturesDir(), m[1], m[2])] : [];
      })),
      schema: UNDERSTAND_SCHEMA,
      model: 'sonnet',
      maxBudgetUsd: 1.5,
      allowedTools: ['Read', 'Glob', 'Grep'],
      timeoutMs: 300_000,
    });
    return { survey, understanding };
  } catch (err) {
    // A failed reading is not a failed revamp: the survey alone is enough to
    // open the wizard, and every answer is one somebody can give themselves.
    return reply.code(200).send({ survey, error: (err as Error).message });
  }
});

app.post('/api/plan', async (req, reply) => {
  const spec = completeSpec((req.body ?? {}) as Partial<Spec>);
  // A revamp is planned against the site that is actually there, so the stages,
  // the estimate and the brief all come from the survey rather than the template.
  if (spec.mode === 'revamp') {
    const survey = await surveySite(spec.folder);
    if (!survey.ok) return reply.code(400).send({ error: survey.reason });
    return revampPlan(spec, survey);
  }
  return planFor(spec);
});
app.post('/api/questions', async (req, reply) => {
  const spec = completeSpec((req.body ?? {}) as Partial<Spec>);
  const dir = join(superbuildsHome(), 'scratch'); mkdirSync(dir, { recursive: true });
  try {
    const out = await askOnce<{ questions: unknown[] }>({ cwd: dir, prompt: questionsPrompt(spec), schema: QUESTIONS_SCHEMA, model: 'sonnet', maxBudgetUsd: 0.5, allowedTools: [], timeoutMs: 120_000 });
    return out;
  } catch (err) { return reply.code(200).send({ questions: [], error: (err as Error).message }); }
});
app.post('/api/names', async (req, reply) => {
  const spec = completeSpec((req.body ?? {}) as Partial<Spec>);
  const dir = join(superbuildsHome(), 'scratch'); mkdirSync(dir, { recursive: true });
  try {
    return await askOnce<{ names: unknown[] }>({ cwd: dir, prompt: namesPrompt(spec), schema: NAMES_SCHEMA, model: 'sonnet', maxBudgetUsd: 0.3, allowedTools: [], timeoutMs: 90_000 });
  } catch (err) { return reply.code(200).send({ names: [], error: (err as Error).message }); }
});

/* Projects */

app.get('/api/projects', async () => listProjects());
app.get('/api/projects/:id', async (req, reply) => getProject((req.params as { id: string }).id) ?? reply.code(404).send({ error: 'no such project' }));
app.post('/api/projects', async (req, reply) => {
  const spec = completeSpec((req.body ?? {}) as Partial<Spec>);
  if (!spec.name.trim()) return reply.code(400).send({ error: 'Give it a name first.' });
  const folder = spec.folder?.trim() || folderFor(spec.name);

  if (spec.mode === 'revamp') {
    // The opposite requirement: it has to be a website already, and an empty
    // folder is the failure rather than the prerequisite.
    const survey = await surveySite(folder);
    if (!survey.ok) return reply.code(400).send({ error: survey.reason });
    return createProject({ ...spec, folder: resolve(folder) });
  }

  const usable = folderIsUsable(folder);
  if (!usable.ok) return reply.code(400).send({ error: usable.reason });
  return createProject({ ...spec, folder: resolve(folder) });
});
app.patch('/api/projects/:id', async (req, reply) => {
  const id = (req.params as { id: string }).id;
  const body = (req.body ?? {}) as { name?: string; spec?: Partial<Spec> };
  const p = getProject(id); if (!p) return reply.code(404).send({ error: 'no such project' });
  return updateProject(id, { ...(body.name ? { name: body.name } : {}), ...(body.spec ? { spec: completeSpec({ ...p.spec, ...body.spec, folder: p.path }) } : {}) });
});
app.delete('/api/projects/:id', async (req) => { const id = (req.params as { id: string }).id; await stopPreview(id); deleteProject(id); return { ok: true }; });
app.post('/api/projects/:id/open-editor', async (req, reply) => {
  // Best effort, and it says so: `code` is on PATH for most people who have
  // VS Code and for nobody who does not, and there is no way to know which
  // without trying. A failure here is a message, not an error state.
  const p = getProject((req.params as { id: string }).id); if (!p) return reply.code(404).send({ error: 'no such project' });
  const r = await execPlain(process.platform === 'win32' ? 'code.cmd' : 'code', [p.path], 15_000);
  return r.ok ? { ok: true } : { ok: false, message: 'VS Code did not open. It needs the `code` command on your PATH — in VS Code, run “Shell Command: Install code command in PATH”.' };
});
app.post('/api/projects/:id/open-folder', async (req, reply) => {
  const p = getProject((req.params as { id: string }).id); if (!p) return reply.code(404).send({ error: 'no such project' });
  const cmd = process.platform === 'win32' ? ['explorer', [p.path]] : process.platform === 'darwin' ? ['open', [p.path]] : ['xdg-open', [p.path]];
  try { spawn(cmd[0] as string, cmd[1] as string[], { detached: true, stdio: 'ignore' }).unref(); } catch {}
  return { ok: true };
});

/* Generation */

app.post('/api/projects/:id/generate', async (req, reply) => {
  const id = (req.params as { id: string }).id;
  if (!getProject(id)) return reply.code(404).send({ error: 'no such project' });
  try { void runGeneration(id); } catch (err) { return reply.code(400).send({ error: (err as Error).message }); }
  await new Promise((r) => setTimeout(r, 50));
  return generationState(id) ?? { projectId: id, running: true, stages: [], log: '', costUsd: 0 };
});
app.post('/api/projects/:id/generate/cancel', async (req) => { await cancelGeneration((req.params as { id: string }).id); return { ok: true }; });
app.get('/api/projects/:id/generation', async (req) => generationState((req.params as { id: string }).id) ?? null);

/* Sessions */

app.get('/api/projects/:id/session', async (req, reply) => {
  const id = (req.params as { id: string }).id;
  const p = getProject(id); if (!p) return reply.code(404).send({ error: 'no such project' });
  let s = p.sessionId ? getSession(p.sessionId) : undefined;
  if (!s) { s = createSession(id, p.name); updateProject(id, { sessionId: s.id }); }
  return s;
});
app.get('/api/sessions/:id', async (req, reply) => getSession((req.params as { id: string }).id) ?? reply.code(404).send({ error: 'no such session' }));
app.post('/api/sessions/:id/turn', async (req, reply) => {
  const sid = (req.params as { id: string }).id;
  const { text, model } = (req.body ?? {}) as { text?: string; model?: string };
  const s = getSession(sid); if (!s) return reply.code(404).send({ error: 'no such session' });
  const p = s.projectId === 'machine' ? { path: join(superbuildsHome(), 'machine'), name: 'this machine' } : getProject(s.projectId);
  if (!p) return reply.code(404).send({ error: 'no such project' });
  if (!text?.trim()) return reply.code(400).send({ error: 'Say something first.' });
  if (sessionIsBusy(sid)) return reply.code(409).send({ error: 'Claude is still replying. Stop it first, or wait.' });
  void sendTurn(sid, text, p.path, p.name, { model, checkpoint: s.projectId !== 'machine' }).catch(() => {});
  return { ok: true };
});
app.post('/api/sessions/:id/change', async (req, reply) => {
  const sid = (req.params as { id: string }).id;
  const { kind, targets, notes } = (req.body ?? {}) as { kind?: string; targets?: string[]; notes?: string };
  const s = getSession(sid); if (!s) return reply.code(404).send({ error: 'no such session' });
  const p = getProject(s.projectId); if (!p) return reply.code(404).send({ error: 'no such project' });
  if (!kind || !CHANGES.some((c) => c.id === kind)) return reply.code(400).send({ error: 'Unknown change.' });
  if (sessionIsBusy(sid)) return reply.code(409).send({ error: 'Claude is still replying.' });
  void sendTurn(sid, changeBrief(kind, (targets ?? []).map(String), notes, p.name), p.path, p.name, {}).catch(() => {});
  return { ok: true };
});
app.post('/api/sessions/:id/stop', async (req) => ({ how: await stopTurn((req.params as { id: string }).id) }));
app.post('/api/sessions/:id/rewind', async (req, reply) => {
  const sid = (req.params as { id: string }).id;
  const { turnId } = (req.body ?? {}) as { turnId?: string };
  const s = getSession(sid); if (!s) return reply.code(404).send({ error: 'no such session' });
  const p = getProject(s.projectId); if (!p) return reply.code(404).send({ error: 'no such project' });
  return rewindTo(sid, String(turnId ?? ''), p.path);
});

/* Preview */

app.get('/api/projects/:id/preview', async (req) => previewState((req.params as { id: string }).id));
app.post('/api/projects/:id/preview/start', async (req, reply) => {
  const p = getProject((req.params as { id: string }).id); if (!p) return reply.code(404).send({ error: 'no such project' });
  return startPreview(p.id, p.path);
});
app.post('/api/projects/:id/preview/stop', async (req) => stopPreview((req.params as { id: string }).id));
app.post('/api/projects/:id/thumbnail', async (req) => ({ thumbnail: await thumbnailFor((req.params as { id: string }).id) }));

/* Reference capture */

app.get('/api/reference/available', async () => captureAvailable());
app.post('/api/reference', async (req, reply) => {
  const { url } = (req.body ?? {}) as { url?: string };
  let parsed: URL;
  try { parsed = new URL(String(url ?? '')); } catch { return reply.code(400).send({ error: 'That does not look like a web address.' }); }
  if (!/^https?:$/.test(parsed.protocol)) return reply.code(400).send({ error: 'Only http and https addresses.' });
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|\[::1\])/.test(parsed.hostname)) return reply.code(400).send({ error: 'Local addresses cannot be captured.' });
  const avail = captureAvailable();
  if (!avail.ok) return reply.code(400).send({ error: avail.reason });
  return startCapture(parsed.toString());
});
app.get('/api/reference/:id', async (req, reply) => getCapture((req.params as { id: string }).id) ?? reply.code(404).send({ error: 'no such capture' }));

/* Deploy */

app.get('/api/projects/:id/deploy', async (req) => deployStatus((req.params as { id: string }).id));
app.post('/api/projects/:id/deploy/login', async (req) => vercelLogin((req.params as { id: string }).id));
app.post('/api/projects/:id/deploy', async (req, reply) => {
  const { target } = (req.body ?? {}) as { target?: 'production' | 'preview' };
  try { return await deployProject((req.params as { id: string }).id, target === 'preview' ? 'preview' : 'production'); } catch (err) { return reply.code(400).send({ error: (err as Error).message }); }
});
/* Three directions, side by side: pointing at a design instead of describing one */

app.get('/api/projects/:id/directions', async (req, reply) => {
  const p = getProject((req.params as { id: string }).id); if (!p) return reply.code(404).send({ error: 'no such project' });
  return { directions: readDirections(p.path) };
});
app.post('/api/projects/:id/directions', async (req, reply) => {
  try { return { directions: await proposeDirections((req.params as { id: string }).id) }; }
  catch (err) { return reply.code(400).send({ error: (err as Error).message }); }
});
app.post('/api/projects/:id/directions/choose', async (req, reply) => {
  const { id } = (req.body ?? {}) as { id?: string };
  if (!id) return reply.code(400).send({ error: 'which direction?' });
  try {
    const state = chooseDirection((req.params as { id: string }).id, id);
    broadcast({ type: 'tweaks.update', state });
    return state;
  } catch (err) { return reply.code(400).send({ error: (err as Error).message }); }
});

/* The tweak panel: design by dragging, written to the project's design.tweaks.json */

app.get('/api/projects/:id/tweaks', async (req, reply) => {
  try { return tweakState((req.params as { id: string }).id); }
  catch (err) { return reply.code(404).send({ error: (err as Error).message }); }
});
app.post('/api/projects/:id/tweaks', async (req, reply) => {
  const { values, replace } = (req.body ?? {}) as { values?: Record<string, unknown>; replace?: boolean };
  try {
    const state = setTweaks((req.params as { id: string }).id, values ?? {}, replace === true);
    broadcast({ type: 'tweaks.update', state });
    return state;
  } catch (err) { return reply.code(400).send({ error: (err as Error).message }); }
});
app.post('/api/projects/:id/tweaks/shuffle', async (req, reply) => {
  try {
    const state = shufflePalette((req.params as { id: string }).id);
    broadcast({ type: 'tweaks.update', state });
    return state;
  } catch (err) { return reply.code(400).send({ error: (err as Error).message }); }
});

app.post('/api/projects/:id/env', async (req, reply) => {
  const p = getProject((req.params as { id: string }).id); if (!p) return reply.code(404).send({ error: 'no such project' });
  const { key, value } = (req.body ?? {}) as { key?: string; value?: string };
  if (!key || typeof value !== 'string') return reply.code(400).send({ error: 'key and value are required' });
  const ok = setEnvValue(p.path, key, value);
  return ok ? { ok: true } : reply.code(400).send({ error: 'That is not a valid variable name.' });
});

/* The project's own files: browse, read, edit, revert */

function projectOr404(id: string, reply: { code: (n: number) => { send: (b: unknown) => unknown } }) {
  const p = getProject(id);
  if (!p) { reply.code(404).send({ error: 'no such project' }); return undefined; }
  return p;
}

app.get('/api/projects/:id/files', async (req, reply) => {
  const p = projectOr404((req.params as { id: string }).id, reply); if (!p) return;
  try { return await listDir(p.path, String((req.query as { path?: string }).path ?? '')); }
  catch (err) { return reply.code(400).send({ error: (err as Error).message }); }
});
app.get('/api/projects/:id/file', async (req, reply) => {
  const p = projectOr404((req.params as { id: string }).id, reply); if (!p) return;
  try { return readProjectFile(p.path, String((req.query as { path?: string }).path ?? '')); }
  catch (err) { return reply.code(400).send({ error: (err as Error).message }); }
});
app.post('/api/projects/:id/file', async (req, reply) => {
  const p = projectOr404((req.params as { id: string }).id, reply); if (!p) return;
  const { path, text } = (req.body ?? {}) as { path?: string; text?: string };
  try { return writeProjectFile(p.path, String(path ?? ''), String(text ?? '')); }
  catch (err) { return reply.code(400).send({ error: (err as Error).message }); }
});
app.post('/api/projects/:id/file/new', async (req, reply) => {
  const p = projectOr404((req.params as { id: string }).id, reply); if (!p) return;
  const { path, dir } = (req.body ?? {}) as { path?: string; dir?: boolean };
  try { return createProjectFile(p.path, String(path ?? ''), dir === true); }
  catch (err) { return reply.code(400).send({ error: (err as Error).message }); }
});
app.post('/api/projects/:id/file/delete', async (req, reply) => {
  const p = projectOr404((req.params as { id: string }).id, reply); if (!p) return;
  try { return deleteProjectFile(p.path, String((req.body as { path?: string })?.path ?? '')); }
  catch (err) { return reply.code(400).send({ error: (err as Error).message }); }
});
app.post('/api/projects/:id/file/revert', async (req, reply) => {
  const p = projectOr404((req.params as { id: string }).id, reply); if (!p) return;
  try { return await revertProjectFile(p.path, String((req.body as { path?: string })?.path ?? '')); }
  catch (err) { return reply.code(400).send({ error: (err as Error).message }); }
});
app.get('/api/projects/:id/search', async (req, reply) => {
  const p = projectOr404((req.params as { id: string }).id, reply); if (!p) return;
  return { hits: searchProject(p.path, String((req.query as { q?: string }).q ?? '')) };
});

/* The CRM login, so nobody is locked out of their own customer data */

app.get('/api/projects/:id/admin', async (req, reply) => {
  const p = projectOr404((req.params as { id: string }).id, reply); if (!p) return;
  return adminLogin(p.path);
});
app.post('/api/projects/:id/admin/password', async (req, reply) => {
  const p = projectOr404((req.params as { id: string }).id, reply); if (!p) return;
  try { return setAdminPassword(p.path, (req.body as { password?: string })?.password); }
  catch (err) { return reply.code(400).send({ error: (err as Error).message }); }
});
app.post('/api/projects/:id/admin/email', async (req, reply) => {
  const p = projectOr404((req.params as { id: string }).id, reply); if (!p) return;
  try { return setAdminEmail(p.path, String((req.body as { email?: string })?.email ?? '')); }
  catch (err) { return reply.code(400).send({ error: (err as Error).message }); }
});
app.post('/api/projects/:id/admin/forget', async (req, reply) => {
  const p = projectOr404((req.params as { id: string }).id, reply); if (!p) return;
  return forgetDevPassword(p.path);
});

/* Analytics: which destinations are on, their keys, and where to read them */

app.get('/api/projects/:id/analytics', async (req, reply) => {
  try { return analyticsState((req.params as { id: string }).id); }
  catch (err) { return reply.code(404).send({ error: (err as Error).message }); }
});
app.post('/api/projects/:id/analytics', async (req, reply) => {
  const { ids } = (req.body ?? {}) as { ids?: string[] };
  try {
    const state = setAnalytics((req.params as { id: string }).id, Array.isArray(ids) ? ids.map(String) : []);
    broadcast({ type: 'analytics.update', state });
    return state;
  } catch (err) { return reply.code(400).send({ error: (err as Error).message }); }
});
app.post('/api/projects/:id/analytics/keys', async (req, reply) => {
  const { values } = (req.body ?? {}) as { values?: Record<string, string> };
  try {
    const state = setAnalyticsKeys((req.params as { id: string }).id, values ?? {});
    broadcast({ type: 'analytics.update', state });
    return state;
  } catch (err) { return reply.code(400).send({ error: (err as Error).message }); }
});

/* Under the hood: what is driving the build, and the prompt it is driving with */

app.get('/api/projects/:id/engine', async (req, reply) => {
  try { return engineInfo((req.params as { id: string }).id); }
  catch (err) { return reply.code(404).send({ error: (err as Error).message }); }
});
app.post('/api/projects/:id/brief', async (req, reply) => {
  try { return setBrief((req.params as { id: string }).id, String((req.body as { text?: string })?.text ?? '')); }
  catch (err) { return reply.code(400).send({ error: (err as Error).message }); }
});

/* Several conversations at once, and the notebook they share */

/** Turns in flight, what this machine will carry, and what is in line. */
function capacityNow() {
  return { running: listProjects().reduce((n, p) => n + listSessions(p.id).filter((s) => sessionIsBusy(s.id)).length, 0), ceiling: ceiling(), waiting: queued() };
}
app.get('/api/capacity', async () => capacityNow());

app.get('/api/projects/:id/sessions', async (req, reply) => {
  const p = projectOr404((req.params as { id: string }).id, reply); if (!p) return;
  // Newest last, so the tabs read left to right in the order they were opened.
  return listSessions(p.id).sort((a, b) => a.createdAt - b.createdAt);
});
app.post('/api/projects/:id/sessions', async (req, reply) => {
  const p = projectOr404((req.params as { id: string }).id, reply); if (!p) return;
  const { title } = (req.body ?? {}) as { title?: string };
  const n = listSessions(p.id).length + 1;
  return createSession(p.id, String(title ?? '').trim().slice(0, 60) || `Conversation ${n}`);
});
app.patch('/api/sessions/:id', async (req, reply) => {
  const s = getSession((req.params as { id: string }).id); if (!s) return reply.code(404).send({ error: 'no such conversation' });
  const { title } = (req.body ?? {}) as { title?: string };
  const named = String(title ?? '').trim().slice(0, 60);
  if (!named) return reply.code(400).send({ error: 'Give it a name.' });
  return renameSession(s.id, named);
});
app.delete('/api/sessions/:id', async (req, reply) => {
  const s = getSession((req.params as { id: string }).id); if (!s) return reply.code(404).send({ error: 'no such conversation' });
  if (sessionIsBusy(s.id)) return reply.code(409).send({ error: 'Claude is still replying in that one. Stop it first.' });
  const p = getProject(s.projectId);
  // The project always keeps one conversation: closing the last would leave it
  // with nothing to talk to.
  if (p && listSessions(p.id).length <= 1) return reply.code(400).send({ error: 'That is the only conversation about this project.' });
  deleteSession(s.id);
  if (p?.sessionId === s.id) updateProject(p.id, { sessionId: listSessions(p.id)[0]?.id });
  return { ok: true };
});

app.get('/api/projects/:id/memory', async (req, reply) => {
  const p = projectOr404((req.params as { id: string }).id, reply); if (!p) return;
  return { projectId: p.id, ...memory(p.path) };
});
app.post('/api/projects/:id/memory', async (req, reply) => {
  const p = projectOr404((req.params as { id: string }).id, reply); if (!p) return;
  try {
    const m = { projectId: p.id, ...setMemory(p.path, String((req.body as { text?: string })?.text ?? '')) };
    broadcast({ type: 'memory.update', memory: m });
    return m;
  } catch (err) { return reply.code(400).send({ error: (err as Error).message }); }
});

/* Hooks from Claude Code */

app.post('/hooks/pretooluse', async (req, reply) => {
  if (req.headers['x-superbuilds-token'] !== TOKEN) return reply.code(401).send({});
  const verdict = judge((req.body ?? {}) as never);
  if (!verdict.allow) {
    const body = req.body as { session_id?: string };
    // Let the person see what was stopped, as a system line in the transcript.
    const sid = String(body.session_id ?? '');
    const s = sid ? getSession(sid) : undefined;
    if (s) broadcast({ type: 'session.turn', sessionId: s.id, turn: { id: `deny-${Date.now()}`, role: 'system', text: `Refused: ${verdict.reason}`, at: Date.now() } });
  }
  return hookResponse(verdict);
});
app.post('/hooks/notification', async (req, reply) => { if (req.headers['x-superbuilds-token'] !== TOKEN) return reply.code(401).send({}); return {}; });

/* Socket */

await app.listen({ port: PORT, host: HOST });
configureHooks(PORT, TOKEN);
// Anything joining or leaving the queue is news: it is the only explanation a
// person has for a conversation that has not started yet.
onQueueChange(() => broadcast({ type: 'capacity.update', capacity: capacityNow() }));

const wss = new WebSocketServer({ server: app.server, path: '/ws' });
wss.on('connection', (ws, req) => {
  const origin = String(req.headers.origin ?? '');
  if (origin && ![`http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`, 'http://127.0.0.1:5180', 'http://localhost:5180'].includes(origin)) { ws.close(); return; }
  addClient(ws);
  send(ws, { type: 'hello', token: TOKEN });
  for (const p of listProjects()) send(ws, { type: 'project.upsert', project: p });
  for (const p of listProjects()) { const g = generationState(p.id); if (g) send(ws, { type: 'generation.update', state: g }); const pv = previewState(p.id); if (pv.running) send(ws, { type: 'preview.update', state: pv }); }
  send(ws, { type: 'capacity.update', capacity: capacityNow() });
  ws.on('close', () => removeClient(ws));
  ws.on('error', () => removeClient(ws));
});

console.log(`Super Builds daemon on http://${HOST}:${PORT}${DEV ? " (dev — open the interface at http://127.0.0.1:5180)" : ""}`);

const shutdown = async () => {
  closeAll();
  await stopAllPreviews();
  try { await app.close(); } catch {}
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
