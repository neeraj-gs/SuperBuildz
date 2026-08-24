/**
 * Generation: the template becomes a site, stage by stage, observably.
 *
 * One Claude Code session per project, driven turn by turn by the daemon so
 * every stage is a checkpoint, a commit and a line on the screen. The preview
 * starts the moment the scaffold is installed, so the person watches the site
 * appear rather than waiting for a verdict.
 */

import type { GenerationState, Spec } from '@superbuilds/protocol';
import { broadcast } from './bus.ts';
import { getProject, updateProject } from './projects.ts';
import { scaffoldProject } from './scaffold.ts';
import { createSession, sendTurn, stopTurn, sessionIsBusy } from './sessions.ts';
import { getSession } from './store.ts';
import { stagesFor } from './brief.ts';
import { startPreview } from './preview.ts';
import { thumbnailFor } from './reference.ts';
import { proposeDirections } from './directions.ts';
import { surveySite } from './survey.ts';
import { prepareRevamp, revampStagesFor, writeRevampBrief } from './revamp.ts';

const states = new Map<string, GenerationState>();
const cancelled = new Set<string>();

export function generationState(projectId: string): GenerationState | undefined {
  return states.get(projectId);
}

function push(projectId: string, patch: Partial<GenerationState>) {
  const cur = states.get(projectId);
  if (!cur) return;
  const next = { ...cur, ...patch };
  states.set(projectId, next);
  broadcast({ type: 'generation.update', state: next });
}

function setStage(projectId: string, id: string, patch: Partial<GenerationState['stages'][number]>) {
  const cur = states.get(projectId);
  if (!cur) return;
  push(projectId, { stages: cur.stages.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
}

export async function runGeneration(projectId: string): Promise<GenerationState> {
  const project = getProject(projectId);
  if (!project?.spec) throw new Error('That project has no specification to build from.');
  if (states.get(projectId)?.running) throw new Error('That project is already being built.');
  const spec: Spec = project.spec;
  // A revamp is the same machine pointed at somebody's existing site: same
  // session, same stage loop, same directions, same chat afterwards. What
  // differs is stage zero — a branch instead of a scaffold — and the prompts,
  // which are written to restyle rather than to invent.
  if (spec.mode === 'revamp') return runRevamp(projectId);
  const stageDefs = stagesFor(spec);

  const initial: GenerationState = {
    projectId, running: true, log: '', costUsd: 0, startedAt: Date.now(),
    stages: [{ id: 'scaffold', label: 'Template and dependencies', status: 'pending' }, ...stageDefs.map((s) => ({ id: s.id, label: s.label, status: 'pending' as const }))],
  };
  states.set(projectId, initial);
  cancelled.delete(projectId);
  broadcast({ type: 'generation.update', state: initial });
  updateProject(projectId, { status: 'scaffolding' });

  // Stage 0
  setStage(projectId, 'scaffold', { status: 'running', startedAt: Date.now() });
  const scaffold = await scaffoldProject(spec, project.path, (chunk) => {
    const cur = states.get(projectId); if (!cur) return;
    push(projectId, { log: (cur.log + chunk).slice(-40_000) });
  });
  if (!scaffold.ok) {
    setStage(projectId, 'scaffold', { status: 'failed', endedAt: Date.now(), note: scaffold.error });
    push(projectId, { running: false, error: scaffold.error, endedAt: Date.now() });
    updateProject(projectId, { status: 'failed' });
    return states.get(projectId)!;
  }
  setStage(projectId, 'scaffold', { status: 'done', endedAt: Date.now(), note: `Admin login: ${scaffold.adminEmail} / ${scaffold.adminPassword}` });

  // A session for the whole build, kept for the conversation afterwards.
  const session = project.sessionId && getSession(project.sessionId) ? getSession(project.sessionId)! : createSession(projectId, `Build ${project.name}`);
  updateProject(projectId, { status: 'generating', sessionId: session.id });

  // Preview from here on: the site is already a site.
  void startPreview(projectId, project.path);

  for (const stage of stageDefs) {
    if (cancelled.has(projectId)) break;
    setStage(projectId, stage.id, { status: 'running', startedAt: Date.now() });
    try {
      const turn = await sendTurn(session.id, stage.prompt(spec), project.path, project.name, { stage: stage.id, budgetUsd: spec.budgetUsd });
      const cur = states.get(projectId);
      push(projectId, { costUsd: (cur?.costUsd ?? 0) + (turn.costUsd ?? 0) });
      setStage(projectId, stage.id, { status: 'done', endedAt: Date.now() });

      // As soon as the identity exists there is something to vary, so the
      // three directions are proposed in the background — by the time the
      // build finishes they are waiting behind the Directions button rather
      // than costing the person a two-minute wait at the moment they are
      // finally ready to look at their site. A failure here is not a build
      // failure: they can press Propose themselves.
      if (stage.id === 'identity' && spec.directions !== false) {
        void proposeDirections(projectId).catch(() => {});
      }
    } catch (err) {
      const msg = (err as Error).message;
      setStage(projectId, stage.id, { status: cancelled.has(projectId) ? 'skipped' : 'failed', endedAt: Date.now(), note: msg });
      if (!cancelled.has(projectId)) {
        push(projectId, { running: false, error: `${stage.label}: ${msg}`, endedAt: Date.now() });
        updateProject(projectId, { status: 'failed' });
        return states.get(projectId)!;
      }
      break;
    }
  }

  const wasCancelled = cancelled.has(projectId);
  push(projectId, { running: false, endedAt: Date.now(), error: wasCancelled ? 'Stopped. The site is whatever it had reached; carry on from the chat.' : undefined });
  updateProject(projectId, { status: 'ready' });

  // A thumbnail for the dashboard, when a browser exists.
  void thumbnailFor(projectId).catch(() => {});
  return states.get(projectId)!;
}

/**
 * The revamp path.
 *
 * Stage zero is `prepareRevamp` rather than `scaffoldProject`: no template is
 * copied and nothing is overwritten, because the files are already somebody's.
 * What it does instead is make the folder safe — a repository, a commit of
 * whatever was lying around, a branch of our own — and put the scene library
 * within reach. Everything after that is the ordinary stage loop.
 */
async function runRevamp(projectId: string): Promise<GenerationState> {
  const project = getProject(projectId)!;
  const spec = project.spec!;
  const stageDefs = revampStagesFor(spec);

  const initial: GenerationState = {
    projectId, running: true, log: '', costUsd: 0, startedAt: Date.now(),
    stages: [{ id: 'prepare', label: 'A branch, and a way back', status: 'pending' }, ...stageDefs.map((s) => ({ id: s.id, label: s.label, status: 'pending' as const }))],
  };
  states.set(projectId, initial);
  cancelled.delete(projectId);
  broadcast({ type: 'generation.update', state: initial });
  updateProject(projectId, { status: 'scaffolding' });

  setStage(projectId, 'prepare', { status: 'running', startedAt: Date.now() });
  const survey = await surveySite(project.path);
  if (!survey.ok) {
    setStage(projectId, 'prepare', { status: 'failed', endedAt: Date.now(), note: survey.reason });
    push(projectId, { running: false, error: survey.reason, endedAt: Date.now() });
    updateProject(projectId, { status: 'failed' });
    return states.get(projectId)!;
  }

  const prepared = await prepareRevamp(project.path, survey, (chunk) => {
    const cur = states.get(projectId); if (!cur) return;
    push(projectId, { log: (cur.log + chunk).slice(-40_000) });
  });
  if (!prepared.ok) {
    setStage(projectId, 'prepare', { status: 'failed', endedAt: Date.now(), note: prepared.error });
    push(projectId, { running: false, error: prepared.error, endedAt: Date.now() });
    updateProject(projectId, { status: 'failed' });
    return states.get(projectId)!;
  }

  writeRevampBrief(project.path, spec, survey);
  setStage(projectId, 'prepare', { status: 'done', endedAt: Date.now(), note: `On branch ${prepared.branch}. Your own work is committed and untouched.` });

  const session = project.sessionId && getSession(project.sessionId) ? getSession(project.sessionId)! : createSession(projectId, `Revamp ${project.name}`);
  updateProject(projectId, { status: 'generating', sessionId: session.id });

  // Their dev server, not ours: the site already runs, so show it running from
  // the first second rather than after the first stage.
  void startPreview(projectId, project.path);

  for (const stage of stageDefs) {
    if (cancelled.has(projectId)) break;
    setStage(projectId, stage.id, { status: 'running', startedAt: Date.now() });
    try {
      const turn = await sendTurn(session.id, stage.prompt(spec, survey), project.path, project.name, { stage: stage.id, budgetUsd: spec.budgetUsd });
      const cur = states.get(projectId);
      push(projectId, { costUsd: (cur?.costUsd ?? 0) + (turn.costUsd ?? 0) });
      setStage(projectId, stage.id, { status: 'done', endedAt: Date.now() });
      if (stage.id === 'identity' && spec.directions !== false) void proposeDirections(projectId).catch(() => {});
    } catch (err) {
      const msg = (err as Error).message;
      setStage(projectId, stage.id, { status: cancelled.has(projectId) ? 'skipped' : 'failed', endedAt: Date.now(), note: msg });
      if (!cancelled.has(projectId)) {
        push(projectId, { running: false, error: `${stage.label}: ${msg}`, endedAt: Date.now() });
        updateProject(projectId, { status: 'failed' });
        return states.get(projectId)!;
      }
      break;
    }
  }

  const wasCancelled = cancelled.has(projectId);
  push(projectId, {
    running: false, endedAt: Date.now(),
    error: wasCancelled ? `Stopped. Everything so far is on the ${prepared.branch} branch; your own branch is exactly as it was.` : undefined,
  });
  updateProject(projectId, { status: 'ready' });
  void thumbnailFor(projectId).catch(() => {});
  return states.get(projectId)!;
}

export async function cancelGeneration(projectId: string) {
  cancelled.add(projectId);
  const p = getProject(projectId);
  if (p?.sessionId && sessionIsBusy(p.sessionId)) await stopTurn(p.sessionId);
}
