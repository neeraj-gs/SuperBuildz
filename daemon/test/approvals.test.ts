/**
 * A question that is held open, and the four ways it ends.
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { askFor, settleApproval, pendingFor, granted, grant, revoke, grantsFor, dropSession, resetApprovals } from '../src/approvals.ts';

const draft = (sessionId = 's1') => ({
  sessionId,
  projectId: 'p1',
  tool: 'Bash',
  ruleId: 'outside-project',
  what: 'Create or change a file outside this project',
  scope: 'writing anywhere on this machine, for the rest of this conversation',
  detail: 'echo hi > C:/tmp/note.txt',
});

beforeEach(() => resetApprovals());

test('a question is pending until it is answered', async () => {
  let id = '';
  const answer = askFor(draft(), (a) => { id = a.id; }, 5_000);
  assert.equal(pendingFor('s1').length, 1);
  assert.equal(pendingFor('s2').length, 0);

  settleApproval(id, 'once');
  assert.equal(await answer, 'once');
  assert.equal(pendingFor('s1').length, 0, 'answering takes it off the table');
});

test('yes for the conversation is remembered; yes once is not', async () => {
  let id = '';
  const a1 = askFor(draft(), (a) => { id = a.id; }, 5_000);
  settleApproval(id, 'once');
  await a1;
  assert.equal(granted('s1', 'outside-project'), false);

  const a2 = askFor(draft(), (a) => { id = a.id; }, 5_000);
  settleApproval(id, 'session');
  await a2;
  assert.equal(granted('s1', 'outside-project'), true);
  // And only for that conversation.
  assert.equal(granted('s2', 'outside-project'), false);
});

test('nobody answering is a no', async () => {
  const decision = await askFor(draft(), () => {}, 30);
  assert.equal(decision, 'no');
  assert.equal(pendingFor('s1').length, 0);
});

test('answering twice is not an error, and does not change the answer', async () => {
  let id = '';
  const answer = askFor(draft(), (a) => { id = a.id; }, 5_000);
  assert.ok(settleApproval(id, 'no'));
  assert.equal(settleApproval(id, 'session'), undefined, 'the second answer finds nothing to answer');
  assert.equal(await answer, 'no');
  assert.equal(granted('s1', 'outside-project'), false);
});

test('closing a conversation refuses what it left open and forgets what it was allowed', async () => {
  grant('s1', 'power');
  const answer = askFor(draft(), () => {}, 5_000);
  const dropped = dropSession('s1');

  assert.equal(dropped.length, 1);
  assert.equal(await answer, 'no');
  assert.deepEqual(grantsFor('s1'), []);
});

test('a grant can be given and taken back without a question being asked', () => {
  assert.deepEqual(grant('s3', 'registry'), ['registry']);
  assert.equal(granted('s3', 'registry'), true);
  assert.deepEqual(revoke('s3', 'registry'), []);
  assert.equal(granted('s3', 'registry'), false);
});
