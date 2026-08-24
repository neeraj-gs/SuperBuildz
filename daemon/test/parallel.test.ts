/**
 * Several conversations at once, and the notebook they share.
 *
 * The queue is the part worth testing: it is invisible when it works, and when
 * it is wrong the symptom is a laptop that has stopped responding rather than
 * an error anybody can read.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { admitOrQueue, ceiling, configureCapacity, drain, forgetQueue, queued, unqueue } from '../src/capacity.ts';
import { memory, memoryPrompt, noteTurn, setMemory } from '../src/memory.ts';

/** A queue driven by a counter we control, so nothing here depends on timing. */
function harness(limit: number) {
  process.env.SUPERBUILDS_MAX_AGENTS = String(limit);
  forgetQueue();
  let running = 0;
  const finished: string[] = [];
  const settle: Array<() => void> = [];
  configureCapacity({ countLive: () => running });

  const job = (id: string) => ({
    sessionId: id,
    projectId: 'p',
    title: id,
    start: () => new Promise<void>((resolve) => {
      running++;
      settle.push(() => { running--; finished.push(id); resolve(); });
    }),
  });

  /*
    Finishing is asynchronous on purpose.

    The queue drains in a promise's `finally`, which is a microtask — so a test
    that finishes a job and checks the count on the very next line is checking
    before the drain has had its turn, and would fail against correct code.
  */
  const finishOne = async () => { settle.shift()?.(); await Promise.resolve(); await Promise.resolve(); };
  return { job, finished, finishOne, running: () => running };
}

test('the ceiling comes from the machine, and can be overridden', () => {
  delete process.env.SUPERBUILDS_MAX_AGENTS;
  const n = ceiling();
  assert.ok(n >= 2 && n <= 6, `${n} is not a sane ceiling`);
  process.env.SUPERBUILDS_MAX_AGENTS = '3';
  assert.equal(ceiling(), 3);
  // Nobody gets to ask for forty.
  process.env.SUPERBUILDS_MAX_AGENTS = '99';
  assert.equal(ceiling(), 16);
  delete process.env.SUPERBUILDS_MAX_AGENTS;
});

test('turns over the ceiling wait in order and then run, and none is ever dropped', async () => {
  const h = harness(2);

  assert.deepEqual(admitOrQueue(h.job('a')), { started: true, position: 0 });
  assert.deepEqual(admitOrQueue(h.job('b')), { started: true, position: 0 });
  // The third is over the ceiling: in line, not refused.
  assert.deepEqual(admitOrQueue(h.job('c')), { started: false, position: 1 });
  assert.deepEqual(admitOrQueue(h.job('d')), { started: false, position: 2 });
  assert.equal(h.running(), 2);
  assert.deepEqual(queued().map((q) => q.title), ['c', 'd']);

  await h.finishOne();              // a finishes; c starts
  assert.equal(h.running(), 2);
  assert.deepEqual(queued().map((q) => q.title), ['d']);

  await h.finishOne();              // b finishes; d starts
  await h.finishOne();              // c finishes
  await h.finishOne();              // d finishes
  assert.equal(h.running(), 0);
  assert.deepEqual(h.finished.sort(), ['a', 'b', 'c', 'd']);
  assert.deepEqual(queued(), []);
  forgetQueue();
});

test('a queued turn can be taken out of the line, and a running one cannot', () => {
  const h = harness(1);
  admitOrQueue(h.job('a'));
  admitOrQueue(h.job('b'));
  assert.equal(unqueue('b'), true);
  assert.equal(unqueue('b'), false, 'already gone');
  assert.equal(unqueue('a'), false, 'a is running, not waiting');
  assert.deepEqual(queued(), []);
  forgetQueue();
});

test('draining with nothing waiting is harmless', () => {
  harness(2);
  drain();
  drain();
  assert.deepEqual(queued(), []);
  forgetQueue();
});

/* --------------------------------------------------------------- memory -- */

function project(): string { return mkdtempSync(join(tmpdir(), 'sb-mem-')); }

test('the notebook starts with a template and keeps what the person wrote', () => {
  const dir = project();
  const m = memory(dir);
  assert.match(m.text, /Shared notes for this project/);
  assert.deepEqual(m.entries, []);

  setMemory(dir, '# Shared notes for this project\n\nWe are a wine bar, not a restaurant.\n\n## What the conversations have been doing\n\n');
  assert.match(memory(dir).notes, /wine bar/);
  assert.match(readFileSync(join(dir, '.superbuilds', 'memory.md'), 'utf8'), /wine bar/);
});

test('a finished turn adds one line, and the person half survives it', () => {
  const dir = project();
  setMemory(dir, '# Shared notes for this project\n\nNever use the word artisanal.\n\n## What the conversations have been doing\n\n');

  noteTurn(dir, 'Menu page', 'I rewrote the menu page around the tasting menu. It now leads with the six-seat counter.\n\n```sb-options\n["Show me"]\n```');
  const m = memory(dir);
  assert.equal(m.entries.length, 1);
  assert.match(m.entries[0], /\*\*Menu page\*\*/);
  assert.match(m.entries[0], /rewrote the menu page around the tasting menu\./);
  // The options block and anything after the first sentence stay out of it.
  assert.equal(m.entries[0].includes('sb-options'), false);
  assert.equal(m.entries[0].includes('six-seat counter'), false);
  // And the standing instructions are untouched.
  assert.match(m.notes, /artisanal/);
});

test('the log is capped, newest first', () => {
  const dir = project();
  for (let i = 1; i <= 25; i++) noteTurn(dir, 'A conversation', `Change number ${i} happened.`);
  const m = memory(dir);
  assert.equal(m.entries.length, 20, 'twenty is enough to stop a collision and short enough to read');
  assert.match(m.entries[0], /number 25/);
  assert.match(m.entries[19], /number 6/);
});

test('the prompt block is absent when there is nothing to say', () => {
  const dir = project();
  // A fresh project: the template's own explanation is not an instruction.
  assert.equal(memoryPrompt(dir, []).trim(), '');

  noteTurn(dir, 'First', 'I built the hero.');
  const withLog = memoryPrompt(dir, []);
  assert.match(withLog, /Recently, in other conversations/);
  assert.match(withLog, /I built the hero\./);

  const withOthers = memoryPrompt(dir, [{ title: 'Colours', doing: 'trying the palette three ways' }]);
  assert.match(withOthers, /Other conversations are working on this same project/);
  assert.match(withOthers, /trying the palette three ways/);
});

test('a turn that says nothing is not recorded', () => {
  const dir = project();
  noteTurn(dir, 'Quiet', '```sb-options\n["A"]\n```');
  noteTurn(dir, 'Quiet', '   ');
  assert.deepEqual(memory(dir).entries, []);
});
