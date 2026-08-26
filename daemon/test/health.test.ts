/**
 * Turning what a browser said into what a person can do.
 *
 * The judgement is here rather than in the component because it is the part
 * that has to stay honest: every new cause added to `explain` is a new chance
 * to claim confidently that a site is broken for a reason it is not. The
 * fallback matters as much as the clever cases — "here is what the browser
 * said" is a fine answer, and "the key is missing" when it is not is worse
 * than useless.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explain, missingVariable } from '../src/health.ts';

test('a page that drew something is fine, whatever it logged on the way', () => {
  const h = explain({ status: 200, textLength: 2400, errors: ['Failed to load resource: favicon.ico 404'] });
  assert.equal(h.state, 'ok');
  assert.equal(h.reason, undefined);
  // The noise is kept, in case somebody wants it. It is not a verdict.
  assert.equal(h.errors?.length, 1);
});

test('the Clerk case, which is what produced this file', () => {
  const h = explain({
    status: 200,
    textLength: 0,
    errors: ['@clerk/clerk-react: Missing publishableKey. You can get your key at https://dashboard.clerk.com. (NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)'],
  });
  assert.equal(h.state, 'empty');
  assert.equal(h.missingEnv, 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
  assert.match(h.reason ?? '', /\.env\.local/);
});

test('any missing variable is named, not just the ones we knew about', () => {
  const h = explain({ status: 200, textLength: 0, errors: ['Error: NEXT_PUBLIC_SUPABASE_URL is not defined'] });
  assert.equal(h.state, 'empty');
  assert.equal(h.missingEnv, 'NEXT_PUBLIC_SUPABASE_URL');
});

test('a missing package names the package', () => {
  const h = explain({ status: 200, textLength: 0, errors: ["Module not found: Can't resolve 'framer-motion'"] });
  assert.match(h.reason ?? '', /framer-motion/);
  assert.match(h.reason ?? '', /npm install/);
  assert.equal(h.missingEnv, undefined, 'a package is not an environment variable');
});

test('a 500 is the dev server failing, not the page rendering', () => {
  const h = explain({ status: 500, textLength: 0, errors: ["Module not found: Can't resolve './design.config'"] });
  assert.equal(h.state, 'error');
  assert.match(h.reason ?? '', /design\.config/);
});

test('a 404 at the root says what it means', () => {
  const h = explain({ status: 404, textLength: 0, errors: [] });
  assert.equal(h.state, 'error');
  assert.match(h.reason ?? '', /no page at the root/);
});

test('blank with nothing logged does not invent a cause', () => {
  const h = explain({ status: 200, textLength: 0, errors: [] });
  assert.equal(h.state, 'empty');
  assert.equal(h.missingEnv, undefined);
  assert.match(h.reason ?? '', /still being written/);
});

test('blank with an error we do not recognise quotes it rather than guessing', () => {
  const h = explain({ status: 200, textLength: 0, errors: ['TypeError: Cannot read properties of null (reading map)'] });
  assert.equal(h.state, 'empty');
  assert.equal(h.missingEnv, undefined);
  assert.match(h.reason ?? '', /Cannot read properties of null/);
});

test('the variable picked out of a message is the configuration one', () => {
  // "Error" and "TypeError" are capitalised too; neither is what to put in a file.
  assert.equal(missingVariable('Error: NEXT_PUBLIC_API_URL must be set'), 'NEXT_PUBLIC_API_URL');
  assert.equal(missingVariable('Invalid DATABASE_URL supplied to createClient'), 'DATABASE_URL');
  assert.equal(missingVariable('nothing shouty here'), undefined);
});
