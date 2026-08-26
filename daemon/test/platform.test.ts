/**
 * Guessing which of the three the visitor is on.
 *
 * It only decides which card is highlighted, so a wrong guess is cheap — but
 * only because all three stay pressable. The case worth testing is the one
 * where the honest answer is "none of them": a program that runs a build on
 * your own machine has nothing to offer a phone, and telling somebody on an
 * iPhone that their platform is macOS would be a lie with a download button
 * under it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guessPlatform, PLATFORMS } from '../../ui/src/features/landing/platform.ts';

const UA = {
  win11: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  ubuntu: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
  chromeOS: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
};

test('the three desktops it can actually offer a build for', () => {
  assert.equal(guessPlatform(UA.win11, 'Windows'), 'windows');
  assert.equal(guessPlatform(UA.macSafari, 'macOS'), 'mac');
  assert.equal(guessPlatform(UA.ubuntu, 'Linux'), 'linux');
});

test('it works with no platform hint at all, which is most browsers now', () => {
  assert.equal(guessPlatform(UA.win11), 'windows');
  assert.equal(guessPlatform(UA.macSafari), 'mac');
  assert.equal(guessPlatform(UA.ubuntu), 'linux');
});

test('ChromeOS reads as Linux rather than as nothing', () => {
  assert.equal(guessPlatform(UA.chromeOS), 'linux');
});

test('a phone is none of them, not the nearest one', () => {
  // An Android user agent says "Linux" in it, which is the trap.
  assert.equal(guessPlatform(UA.android), undefined);
  // And an iPhone says "like Mac OS X".
  assert.equal(guessPlatform(UA.iphone), undefined);
});

test('an unrecognisable browser is a fine answer', () => {
  assert.equal(guessPlatform('curl/8.4.0'), undefined);
  assert.equal(guessPlatform(''), undefined);
});

test('every platform the row draws says what actually arrives', () => {
  assert.equal(PLATFORMS.length, 3);
  for (const p of PLATFORMS) {
    assert.ok(p.name, `${p.id} has a name`);
    // "Windows" is not a download; ".exe installer" is. The row promises a file.
    assert.match(p.formats, /\.(exe|dmg|deb)|AppImage/, `${p.id} names a real file`);
  }
});
