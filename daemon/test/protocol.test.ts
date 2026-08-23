import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitOptions, slugify } from '../../packages/protocol/src/index.ts';
import { createNdjsonParser, buildArgs } from '../src/claude.ts';
import { judge } from '../src/policy.ts';
import { portFor, forgetPorts, releasePort } from '../src/ports.ts';

test('options block is parsed and removed, JSON or lines', () => {
  const a = splitOptions('Done.\n\n```sb-options\n["Make it bigger", "Publish it"]\n```');
  assert.equal(a.text, 'Done.');
  assert.deepEqual(a.options, ['Make it bigger', 'Publish it']);
  const b = splitOptions('Done.\n```sb-options\n- One\n- Two\n```\n');
  assert.deepEqual(b.options, ['One', 'Two']);
  const c = splitOptions('Nothing here.');
  assert.equal(c.text, 'Nothing here.');
  assert.deepEqual(c.options, []);
});

test('slugify makes folder-safe names', () => {
  assert.equal(slugify('Ember & Oak — Lisbon'), 'ember-oak-lisbon');
  assert.equal(slugify('   '), 'site');
});

test('ndjson parser survives CRLF and split chunks', () => {
  const got: unknown[] = [];
  const p = createNdjsonParser((r) => got.push(r));
  p.push('{"type":"a"}\r\n{"ty');
  p.push('pe":"b"}\n');
  p.flush();
  assert.deepEqual(got, [{ type: 'a' }, { type: 'b' }]);
});

test('buildArgs puts session id or resume, never both', () => {
  const a = buildArgs({ cwd: '.', resumeSessionId: 'x' }, 'y');
  assert.ok(a.includes('--resume') && !a.includes('--session-id'));
  const b = buildArgs({ cwd: '.' }, 'y');
  assert.ok(b.includes('--session-id') && !b.includes('--resume'));
});

test('policy refuses the dangerous and allows the ordinary', () => {
  const cwd = process.platform === 'win32' ? 'C:\\Users\\me\\SuperBuilds\\site' : '/home/me/SuperBuilds/site';
  assert.equal(judge({ tool_name: 'Bash', tool_input: { command: 'taskkill /f /im node.exe' }, cwd }).allow, false);
  assert.equal(judge({ tool_name: 'Bash', tool_input: { command: 'pkill node' }, cwd }).allow, false);
  assert.equal(judge({ tool_name: 'Bash', tool_input: { command: 'rm -rf /' }, cwd }).allow, false);
  assert.equal(judge({ tool_name: 'Bash', tool_input: { command: 'cat .env.local' }, cwd }).allow, false);
  assert.equal(judge({ tool_name: 'Bash', tool_input: { command: 'cat ~/.claude.json' }, cwd }).allow, false);
  assert.equal(judge({ tool_name: 'Bash', tool_input: { command: 'npm run build' }, cwd }).allow, true);
  assert.equal(judge({ tool_name: 'Bash', tool_input: { command: 'git add -A && git commit -m x' }, cwd }).allow, true);
  assert.equal(judge({ tool_name: 'Write', tool_input: { file_path: `${cwd}/app/page.tsx` }, cwd }).allow, true);
  assert.equal(judge({ tool_name: 'Write', tool_input: { file_path: process.platform === 'win32' ? 'C:\\Windows\\x.txt' : '/etc/x' }, cwd }).allow, false);
  assert.equal(judge({ tool_name: 'Read', tool_input: { file_path: `${cwd}/.env.local` }, cwd }).allow, false);
  assert.equal(judge({ tool_name: 'Read', tool_input: { file_path: `${cwd}/.env.example` }, cwd }).allow, true);
});

test('ports are stable per key and distinct across keys', async () => {
  forgetPorts();
  const a = await portFor('one'); const b = await portFor('two'); const a2 = await portFor('one');
  assert.equal(a, a2);
  assert.notEqual(a, b);
  releasePort('one'); releasePort('two');
});

test('a port held by a wildcard listener is not handed out as free', async () => {
  const { createServer } = await import('node:net');
  const { portFor, forgetPorts } = await import('../src/ports.ts');

  forgetPorts();
  const wanted = await portFor('preview:squat-check');
  assert.ok(wanted, 'there should be a free port to test with');

  // A dev server binds the wildcard (`::`, dual-stack). Probing 127.0.0.1
  // specifically can succeed while that same bind fails, which is how a
  // squatted port read as free and `next dev` then died with EADDRINUSE.
  const squatter = createServer(() => {});
  await new Promise<void>((r) => squatter.listen(wanted!, () => r()));
  try {
    forgetPorts();
    const chosen = await portFor('preview:squat-check');
    assert.notEqual(chosen, wanted, 'a port somebody is listening on must not be offered');
  } finally {
    await new Promise<void>((r) => squatter.close(() => r()));
  }

  // And it goes back to being the stable choice once it is released.
  forgetPorts();
  assert.equal(await portFor('preview:squat-check'), wanted);

  // `avoid` gets you a different one, for retrying after a collision.
  forgetPorts();
  assert.notEqual(await portFor('preview:squat-check', [wanted!]), wanted);
});
