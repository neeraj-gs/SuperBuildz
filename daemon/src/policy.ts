/**
 * What a session may do to the machine it is on, and what it has to ask first.
 *
 * Generation runs unattended with `bypassPermissions`, because a non-coder
 * cannot be asked to approve `npm install`. So the PreToolUse hook is the gate:
 * every tool call passes through here.
 *
 * ── Why there are two tiers rather than one ─────────────────────────────────
 *
 * There used to be one: allowed, or refused with a sentence. That made the
 * refusal list carry an impossible job — wide enough to protect the machine and
 * narrow enough never to stop real work — and it failed in the expensive
 * direction. The pattern `\bformat\b` was meant to catch `format C:`. What it
 * actually caught was `git log --format=%B`, `git log --pretty=format:%h`,
 * `npm run format`, `gh pr list --format json`, `next lint --format compact`
 * and `Get-Process | Format-Table`: seven ordinary commands out of fifteen, in
 * the middle of a build, with nobody able to overrule it.
 *
 * So there are two tiers now:
 *
 *   never   the three things no answer makes safe — formatting a disk, killing
 *           Node by name (which would end Super Builds and the conversation
 *           doing the asking), and writing into Super Builds' own state. None
 *           has anything to do with building a website, and the first two are
 *           irreversible from a single press.
 *
 *   ask     everything else. It stops, the person is shown the exact command
 *           and what it would do, and they answer once, always, or no. Nobody
 *           there to answer means no — see `approvals.ts`.
 *
 * That is the whole shape. This is somebody's own machine and their own Claude
 * Code, so whether it may do a thing is their decision. What this file owes
 * them is that they are asked in words they can weigh, with the command in
 * full, before it happens rather than after.
 *
 * ── Why the patterns are anchored at command position ──────────────────────
 *
 * `format` is a word that appears in a flag on half the git commands ever
 * written, and a disk format is `format C:` at the *start* of a command. The
 * difference is position, so position is what is matched: the start of the
 * line, or just after a pipe, a semicolon, `&&`, `||`, a subshell or a `sudo`.
 * A word inside an argument is an argument.
 */

import { relative, resolve, isAbsolute } from 'node:path';
import { homedir } from 'node:os';

export interface HookInput {
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  cwd?: string;
  session_id?: string;
}

/** `never` can only be refused. `ask` is refused until somebody says otherwise. */
export type Risk = 'never' | 'ask';

export interface Rule {
  /** Stable, and the key a conversation-wide yes is granted against. */
  id: string;
  risk: Risk;
  /** The sentence Claude reads when it is refused. */
  reason: string;
  /** What it wants to do, in words somebody who does not code can weigh. */
  what: string;
  /** What saying yes for the whole conversation would cover. */
  scope?: string;
  /** Worth a red card rather than an ordinary one. */
  danger?: boolean;
}

export interface Verdict {
  allow: boolean;
  rule?: Rule;
  /** The command or the path, verbatim. Never summarised, never elided. */
  detail?: string;
  /** The sentence Claude reads. `rule.reason`, unless the path belongs in it. */
  reason?: string;
}

/* ------------------------------------------------------------------ rules -- */

const DISK: Rule = {
  id: 'disk', risk: 'never', danger: true,
  reason: 'Formatting or partitioning a disk is refused and cannot be allowed from here. Nothing a website needs requires it.',
  what: 'Format or partition a disk on this machine',
};

const OWN_PROCESS: Rule = {
  id: 'own-process', risk: 'never',
  reason: 'Killing Node by name would end Super Builds and this conversation with it. Stop the one process by its PID, or ask the person to restart the preview.',
  what: 'Kill every Node process on the machine — including Super Builds itself',
};

const OWN_STATE: Rule = {
  id: 'own-state', risk: 'never',
  reason: "Super Builds' own state is off limits. Everything this conversation needs is in the project folder.",
  what: "Write inside Super Builds' own state folder",
};

const POWER: Rule = {
  id: 'power', risk: 'ask',
  reason: 'Shutting down, restarting or editing the boot configuration needs the person to say so.',
  what: 'Shut down, restart, or change how this machine boots',
  scope: 'power and boot commands',
};

const WIDE_DELETE: Rule = {
  id: 'wide-delete', risk: 'ask', danger: true,
  reason: 'A recursive delete outside the project folder needs the person to say so.',
  what: 'Delete a folder and everything inside it, outside this project',
  scope: 'recursive deletes outside the project',
};

const REGISTRY: Rule = {
  id: 'registry', risk: 'ask',
  reason: 'Editing the Windows registry needs the person to say so.',
  what: 'Change a setting in the Windows registry',
  scope: 'registry edits',
};

const FORCE_PUSH: Rule = {
  id: 'force-push', risk: 'ask', danger: true,
  reason: 'Force-pushing can destroy commits already on the remote, so it needs the person to say so. Force-with-lease is allowed without asking.',
  what: 'Force-push, which can overwrite work already on the remote',
  scope: 'force-pushing',
};

const OUTSIDE: Rule = {
  id: 'outside-project', risk: 'ask',
  reason: 'Writing outside the project folder needs the person to say so.',
  what: 'Create or change a file outside this project',
  scope: 'writing anywhere on this machine',
};

const OTHER_CONFIG: Rule = {
  id: 'other-config', risk: 'ask', danger: true,
  reason: "Reading or writing another tool's configuration needs the person to say so — those folders hold credentials.",
  what: "Read or change another tool's configuration, where credentials are kept",
  scope: "other tools' configuration folders",
};

const PIPE_TO_SHELL: Rule = {
  id: 'pipe-to-shell', risk: 'ask', danger: true,
  reason: 'Piping a download straight into a shell runs code nobody has read, so it needs the person to say so.',
  what: 'Download a script from the internet and run it immediately, unread',
  scope: 'downloading and running scripts',
};

const READ_SECRET: Rule = {
  id: 'read-secret', risk: 'ask', danger: true,
  reason: 'Printing a secrets file would put its contents into this conversation, which is saved to disk. Refer to the variables by name instead.',
  what: 'Read a secrets file — its contents would be saved into this conversation',
  scope: 'reading secrets files',
};

export const RULES: Rule[] = [DISK, OWN_PROCESS, OWN_STATE, POWER, WIDE_DELETE, REGISTRY, FORCE_PUSH, OUTSIDE, OTHER_CONFIG, PIPE_TO_SHELL, READ_SECRET];

export function ruleById(id: string): Rule | undefined {
  return RULES.find((r) => r.id === id);
}

/* -------------------------------------------------------------- matching -- */

/**
 * A pattern that only fires where a command actually begins.
 *
 * Start of input, or after a newline, a `;`, a `|`, an `&` or an opening
 * bracket — optionally past a `sudo`. `&&` and `||` need no separate case:
 * the single characters are already in the class.
 */
function cmd(body: string): RegExp {
  return new RegExp('(?:^|[\\n;&|(])\\s*(?:sudo\\s+|doas\\s+)?(?:' + body + ')', 'i');
}

const BASH_RULES: Array<{ rule: Rule; test: RegExp }> = [
  // `format C:`, `format /fs:ntfs D:` — the drive letter is what makes it a format.
  { rule: DISK, test: cmd('format(?:\\.com)?\\s+(?:/\\S+\\s+)*[a-z]:') },
  { rule: DISK, test: cmd('(?:diskpart|mkfs(?:\\.\\w+)?)\\b') },
  { rule: DISK, test: /\bFormat-Volume\b/i },

  { rule: OWN_PROCESS, test: /\b(?:taskkill|pkill|killall)\b[^\n]*\bnode(?:\.exe)?\b/i },
  { rule: OWN_PROCESS, test: /\bStop-Process\b[^\n]*-Name\s+["']?node/i },

  { rule: POWER, test: cmd('(?:shutdown|reboot|halt|poweroff|bcdedit)\\b') },
  { rule: POWER, test: /\b(?:Restart|Stop)-Computer\b/i },

  { rule: WIDE_DELETE, test: /\brm\s+(?:-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)\s+(?:\/|~|\$HOME|[A-Za-z]:\\|\.\.)/i },
  { rule: WIDE_DELETE, test: /\b(?:rmdir|rd)\s+\/s[^\n]*(?:[A-Za-z]:\\(?!.*node_modules)|\.\.)/i },

  { rule: REGISTRY, test: cmd('reg(?:\\.exe)?\\s+(?:add|delete)\\b') },
  { rule: REGISTRY, test: /\bregedit\b/i },
  { rule: REGISTRY, test: /\b(?:New|Set|Remove)-ItemProperty\b[^\n]*\bHK(?:LM|CU|CR|U|CC):/i },

  { rule: FORCE_PUSH, test: /\bgit\s+push\b[^\n]*--force(?!-with-lease)/i },

  { rule: OTHER_CONFIG, test: /(?:~|\$HOME|%USERPROFILE%|[A-Za-z]:\\Users\\[^\\]+)[\\/]\.(?:claude|superbuilds|vercel|ssh|aws|gnupg)\b/i },

  { rule: PIPE_TO_SHELL, test: /\bcurl\b[^\n]*\|\s*(?:sh|bash|powershell|pwsh|iex)\b/i },
  { rule: PIPE_TO_SHELL, test: /\b(?:Invoke-Expression|iex)\s*\(?\s*\(?\s*(?:New-Object|iwr|Invoke-WebRequest)/i },

  // Reading another project's .env is the other way a key leaks into a transcript.
  { rule: READ_SECRET, test: /\b(?:cat|type|Get-Content|gc|more|less|head|tail)\b[^\n]*\.env\b(?!\.example)/i },
];

const PROTECTED_FILES = /(?:^|[\\/])\.(?:env(?:\..*)?|npmrc|git-credentials)$/i;

/** Is `target` inside `cwd`, or is it somewhere else on the machine? */
function insideProject(target: string, cwd: string): boolean {
  const abs = isAbsolute(target) ? target : resolve(cwd, target);
  const rel = relative(resolve(cwd), abs);
  if (rel === '') return true;
  return !!rel && !rel.startsWith('..') && !isAbsolute(rel);
}

/* ----------------------------------------------------------------- judge -- */

export function judge(input: HookInput): Verdict {
  const tool = input.tool_name ?? '';
  const args = input.tool_input ?? {};
  const cwd = input.cwd ?? process.cwd();

  if (tool === 'Bash' || tool === 'PowerShell') {
    const command = String(args.command ?? '');
    for (const { rule, test } of BASH_RULES) {
      if (test.test(command)) return { allow: false, rule, detail: command.slice(0, 600), reason: rule.reason };
    }
    return { allow: true };
  }

  if (tool === 'Write' || tool === 'Edit' || tool === 'MultiEdit' || tool === 'NotebookEdit') {
    const path = String(args.file_path ?? args.path ?? args.notebook_path ?? '');
    if (!path) return { allow: true };
    if (resolve(path).toLowerCase().startsWith(resolve(homedir(), '.superbuilds').toLowerCase())) {
      return { allow: false, rule: OWN_STATE, detail: path, reason: OWN_STATE.reason };
    }
    if (!insideProject(path, cwd)) {
      return { allow: false, rule: OUTSIDE, detail: path, reason: `${OUTSIDE.reason} (${path})` };
    }
    return { allow: true };
  }

  if (tool === 'Read') {
    const path = String(args.file_path ?? '');
    if (!path) return { allow: true };
    if (PROTECTED_FILES.test(path) && !/\.env\.example$/i.test(path)) {
      return { allow: false, rule: READ_SECRET, detail: path, reason: READ_SECRET.reason };
    }
    if (/[\\/]\.(?:claude|superbuilds|vercel|ssh|aws|gnupg)[\\/]/i.test(path) && !insideProject(path, cwd)) {
      return { allow: false, rule: OTHER_CONFIG, detail: path, reason: OTHER_CONFIG.reason };
    }
    return { allow: true };
  }

  return { allow: true };
}

/** The shape Claude Code expects back from a PreToolUse hook. */
export function hookResponse(v: { allow: boolean; reason?: string }) {
  if (v.allow) return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow' } };
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: v.reason } };
}
