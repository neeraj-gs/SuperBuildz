/**
 * What a reference site is allowed to decide, and how it gets applied.
 *
 * This lived inside the reference screen, which was fine while the reference
 * screen was the only place you could take anything from it. It is not any
 * more: the colour screen, the type screen, the layout screen and the rest all
 * offer "the one your reference used" beside the catalogue's own options, and
 * all of them have to apply it exactly the way the reference screen does — the
 * same fields, the same list of what was adopted, so pressing "restaurant"
 * afterwards still knows which choices were deliberate.
 *
 * One list, one function, seven parts.
 */

import type { Catalogue, DesignDNA, DnaPart, Spec } from '@superbuilds/protocol';

export type Draftish = Partial<Spec> & { name: string; folder: string };

/** What can be taken, what it sets, and how to say it in one line. */
export const PARTS: Array<{ id: DnaPart; label: string; icon: string; blurb: string; step: string }> = [
  { id: 'palette', label: 'Its colours', icon: 'palette', blurb: 'The five it actually uses, sampled — yours to drag afterwards', step: 'palette' },
  { id: 'typography', label: 'Its typography', icon: 'type', blurb: 'The nearest pairing in the catalogue, not the same fonts', step: 'type' },
  { id: 'atmosphere', label: 'How it feels', icon: 'sparkle', blurb: 'The mood, which decides far more than the colours do', step: 'atmosphere' },
  { id: 'layout', label: 'How it is organised', icon: 'layout', blurb: 'The grid and the rhythm of the page', step: 'layout' },
  { id: 'scene', label: 'Its 3D', icon: 'cube', blurb: 'The kind of scene, adapted to your business', step: 'scene' },
  { id: 'motion', label: 'How it moves', icon: 'mouse', blurb: 'Intensity, scroll, hover, cursor and transitions together', step: 'motion' },
  { id: 'signature', label: 'Its one memorable move', icon: 'bolt', blurb: 'The thing you would describe to somebody afterwards', step: 'signature' },
];

/** The part a wizard screen is about, if any. */
export function partForStep(step: string): DnaPart | undefined {
  return PARTS.find((p) => p.step === step)?.id;
}

/**
 * What a part would set, in the catalogue's own words.
 *
 * Absent means there is nothing to take — either the reading found nothing for
 * it, or what it found is not something this product can build. Offering a
 * switch that would do nothing is worse than not offering it.
 */
export function describes(part: DnaPart, dna: DesignDNA, catalogue: Catalogue): string | undefined {
  const s = dna.suggests ?? {};
  const name = (list: { id: string; label: string }[], id?: string) => (id ? list.find((c) => c.id === id)?.label : undefined);
  switch (part) {
    case 'palette': return dna.customPalette ? 'its own five colours' : name(catalogue.palettes, s.palette);
    case 'typography': return name(catalogue.typography, s.typography);
    case 'atmosphere': return name(catalogue.atmospheres, s.atmosphere);
    case 'layout': return name(catalogue.layouts, s.layout);
    case 'scene': return name(catalogue.scenes, s.scene);
    case 'motion': {
      const parts = [name(catalogue.motionIntensity, s.motionIntensity), name(catalogue.scrollStyles, s.scrollStyle), name(catalogue.hoverStyles, s.hoverStyle)].filter(Boolean);
      return parts.length ? parts.join(' · ') : undefined;
    }
    case 'signature': return s.signature ? (catalogue.signatures.find((x) => x.id === s.signature)?.label ?? s.signature) : undefined;
  }
}

/**
 * Take a part, or put it back.
 *
 * Returns the next draft rather than mutating one, so the same call works from
 * a `setSpec` updater on any screen. Nothing is adopted until this runs: the
 * reading always reaches the brief as context, but what it *chooses* for you
 * is only ever what you pressed.
 */
export function togglePart(s: Draftish, dna: DesignDNA, part: DnaPart): Draftish {
  const on = new Set(s.adopted ?? []).has(part);
  const sug = dna.suggests ?? {};
  const next: Draftish = { ...s };
  const list = new Set(s.adopted ?? []);
  if (on) list.delete(part); else list.add(part);
  next.adopted = [...list];

  if (part === 'palette') {
    if (on) next.customPalette = undefined;
    else { next.customPalette = dna.customPalette; if (sug.palette) next.palette = sug.palette; }
  }
  if (part === 'typography' && sug.typography) next.typography = on ? s.typography : sug.typography;
  if (part === 'atmosphere' && sug.atmosphere) next.atmosphere = on ? s.atmosphere : sug.atmosphere;
  if (part === 'layout' && sug.layout) next.layout = on ? s.layout : sug.layout;
  if (part === 'scene' && sug.scene) next.scene = on ? s.scene : sug.scene;
  if (part === 'motion' && !on) {
    if (sug.motionIntensity) next.motionIntensity = sug.motionIntensity;
    if (sug.scrollStyle) next.scrollStyle = sug.scrollStyle;
    if (sug.hoverStyle) next.hoverStyle = sug.hoverStyle;
    if (sug.cursorStyle) next.cursorStyle = sug.cursorStyle;
    if (sug.transition) next.transition = sug.transition;
  }
  if (part === 'signature') next.signature = on ? undefined : sug.signature;
  return next;
}

/** The host, for labelling — an address is too long to sit on a switch. */
export function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url.replace(/^https?:\/\//, '').split('/')[0]; }
}
