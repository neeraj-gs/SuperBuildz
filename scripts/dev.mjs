/**
 * Development: the daemon and Vite, with reload, as one command.
 *
 * Daemon on 127.0.0.1:7747, UI on 127.0.0.1:5180 proxying /api and /ws to it.
 * Either child dying ends both, so a crash is visible rather than a UI that
 * quietly cannot reach anything.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const npm = isWin ? 'npm.cmd' : 'npm';

const daemon = spawn(process.execPath, [join(root, 'daemon', 'src', 'index.ts')], {
  cwd: root, stdio: 'inherit', env: { ...process.env, SUPERBUILDS_DEV: '1' },
});
const ui = spawn(npm, ['--prefix', join(root, 'ui'), 'run', 'dev'], {
  cwd: root, stdio: 'inherit', shell: isWin,
});

const stop = () => { try { daemon.kill(); } catch {} try { ui.kill(); } catch {} };
daemon.on('exit', (code) => { console.error(`[dev] daemon exited ${code}`); stop(); process.exit(code ?? 1); });
ui.on('exit', (code) => { console.error(`[dev] ui exited ${code}`); stop(); process.exit(code ?? 1); });
process.on('SIGINT', () => { stop(); process.exit(0); });
process.on('SIGTERM', () => { stop(); process.exit(0); });
