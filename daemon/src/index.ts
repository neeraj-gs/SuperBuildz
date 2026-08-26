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
import type { Spec, KeyState } from '@superbuilds/protocol';
import { keysNeeded, fillKeys } from './keys.ts';
import { envEntries } from './env.ts';
import { addClient, removeClient, send, broadcast, clientCount } from './bus.ts';
import { detect } from './detection.ts';
import { installPlan, runInstall, runAuthLogin, forgetProbes, provisionPrompt } from './install.ts';
import { CATALOGUE, defaultsFor, completeSpec } from './catalogue/index.ts';
import { planFor, questionsPrompt, QUESTIONS_SCHEMA, namesPrompt, NAMES_SCHEMA, CHANGES, changeBrief } from './brief.ts';
import { askOnce, listModels } from './claude.ts';
import { createProject, deleteProject, folderFor, folderIsUsable, getProject, listProjects, updateProject } from './projects.ts';
import { getSession, saveSession, listSessions, capturesDir, thumbsDir } from './store.ts';
import { createSession, sendTurn, stopTurn, rewindTo, closeAll, configureHooks, sessionIsBusy, renameSession, deleteSession } from './sessions.ts';
import { runGeneration, cancelGeneration, generationState } from './generate.ts';
import { previewState, startPreview, stopPreview, stopAllPreviews, checkPreview } from './preview.ts';
import { startCapture, getCapture, captureAvailable, thumbnailFor } from './reference.ts';
import { deployStatus, vercelLogin, deployProject, setEnvValue } from './deploy.ts';
import { judge, hookResponse, RULES } from './policy.ts';
import { askFor, granted, grant, revoke, grantsFor, pendingFor, settleApproval, dropSession } from './approvals.ts';
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
import { hostAllowed, needsToken, originAllowed } from './origins.ts';
import { sessionBoard } from './board.ts';
import { legiblePalette } from './colour.ts';
import { understandPrompt, UNDERSTAND_SCHEMA, revampPlan } from './revamp.ts';
import { execPlain } from './binaries.ts';
import { superbuildsHome, uiDist } from './paths.ts';

const PORT = Number(process.env.SUPERBUILDS_PORT ?? 7747);
const HOST = '127.0.0.1';
const TOKEN = randomBytes(24).toString('base64url');
const DEV = process.env.SUPERBUILDS_DEV === '1';
// Where Vite is, in development. Chosen by `scripts/dev.mjs` — which probes for
// a free one and hands the same number to both children — so the two halves
// cannot disagree about it. Only used to redirect :7747 to the live interface;
// nothing is authorised by it.
const UI_PORT = Number(process.env.SUPERBUILDS_UI_PORT ?? 5180);

const app = Fastify({ logger: false, bodyLimit: 4 * 1024 * 1024 });

/*
  Any loopback origin, on any port. See `origins.ts` for why it is not a list
  of port numbers any more, and for the two things that make it safe.

  The callback answers `(null, false)` and never `(error, …)`. Handing
  @fastify/cors an Error makes Fastify answer 500 "Internal Server Error",
  which is how a refused origin came to look like the daemon falling over. A
  disallowed origin is a decision, not a fault: the response is sent without
  the header and the browser is the one that stops it.
*/
await app.register(cors, {
  origin: (origin, cb) => cb(null, originAllowed(origin)),
  credentials: false,
});

/*
  DNS rebinding. A page on the internet can point a name it controls at
  127.0.0.1 and then talk to this daemon as same-origin — no CORS involved,
  because as far as the browser is concerned there is no crossing. What it
  cannot forge is the `Host` header, which carries the name it used.
*/
app.addHook('onRequest', async (req, reply) => {
  if (!hostAllowed(req.headers.host)) {
    return reply.code(403).send({ error: 'This daemon answers on 127.0.0.1 only.' });
  }
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
  const VITE = `http://127.0.0.1:${UI_PORT}`;
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

/**
 * The token guards everything that changes state *and* everything that returns
 * the person's own work — see `needsToken`. Health, the catalogue and what is
 * installed stay open, because the interface reads them before the socket has
 * handed it a token and none of them are anybody's.
 */
function guarded(req: { headers: Record<string, unknown> }): boolean {
  return req.headers['x-superbuilds-token'] === TOKEN;
}
app.addHook('onRequest', async (req, reply) => {
  if (needsToken(req.method, req.url) && !guarded(req as never)) {
    return reply.code(401).send({ error: 'missing or wrong token — reload the page' });
  }
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
    // Their own brand colours get the same repair a reference site's do: a
    // sampled pair that cannot be read is a bug wherever it came from.
    if (understanding && typeof understanding === 'object' && 'customPalette' in understanding) {
      understanding.customPalette = legiblePalette(understanding.customPalette as Record<string, string>);
    }
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
/* "It is white and I do not know why." Opens the same address in a real browser and says. */
app.post('/api/projects/:id/preview/check', async (req, reply) => {
  const p = getProject((req.params as { id: string }).id); if (!p) return reply.code(404).send({ error: 'no such project' });
  const health = await checkPreview(p.id);
  if (!health) return reply.code(409).send({ error: 'The preview is not running, so there is nothing to look at.' });
  return health;
});
app.post('/api/projects/:id/thumbnail', async (req) => ({ thumbnail: await thumbnailFor((req.params as { id: string }).id) }));

/* Keys the site needs and has not got */

function keyState(project: { id: string; path: string }): KeyState {
  return {
    projectId: project.id,
    needed: keysNeeded(project.path, previewState(project.id).health),
    // Names only. The values are on disk, in the person's own project, and
    // never travel over this socket in either direction except inbound once.
    filled: envEntries(project.path).filter((e) => e.value.trim()).map((e) => e.key),
  };
}

app.get('/api/projects/:id/keys', async (req, reply) => {
  const p = projectOr404((req.params as { id: string }).id, reply); if (!p) return;
  return keyState(p);
});

/**
 * The values arrive, go into the project's own `.env.local`, and are gone.
 *
 * Nothing here logs them, echoes them, or puts them into the reply — the
 * answer is the names it accepted, which is the most that can be said about a
 * secret without saying it. The preview is then restarted, because a dev
 * server reads its environment once at startup and the whole point of having
 * been asked is that the site draws afterwards.
 */
app.post('/api/projects/:id/keys', async (req, reply) => {
  const p = projectOr404((req.params as { id: string }).id, reply); if (!p) return;
  const values = (req.body as { values?: Record<string, unknown> })?.values;
  if (!values || typeof values !== 'object') return reply.code(400).send({ error: 'Nothing to save.' });

  let written: string[];
  try { written = fillKeys(p.path, values); } catch (err) { return reply.code(400).send({ error: (err as Error).message }); }

  const state = keyState(p);
  broadcast({ type: 'keys.update', state });

  const wasRunning = previewState(p.id).running;
  if (wasRunning && written.length) {
    void (async () => {
      try { await stopPreview(p.id); await startPreview(p.id, p.path); } catch { /* the panel reports its own state */ }
    })();
  }
  return { written, restarting: wasRunning && written.length > 0 };
});

/**
 * A notice has been dealt with, so it comes off the shelf.
 *
 * It stays in the transcript where it happened: the shelf is the list of what
 * has not been answered, not a second copy of the conversation.
 */
app.post('/api/sessions/:id/notices/:noticeId', async (req, reply) => {
  const { id, noticeId } = req.params as { id: string; noticeId: string };
  const s = getSession(id); if (!s) return reply.code(404).send({ error: 'no such conversation' });
  let found = false;
  const turns = s.turns.map((t) => {
    if (!t.notices?.some((n) => n.id === noticeId)) return t;
    found = true;
    return { ...t, notices: t.notices.map((n) => (n.id === noticeId ? { ...n, done: true } : n)) };
  });
  if (!found) return reply.code(404).send({ error: 'no such notice' });
  const next = saveSession({ ...s, turns });
  broadcast({ type: 'session.upsert', session: next });
  return { ok: true };
});

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

/**
 * Every conversation on this machine, for the board.
 *
 * One route rather than one per project: the question the board asks is "what
 * is this machine doing", and asking it project by project is both N requests
 * and a total nobody can compute without all of them anyway.
 */
app.get('/api/sessions', async () => sessionBoard(sessionIsBusy));

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
  // Anything it left open is refused, and what it was allowed to do goes with it.
  for (const a of dropSession(s.id)) broadcast({ type: 'approval.settled', id: a.id, sessionId: s.id, decision: 'no' });
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

/**
 * The gate.
 *
 * Claude Code holds the tool call until this answers, which is what makes an
 * approval possible at all: while the reply is outstanding, nothing has run.
 * So a rule the person could reasonably overrule is not refused here — it is
 * put to them, and their answer is the reply. Say yes and the original command
 * runs, first time, rather than Claude inventing a way around a refusal it was
 * told about after the fact.
 *
 * Everything that happens is written into the transcript, allowed or refused,
 * because a permission system nobody can audit afterwards is a permission
 * system nobody should trust.
 */
app.post('/hooks/pretooluse', async (req, reply) => {
  if (req.headers['x-superbuilds-token'] !== TOKEN) return reply.code(401).send({});
  const body = (req.body ?? {}) as { session_id?: string; tool_name?: string };
  const verdict = judge(body as never);
  if (verdict.allow) return hookResponse(verdict);

  const session = body.session_id ? getSession(String(body.session_id)) : undefined;
  const rule = verdict.rule!;
  const note = (text: string) => {
    if (!session) return;
    const turn = { id: `policy-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, role: 'system' as const, text, at: Date.now() };
    // Saved as well as sent: a refusal that disappears on reload is a refusal
    // nobody can go back and check.
    const fresh = getSession(session.id);
    if (fresh) saveSession({ ...fresh, turns: [...fresh.turns, turn], updatedAt: turn.at });
    broadcast({ type: 'session.turn', sessionId: session.id, turn });
  };

  // No answer would make these safe, so they are not put to anybody.
  if (rule.risk === 'never') {
    note(`Refused: ${rule.what.toLowerCase()}. ${rule.reason}`);
    return hookResponse({ allow: false, reason: verdict.reason });
  }

  // Already said yes to this, for this conversation.
  if (session && granted(session.id, rule.id)) {
    note(`Allowed, because you said yes to ${rule.scope ?? 'this'}: ${verdict.detail ?? rule.what}`);
    return hookResponse({ allow: true });
  }

  // Nobody is watching, so nobody can answer. Refuse now rather than stalling
  // an unattended build for two and a half minutes to reach the same place.
  if (!session || clientCount() === 0) {
    const why = session
      ? 'Nobody has Super Builds open, so there was nobody to ask.'
      : 'This is not running inside a Super Builds conversation, so there was nobody to ask.';
    note(`Refused: ${rule.what.toLowerCase()}. ${why}`);
    return hookResponse({ allow: false, reason: `${verdict.reason} ${why} Do it another way, or ask the person to allow it from the project screen.` });
  }

  let askId = '';
  const decision = await askFor(
    {
      sessionId: session.id,
      projectId: session.projectId,
      tool: String(body.tool_name ?? 'a tool'),
      ruleId: rule.id,
      what: rule.what,
      scope: rule.scope,
      detail: verdict.detail ?? '',
      danger: rule.danger,
    },
    (approval) => { askId = approval.id; broadcast({ type: 'approval.ask', approval }); },
  );
  // The route that took the answer has already said so. This covers the other
  // way a question ends: nobody answered and it refused itself, which still has
  // to take the card off the screen.
  broadcast({ type: 'approval.settled', id: askId, sessionId: session.id, decision });

  if (decision === 'no') {
    note(`Refused: ${rule.what.toLowerCase()}.\n\n\`${verdict.detail ?? ''}\``);
    return hookResponse({ allow: false, reason: `${verdict.reason} The person was asked and said no.` });
  }
  if (decision === 'session') {
    broadcast({ type: 'approval.grants', sessionId: session.id, granted: grantsFor(session.id) });
    note(`Allowed for the rest of this conversation — ${rule.scope ?? rule.what.toLowerCase()}.\n\n\`${verdict.detail ?? ''}\``);
  } else {
    note(`Allowed once — ${rule.what.toLowerCase()}.\n\n\`${verdict.detail ?? ''}\``);
  }
  return hookResponse({ allow: true });
});

/* What this conversation may do without asking again, and the answers to open questions. */

app.get('/api/sessions/:id/access', async (req, reply) => {
  const id = (req.params as { id: string }).id;
  if (!getSession(id)) return reply.code(404).send({ error: 'no such session' });
  return {
    sessionId: id,
    granted: grantsFor(id),
    rules: RULES.filter((r) => r.risk === 'ask').map((r) => ({ id: r.id, what: r.what, scope: r.scope, danger: r.danger })),
  };
});

app.post('/api/sessions/:id/access', async (req, reply) => {
  const id = (req.params as { id: string }).id;
  if (!getSession(id)) return reply.code(404).send({ error: 'no such session' });
  const { ruleId, on } = (req.body ?? {}) as { ruleId?: string; on?: boolean };
  const rule = RULES.find((r) => r.id === ruleId && r.risk === 'ask');
  if (!rule) return reply.code(400).send({ error: 'That is not something that can be allowed.' });
  const list = on ? grant(id, rule.id) : revoke(id, rule.id);
  broadcast({ type: 'approval.grants', sessionId: id, granted: list });
  return { sessionId: id, granted: list };
});

app.get('/api/approvals', async (req) => pendingFor((req.query as { session?: string })?.session));

app.post('/api/approvals/:id', async (req, reply) => {
  const id = (req.params as { id: string }).id;
  const decision = String((req.body as { decision?: string })?.decision ?? '');
  if (decision !== 'once' && decision !== 'session' && decision !== 'no') return reply.code(400).send({ error: 'once, session or no.' });
  const approval = settleApproval(id, decision);
  if (!approval) return reply.code(404).send({ error: 'That question has already been answered or has timed out.' });
  broadcast({ type: 'approval.settled', id, sessionId: approval.sessionId, decision });
  if (decision === 'session') broadcast({ type: 'approval.grants', sessionId: approval.sessionId, granted: grantsFor(approval.sessionId) });
  return { ok: true, decision };
});
app.post('/hooks/notification', async (req, reply) => { if (req.headers['x-superbuilds-token'] !== TOKEN) return reply.code(401).send({}); return {}; });

/* Socket */

/*
  Bind, or say plainly what is on the port.

  An unhandled EADDRINUSE here exits with a stack trace about a socket, and
  `scripts/dev.mjs` then kills Vite too — so the whole thing dies with no
  sentence anywhere saying "something else is already on 7747".
*/
try {
  await app.listen({ port: PORT, host: HOST });
} catch (e) {
  const err = e as NodeJS.ErrnoException;
  if (err.code === 'EADDRINUSE') {
    console.error(`
Port ${PORT} is already taken — probably a Super Builds daemon that is still running.`);
    console.error('Close that one, or start this one on another port:');
    console.error(`  SUPERBUILDS_PORT=${PORT + 1} npm run dev
`);
  } else {
    console.error(`
The daemon could not start on ${HOST}:${PORT}: ${err.message}
`);
  }
  process.exit(1);
}
configureHooks(PORT, TOKEN);
// Anything joining or leaving the queue is news: it is the only explanation a
// person has for a conversation that has not started yet.
onQueueChange(() => broadcast({ type: 'capacity.update', capacity: capacityNow() }));

const wss = new WebSocketServer({ server: app.server, path: '/ws' });
wss.on('connection', (ws, req) => {
  // Same rule as the API, and for the same reason: a socket refused on a port
  // number is a product that says "daemon offline" and cannot say why.
  if (!originAllowed(req.headers.origin) || !hostAllowed(req.headers.host)) { ws.close(); return; }
  addClient(ws);
  send(ws, { type: 'hello', token: TOKEN });
  for (const p of listProjects()) send(ws, { type: 'project.upsert', project: p });
  for (const p of listProjects()) { const g = generationState(p.id); if (g) send(ws, { type: 'generation.update', state: g }); const pv = previewState(p.id); if (pv.running) send(ws, { type: 'preview.update', state: pv }); }
  // A question already on the table survives a reload. Without this, refreshing
  // the page while something waits for an answer loses the only control that
  // could give one, and the build sits there until the question times out.
  for (const approval of pendingFor()) send(ws, { type: 'approval.ask', approval });
  send(ws, { type: 'capacity.update', capacity: capacityNow() });
  ws.on('close', () => removeClient(ws));
  ws.on('error', () => removeClient(ws));
});

console.log(`Super Builds daemon on http://${HOST}:${PORT}${DEV ? ` (dev — open the interface at http://127.0.0.1:${UI_PORT})` : ''}`);

const shutdown = async () => {
  closeAll();
  await stopAllPreviews();
  try { await app.close(); } catch {}
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
