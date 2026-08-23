import type { Catalogue, Spec } from '@superbuilds/protocol';
import { ARCHETYPES, archetypeFor } from './archetypes.ts';
import {
  ATMOSPHERES, CURSOR_STYLES, FEATURES, GOALS, HOVER_STYLES, LAYOUTS, MOTION_INTENSITY, PAGES, PALETTES,
  SCROLL_STYLES, THEMES, TRANSITIONS, TYPOGRAPHY,
} from './design.ts';
import { SCENES } from './scenes.ts';
import { ANALYTICS, CRM, DEPLOY } from './integrations.ts';
import { SIGNATURES, RHYTHMS, IMAGERY_KINDS, IMAGERY_DEVICES, beliefsFor } from './intent.ts';

export { ARCHETYPES, archetypeFor } from './archetypes.ts';
export * from './design.ts';
export { SCENES, sceneFor, scenesFor, HERO_RULE } from './scenes.ts';
export { ANALYTICS, CRM, DEPLOY } from './integrations.ts';
export * from './intent.ts';

export const CATALOGUE: Catalogue = {
  archetypes: ARCHETYPES,
  goals: GOALS,
  pages: PAGES,
  features: FEATURES,
  palettes: PALETTES,
  typography: TYPOGRAPHY,
  atmospheres: ATMOSPHERES,
  layouts: LAYOUTS,
  scenes: SCENES.map(({ brief: _b, adapt: _a, ...rest }) => rest),
  motionIntensity: MOTION_INTENSITY,
  scrollStyles: SCROLL_STYLES,
  hoverStyles: HOVER_STYLES,
  cursorStyles: CURSOR_STYLES,
  transitions: TRANSITIONS,
  themes: THEMES,
  analytics: ANALYTICS,
  crm: CRM,
  deploy: DEPLOY,
  signatures: SIGNATURES,
  rhythms: RHYTHMS,
  imageryKinds: IMAGERY_KINDS,
  imageryDevices: IMAGERY_DEVICES,
  // The belief that matters depends on what the site is asking for, so the
  // wizard narrows this by the chosen goal rather than showing all of them.
  beliefs: Object.fromEntries(GOALS.map((g) => [g.id, beliefsFor(g.id)])),
};

/** A complete spec from an archetype, so the wizard opens already answered. */
export function defaultsFor(archetypeId: string): Omit<Spec, 'name' | 'folder'> {
  const a = archetypeFor(archetypeId);
  return {
    kind: 'website',
    archetype: a.id,
    sector: undefined,
    goal: a.defaults.goal,
    pages: [...a.defaults.pages],
    features: [...a.defaults.features],
    details: {},
    palette: a.defaults.palette,
    typography: a.defaults.typography,
    atmosphere: a.defaults.atmosphere,
    layout: a.defaults.layout,
    scene: a.defaults.scene,
    motionIntensity: 'expressive',
    scrollStyle: 'smooth',
    hoverStyle: 'lift',
    cursorStyle: 'dot',
    transition: 'fade',
    theme: 'dark',
    analytics: ['custom', 'vercel'],
    crm: 'custom',
    deploy: 'vercel',
    references: [],
    assets: [],
    imagery: { kind: 'none', instead: [] },
    directions: true,
    review: true,
  };
}

/** Fill anything a draft left out, so the compiler never sees undefined. */
export function completeSpec(partial: Partial<Spec> & { name?: string; folder?: string }): Spec {
  const base = defaultsFor(partial.archetype ?? 'other');
  const merged = { ...base, ...partial } as Spec;
  merged.details = { ...(partial.details ?? {}) };
  merged.pages = merged.pages?.length ? merged.pages : base.pages;
  merged.features = merged.features ?? base.features;
  merged.analytics = merged.analytics?.length ? merged.analytics : base.analytics;
  merged.references = merged.references ?? [];
  merged.assets = merged.assets ?? [];
  merged.name = merged.name || 'Untitled';
  merged.folder = merged.folder || '';
  merged.review = merged.review !== false;
  merged.directions = merged.directions !== false;
  merged.imagery = merged.imagery ?? { kind: 'none', instead: [] };
  return merged;
}
