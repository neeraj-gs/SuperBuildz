/**
 * The chart ramp has to work for an accent nobody has chosen yet.
 *
 * Every palette in the catalogue, plus a spread of arbitrary hues at arbitrary
 * lightnesses, against both a dark and a light surface. The two checks are the
 * ones the data-visualisation rules make computable: adjacent steps far enough
 * apart in OKLab lightness to read as different, and the faintest step still
 * distinguishable from the surface it sits on.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chartRamp, contrast, lightnessOf, rgbToOklab } from '../../templates/site/lib/ramp.ts';
import { PALETTES } from '../src/catalogue/index.ts';

const MIN_DL = 0.06;
const MIN_CONTRAST = 2.0;

function check(accent: string, surface: string, ink: string, label: string) {
  const ramp = chartRamp(accent, surface, ink);
  assert.ok(ramp.steps.length >= 4 && ramp.steps.length <= 5, `${label}: ${ramp.steps.length} steps`);
  for (const s of ramp.steps) assert.match(s, /^#[0-9a-f]{6}$/, `${label}: ${s} is a hex colour`);

  const ls = ramp.steps.map(lightnessOf);
  for (let i = 1; i < ls.length; i++) {
    const dl = Math.abs(ls[i] - ls[i - 1]);
    assert.ok(dl >= MIN_DL - 0.001, `${label}: steps ${i} and ${i + 1} are only ${dl.toFixed(3)} apart in lightness`);
  }

  // Monotone: a ramp that turns round mid-way stops meaning "more".
  const rising = ls[1] > ls[0];
  for (let i = 1; i < ls.length; i++) {
    assert.equal(ls[i] > ls[i - 1], rising, `${label}: the ramp changes direction at step ${i + 1}`);
  }

  const faintest = contrast(ramp.steps[ramp.steps.length - 1], surface);
  assert.ok(faintest >= MIN_CONTRAST, `${label}: the faintest step is only ${faintest.toFixed(2)}:1 against the surface`);

  // Status must be legible, and "bad" must not quietly become the brand colour.
  for (const [name, c] of [['warn', ramp.warn], ['bad', ramp.bad]] as const) {
    assert.ok(contrast(c, surface) >= 2.8, `${label}: ${name} is only ${contrast(c, surface).toFixed(2)}:1 against the surface`);
  }
}

test('the ramp works for every palette in the catalogue', () => {
  for (const p of PALETTES) {
    const [bg, fg, accent, , surface] = p.swatch ?? [];
    assert.ok(accent, `${p.id} has an accent`);
    check(accent, surface ?? bg, fg, p.id);
  }
});

test('the ramp works for an accent nobody has chosen yet', () => {
  // Twelve hues around the wheel at three lightnesses, on a near-black and a
  // near-white surface: the two grounds and the whole range in between.
  const hues = ['#ff0000', '#ff8000', '#ffff00', '#80ff00', '#00ff00', '#00ff80', '#00ffff', '#0080ff', '#0000ff', '#8000ff', '#ff00ff', '#ff0080'];
  const shades = ['', '80', 'c0'];
  for (const hue of hues) {
    for (const shade of shades) {
      // Darken by mixing towards black in hex, crudely but deterministically.
      const accent = shade ? mixHex(hue, '#000000', 0.6) : hue;
      check(accent, '#15171B', '#EDE9E0', `${accent} on charcoal`);
      check(accent, '#F0ECE3', '#16150F', `${accent} on bone`);
    }
  }
});

test('an accent that is almost exactly the surface still produces a ramp', () => {
  // The nastiest case: nowhere obvious to go, because the accent and the ground
  // are the same lightness. It has to take the long way round rather than
  // return five colours nobody can tell apart.
  check('#7a7a7a', '#787878', '#000000', 'grey on grey');
  check('#151719', '#15171B', '#EDE9E0', 'near-black on near-black');
  check('#F1EDE4', '#F0ECE3', '#16150F', 'near-white on near-white');
});

test('the grid is a hairline off the surface, not a line in its own right', () => {
  const ramp = chartRamp('#C8FF3D', '#15171B', '#EDE9E0');
  const c = contrast(ramp.grid, '#15171B');
  assert.ok(c > 1.05 && c < 2, `the grid is ${c.toFixed(2)}:1 — it should be visible and recessive`);
});

function mixHex(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v * t + y[i] * (1 - t)).toString(16).padStart(2, '0')).join('');
}

test('the ramp leads with the accent where there is room, and stays its hue where there is not', () => {
  // A dark ground and a light accent: plenty of lightness between them, so the
  // brightest colour on the dashboard is the exact colour somebody chose.
  for (const [accent, surface, ink] of [
    ['#FF7A3D', '#221A15', '#F6EEE3'],
    ['#C8FF3D', '#15171B', '#EDE9E0'],
    ['#B7F46C', '#13261C', '#F2EFE4'],
  ]) {
    assert.equal(chartRamp(accent, surface, ink).steps[0], accent.toLowerCase(), `${accent} should lead its own ramp`);
  }

  /*
    And where there is not room, the ramp still belongs to the same hue.

    A saturated blue on near-black is the honest hard case: blue contributes
    little luminance, so it has to be light to be legible, and there is not
    enough lightness between a mid blue and a near-black surface for four
    distinguishable steps. The ramp starts lighter rather than produce four
    shades nobody can tell apart, and `--chart-accent` still carries the exact
    accent for every single-series mark.
  */
  for (const [accent, surface, ink] of [
    ['#3B6CFF', '#111216', '#FFFFFF'],
    ['#D9442B', '#F0ECE3', '#16150F'],
    ['#1FA89E', '#F2F6F9', '#0F1A2B'],
  ]) {
    const first = chartRamp(accent, surface, ink).steps[0];
    assert.ok(Math.abs(hueOf(first) - hueOf(accent)) < 0.25, `${accent} drifted to ${first}`);
  }
});

/** The hue angle in OKLab, in radians. Lightness and chroma are free to move. */
function hueOf(hex: string): number {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
  const [, a, b] = rgbToOklab(p(hex));
  return Math.atan2(b, a);
}
