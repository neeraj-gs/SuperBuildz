/**
 * Which lane a conversation is in.
 *
 * The rule the board is built on is that no lane is ever set by hand — every
 * one is derived from something already true. So the whole of it is one pure
 * function, and this is the file that keeps it honest.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Session, Turn } from '@superbuilds/protocol';
import { RESTING_AFTER_MS, laneFor } from '../src/board.ts';

const NOW = 1_800_000_000_000;
const turn = (role: Turn['role'], at: number, error?: string): Turn => ({ id: `t${at}`, role, text: 'x', at, error });
const sess = (over: Partial<Session> = {}): Pick<Session, 'status' | 'turns' | 'updatedAt'> =>
  ({ status: 'idle', turns: [], updatedAt: NOW - 1000, ...over }) as Pick<Session, 'status' | 'turns' | 'updatedAt'>;

test('a turn in flight is running, whatever else is true of it', () => {
  assert.equal(laneFor(sess(), { busy: true, now: NOW }), 'running');
  // Even one that has failed before, or that is also somehow in the queue.
  assert.equal(laneFor(sess({ status: 'error' }), { busy: true, now: NOW }), 'running');
  assert.equal(laneFor(sess({ updatedAt: 0 }), { busy: true, now: NOW }), 'running');
});

test('waiting behind the ceiling is its own lane, not a failure', () => {
  assert.equal(laneFor(sess(), { busy: false, place: 1, now: NOW }), 'queued');
  assert.equal(laneFor(sess({ updatedAt: 0 }), { busy: false, place: 3, now: NOW }), 'queued');
});

test('a failure asks for a person even when it is old', () => {
  assert.equal(laneFor(sess({ status: 'error', updatedAt: 0 }), { busy: false, now: NOW }), 'you');
  assert.equal(laneFor(sess({ turns: [turn('assistant', 0, 'it broke')], updatedAt: 0 }), { busy: false, now: NOW }), 'you');
});

test('Claude spoke last and stopped, so the move is yours', () => {
  assert.equal(laneFor(sess({ turns: [turn('user', NOW - 2000), turn('assistant', NOW - 1000)] }), { busy: false, now: NOW }), 'you');
});

test('a conversation nobody opened yet is waiting for you, not resting', () => {
  assert.equal(laneFor(sess({ turns: [] }), { busy: false, now: NOW }), 'you');
});

test('a day untouched files it under earlier', () => {
  const old = NOW - RESTING_AFTER_MS - 1;
  assert.equal(laneFor(sess({ turns: [turn('assistant', old)], updatedAt: old }), { busy: false, now: NOW }), 'resting');
  // And an empty one that was never used either.
  assert.equal(laneFor(sess({ turns: [], updatedAt: old }), { busy: false, now: NOW }), 'resting');
  // The boundary itself is the past, not the present.
  const edge = NOW - RESTING_AFTER_MS;
  assert.equal(laneFor(sess({ turns: [turn('assistant', edge)], updatedAt: edge }), { busy: false, now: NOW }), 'resting');
  assert.equal(laneFor(sess({ turns: [turn('assistant', edge + 1)], updatedAt: edge + 1 }), { busy: false, now: NOW }), 'you');
});

test('every lane is reachable and nothing falls through', () => {
  const seen = new Set([
    laneFor(sess(), { busy: true, now: NOW }),
    laneFor(sess(), { busy: false, place: 1, now: NOW }),
    laneFor(sess({ turns: [turn('assistant', NOW - 5)] }), { busy: false, now: NOW }),
    laneFor(sess({ updatedAt: 0 }), { busy: false, now: NOW }),
  ]);
  assert.deepEqual([...seen].sort(), ['queued', 'resting', 'running', 'you']);
});
