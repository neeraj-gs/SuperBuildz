/**
 * A sampled palette has to be readable before anybody is offered it.
 *
 * The case that produced this file is real: a site that opens near-black and
 * turns pale halfway down was read as a pale ground with pale text, and the
 * live preview went blank the moment "its colours" was pressed.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrast, legiblePalette, luminance, mix } from '../src/colour.ts';

const ok = (bg: string, fg: string, want = 4.5) => contrast(bg, fg) >= want;

test('contrast agrees with the numbers everyone quotes', () => {
  assert.equal(Math.round(contrast('#ffffff', '#000000')), 21);
  assert.equal(Math.round(contrast('#ffffff', '#ffffff')), 1);
  // The canonical middle grey against white, to two places.
  assert.ok(Math.abs(contrast('#ffffff', '#767676') - 4.54) < 0.05);
  assert.ok(luminance('#000000') === 0 && luminance('#ffffff') === 1);
});

test('a palette that already reads is returned untouched', () => {
  const good = { bg: '#0b0c0e', fg: '#efede8', accent: '#c8ff3d', muted: '#9aa6b7', surface: '#15171b' };
  assert.deepEqual(legiblePalette(good), good);
});

test('pale text on a pale ground is repaired', () => {
  // The otsuka case: mint ground, near-white text.
  const p = legiblePalette({ bg: '#e9f7ef', fg: '#f4fbf6', accent: '#00a84f', muted: '#dfeee5', surface: '#e9f7ef' })!;
  assert.ok(ok(p.bg, p.fg), `body text only reaches ${contrast(p.bg, p.fg).toFixed(2)}`);
  assert.ok(ok(p.bg, p.muted, 3), 'quiet text still has to be text');
  assert.ok(ok(p.bg, p.accent, 3), 'the accent is used as light, so it has to be visible');
  assert.notEqual(p.surface, p.bg, 'a panel identical to the page is not a panel');
  assert.equal(p.bg, '#e9f7ef', 'the ground it actually sampled survives');
});

test('the ground stands and the ink moves', () => {
  // A dark ground with an ink barely off it: the repair must darken nothing
  // and lighten the text, keeping the hue it sampled rather than reaching for
  // white.
  const p = legiblePalette({ bg: '#12231a', fg: '#1d3a28', accent: '#00a84f', muted: '#24402f', surface: '#12231a' })!;
  assert.equal(p.bg, '#12231a', 'the ground is most of the pixels and is not argued with');
  assert.ok(ok(p.bg, p.fg), `body text only reaches ${contrast(p.bg, p.fg).toFixed(2)}`);
  assert.notEqual(p.fg, '#ffffff', 'it should have travelled up its own axis, not jumped to white');
});

test('a mid grey on a mid grey falls back to black or white', () => {
  const p = legiblePalette({ bg: '#808080', fg: '#8a8a8a', accent: '#7f7f7f', muted: '#858585', surface: '#808080' })!;
  assert.ok(ok(p.bg, p.fg), `got ${contrast(p.bg, p.fg).toFixed(2)}`);
  assert.ok(p.fg === '#000000' || p.fg === '#ffffff');
});

test('anything that is not five hexes is nothing', () => {
  assert.equal(legiblePalette(undefined), undefined);
  assert.equal(legiblePalette({ bg: '#000000' }), undefined);
  assert.equal(legiblePalette({ bg: 'red', fg: '#fff', accent: '#c8ff3d', muted: '#999999', surface: '#111111' }), undefined);
  // Three-digit hex is not accepted: the spec's own rule is six digits.
  assert.equal(legiblePalette({ bg: '#000', fg: '#fff', accent: '#c8ff3d', muted: '#999999', surface: '#111111' }), undefined);
});

test('every palette in a spread of real-ish samples comes out readable', () => {
  const grounds = ['#0b0c0e', '#120c08', '#efe9dd', '#ffffff', '#1b2b1f', '#f5f5f7', '#2b2118', '#00a84f'];
  const inks = ['#ffffff', '#000000', '#8a8a8a', '#00a84f', '#e9f7ef', '#333333'];
  for (const bg of grounds) {
    for (const fg of inks) {
      const p = legiblePalette({ bg, fg, accent: '#00a84f', muted: '#909090', surface: bg })!;
      assert.ok(p, `${bg}/${fg} produced nothing`);
      assert.ok(ok(p.bg, p.fg), `${bg}/${fg} → ${contrast(p.bg, p.fg).toFixed(2)}`);
      assert.ok(ok(p.bg, p.muted, 3), `${bg}/${fg} muted → ${contrast(p.bg, p.muted).toFixed(2)}`);
      assert.ok(ok(p.bg, p.accent, 3), `${bg}/${fg} accent → ${contrast(p.bg, p.accent).toFixed(2)}`);
      assert.ok(contrast(p.bg, p.surface) >= 1.06, `${bg}/${fg} surface is the page`);
    }
  }
});

test('mixing is a straight line and hits both ends', () => {
  assert.equal(mix('#000000', '#ffffff', 0), '#000000');
  assert.equal(mix('#000000', '#ffffff', 1), '#ffffff');
  assert.equal(mix('#000000', '#ffffff', 0.5), '#808080');
});
