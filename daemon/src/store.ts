/**
 * Plain JSON under ~/.superbuilds. Inspectable, copyable, no database.
 *
 *   projects.json            every project
 *   sessions/<id>.json       one conversation, turns and all
 *   checkpoints/<sid>/<cid>  folder snapshots
 *   captures/<id>/           reference screenshots and recordings
 *   thumbs/<projectId>.png   dashboard thumbnails
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import type { Project, Session } from '@superbuilds/protocol';
import { superbuildsHome } from './paths.ts';

function dir(name: string): string {
  const d = join(superbuildsHome(), name);
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  return d;
}

/** Write whole, then rename: a crash mid-write leaves the old file, not half a new one. */
function writeJson(file: string, value: unknown) {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2));
  renameSync(tmp, file);
}

function readJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(readFileSync(file, 'utf8')) as T; } catch { return fallback; }
}

/* Projects */

const projectsFile = () => join(superbuildsHome(), 'projects.json');

export function listProjects(): Project[] {
  return readJson<Project[]>(projectsFile(), []).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getProject(id: string): Project | undefined {
  return listProjects().find((p) => p.id === id);
}

export function saveProject(project: Project): Project {
  const all = readJson<Project[]>(projectsFile(), []);
  const i = all.findIndex((p) => p.id === project.id);
  const next = { ...project, updatedAt: Date.now() };
  if (i === -1) all.push(next); else all[i] = next;
  writeJson(projectsFile(), all);
  return next;
}

export function removeProject(id: string) {
  const all = readJson<Project[]>(projectsFile(), []).filter((p) => p.id !== id);
  writeJson(projectsFile(), all);
}

/* Sessions */

const sessionFile = (id: string) => join(dir('sessions'), `${id}.json`);

export function getSession(id: string): Session | undefined {
  const f = sessionFile(id);
  return existsSync(f) ? readJson<Session | undefined>(f, undefined) : undefined;
}

export function saveSession(session: Session): Session {
  const next = { ...session, updatedAt: Date.now() };
  writeJson(sessionFile(session.id), next);
  return next;
}

export function listSessions(projectId?: string): Session[] {
  const out: Session[] = [];
  for (const name of readdirSync(dir('sessions'))) {
    if (!name.endsWith('.json')) continue;
    const s = readJson<Session | undefined>(join(dir('sessions'), name), undefined);
    if (s && (!projectId || s.projectId === projectId)) out.push(s);
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function removeSession(id: string) {
  try { rmSync(sessionFile(id), { force: true }); } catch {}
  try { rmSync(join(dir('checkpoints'), id), { recursive: true, force: true }); } catch {}
}

/* Folders other modules need */

export const checkpointsDir = (sessionId: string) => { const d = join(dir('checkpoints'), sessionId); if (!existsSync(d)) mkdirSync(d, { recursive: true }); return d; };
export const capturesDir = () => dir('captures');
export const thumbsDir = () => dir('thumbs');
