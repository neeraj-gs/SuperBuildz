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

export async function cancelGeneration(projectId: string) {
  cancelled.add(projectId);
  const p = getProject(projectId);
  if (p?.sessionId && sessionIsBusy(p.sessionId)) await stopTurn(p.sessionId);
}
