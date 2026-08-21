/**
 * `npm start`: build the interface, start the daemon, open a window.
 *
 * The window is the Chromium the person already has, in app mode (no address
 * bar), falling back to an ordinary tab. No second browser is downloaded to
 * run a local tool. Electron is the next front door and changes nothing here.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const port = Number(process.env.SUPERBUILDS_PORT ?? 7747);
const url = `http://127.0.0.1:${port}/`;

if (!existsSync(join(root, 'ui', 'dist', 'index.html')) || process.argv.includes('--build')) {
  console.log('[start] building the interface…');
  const b = spawnSync(isWin ? 'npm.cmd' : 'npm', ['--prefix', join(root, 'ui'), 'run', 'build'], { cwd: root, stdio: 'inherit', shell: isWin });
  if (b.status !== 0) process.exit(b.status ?? 1);
}

const daemon = spawn(process.execPath, [join(root, 'daemon', 'src', 'index.ts')], { cwd: root, stdio: 'inherit', env: process.env });
daemon.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGINT', () => { try { daemon.kill(); } catch {} process.exit(0); });

// Wait for the daemon, then open a window.
const started = Date.now();
const poll = async () => {
  while (Date.now() - started < 30_000) {
    try { const r = await fetch(url + 'api/health'); if (r.ok) return true; } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
};

if (await poll()) openWindow(url); else console.error('[start] the daemon did not answer in 30 seconds. Open ' + url + ' yourself.');

function openWindow(target) {
  const candidates = isWin ? [
    join(process.env['ProgramFiles'] ?? 'C:\\Program Files', 'Google\\Chrome\\Application\\chrome.exe'),
    join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Google\\Chrome\\Application\\chrome.exe'),
    join(process.env['LOCALAPPDATA'] ?? '', 'Google\\Chrome\\Application\\chrome.exe'),
    join(process.env['ProgramFiles'] ?? 'C:\\Program Files', 'Microsoft\\Edge\\Application\\msedge.exe'),
    join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Microsoft\\Edge\\Application\\msedge.exe'),
    join(process.env['LOCALAPPDATA'] ?? '', 'BraveSoftware\\Brave-Browser\\Application\\brave.exe'),
  ] : process.platform === 'darwin' ? [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  ] : ['google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge', 'brave-browser'];

  const profile = join(homedir(), '.superbuilds', 'window-profile');
  for (const bin of candidates) {
    if (isWin || process.platform === 'darwin') { if (!existsSync(bin)) continue; }
    try {
      spawn(bin, [`--app=${target}`, `--user-data-dir=${profile}`, '--window-size=1480,960', '--no-first-run', '--no-default-browser-check'], { detached: true, stdio: 'ignore' }).unref();
      console.log(`[start] Super Builds is open. (${target})`);
      return;
    } catch { /* next */ }
  }
  // Fallback: the default browser.
  const opener = isWin ? ['cmd', ['/c', 'start', '', target]] : process.platform === 'darwin' ? ['open', [target]] : ['xdg-open', [target]];
  try { spawn(opener[0], opener[1], { detached: true, stdio: 'ignore' }).unref(); } catch {}
  console.log(`[start] Open ${target} in your browser.`);
}
