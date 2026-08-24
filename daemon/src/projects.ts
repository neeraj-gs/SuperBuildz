/**
 * Projects: a name, a folder, a spec, a status. Identified by a hash of the
 * folder, so building into a folder Super Builds already knows reuses the
 * project rather than duplicating it.
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { slugify, type Project, type Spec } from '@superbuilds/protocol';
import { getProject, listProjects, saveProject, removeProject as dropProject } from './store.ts';
import { sitesRoot } from './paths.ts';
import { broadcast } from './bus.ts';

export function projectHash(path: string): string {
  return createHash('sha1').update(resolve(path).toLowerCase()).digest('hex').slice(0, 12);
}

/** A folder for a new site: ~/SuperBuilds/<slug>, with -2, -3 if taken and non-empty. */
export function folderFor(name: string): string {
  const base = slugify(name);
  let candidate = join(sitesRoot(), base);
  let n = 2;
  while (existsSync(candidate) && readdirSync(candidate).length > 0) {
    candidate = join(sitesRoot(), `${base}-${n++}`);
  }
  return candidate;
}

export function folderIsUsable(path: string): { ok: boolean; reason?: string } {
  const abs = resolve(path);
  if (!existsSync(abs)) return { ok: true };
  if (!statSync(abs).isDirectory()) return { ok: false, reason: `${abs} is a file, not a folder.` };
  if (readdirSync(abs).length > 0) return { ok: false, reason: `${abs} already has files in it. Pick an empty folder, or a new name.` };
  return { ok: true };
}

export function createProject(spec: Spec): Project {
  const path = resolve(spec.folder || folderFor(spec.name));
  const id = projectHash(path);
  const existing = getProject(id);
  const now = Date.now();
  const mode = spec.mode ?? 'new';
  const project: Project = existing
    ? { ...existing, name: spec.name || existing.name, mode, spec: { ...spec, folder: path }, updatedAt: now }
    : {
      id, name: spec.name || 'Untitled', slug: slugify(spec.name), path, mode, createdAt: now, updatedAt: now,
      status: 'draft', spec: { ...spec, folder: path },
    };
  const saved = saveProject(project);
  broadcast({ type: 'project.upsert', project: saved });
  return saved;
}

export function updateProject(id: string, patch: Partial<Project>): Project | undefined {
  const p = getProject(id);
  if (!p) return undefined;
  const saved = saveProject({ ...p, ...patch });
  broadcast({ type: 'project.upsert', project: saved });
  return saved;
}

export function deleteProject(id: string) {
  dropProject(id);
  broadcast({ type: 'project.remove', projectId: id });
}

export { getProject, listProjects };

/** Whether the folder looks like a generated site (so a restart can resume it). */
export function looksGenerated(path: string): boolean {
  return existsSync(join(path, 'package.json')) && existsSync(join(path, 'design.config.ts'));
}
