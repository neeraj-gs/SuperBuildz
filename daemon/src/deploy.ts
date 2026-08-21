/**
 * Publishing to Vercel, without ever holding the token.
 *
 * Everything runs the Vercel CLI in the project folder. `vercel login` opens
 * the person's own browser in a terminal we open and watch; the credential
 * lands in Vercel's own store. Then link, push the env, deploy, parse the URL.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DeployState } from '@superbuilds/protocol';
import { broadcast } from './bus.ts';
import { execBin, spawnBin } from './binaries.ts';
import { openTerminal } from './terminal.ts';
import { probe } from './install.ts';
import { getProject, updateProject } from './projects.ts';

const states = new Map<string, DeployState>();

function blank(projectId: string): DeployState {
  return { projectId, cli: false, connected: false, running: false, log: '', envKeys: [] };
}

function push(projectId: string, patch: Partial<DeployState>) {
  const cur = states.get(projectId) ?? blank(projectId);
  const next = { ...cur, ...patch };
  states.set(projectId, next);
  broadcast({ type: 'deploy.update', state: next });
  return next;
}

/** Keys in .env.local, names only. Values never leave the daemon. */
export function envEntries(projectPath: string): Array<{ key: string; value: string }> {
  const file = join(projectPath, '.env.local');
  if (!existsSync(file)) return [];
  const out: Array<{ key: string; value: string }> = [];
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (key) out.push({ key, value });
  }
  return out;
}

/** Set or replace one key in .env.local. The value passes through memory and is not kept. */
export function setEnvValue(projectPath: string, key: string, value: string): boolean {
  if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(key)) return false;
  const file = join(projectPath, '.env.local');
  const lines = existsSync(file) ? readFileSync(file, 'utf8').split('\n') : [];
  const quoted = /[\s#"']/.test(value) ? JSON.stringify(value) : value;
  let done = false;
  const next = lines.map((l) => {
    const m = l.match(/^#?\s*([A-Z][A-Z0-9_]*)=/);
    if (m && m[1] === key && !done) { done = true; return `${key}=${quoted}`; }
    return l;
  });
  if (!done) next.push(`${key}=${quoted}`);
  writeFileSync(file, next.join('\n').replace(/\n*$/, '\n'), { mode: 0o600 });
  return true;
}

export async function deployStatus(projectId: string): Promise<DeployState> {
  const project = getProject(projectId);
  if (!project) return blank(projectId);
  const cli = (await probe('vercel')).present;
  let connected = false; let account: string | undefined;
  if (cli) {
    const who = await execBin('vercel', ['whoami'], { cwd: project.path, timeout: 20_000 });
    if (who.ok && who.out && !/not authenticated|no existing credentials|error/i.test(who.out)) { connected = true; account = who.out.trim().split('\n').at(-1); }
  }
  const envKeys = envEntries(project.path).map((e) => e.key);
  const cur = states.get(projectId);
  return push(projectId, { cli, connected, account, envKeys, url: cur?.url ?? project.deploy?.url });
}

export async function vercelLogin(projectId: string): Promise<{ ok: boolean; message: string }> {
  const project = getProject(projectId);
  if (!project) return { ok: false, message: 'Unknown project.' };
  const res = await openTerminal({
    title: 'Sign in to Vercel', cwd: project.path, commands: ['vercel login'],
    say: ['Signing in to Vercel. A browser will open; finish there, then come back to Super Builds.'], hold: true,
  });
  return { ok: res.opened, message: res.opened ? 'Vercel sign-in opened in a terminal. Finish in your browser, then press Check again.' : res.message };
}

function run(args: string[], cwd: string, onLog: (c: string) => void, input?: string): Promise<{ ok: boolean; out: string }> {
  return new Promise((resolve) => {
    const child = spawnBin('vercel', args, { cwd, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, FORCE_COLOR: '0', CI: '1' } });
    let out = '';
    const on = (c: string) => { out += c; onLog(c); };
    child.stdout?.setEncoding('utf8'); child.stdout?.on('data', on);
    child.stderr?.setEncoding('utf8'); child.stderr?.on('data', on);
    child.stdin?.on('error', () => {});
    if (input !== undefined) { try { child.stdin?.write(input); child.stdin?.end(); } catch {} } else { try { child.stdin?.end(); } catch {} }
    child.on('error', (e) => resolve({ ok: false, out: out + e.message }));
    child.on('close', (code) => resolve({ ok: code === 0, out }));
  });
}

export async function deployProject(projectId: string, target: 'production' | 'preview' = 'production'): Promise<DeployState> {
  const project = getProject(projectId);
  if (!project) throw new Error('Unknown project.');
  const status = await deployStatus(projectId);
  if (!status.cli) throw new Error('The Vercel CLI is not installed. Install it from the requirements screen first.');
  if (!status.connected) throw new Error('Not signed in to Vercel yet. Press "Connect Vercel" first.');
  if (status.running) throw new Error('A deploy is already running.');

  const entries = envEntries(project.path);
  const needsDb = project.spec?.crm === 'custom' && !entries.some((e) => e.key === 'DATABASE_URL' && e.value);
  if (needsDb) throw new Error('The CRM needs a Postgres database on Vercel (SQLite cannot live there). Add a DATABASE_URL — a free Neon or Supabase database works — then publish.');

  push(projectId, { running: true, log: '', error: undefined });
  const onLog = (c: string) => { const cur = states.get(projectId)!; push(projectId, { log: (cur.log + c).slice(-40_000) }); };
  const slug = project.slug || 'site';

  try {
    onLog(`> vercel link --yes --project ${slug}\n`);
    const link = await run(['link', '--yes', '--project', slug], project.path, onLog);
    if (!link.ok) throw new Error('vercel link failed. Read the log.');

    for (const { key, value } of entries) {
      if (!value) continue;
      onLog(`> vercel env add ${key} ${target} (value not shown)\n`);
      const added = await run(['env', 'add', key, target, '--force'], project.path, () => {}, value + '\n');
      if (!added.ok && !/already exists/i.test(added.out)) onLog(`  could not set ${key}: ${added.out.split('\n').slice(-2).join(' ')}\n`);
    }

    onLog(`> vercel ${target === 'production' ? '--prod ' : ''}--yes\n`);
    const dep = await run([...(target === 'production' ? ['--prod'] : []), '--yes'], project.path, onLog);
    const urls = [...dep.out.matchAll(/https:\/\/[a-z0-9.-]+\.vercel\.app/gi)].map((m) => m[0]);
    const url = urls.at(-1);
    if (!dep.ok || !url) throw new Error('The deploy did not finish. Read the log: Vercel usually says exactly why.');

    updateProject(projectId, { deploy: { url, at: Date.now(), target } });
    return push(projectId, { running: false, url });
  } catch (err) {
    return push(projectId, { running: false, error: (err as Error).message });
  }
}
