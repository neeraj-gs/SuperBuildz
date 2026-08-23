/**
 * The tweak panel: everything a person can change by dragging.
 *
 * The whole product thesis is that a non-coder should be able to change how
 * their site looks without describing it. Chat can do anything, but a chat
 * turn costs thirty seconds and some usage, and "a bit more space between the
 * sections" is not a sentence anybody enjoys writing. A slider is instant,
 * free, reversible, and — the part that matters — lets somebody *find* what
 * they want by moving it, which is how people actually choose.
 *
 * Values land in the project's `design.tweaks.json`. `lib/tokens.ts` merges
 * that over `design.config.ts`, so:
 *
 *   - a slider drag and an edit by the build never touch the same file
 *   - Next's dev server hot-reloads on the write, so the preview updates
 *   - `{}` is a complete, obvious undo
 *   - the designed values stay legible in the repo
 *
 * The control list lives here rather than in the UI so the two cannot drift.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { TweakControl, TweakPreset, TweakState, Tweaks } from '@superbuilds/protocol';
import { getProject } from './projects.ts';

const FILE = 'design.tweaks.json';

export const TWEAK_CONTROLS: TweakControl[] = [
  // Colour ------------------------------------------------------------------
  { key: 'bg', label: 'Page', group: 'Colour', kind: 'colour', hint: 'The ground everything sits on.' },
  { key: 'fg', label: 'Ink', group: 'Colour', kind: 'colour', hint: 'Text and anything drawn on the ground.' },
  { key: 'accent', label: 'Accent', group: 'Colour', kind: 'colour', hint: 'The one colour that means "this matters".' },
  { key: 'surface', label: 'Surface', group: 'Colour', kind: 'colour', hint: 'Panels and cards, a step off the ground.' },
  { key: 'muted', label: 'Quiet', group: 'Colour', kind: 'colour', hint: 'Captions, labels, things you read second.' },

  // Type --------------------------------------------------------------------
  { key: 'displayScale', label: 'Headline size', group: 'Type', kind: 'range', min: 0.6, max: 1.6, step: 0.02, unit: '×', hint: 'Everything set in the display face, together.' },
  { key: 'displayTracking', label: 'Headline tightness', group: 'Type', kind: 'range', min: -0.07, max: 0.02, step: 0.002, unit: 'em', hint: 'Negative pulls the letters together. Large type wants more.' },
  { key: 'bodyScale', label: 'Body size', group: 'Type', kind: 'range', min: 0.85, max: 1.25, step: 0.01, unit: '×' },
  { key: 'measure', label: 'Line length', group: 'Type', kind: 'range', min: 45, max: 90, step: 1, unit: 'ch', hint: 'How many characters before a line wraps. 60–70 reads best.' },

  // Space -------------------------------------------------------------------
  { key: 'section', label: 'Section rhythm', group: 'Space', kind: 'range', min: 0.5, max: 1.8, step: 0.02, unit: '×', hint: 'The air above and below every section.' },
  { key: 'gutter', label: 'Side margins', group: 'Space', kind: 'range', min: 12, max: 96, step: 2, unit: 'px' },
  { key: 'radius', label: 'Corner radius', group: 'Space', kind: 'range', min: 0, max: 28, step: 1, unit: 'px', hint: '0 is hard-edged and serious. 20 is friendly.' },

  // Motion ------------------------------------------------------------------
  { key: 'pace', label: 'Pace', group: 'Motion', kind: 'range', min: 0.4, max: 2.2, step: 0.05, unit: '×', hint: 'Every duration at once. Above 1 is slower and more cinematic.' },
  { key: 'rise', label: 'Reveal travel', group: 'Motion', kind: 'range', min: 0, max: 64, step: 2, unit: 'px', hint: 'How far things move as they arrive. 0 is a plain fade.' },
  { key: 'stagger', label: 'Stagger', group: 'Motion', kind: 'range', min: 0, max: 180, step: 5, unit: 'ms', hint: 'The gap between one thing arriving and the next.' },

  // Texture -----------------------------------------------------------------
  { key: 'grain', label: 'Grain', group: 'Texture', kind: 'range', min: 0, max: 0.3, step: 0.01, hint: 'Film grain over the whole page. A little goes a long way.' },
  { key: 'sceneDim', label: 'Scene quiet', group: 'Texture', kind: 'range', min: 0, max: 1, step: 0.02, hint: 'How much of the ground colour sits over the 3D scene.' },
  { key: 'sceneBrightness', label: 'Scene brightness', group: 'Texture', kind: 'range', min: 0.3, max: 1.8, step: 0.02, unit: '×' },
];

export const TWEAK_PRESETS: TweakPreset[] = [
  { id: 'designed', label: 'As designed', blurb: 'Everything back to what the build chose.', values: {} },
  { id: 'quiet', label: 'Quieter', blurb: 'Smaller headlines, more air, slower, dimmer scene.', values: { displayScale: 0.82, section: 1.3, pace: 1.3, rise: 12, grain: 0.05, sceneDim: 0.25 } },
  { id: 'loud', label: 'Louder', blurb: 'Bigger, tighter, faster, the scene turned up.', values: { displayScale: 1.28, displayTracking: -0.05, section: 0.78, pace: 0.75, rise: 40, stagger: 40, sceneBrightness: 1.25 } },
  { id: 'editorial', label: 'Editorial', blurb: 'Print rhythm: long measure, hard corners, restrained motion.', values: { displayScale: 1.1, measure: 72, radius: 0, section: 1.15, rise: 10, pace: 1.15, grain: 0.06 } },
  { id: 'dense', label: 'Denser', blurb: 'Less air, tighter margins, quick. Good for a lot of content.', values: { displayScale: 0.85, bodyScale: 0.95, section: 0.62, gutter: 20, pace: 0.8, rise: 8 } },
  { id: 'film', label: 'Filmic', blurb: 'Grain, a dark scene, slow reveals travelling far.', values: { grain: 0.16, sceneBrightness: 0.7, sceneDim: 0.15, pace: 1.45, rise: 48, stagger: 90 } },
];

const KEYS = new Set(TWEAK_CONTROLS.map((c) => c.key));

/** Only known keys, only sane values. This writes into the person's project. */
export function sanitise(input: unknown): Tweaks {
  const out: Tweaks = {};
  if (!input || typeof input !== 'object') return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!KEYS.has(k as keyof Tweaks)) continue;
    const control = TWEAK_CONTROLS.find((c) => c.key === k)!;
    if (control.kind === 'colour') {
      if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) (out as Record<string, unknown>)[k] = v.toLowerCase();
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      const min = control.min ?? -Infinity;
      const max = control.max ?? Infinity;
      (out as Record<string, unknown>)[k] = Math.min(max, Math.max(min, v));
    }
  }
  return out;
}

function tweakPath(projectPath: string) { return join(projectPath, FILE); }

export function readTweaks(projectPath: string): Tweaks {
  const file = tweakPath(projectPath);
  if (!existsSync(file)) return {};
  try { return sanitise(JSON.parse(readFileSync(file, 'utf8'))); } catch { return {}; }
}

/**
 * What the build designed, pulled out of `design.config.ts` by reading the
 * literals rather than evaluating the module — the daemon must never import
 * code out of a project folder.
 */
export function designedValues(projectPath: string): Tweaks {
  const file = join(projectPath, 'design.config.ts');
  const out: Tweaks = {};
  if (!existsSync(file)) return out;
  let src: string;
  try { src = readFileSync(file, 'utf8'); } catch { return out; }

  const str = (name: string) => src.match(new RegExp(`${name}:\\s*'([^']*)'|${name}:\\s*"([^"]*)"`))?.slice(1).find(Boolean);
  const num = (name: string) => {
    const m = src.match(new RegExp(`${name}:\\s*(-?[0-9.]+)`));
    return m ? Number(m[1]) : undefined;
  };
  const px = (v?: string) => (v && /^-?[0-9.]+px$/.test(v) ? Number(v.replace('px', '')) : undefined);

  for (const key of ['bg', 'fg', 'accent', 'muted', 'surface'] as const) {
    const v = str(key);
    if (v && /^#[0-9a-fA-F]{6}$/.test(v)) out[key] = v.toLowerCase();
  }
  const tracking = str('displayTracking');
  if (tracking && tracking.endsWith('em')) out.displayTracking = Number(tracking.replace('em', ''));
  const measure = str('measure');
  if (measure && measure.endsWith('ch')) out.measure = Number(measure.replace('ch', ''));
  out.radius = px(str('radius'));
  out.rise = num('rise');
  out.stagger = num('stagger');
  // Scales are relative to the designed value, so 1 is always "as designed".
  out.displayScale = 1; out.bodyScale = 1; out.section = 1; out.pace = 1; out.sceneBrightness = 1;
  out.grain = 0; out.sceneDim = 0;
  return out;
}

export function tweakState(projectId: string): TweakState {
  const project = getProject(projectId);
  if (!project) throw new Error('no such project');
  return {
    projectId,
    values: readTweaks(project.path),
    designed: designedValues(project.path),
    controls: TWEAK_CONTROLS,
    presets: TWEAK_PRESETS,
  };
}

/**
 * Merge a patch and write it. `null` for a key clears it back to the designed
 * value, which is what a "reset this one" button sends.
 */
export function setTweaks(projectId: string, patch: Record<string, unknown>, replace = false): TweakState {
  const project = getProject(projectId);
  if (!project) throw new Error('no such project');

  const current = replace ? {} : readTweaks(project.path);
  const cleared = new Set(Object.entries(patch).filter(([, v]) => v === null).map(([k]) => k));
  const next: Record<string, unknown> = { ...current, ...sanitise(patch) };
  for (const k of cleared) delete next[k];

  const body = {
    $comment: 'Live tweaks, written by the panel in Super Builds. Everything here overrides design.config.ts; delete a key to go back to the designed value, or empty this file to {} to reset entirely.',
    ...next,
  };
  writeFileSync(tweakPath(project.path), `${JSON.stringify(body, null, 2)}\n`, 'utf8');
  return tweakState(projectId);
}

/**
 * A palette a long way from the current one, but still a palette: the ground
 * and the ink stay a real contrast pair and the accent stays legible on both.
 * Shuffling is how somebody without the vocabulary discovers they wanted
 * something warmer.
 */
export function shufflePalette(projectId: string): TweakState {
  const state = tweakState(projectId);
  const now = { ...state.designed, ...state.values };
  const dark = luminance(now.bg ?? '#0a0b0d') < 0.4;

  const hue = Math.floor(Math.random() * 360);
  const bg = hsl(hue, dark ? 0.10 : 0.06, dark ? 0.045 + Math.random() * 0.03 : 0.94 - Math.random() * 0.04);
  const fg = hsl(hue, 0.08, dark ? 0.92 : 0.09);
  const surface = hsl(hue, dark ? 0.11 : 0.05, dark ? 0.10 : 0.98);
  const muted = hsl(hue, 0.08, dark ? 0.48 : 0.42);
  // The accent sits well away from the ground's hue, and is bright on a dark
  // ground and deep on a light one so it always reads as emphasis.
  const accentHue = (hue + 120 + Math.floor(Math.random() * 120)) % 360;
  const accent = hsl(accentHue, 0.72, dark ? 0.62 : 0.42);

  return setTweaks(projectId, { bg, fg, surface, muted, accent });
}

function hsl(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const v = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * v).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  return (((n >> 16) & 255) * 0.2126 + ((n >> 8) & 255) * 0.7152 + (n & 255) * 0.0722) / 255;
}
