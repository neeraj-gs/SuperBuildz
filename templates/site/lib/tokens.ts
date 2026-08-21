/**
 * design.config.ts → CSS variables. Set on <html> in the root layout, read by
 * globals.css and every component. The admin reads the same variables, which
 * is how it stays in the site's identity.
 */

import { design } from '@/design.config';
import { fontFamilies } from '@/app/fonts';

export type Theme = 'dark' | 'light';

export function paletteFor(theme: Theme) {
  const base = design.palette;
  const baseIsDark = isDark(base.bg);
  const useAlt = (theme === 'dark') !== baseIsDark;
  return useAlt ? base.alt : { bg: base.bg, fg: base.fg, accent: base.accent, muted: base.muted, surface: base.surface };
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
  return {
    '--bg': p.bg, '--fg': p.fg, '--accent': p.accent, '--muted': p.muted, '--surface': p.surface,
    '--line': `color-mix(in srgb, ${p.fg} 12%, transparent)`,
    '--font-display': fontFamilies.display, '--font-body': fontFamilies.body, '--font-mono': fontFamilies.mono,
    '--display-size': design.type.displaySize, '--display-tracking': design.type.displayTracking, '--display-leading': design.type.displayLeading,
    '--body-size': design.type.bodySize, '--body-leading': design.type.bodyLeading, '--measure': design.type.measure,
    '--radius': design.shape.radius, '--radius-lg': design.shape.radiusLg,
    '--section': design.space.section, '--gutter': design.space.gutter,
    '--ease-out': design.motion.easeOut, '--ease-in-out': design.motion.easeInOut,
    '--fast': `${design.motion.fast}ms`, '--base': `${design.motion.base}ms`, '--slow': `${design.motion.slow}ms`,
    '--stagger': `${design.motion.stagger}ms`, '--rise': `${design.motion.rise}px`,
  };
}

export function styleAttribute(theme: Theme): string {
  return Object.entries(cssVariables(theme)).map(([k, v]) => `${k}:${v}`).join(';');
}

export const tokens = design;
