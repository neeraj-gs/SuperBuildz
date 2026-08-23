'use client';

/**
 * Preview a visual direction by URL: `?direction=<id>`.
 *
 * Directions live in `directions.json` at the project root — a handful of
 * named token sets the build proposed. Adding `?direction=ember` to any route
 * applies that set over the designed tokens for the length of that page view
 * and nothing else: no cookie, no write, no effect on any other visitor.
 *
 * It exists so three complete directions can be shown side by side in three
 * frames and compared by looking, which is the only way most people can
 * choose. Describing a design is hard; pointing at one is not.
 *
 * When the parameter is absent this renders nothing and costs nothing.
 */

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import directions from '@/directions.json';
import type { Tweaks } from '@/lib/tokens';

type Direction = { id: string; name: string; note: string; tweaks: Tweaks };

export function DirectionPreview() {
  const params = useSearchParams();
  const id = params.get('direction');

  useEffect(() => {
    const root = document.documentElement;
    // Everything this component set last time, so switching directions in
    // place does not leave the previous one's values behind.
    const applied = new Set<string>(JSON.parse(root.dataset.sbDirectionVars || '[]'));
    for (const name of applied) root.style.removeProperty(name);
    root.dataset.sbDirectionVars = '[]';
    delete root.dataset.sbDirection;
    if (!id) return;

    const found = (directions as Direction[]).find((d) => d.id === id);
    if (!found) return;

    const vars = varsFor(found.tweaks);
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    root.dataset.sbDirectionVars = JSON.stringify(Object.keys(vars));
    root.dataset.sbDirection = id;
  }, [id]);

  return null;
}

/**
 * Which variables a direction sets. Everything scalable is a plain multiplier
 * (`--display-scale`, `--section-scale`, `--pace`) that `lib/tokens.ts`
 * already multiplies into the usable variable, so nothing has to be read back
 * out of the cascade — reading computed values and multiplying them here is
 * what silently collapsed the display type to 17px in the first attempt.
 */
function varsFor(t: Tweaks): Record<string, string> {
  const out: Record<string, string> = {};
  const set = (name: string, v: string | number | undefined) => {
    if (v !== undefined) out[name] = String(v);
  };

  set('--bg', t.bg);
  if (t.fg) { out['--fg'] = t.fg; out['--line'] = `color-mix(in srgb, ${t.fg} 12%, transparent)`; }
  set('--accent', t.accent);
  set('--surface', t.surface);
  set('--muted', t.muted);

  set('--display-scale', t.displayScale);
  set('--display-tracking', t.displayTracking !== undefined ? `${t.displayTracking}em` : undefined);
  set('--body-scale', t.bodyScale);
  set('--measure', t.measure !== undefined ? `${t.measure}ch` : undefined);

  if (t.radius !== undefined) { out['--radius'] = `${t.radius}px`; out['--radius-lg'] = `${t.radius * 1.8}px`; }
  set('--section-scale', t.section);
  set('--gutter', t.gutter !== undefined ? `${t.gutter}px` : undefined);

  set('--pace', t.pace);
  set('--rise', t.rise !== undefined ? `${t.rise}px` : undefined);
  set('--stagger', t.stagger !== undefined ? `${t.stagger}ms` : undefined);

  set('--grain', t.grain);
  set('--scene-tint', t.sceneDim);
  set('--scene-brightness', t.sceneBrightness);

  return out;
}
