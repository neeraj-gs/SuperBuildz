/**
 * Opening a terminal window that actually runs what it was told to.
 *
 * Ported from PowerHouz. The bug it fixes: `spawn('cmd', ['/c','start','""',…])`
 * reads correctly and does not work, because Node escapes the quotes inside
 * arguments and cmd then takes the wrong token as the program. A window
 * appears showing an error while the spawn reports success. So there is no
 * command line here: the command goes into a script file, and
 * `windowsVerbatimArguments` stops Node touching the one line that launches it.
 *
 * And proof: the script writes a marker as its first act; `opened` is observed.
 */

import { spawn } from 'node:child_process';
import { existsSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function shellQuote(value: string): string {
  return /\s/.test(value) ? `"${value}"` : value;
}

export interface TerminalRequest {
  title: string;
  /** One or more command lines, already quoted as the shell needs them. */
  commands: string[];
  cwd?: string;
  say?: string[];
  /** Keep the window open afterwards so output can be read. */
  hold?: boolean;
}

export interface TerminalResult { ok: boolean; opened: boolean; message: string; script?: string }

const stamp = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export async function openTerminal(req: TerminalRequest): Promise<TerminalResult> {
  const id = stamp();
  const marker = join(tmpdir(), `sb-term-${id}.txt`);
  let script = '';
  try {
    if (process.platform === 'win32') {
      script = join(tmpdir(), `sb-term-${id}.cmd`);
      const lines = [
        '@echo off',
        'setlocal enabledelayedexpansion',
        `title ${req.title}`,
        `echo open> ${shellQuote(marker)}`,
        ...(req.cwd ? [`cd /d ${shellQuote(req.cwd)}`] : []),
        ...(req.say ?? []).map((l) => `echo ${l}`),
        ...(req.say?.length ? ['echo.'] : []),
        'set FAILED=',
      ];
      for (const c of req.commands) {
        lines.push(`echo ^> ${c.replace(/[&<>|^]/g, '^$&')}`, c, 'if errorlevel 1 set FAILED=1', 'echo.');
      }
      lines.push(
        'if defined FAILED (echo Some steps reported an error. Read the output above.) else (echo Done. You can close this window.)',
        ...(req.hold === false ? [] : ['pause']),
        '',
      );
      writeFileSync(script, lines.join('\r\n'));
      spawn('cmd.exe', [`/c start "${req.title}" ${shellQuote(script)}`], {
        windowsVerbatimArguments: true, detached: true, stdio: 'ignore',
      }).unref();
    } else {
      script = join(tmpdir(), `sb-term-${id}.sh`);
      const lines = [
        '#!/usr/bin/env bash',
        `echo open > ${shellQuote(marker)}`,
        ...(req.cwd ? [`cd ${shellQuote(req.cwd)} || exit 1`] : []),
        ...(req.say ?? []).map((l) => `echo "${l.replace(/"/g, '\\"')}"`),
        'failed=0',
      ];
      for (const c of req.commands) lines.push(`echo "> ${c.replace(/"/g, '\\"')}"`, `${c} || failed=1`, 'echo');
      lines.push(
        'if [ "$failed" -ne 0 ]; then echo "Some steps reported an error. Read the output above."; else echo "Done. You can close this window."; fi',
        ...(req.hold === false ? [] : ['read -n 1 -s -r -p "Press any key to close."']),
        '',
      );
      writeFileSync(script, lines.join('\n'));
      chmodSync(script, 0o755);
      if (process.platform === 'darwin') {
        spawn('osascript', ['-e', `tell application "Terminal" to do script "bash ${script}"`, '-e', 'tell application "Terminal" to activate'], { detached: true, stdio: 'ignore' }).unref();
      } else {
        for (const [bin, flag] of [['x-terminal-emulator', '-e'], ['gnome-terminal', '--'], ['konsole', '-e'], ['xfce4-terminal', '-x'], ['xterm', '-e']]) {
          try { spawn(bin, [flag, 'bash', script], { detached: true, stdio: 'ignore' }).unref(); break; } catch { /* next */ }
        }
      }
    }
  } catch (err) {
    return { ok: false, opened: false, message: `Could not open a terminal: ${(err as Error).message}`, script };
  }

  for (let waited = 0; waited < 5000; waited += 250) {
    if (existsSync(marker)) {
      try { rmSync(marker, { force: true }); } catch {}
      return { ok: true, opened: true, message: `A terminal is open: ${req.title}.`, script };
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return { ok: false, opened: false, message: `No terminal window appeared. The script is at ${script}; you can run it yourself.`, script };
}
