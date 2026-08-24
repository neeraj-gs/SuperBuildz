/**
 * What is actually driving your build, said out loud.
 *
 * ── Why this screen exists ──────────────────────────────────────────────────
 *
 * Super Builds is a wrapper around somebody's own Claude Code, and a wrapper
 * that will not say what it is doing is indistinguishable from a black box you
 * are paying for. Two questions kept coming up and neither had an answer
 * anywhere in the product: what is it allowed to do to my machine, and what did
 * it actually ask for? Both are knowable — the first is a settings file and a
 * policy list this repository owns, the second is a prompt this repository
 * writes — so both are shown.
 *
 * ── The prompt is editable, and that is the point ───────────────────────────
 *
 * `BRIEF.md` sits in the project folder and every stage is told to obey it. A
 * person who disagrees with a line of it should be able to change that line and
 * build again, instead of arguing with a chat about a document they cannot see.
 * Editing it is not a power-user escape hatch; it is the one document that
 * decides what the site becomes.
 *
 * ── Best effort, and honest about it ────────────────────────────────────────
 *
 * The plugin, skill and MCP lists are read off disk from Claude Code's own
 * configuration. That is a format this repository does not own, so everything
 * here is defensive: a file that will not parse contributes nothing and says
 * nothing, rather than inventing a list or throwing on a screen that is only
 * meant to inform.
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import type { EngineExtra, EngineInfo } from '@superbuilds/protocol';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { getProject } from './projects.ts';
import { getSession } from './store.ts';
import { stagesFor } from './brief.ts';
import { superbuildsHome } from './paths.ts';
import { resolveClaudeBin } from './claude.ts';

function readJson(file: string): Record<string, unknown> | null {
  try { return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>; } catch { return null; }
}

/** Names of the directories directly under `dir`, or nothing if there is no such place. */
function dirNames(dir: string): string[] {
  try { return readdirSync(dir).filter((n) => !n.startsWith('.') && statSync(join(dir, n)).isDirectory()); } catch { return []; }
}

function fileNames(dir: string, ext: string): string[] {
  try { return readdirSync(dir).filter((n) => n.endsWith(ext)).map((n) => n.slice(0, -ext.length)); } catch { return []; }
}

/**
 * Everything Claude Code has been given, from the two places it looks.
 *
 * The user's `~/.claude` applies to every project; the project's own `.claude`
 * applies to this one. Both are listed, labelled by where they came from, so
 * "why did it do that" has somewhere to start.
 */
function extrasFor(projectPath: string): EngineExtra[] {
  const out: EngineExtra[] = [];
  const roots: Array<[string, string]> = [
    [join(homedir(), '.claude'), 'this machine'],
    [join(projectPath, '.claude'), 'this project'],
  ];

  for (const [root, where] of roots) {
    if (!existsSync(root)) continue;

    for (const name of dirNames(join(root, 'skills'))) out.push({ name, kind: 'skill', where });
    for (const name of fileNames(join(root, 'agents'), '.md')) out.push({ name, kind: 'agent', where });
    for (const name of fileNames(join(root, 'commands'), '.md')) out.push({ name: `/${name}`, kind: 'command', where });

    // Plugins live under plugins/repos/<owner>/<repo>, and the enabled set is
    // named in settings.json. Both are read: installed but disabled is worth
    // seeing, because it is the usual explanation for "the skill did nothing".
    const settings = readJson(join(root, 'settings.json')) ?? {};
    const enabled = new Set<string>();
    const enabledPlugins = settings.enabledPlugins as Record<string, unknown> | undefined;
    if (enabledPlugins && typeof enabledPlugins === 'object') {
      for (const [k, v] of Object.entries(enabledPlugins)) if (v !== false) enabled.add(k.split('@')[0]);
    }
    for (const owner of dirNames(join(root, 'plugins', 'repos'))) {
      for (const repo of dirNames(join(root, 'plugins', 'repos', owner))) {
        out.push({ name: repo, kind: 'plugin', where, detail: enabled.size === 0 || enabled.has(repo) ? undefined : 'installed, not enabled' });
      }
    }

    const mcp = (settings.mcpServers ?? readJson(join(root, 'mcp.json'))?.mcpServers) as Record<string, unknown> | undefined;
    if (mcp && typeof mcp === 'object') for (const name of Object.keys(mcp)) out.push({ name, kind: 'mcp', where });
  }

  // A project-level .mcp.json is the documented place for a shared server list.
  const projectMcp = readJson(join(projectPath, '.mcp.json'));
  const servers = projectMcp?.mcpServers as Record<string, unknown> | undefined;
  if (servers && typeof servers === 'object') for (const name of Object.keys(servers)) out.push({ name, kind: 'mcp', where: 'this project' });

  // Same name from two places is not a duplicate worth showing twice.
  const seen = new Set<string>();
  return out.filter((e) => { const k = `${e.kind}:${e.name}:${e.where}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

const HOOKS: EngineInfo['hooks'] = [
  { event: 'PreToolUse', does: 'Every tool call is offered to Super Builds first, which refuses the handful that could hurt this machine.' },
  { event: 'Notification', does: 'Lets Super Builds know when Claude Code wants attention.' },
];

const REFUSES = [
  'Killing Node processes by name — that would end Super Builds itself.',
  'Deleting recursively outside the project folder.',
  'Formatting disks, editing the registry, shutting the machine down.',
  'Reading or writing another tool\'s credentials — .ssh, .aws, .vercel, .claude.',
  'Piping a download straight into a shell.',
  'Force-pushing to git.',
  'Reading .env files into the conversation, so keys never reach a transcript.',
];

export function engineInfo(projectId: string): EngineInfo {
  const project = getProject(projectId);
  if (!project) throw new Error('Unknown project.');
  const spec = project.spec;

  const briefPath = join(project.path, 'BRIEF.md');
  const exists = existsSync(briefPath);
  let text = '';
  try { text = exists ? readFileSync(briefPath, 'utf8') : ''; } catch { text = ''; }

  return {
    projectId,
    claude: {
      bin: resolveClaudeBin(),
      model: getSession(project.sessionId ?? '')?.model,
      // Builds run unattended because a non-coder cannot be asked to approve
      // `npm install` forty times. The hook above is what makes that safe.
      permissionMode: 'bypassPermissions',
    },
    argv: [
      'claude', '-p',
      '--output-format', 'stream-json', '--include-partial-messages', '--verbose',
      '--append-system-prompt', '<the Super Builds system prompt for this stage>',
      '--permission-mode', 'bypassPermissions',
      ...(spec?.budgetUsd ? ['--max-budget-usd', String(spec.budgetUsd)] : []),
      '--settings', join(superbuildsHome(), 'hooks', 'settings-<port>.json'),
    ],
    hooks: HOOKS,
    refuses: REFUSES,
    extras: extrasFor(project.path),
    brief: { text, exists, path: 'BRIEF.md' },
    stages: spec ? stagesFor(spec).map((s) => ({ id: s.id, label: s.label, blurb: s.blurb, prompt: s.prompt(spec) })) : [],
  };
}

/** Rewrite BRIEF.md. Every later stage reads it, so this changes what gets built. */
export function setBrief(projectId: string, text: string): { ok: true } {
  const project = getProject(projectId);
  if (!project) throw new Error('Unknown project.');
  if (typeof text !== 'string' || text.length > 400_000) throw new Error('That is not a brief.');
  writeFileSync(join(project.path, 'BRIEF.md'), text.replace(/\r\n/g, '\n').replace(/\n*$/, '\n'));
  return { ok: true };
}
