/**
 * Lifting the one sentence that needed a person out of forty minutes of prose.
 *
 * The parsing is forgiving on purpose and the tests say how far: a model that
 * writes one object instead of an array, or leaves a trailing comma, still
 * meant a notice, and dropping it silently loses exactly the thing this exists
 * to keep. What it is *not* forgiving about is a notice with no title, and a
 * "key" notice that names no key — both of which would put an empty card on a
 * shelf whose whole value is that a card there means something.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitNotices, NOTICE_INSTRUCTIONS } from '../src/notices.ts';
import { splitOptions } from '@superbuilds/protocol';

const fence = (body: string) => '```sb-notice\n' + body + '\n```';

test('an ordinary reply has no notices and is not touched', () => {
  const text = 'I made the hero type larger and tightened the spacing under it.';
  const out = splitNotices(text);
  assert.deepEqual(out.notices, []);
  assert.equal(out.text, text);
});

test('a key notice comes out and the fence does not stay in the prose', () => {
  const raw = [
    'The booking form is in and it emails you when somebody submits it.',
    fence('{"kind":"key","title":"Booking emails need a Resend key","body":"Nothing is sent until it has one.","keys":["RESEND_API_KEY"]}'),
  ].join('\n\n');

  const { text, notices } = splitNotices(raw);
  assert.equal(notices.length, 1);
  assert.equal(notices[0].kind, 'key');
  assert.deepEqual(notices[0].keys, ['RESEND_API_KEY']);
  assert.ok(notices[0].id, 'it can be answered, so it has an id');
  assert.doesNotMatch(text, /sb-notice|RESEND/);
  assert.equal(text, 'The booking form is in and it emails you when somebody submits it.');
});

test('the real case: a decision with the alternatives it offered', () => {
  const raw = fence(JSON.stringify({
    kind: 'decision',
    title: 'The two admin pages are behind the login, not public',
    body: 'They read patient names, emails and phone numbers. The brief listed them as public URLs; publishing them would have exposed patient records.',
    choices: ['Keep them behind the login', 'Make them public anyway'],
  }));
  const { notices } = splitNotices(raw);
  assert.equal(notices[0].kind, 'decision');
  assert.equal(notices[0].choices?.length, 2);
});

test('notices come out before the options block, and both survive', () => {
  const raw = [
    'Done.',
    fence('{"kind":"note","title":"Five rubric lines are still under 4"}'),
    '```sb-options\n["Fix the rest", "Show me the phone"]\n```',
  ].join('\n\n');

  const first = splitNotices(raw);
  assert.equal(first.notices.length, 1);
  const second = splitOptions(first.text);
  assert.deepEqual(second.options, ['Fix the rest', 'Show me the phone']);
  assert.equal(second.text, 'Done.');
});

test('a trailing comma is still a notice', () => {
  const { notices } = splitNotices(fence('{"kind":"blocked","title":"I need the domain name",}'));
  assert.equal(notices.length, 1);
  assert.equal(notices[0].kind, 'blocked');
});

test('a bare object rather than an array is still a notice', () => {
  const { notices } = splitNotices(fence('{"kind":"note","title":"The old logo file is unused now"}'));
  assert.equal(notices.length, 1);
});

test('a key notice that names no key is a note, not an empty form', () => {
  const { notices } = splitNotices(fence('{"kind":"key","title":"It needs a key"}'));
  assert.equal(notices[0].kind, 'note');
});

test('a value where a name should be is refused, and takes the card with it', () => {
  // If a model ever puts the secret in `keys`, it must not reach the store.
  const { notices } = splitNotices(fence('{"kind":"key","title":"Stripe","keys":["sk_live_51H8xYzABCDEF"]}'));
  assert.equal(notices[0].kind, 'note', 'nothing that is not a variable name survives');
  assert.equal(notices[0].keys, undefined);
});

test('a notice with no title is not a notice', () => {
  assert.deepEqual(splitNotices(fence('{"kind":"note","body":"something"}')).notices, []);
  assert.deepEqual(splitNotices(fence('nonsense that is not json')).notices, []);
});

test('an unknown kind falls back to the quietest one', () => {
  assert.equal(splitNotices(fence('{"kind":"catastrophe","title":"Something"}')).notices[0].kind, 'note');
});

test('four is the most a single reply can pin', () => {
  const many = Array.from({ length: 9 }, (_, i) => ({ kind: 'note', title: `Thing ${i}` }));
  assert.equal(splitNotices(fence(JSON.stringify(many))).notices.length, 4);
});

test('the instructions tell Claude to be sparing, and how', () => {
  assert.match(NOTICE_INSTRUCTIONS, /sb-notice/);
  assert.match(NOTICE_INSTRUCTIONS, /Most turns must not have one/);
  assert.match(NOTICE_INSTRUCTIONS, /never a value/);
});
