/**
 * What a session may never do to the machine it is on.
 *
 * Generation runs unattended with `bypassPermissions`, because a non-coder
 * cannot be asked to approve `npm install`. So the PreToolUse hook is the
 * gate: every tool call passes through here, and the handful of things that
 * could hurt the machine are refused with a sentence Claude reads and the
 * person sees. Everything else is allowed; the project folder is theirs.
 */

import { relative, resolve, isAbsolute } from 'node:path';
import { homedir } from 'node:os';

export interface HookInput {
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  cwd?: string;
  session_id?: string;
}

export interface Verdict { allow: boolean; reason?: string }

const DENY_COMMANDS: Array<[RegExp, string]> = [
  [/\b(taskkill|pkill|killall)\b[^\n]*\bnode(\.exe)?\b/i, 'Killing Node by name would end Super Builds and this conversation. Stop the specific process by PID, or ask the person to restart the preview.'],
  [/\bStop-Process\b[^\n]*-Name\s+node/i, 'Killing Node by name would end Super Builds and this conversation.'],
  [/\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)\s+(\/|~|\$HOME|[A-Za-z]:\\|\.\.)/i, 'Recursive delete outside the project is refused.'],
  [/\b(rmdir|rd)\s+\/s[^\n]*([A-Za-z]:\\(?!.*node_modules)|\.\.)/i, 'Recursive delete outside the project is refused.'],
  [/\b(format|diskpart|mkfs|shutdown|reboot|halt|bcdedit)\b/i, 'System-level commands are refused.'],
  [/\b(reg\s+(add|delete)|regedit)\b/i, 'Registry edits are refused.'],
  [/\bgit\s+push\b[^\n]*--force(?!-with-lease)/i, 'Force-pushing is refused.'],
  [/(~|\$HOME|%USERPROFILE%|[A-Za-z]:\\Users\\[^\\]+)[\\/]\.(claude|superbuilds|vercel|ssh|aws|gnupg)\b/i, 'Reading or writing another tool\'s configuration or credentials is refused.'],
  [/\bcurl\b[^\n]*\|\s*(sh|bash|powershell|iex)\b/i, 'Piping a download into a shell is refused.'],
  [/\b(Invoke-Expression|iex)\s*\(?\s*\(?\s*(New-Object|iwr|Invoke-WebRequest)/i, 'Piping a download into a shell is refused.'],
];

const PROTECTED_FILES = /(^|[\\/])\.(env(\..*)?|npmrc|git-credentials)$/i;

function insideProject(target: string, cwd: string): boolean {
  const abs = isAbsolute(target) ? target : resolve(cwd, target);
  const rel = relative(resolve(cwd), abs);
  return !!rel && !rel.startsWith('..') && !isAbsolute(rel) || rel === '';
}

export function judge(input: HookInput): Verdict {
  const tool = input.tool_name ?? '';
  const args = input.tool_input ?? {};
  const cwd = input.cwd ?? process.cwd();

  if (tool === 'Bash' || tool === 'PowerShell') {
    const command = String(args.command ?? '');
    for (const [rx, reason] of DENY_COMMANDS) if (rx.test(command)) return { allow: false, reason };
    // Reading another project's .env is the other way keys leak into transcripts.
    if (/\b(cat|type|Get-Content|more|less|head|tail)\b[^\n]*\.env/i.test(command) && !/\.env\.example/.test(command)) {
      return { allow: false, reason: 'Printing an .env file would put a secret into the conversation. Refer to variables by name.' };
    }
    return { allow: true };
  }

  if (tool === 'Write' || tool === 'Edit' || tool === 'MultiEdit' || tool === 'NotebookEdit') {
    const path = String(args.file_path ?? args.path ?? args.notebook_path ?? '');
    if (path && !insideProject(path, cwd)) return { allow: false, reason: `Writing outside the project folder is refused (${path}).` };
    const home = homedir();
    if (path && resolve(path).toLowerCase().startsWith(resolve(home, '.superbuilds').toLowerCase())) return { allow: false, reason: 'Super Builds\' own state is off limits.' };
    return { allow: true };
  }

  if (tool === 'Read') {
    const path = String(args.file_path ?? '');
    if (PROTECTED_FILES.test(path) && !/\.env\.example$/i.test(path)) return { allow: false, reason: 'Reading an .env file would put a secret into the conversation. Refer to variables by name.' };
    if (/[\\/]\.(claude|superbuilds|vercel|ssh|aws)[\\/]/i.test(path) && !insideProject(path, cwd)) return { allow: false, reason: 'Another tool\'s configuration is off limits.' };
    return { allow: true };
  }

  return { allow: true };
}

/** The shape Claude Code expects back from a PreToolUse hook. */
export function hookResponse(v: Verdict) {
  if (v.allow) return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow' } };
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: v.reason } };
}
