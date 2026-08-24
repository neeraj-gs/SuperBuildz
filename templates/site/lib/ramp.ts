/**
 * The colour ramp the CRM's charts are drawn with.
 *
 * Computed here, at render time, rather than baked into design.config.ts — the
 * palette switches between themes and can be dragged in the tune panel, and a
 * ramp written down at scaffold time goes stale the moment somebody moves the
 * accent slider. It is arithmetic over five hex strings, so recomputing it on
 * every render costs nothing worth measuring.
 *
 * ── Why a generated site needs this computed, not written down ──────────────
 *
 * Every dashboard palette you can look up is a fixed list of eight hues chosen
 * once, checked once, and shipped. This dashboard cannot have one: it belongs to
 * the site it was built for, whose accent is whatever somebody picked — or
 * mixed — an hour ago, on a ground that might be near-black or near-white. A
 * ramp that is right for lime on charcoal is a mush on vermilion over bone.
 *
 * So the ramp is solved rather than chosen. Given the accent and the surface it
 * will be drawn on, this walks lightness in OKLab — the space where equal steps
 * look equal — from the accent to the faintest step that still clears contrast,
 * in the direction that has room. On a dark ground that is downwards toward the
 * ground; on a light ground with a mid-lightness accent there is more room
 * downwards too, and taking the short way up is exactly how the mush happens.
 *
 * ── What the checks are, and why these ones ────────────────────────────────
 *
 * Two, both from the data-visualisation rules this project follows:
 *
 *   - adjacent steps at least 0.06 apart in OKLab L, or neighbouring bands of a
 *     heatmap read as one band;
 *   - the faintest step at least 2:1 against the surface, or the smallest
 *     non-zero value is indistinguishable from no value at all.
 *
 * `daemon/test/charts.test.ts` runs both against every palette in the catalogue
 * and against a spread of arbitrary accents, because "it looked fine on the one
 * I tried" is how the previous version of this was wrong.
 *
 * ── One hue, deliberately ───────────────────────────────────────────────────
 *
 * There is no categorical palette here and there should not be. A single-accent
 * design system has one hue to spend, so every scale in the CRM is sequential or
 * ordinal, magnitude is carried by lightness, and identity is carried by a
 * label — never by colour alone. Where a chart genuinely needs to tell things
 * apart rather than rank them, it gets a legend and direct labels.
 */

export interface ChartRamp {
  /**
   * Four or five steps, strongest first.
   *
   * Step one is the accent itself wherever the accent is legible on its own
   * surface, and a shade of it where it is not. How many steps there are
   * depends on how much lightness room the ground leaves; see `chartRamp`.
   */
  steps: string[];
  /** Hairline grid and axis: one step off the surface, never dashed. */
  grid: string;
  /** Status, which is never a series colour. Always shipped with a word. */
  good: string;
  warn: string;
  bad: string;
}

/**
 * Five steps where the ground will carry five, four where it will not.
 *
 * A mid-grey page is hostile to any chart: there is lightness room on neither
 * side, and forcing a fifth step out of it produces two nobody can tell apart.
 * Fewer steps is the honest answer, and four is enough for every scale here.
 */
const MAX_STEPS = 5;
const MIN_STEPS = 4;
const MIN_DL = 0.06;       // OKLab L between adjacent steps, the requirement
/*
  What is asked for, which is more than what is required.

  Fitting a step back into the sRGB gamut and then rounding it to eight bits per
  channel moves its lightness a little, so a ramp planned at exactly 0.06 lands
  at 0.058 and fails its own check. Asking for a quarter more absorbs the
  rounding and costs nothing anybody can see.
*/
const STEP_TARGET = MIN_DL * 1.25;
const MIN_CONTRAST = 2.2;  // faintest step against the surface, with headroom over the 2.0 floor

/* ---------------------------------------------------------------------------
   sRGB <-> OKLab. Bjorn Ottosson's transform, unmodified.
--------------------------------------------------------------------------- */

type RGB = [number, number, number];
type Lab = [number, number, number];

function parseHex(hex: string): RGB {
  const h = hex.trim().replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as RGB;
}

function toHex(rgb: RGB): string {
  return '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

export function rgbToOklab([r, g, b]: RGB): Lab {
  const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

export function oklabToRgb([L, a, b]: Lab): RGB {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [
    toGamma(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
  ];
}

/** WCAG relative luminance, from sRGB. */
function luminance(rgb: RGB): number {
  const [r, g, b] = rgb.map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(parseHex(a)), luminance(parseHex(b))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

export function lightnessOf(hex: string): number {
  return rgbToOklab(parseHex(hex))[0];
}

/**
 * Nudge a colour out of the sRGB gamut back into it without losing its hue.
 *
 * Walking lightness while holding chroma constant leaves the gamut for
 * saturated accents, and the naive fix — clipping each channel — shifts hue
 * visibly. Halving chroma until it fits keeps the hue and only loses the
 * saturation that could not be shown anyway.
 */
function fit(L: number, a: number, b: number): string {
  let scale = 1;
  for (let i = 0; i < 24; i++) {
    const rgb = oklabToRgb([L, a * scale, b * scale]);
    if (rgb.every((v) => v >= -0.001 && v <= 1.001)) return toHex(rgb);
    scale *= 0.9;
  }
  return toHex(oklabToRgb([L, 0, 0]));
}

/**
 * The lightness closest to the surface at which this hue still clears
 * `MIN_CONTRAST` against it.
 *
 * Binary search rather than algebra: contrast is defined on WCAG luminance and
 * the walk happens in OKLab lightness, there is no closed form across the two,
 * and twenty iterations is exact to four decimal places. `away` is +1 when
 * legibility lies above the surface and -1 when it lies below.
 */
function faintestLegible(a: number, b: number, surface: string, away: 1 | -1, target = MIN_CONTRAST): number {
  const sL = lightnessOf(surface);
  let near = sL;                       // touching the surface: no contrast at all
  let far = away > 0 ? 1 : 0;          // as far as lightness goes: maximum contrast
  for (let i = 0; i < 20; i++) {
    const mid = (near + far) / 2;
    if (contrast(fit(mid, a, b), surface) >= target) far = mid; else near = mid;
  }
  return far;
}

/**
 * A sequential ramp from the accent to the faintest legible shade of it.
 *
 * ── The direction ───────────────────────────────────────────────────────────
 *
 * Faint means *near the surface*, always — that is what a sequential scale
 * means, and the first version of this had it backwards, which is how a lime on
 * charcoal produced four shades of near-black. So the ramp always runs towards
 * the surface, and how far it can run is decided by contrast.
 *
 * ── When the accent cannot be step one ──────────────────────────────────────
 *
 * If the accent is close to its own surface in lightness there is no room
 * between them, and a ramp that starts at an invisible colour is not a ramp.
 * In that case the strong end moves away from the surface until there is room —
 * a darker or lighter shade of the same hue — because a scale nobody can read
 * is worse than one that is a shade off-brand.
 */
export function chartRamp(accent: string, surface: string, ink: string): ChartRamp {
  const [L, a, b] = rgbToOklab(parseHex(accent));
  const sL = lightnessOf(surface);
  // Legibility lies away from the surface: upwards from a dark ground, downwards
  // from a light one.
  const away: 1 | -1 = sL > 0.5 ? -1 : 1;
  const limit = away > 0 ? 0.97 : 0.06;

  const faintL = faintestLegible(a, b, surface, away);

  /*
    The accent leads its own ramp wherever it can.

    The strong end is the accent itself, and it only moves further from the
    surface when there is not room between the two for the minimum number of
    steps. Insisting on five steps instead pushed the strong end past the accent
    on almost every dark palette, and the brightest colour on the dashboard was
    then a shade nobody had chosen.
  */
  const floorL = faintL + away * STEP_TARGET * (MIN_STEPS - 1);
  let strongL = away > 0 ? Math.max(L, floorL) : Math.min(L, floorL);
  strongL = away > 0 ? Math.min(strongL, limit) : Math.max(strongL, limit);

  // How many steps the room actually carries. Four is the floor; below that the
  // ground is unusable for charts and no arrangement of colours fixes it.
  const span = Math.abs(strongL - faintL);
  const steps = Math.max(MIN_STEPS, Math.min(MAX_STEPS, Math.floor(span / STEP_TARGET) + 1));

  const usesAccent = Math.abs(strongL - L) < 0.005;
  const out: string[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const stepL = strongL + (faintL - strongL) * t;
    // Chroma eases off as a step approaches the surface, the way a real
    // sequential ramp does; holding it flat makes the faint end look dirty.
    const c = 1 - 0.45 * t;
    out.push(i === 0 && usesAccent ? normalise(accent) : fit(stepL, a * c, b * c));
  }

  return {
    steps: out,
    grid: mix(ink, surface, 0.12),
    // A win wears the site's own accent. The other two are fixed hues, because
    // "bad" must not depend on which colour somebody chose for their brand —
    // and all three always ship beside a word or an arrow, never colour alone.
    good: out[0],
    warn: readable('#E0A33E', surface, ink),
    bad: readable('#E0563E', surface, ink),
  };
}

function normalise(hex: string): string { return toHex(parseHex(hex)); }

function mix(a: string, b: string, t: number): string {
  const [x, y] = [parseHex(a), parseHex(b)];
  return toHex(x.map((v, i) => v * t + y[i] * (1 - t)) as RGB);
}

/**
 * A fixed status hue, moved just far enough in lightness to be readable on this
 * particular surface. Amber on bone is invisible; amber on charcoal is not.
 */
function readable(hex: string, surface: string, ink: string): string {
  if (contrast(hex, surface) >= 3) return normalise(hex);
  const [, a, b] = rgbToOklab(parseHex(hex));
  const goDown = lightnessOf(surface) > 0.5;
  for (let i = 1; i <= 20; i++) {
    const L = lightnessOf(hex) + (goDown ? -1 : 1) * i * 0.03;
    if (L <= 0 || L >= 1) break;
    const candidate = fit(L, a, b);
    if (contrast(candidate, surface) >= 3) return candidate;
  }
  return mix(hex, ink, 0.5);
}
