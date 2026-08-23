/**
 * design.config.ts (+ design.tweaks.json) → CSS variables. Set on <html> in
 * the root layout, read by globals.css and every component. The admin reads
 * the same variables, which is how it stays in the site's identity.
 *
 * Two files, on purpose. `design.config.ts` is the designed value — what the
 * build decided and what a reader of the repo should see. `design.tweaks.json`
 * is what somebody dragged a slider to five minutes ago. Keeping them apart
 * means a live tweak and an edit by the build never overwrite each other, and
 * emptying the tweaks file to `{}` is a complete, obvious undo.
 */

import { design } from '@/design.config';
import { fontFamilies } from '@/app/fonts';
import rawTweaks from '@/design.tweaks.json';

export type Theme = 'dark' | 'light';

/** Every value the tweak panel can set. Anything absent falls through. */
export interface Tweaks {
  bg?: string; fg?: string; accent?: string; surface?: string; muted?: string;
  displayScale?: number;      // × the designed display size
  displayTracking?: number;   // em
  bodyScale?: number;         // × the designed body size
  measure?: number;           // ch
  radius?: number;            // px
  section?: number;           // × the designed section rhythm
  gutter?: number;            // px
  pace?: number;              // × every duration
  rise?: number;              // px a reveal travels
  stagger?: number;           // ms
  grain?: number;             // 0..1
  sceneDim?: number;          // 0..1 extra dim over the whole scene layer
  sceneBrightness?: number;   // 0..2
}

export const tweaks: Tweaks = rawTweaks as Tweaks;

const px = (n: number) => `${Math.round(n * 100) / 100}px`;
const ms = (n: number) => `${Math.round(n)}ms`;
/** Scale a `clamp(a, b, c)` or a plain length without parsing CSS properly. */
const scale = (value: string, by: number) =>
  by === 1 ? value : `calc(${value} * ${Math.round(by * 1000) / 1000})`;

export function paletteFor(theme: Theme) {
  const base = design.palette;
  const baseIsDark = isDark(base.bg);
  const useAlt = (theme === 'dark') !== baseIsDark;
  const p = useAlt ? base.alt : { bg: base.bg, fg: base.fg, accent: base.accent, muted: base.muted, surface: base.surface };
  // Colour tweaks apply to whichever theme is showing: the person is dragging
  // a swatch while looking at one of them, and expects that one to change.
  return {
    bg: tweaks.bg ?? p.bg,
    fg: tweaks.fg ?? p.fg,
    accent: tweaks.accent ?? p.accent,
    muted: tweaks.muted ?? p.muted,
    surface: tweaks.surface ?? p.surface,
  };
}

export function isDark(hex: string): boolean {
  const n = parseInt(hex.replace('#', ''), 16);
  return ((n >> 16) & 255) * 0.2126 + ((n >> 8) & 255) * 0.7152 + (n & 255) * 0.0722 < 140;
}

export function defaultTheme(): Theme {
  if (design.theme === 'light') return 'light';
  if (design.theme === 'dark') return 'dark';
  return isDark(design.palette.bg) ? 'dark' : 'light';
}

/** Everything as a CSS string, so it can be applied inline or to <html>. */
export function cssVariables(theme: Theme): Record<string, string> {
  const p = paletteFor(theme);
  const t = tweaks;
  return {
    '--bg': p.bg, '--fg': p.fg, '--accent': p.accent, '--muted': p.muted, '--surface': p.surface,
    '--line': `color-mix(in srgb, ${p.fg} 12%, transparent)`,

    '--font-display': fontFamilies.display,
    '--font-body': fontFamilies.body,
    '--font-mono': fontFamilies.mono,

    '--display-size': scale(design.type.displaySize, t.displayScale ?? 1),
    '--display-tracking': t.displayTracking !== undefined ? `${t.displayTracking}em` : design.type.displayTracking,
    '--display-leading': design.type.displayLeading,
    '--body-size': scale(design.type.bodySize, t.bodyScale ?? 1),
    '--body-leading': design.type.bodyLeading,
    '--measure': t.measure !== undefined ? `${t.measure}ch` : design.type.measure,

    '--radius': t.radius !== undefined ? px(t.radius) : design.shape.radius,
    '--radius-lg': t.radius !== undefined ? px(t.radius * 1.8) : design.shape.radiusLg,

    '--section': scale(design.space.section, t.section ?? 1),
    '--gutter': t.gutter !== undefined ? px(t.gutter) : design.space.gutter,

    '--ease-out': design.motion.easeOut,
    '--ease-in-out': design.motion.easeInOut,
    '--fast': ms(design.motion.fast * (t.pace ?? 1)),
    '--base': ms(design.motion.base * (t.pace ?? 1)),
    '--slow': ms(design.motion.slow * (t.pace ?? 1)),
    '--stagger': ms(t.stagger ?? design.motion.stagger),
    '--rise': px(t.rise ?? design.motion.rise),

    '--grain': String(t.grain ?? 0),
    '--scene-tint': String(t.sceneDim ?? 0),
    '--scene-brightness': String(t.sceneBrightness ?? 1),
  };
}

export function styleAttribute(theme: Theme): string {
  return Object.entries(cssVariables(theme)).map(([k, v]) => `${k}:${v}`).join(';');
}

export const tokens = design;
