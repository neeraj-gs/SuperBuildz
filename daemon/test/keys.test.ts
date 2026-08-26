/**
 * Which keys a project is actually waiting for.
 *
 * The distinction under test is *needed* against *available*. `.env.example`
 * lists a dozen things a site could use; asking for all of them would make the
 * card meaningless within one build, which is the failure this whole feature is
 * meant to fix rather than reproduce. So a commented line in the example is the
 * menu, an uncommented one is the bill, and a commented empty line in
 * `.env.local` is Claude saying "I built this and it is waiting for you".
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { keysNeeded, describeKey, fillKeys } from '../src/keys.ts';

function project(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'sb-keys-'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

const EXAMPLE = [
  'SITE_NAME="Your Site"',
  'SESSION_SECRET=change-me',
  'ADMIN_EMAIL=owner@localhost',
  'ADMIN_PASSWORD_HASH=scrypt:...',
  '# DATABASE_URL=postgres://...',
  '# RESEND_API_KEY=',
].join('\n');

test('what Super Builds writes itself is never asked for', () => {
  const dir = project({ '.env.example': EXAMPLE, '.env.local': '' });
  const names = keysNeeded(dir).map((k) => k.name);
  for (const own of ['SITE_NAME', 'SESSION_SECRET', 'ADMIN_EMAIL', 'ADMIN_PASSWORD_HASH', 'ADMIN_DEV_PASSWORD']) {
    assert.ok(!names.includes(own), `${own} should not be asked for`);
  }
});

test('a commented line in the example is a menu, not a bill', () => {
  const dir = project({ '.env.example': EXAMPLE, '.env.local': '' });
  const names = keysNeeded(dir).map((k) => k.name);
  assert.ok(!names.includes('DATABASE_URL'));
  assert.ok(!names.includes('RESEND_API_KEY'));
});

test('a commented empty line in .env.local is Claude waiting for you', () => {
  const dir = project({ '.env.local': '# STRIPE_SECRET_KEY=\n# A note about something else\nSITE_NAME="x"\n' });
  const needed = keysNeeded(dir);
  assert.equal(needed.length, 1);
  assert.equal(needed[0].name, 'STRIPE_SECRET_KEY');
  assert.equal(needed[0].from, 'placeholder');
  assert.equal(needed[0].service, 'Stripe');
  assert.equal(needed[0].secret, true);
});

test('a commented line that already has a value is a note somebody left', () => {
  const dir = project({ '.env.local': '# DATABASE_URL=postgres://example\n' });
  assert.deepEqual(keysNeeded(dir), []);
});

test('what is already filled in is not asked for again', () => {
  const dir = project({ '.env.local': '# STRIPE_SECRET_KEY=\nSTRIPE_SECRET_KEY=sk_live_x\n' });
  assert.deepEqual(keysNeeded(dir).map((k) => k.name), []);
});

test('an empty value is the same as no value', () => {
  const dir = project({ '.env.local': 'RESEND_API_KEY=\n# RESEND_API_KEY=\n' });
  assert.deepEqual(keysNeeded(dir).map((k) => k.name), ['RESEND_API_KEY']);
});

test('the preview naming a variable puts it first, urgently, with a reason', () => {
  const dir = project({ '.env.local': '# STRIPE_SECRET_KEY=\n' });
  const needed = keysNeeded(dir, { at: Date.now(), state: 'empty', missingEnv: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY' });
  assert.equal(needed[0].name, 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
  assert.equal(needed[0].from, 'preview');
  assert.equal(needed[0].urgent, true);
  assert.match(needed[0].why ?? '', /blank right now/);
  assert.equal(needed[1].name, 'STRIPE_SECRET_KEY', 'and the rest still follow');
});

test('a recognised key says whose it is and where to get it', () => {
  const clerk = describeKey('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
  assert.equal(clerk.service, 'Clerk');
  assert.match(clerk.keysUrl ?? '', /^https:\/\/dashboard\.clerk\.com/);
  assert.equal(clerk.secret, false, 'NEXT_PUBLIC_ ships to the browser');

  const stripe = describeKey('STRIPE_SECRET_KEY');
  assert.equal(stripe.service, 'Stripe');
  assert.equal(stripe.secret, true);
});

test('analytics keys come from the catalogue that already had them', () => {
  const posthog = describeKey('NEXT_PUBLIC_POSTHOG_KEY');
  assert.match(posthog.label, /PostHog/);
  assert.equal(posthog.placeholder, 'phc_…');
  assert.ok(posthog.keysUrl, 'the dashboard link is not written twice');
});

test('an unrecognised key is still askable, just without a link', () => {
  const k = describeKey('WIDGETCO_API_TOKEN');
  assert.equal(k.name, 'WIDGETCO_API_TOKEN');
  assert.equal(k.keysUrl, undefined);
  assert.equal(k.secret, true);
  assert.ok(k.what.length > 10, 'it still says something');
});

test('filling a key writes it and leaves everything else alone', () => {
  const dir = project({ '.env.local': 'SITE_NAME="Ember"\n# RESEND_API_KEY=\n' });
  assert.deepEqual(fillKeys(dir, { RESEND_API_KEY: 're_abc123' }), ['RESEND_API_KEY']);
  const after = readFileSync(join(dir, '.env.local'), 'utf8');
  assert.match(after, /RESEND_API_KEY=re_abc123/);
  assert.match(after, /SITE_NAME="Ember"/);
  assert.deepEqual(keysNeeded(dir), []);
});

test('a newline in a value cannot start a second declaration', () => {
  const dir = project({ '.env.local': '' });
  fillKeys(dir, { SOME_TOKEN: 'abc\nADMIN_PASSWORD_HASH=owned' });
  const after = readFileSync(join(dir, '.env.local'), 'utf8');
  assert.doesNotMatch(after, /^ADMIN_PASSWORD_HASH/m);
});

test('the keys Super Builds owns cannot be set through this route', () => {
  const dir = project({ '.env.local': '' });
  assert.throws(() => fillKeys(dir, { SESSION_SECRET: 'x' }), /Super Builds itself/);
  assert.throws(() => fillKeys(dir, { ADMIN_PASSWORD_HASH: 'x' }), /Super Builds itself/);
});

test('a name that is not a variable name is refused', () => {
  const dir = project({ '.env.local': '' });
  assert.throws(() => fillKeys(dir, { 'rm -rf': 'x' }), /shape/);
  assert.throws(() => fillKeys(dir, { lowercase: 'x' }), /shape/);
});

test('a blank answer is skipped rather than written as empty', () => {
  const dir = project({ '.env.local': '' });
  assert.deepEqual(fillKeys(dir, { OPTIONAL_ONE: '   ', REAL_ONE: 'v' }), ['REAL_ONE']);
});
