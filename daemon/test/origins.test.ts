/**
 * Who the daemon answers.
 *
 * The case that produced this file is real and cost an evening: the interface
 * moved to port 5181 because another project already had 5180, and the daemon's
 * allowlist named 5180 by hand. Every write became "Internal Server Error", the
 * socket was refused so the header read "daemon offline", and the project list
 * still loaded — because a browser sends no Origin on a same-origin GET. Three
 * symptoms, one literal.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hostAllowed, isLoopbackHostname, needsToken, originAllowed } from '../src/origins.ts';

test('the interface is allowed wherever it ended up', () => {
  for (const port of [5180, 5181, 5199, 7747, 3000, 1, 65535]) {
    assert.ok(originAllowed(`http://127.0.0.1:${port}`), `127.0.0.1:${port}`);
    assert.ok(originAllowed(`http://localhost:${port}`), `localhost:${port}`);
  }
  assert.ok(originAllowed('http://127.0.0.1'), 'no port at all');
  assert.ok(originAllowed('http://[::1]:5180'), 'IPv6 loopback');
  assert.ok(originAllowed('http://127.0.0.2:5180'), 'all of 127.0.0.0/8 is loopback');
});

test('the internet is not', () => {
  for (const origin of [
    'http://example.com',
    'https://evil.example:5180',
    // The shapes that are meant to read as loopback and are not.
    'http://127.0.0.1.evil.com',
    'http://localhost.evil.com',
    'http://evil.com/127.0.0.1',
    'http://0.0.0.0:5180',
    'http://192.168.1.4:5180',
    'http://10.0.0.1',
    'http://[::ffff:127.0.0.1]',
    'file://',
    'null',
    'not a url',
    'http://127.0.0.1:5180@evil.com',
  ]) {
    assert.equal(originAllowed(origin), false, `${origin} was allowed`);
  }
});

test('no origin at all is allowed, because that is not a browser acting for a page', () => {
  assert.ok(originAllowed(undefined));
  assert.ok(originAllowed(''));
});

test('a rebound name is refused by its Host', () => {
  // The attack the loose origin rule would otherwise open: a page on the
  // internet points a name it owns at 127.0.0.1, so the browser thinks it is
  // same-origin and sends no Origin at all. What it cannot change is the name
  // it asked for.
  assert.equal(hostAllowed('evil.example:7747'), false);
  assert.equal(hostAllowed('rebind.attacker.io'), false);
  assert.ok(hostAllowed('127.0.0.1:7747'));
  assert.ok(hostAllowed('localhost:7747'));
  assert.ok(hostAllowed('[::1]:7747'));
  assert.ok(hostAllowed(undefined), 'a script with no Host is not what this check is about');
});

test('octets that are not octets are not loopback', () => {
  assert.equal(isLoopbackHostname('127.0.0.999'), false);
  assert.equal(isLoopbackHostname('127.0.0'), false);
  assert.equal(isLoopbackHostname('1270.0.0.1'), false);
  assert.ok(isLoopbackHostname('127.255.255.254'));
});

test('the token guards the person’s own work, on reads as well as writes', () => {
  // Their projects, the files inside them, and every transcript.
  assert.ok(needsToken('GET', '/api/projects'));
  assert.ok(needsToken('GET', '/api/projects/abc/file?path=.env.local'));
  assert.ok(needsToken('GET', '/api/projects/abc/sessions'));
  assert.ok(needsToken('GET', '/api/sessions'));
  assert.ok(needsToken('GET', '/api/sessions/xyz'));
  assert.ok(needsToken('GET', '/api/capacity'));
  // Anything that changes anything, whatever it is.
  assert.ok(needsToken('POST', '/api/install'));
  assert.ok(needsToken('DELETE', '/api/projects/abc'));
  assert.ok(needsToken('PATCH', '/api/sessions/xyz'));
});

test('what the interface reads before it has a token stays open', () => {
  // It cannot have one yet: the socket delivers it, and these are what the
  // first paint needs. None of them is anybody's.
  for (const path of ['/api/health', '/api/detect', '/api/catalogue', '/api/changes', '/api/models', '/api/install/plan', '/api/spec/defaults?archetype=cafe']) {
    assert.equal(needsToken('GET', path), false, path);
  }
  assert.equal(needsToken('OPTIONS', '/api/projects'), false, 'a preflight carries no headers to check');
  assert.equal(needsToken('GET', '/captures/abc/1.png'), false, 'static is not the API');
});
