/**
 * Development: the daemon and Vite, with reload, as one command.
 *
 * One parent picks both ports and tells both children, so they cannot disagree
 * about where the other one is — which is the whole history of `scripts/ports.mjs`.
 * If the usual UI port is taken by something else, a free one is found and the
 * daemon is told that number instead of assuming.
 *
 * Either child dying ends both, so a crash is visible rather than a UI that
 * quietly cannot reach anything.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DAEMON_PORT, UI_PORT_DEFAULT, freeUiPort } from './ports.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const npm = isWin ? 'npm.cmd' : 'npm';

const uiPort = await freeUiPort();
if (uiPort !== UI_PORT_DEFAULT) console.log(`[dev] ${UI_PORT_DEFAULT} is taken; the interface will be on ${uiPort}.`);
const env = { ...process.env, SUPERBUILDS_PORT: String(DAEMON_PORT), SUPERBUILDS_UI_PORT: String(uiPort) };

const daemon = spawn(process.execPath, [join(root, 'daemon', 'src', 'index.ts')], {
  cwd: root, stdio: 'inherit', env: { ...env, SUPERBUILDS_DEV: '1' },
});
const ui = spawn(npm, ['--prefix', join(root, 'ui'), 'run', 'dev'], {
  cwd: root, stdio: 'inherit', shell: isWin, env,
});

const stop = () => { try { daemon.kill(); } catch {} try { ui.kill(); } catch {} };
daemon.on('exit', (code) => { console.error(`[dev] daemon exited ${code}`); stop(); process.exit(code ?? 1); });
ui.on('exit', (code) => { console.error(`[dev] ui exited ${code}`); stop(); process.exit(code ?? 1); });
process.on('SIGINT', () => { stop(); process.exit(0); });
process.on('SIGTERM', () => { stop(); process.exit(0); });
