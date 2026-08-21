/**
 * The 3D scenes somebody can choose, and what each means in code.
 *
 * What the reference sites share is not a technique, it is a decision: the
 * hero is an experience, not a layout. A WebGL light tunnel (Lusion). A
 * drivable world with the name as extruded geometry (Bruno Simon). A word built
 * out of buildings on an isometric island (Abeto's Messenger). A helmet you
 * orbit (Lando Norris). Ice you look into (igloo). None of them is a navigation
 * bar above a headline beside a photograph.
 *
 * So the choice is not "do you want 3D" — that invites "a bit, tastefully",
 * which is how you get a rotating cube nobody remembers. It is *which*
 * experience, described concretely enough to build and to preview honestly.
 * Every scene here exists as working code in `design-library/scenes/` — the
 * same component the wizard previews ships into the generated site, so the
 * build starts from something that runs and adapts it to the business rather
 * than inventing WebGL from a sentence.
 */

import type { Choice } from '@superbuilds/protocol';

export interface Scene extends Choice {
  /** The paragraph that goes into the brief. */
  brief: string;
  /** What the build should adapt to the business — the domain hook. */
  adapt: string;
}

export const SCENES: Scene[] = [
  {
    id: 'none', label: 'Typography carries it', icon: 'type', preview: 'none', weight: 'light',
    blurb: 'No WebGL. Type at viewport scale, full-bleed colour, scroll-driven motion.',
    suits: [],
    brief: 'No WebGL anywhere. The hero still has to be an experience rather than a layout: type at viewport scale, full-bleed colour, and scroll-driven motion — a headline beside a photograph is not an acceptable hero even without 3D.',
    adapt: 'Pick the one word or number that is the business and make it the hero.',
  },
  {
    id: 'field', label: 'A field you move through', icon: 'field', preview: 'field', weight: 'medium',
    blurb: 'Thousands of points or light streaks receding into depth, parting around the pointer, accelerating with scroll.',
    suits: ['saas', 'agency', 'creator', 'events', 'fitness', 'nonprofit', 'other'],
    brief: 'A volumetric field filling the first viewport: thousands of points or light streaks receding into depth, drifting slowly, parting around the pointer, and accelerating as the page scrolls so the reader feels they are travelling into the site rather than past it. Instanced geometry or a points material, never thousands of meshes; additive blending on a dark ground. Colour from the palette accent; density low enough that the headline over it stays perfectly legible. The scene is the room, not the subject.',
    adapt: 'Make the particles mean something: seeds, stars, sparks, data points, snow — whatever the business is made of.',
  },
  {
    id: 'relief', label: 'A surface with something pressed into it', icon: 'relief', preview: 'relief', weight: 'medium',
    blurb: 'An embossed relief lit by one moving light; the pointer moves the light, not the camera.',
    suits: ['portfolio', 'professional', 'shop', 'clinic', 'property', 'creator'],
    brief: 'A single plane displaced by a noise or texture map so it reads as material pressed into shape: plaster, sand, brushed metal, paper. Lit by one moving light so the relief is read entirely through shadow rather than colour, which is what makes it look expensive rather than rendered. The pointer moves the light, not the camera. Works beautifully on a light background, which is rare in 3D and therefore memorable. One plane, one light: the restraint is the effect.',
    adapt: 'Press the business into it: the logo, the monogram, the product silhouette, the outline of the building.',
  },
  {
    id: 'wordmark', label: 'The name, as an object', icon: 'wordmark', preview: 'wordmark', weight: 'medium',
    blurb: 'The business name as real geometry: extruded, bevelled, lit, settling as though it has weight.',
    suits: ['agency', 'creator', 'fitness', 'events', 'shop'],
    brief: 'The business name as actual 3D geometry occupying the hero. Extruded, bevelled, lit from one side, casting a real shadow, slowly rotating or settling as though it has weight. It is the logo and the hero at once, so nothing competes: no photograph, no subheading above it, navigation reduced to a mark in one corner. Give the material a point of view — polished, matte, glass, liquid metal — chosen to say something about the business. Generate the geometry from a font at build time rather than loading a typeface at runtime.',
    adapt: 'The material is the message: chrome for a club night, ceramic for a bakery, brushed steel for a gym.',
  },
  {
    id: 'object', label: 'One thing, turning', icon: 'object', preview: 'object', weight: 'medium',
    blurb: 'A single product or material, studio-lit, that the page orbits as it scrolls.',
    suits: ['shop', 'saas', 'restaurant', 'portfolio', 'professional', 'hardware'],
    brief: 'One object in the hero rendered well enough to be the reason somebody stays: the product, the material, or an abstraction of the service. A small parallax to the pointer and a rotation tied to scroll, so scrolling reveals another side of it rather than scrolling past. Studio lighting — key, rim, soft fill, a real environment map — because flat lighting is what makes a render look like a render. Never a torus knot, a floating blob or a rotating cube: the entire point is that this could be no other business.',
    adapt: 'Model or load the actual thing: the bottle, the chair, the helmet, the loaf. A GLB if one exists; procedural geometry otherwise.',
  },
  {
    id: 'liquid', label: 'Something that flows', icon: 'liquid', preview: 'liquid', weight: 'heavy',
    blurb: 'A liquid or smoke surface driven by a shader, disturbed locally by the pointer.',
    suits: ['creator', 'agency', 'nonprofit', 'saas', 'fitness', 'shop'],
    brief: 'A continuously moving surface — liquid metal, ink in water, smoke, a flowing gradient mesh — driven by a fragment shader rather than geometry. It never repeats visibly and never sits still; the pointer disturbs it locally so it feels alive rather than looped. Two colours from the palette at most; a third makes it wallpaper. Heaviest on a phone, so render to a lower-resolution target on small screens rather than dropping it.',
    adapt: 'The fluid should be the business\'s fluid: oil, water, paint, light, smoke, honey.',
  },
  {
    id: 'diorama', label: 'A small world', icon: 'diorama', preview: 'diorama', weight: 'heavy',
    blurb: 'An isometric low-poly scene of the place, rotating slightly, revealing detail as you scroll.',
    suits: ['restaurant', 'local-service', 'events', 'education', 'property'],
    brief: 'A small isometric world representing the business — the room, the workshop, the street — that the reader can rotate slightly and that reveals detail as the page scrolls. Low-poly and stylised rather than realistic: a stylised diorama reads as craft while a failed attempt at realism reads as a cheap asset. Consider building the name into the geometry itself rather than laying type over it. The most memorable option and much the most work, so build the rest of the site first and treat the scene as the last thing, with a designed still image standing in until it exists.',
    adapt: 'Model the actual place: the counter, the chairs, the van, the courtyard. Three or four recognisable props beat thirty generic ones.',
  },
  {
    id: 'cloth', label: 'Cloth in the wind', icon: 'cloth', preview: 'cloth', weight: 'medium',
    blurb: 'A simulated fabric — a flag, a drape, a banner — that ripples and reacts to the pointer.',
    suits: ['shop', 'events', 'creator', 'fitness', 'nonprofit'],
    brief: 'A plane simulated as cloth: a flag, a drape, a banner, a sheet of silk — driven in a vertex shader or a light spring simulation, catching light in its folds, rippling continuously and reacting to the pointer as wind. The material is the brand: silk, canvas, nylon, paper. Type can be printed on it or sit in front of it. Keep the mesh resolution modest and the lighting soft; the folds do the work.',
    adapt: 'Print the name or the mark on it. The weave and the weight should match what the business sells or stands for.',
  },
  {
    id: 'terrain', label: 'The ground beneath it', icon: 'terrain', preview: 'terrain', weight: 'medium',
    blurb: 'A topographic landscape or a stylised map of the area, lit low, that the camera flies over.',
    suits: ['property', 'local-service', 'education', 'nonprofit', 'events'],
    brief: 'A displaced plane read as terrain or a map: contour lines, a wireframe landscape, a stylised city grid of the area served. Lit low from one side so the relief reads. The camera drifts or advances with scroll as though flying over it; markers rise where the business is. Wireframe or flat-shaded, never photo textures — the abstraction is what keeps it elegant.',
    adapt: 'Make it their ground: the real area, the neighbourhood, the coastline, the valley. Markers where they work.',
  },
  {
    id: 'morph', label: 'Particles that become things', icon: 'morph', preview: 'morph', weight: 'medium',
    blurb: 'A cloud of particles that assembles into the logo, a product, a word — and dissolves into the next on scroll.',
    suits: ['saas', 'agency', 'education', 'creator', 'events'],
    brief: 'A particle system of tens of thousands of points, GPU-driven, that morphs between target shapes — the logo, a product silhouette, a key word, a chart — as the page scrolls, with a brief chaos between states. Additive, accent-coloured on dark; the pointer pushes particles aside locally. Targets are sampled from SVG paths or meshes at build time. The transitions are the motion system of the whole site.',
    adapt: 'Choose three to five targets that tell the story of the business in order.',
  },
  {
    id: 'glass', label: 'Light through glass', icon: 'glass', preview: 'glass', weight: 'heavy',
    blurb: 'Refractive glass shards or a lens drifting over type, bending what is behind them.',
    suits: ['professional', 'saas', 'shop', 'agency', 'property'],
    brief: 'Refractive glass — a few thick shards, a lens, a prism — drifting slowly over large type and bending it through real transmission (physical material with transmission, thickness, dispersion), lit by an environment so the edges catch. The type behind is the content; the glass is the experience. Chromatic dispersion sparingly; clarity is the luxury.',
    adapt: 'The shape of the glass should be theirs: a lens for an optician, a tumbler for a bar, a gem for a jeweller, a tablet for software.',
  },
  {
    id: 'exploded', label: 'Taken apart', icon: 'exploded', preview: 'exploded', weight: 'medium',
    blurb: 'An object that separates into its parts as you scroll, each part annotated, and reassembles.',
    suits: ['hardware', 'saas', 'shop', 'education'],
    brief: 'A product or a symbolic assembly that explodes along one axis as the page scrolls — each component drifting apart, a hairline and a label arriving beside it — and reassembles at the end. Scroll-scrubbed, so the reader controls the disassembly. Studio lighting, a single material family. If no model exists, build the object from primitives with honest proportions; the explosion is the idea, not the fidelity.',
    adapt: 'Explode the actual product, or the service as a stack of layers. Each part gets a real label.',
  },
  {
    id: 'ribbons', label: 'Ribbons that follow you', icon: 'ribbons', preview: 'ribbons', weight: 'medium',
    blurb: 'Long flowing tubes or ribbons that trail the pointer and weave through the type.',
    suits: ['creator', 'agency', 'fitness', 'events', 'education'],
    brief: 'A few long ribbons or tubes (tube geometry along animated curves) that flow continuously through the hero, weave in front of and behind the type, and bend towards the pointer. Glossy or iridescent material lit by an environment. Three ribbons maximum; motion slow enough to read as grace rather than noise. Scroll changes their tension.',
    adapt: 'Colour and finish from the brand; the path can trace a letterform or the outline of the logo at rest.',
  },
];

export function sceneFor(id: string): Scene {
  return SCENES.find((s) => s.id === id) ?? SCENES[0];
}

export function scenesFor(archetype?: string): Scene[] {
  if (!archetype) return SCENES;
  const fits = SCENES.filter((s) => s.suits?.includes(archetype));
  const rest = SCENES.filter((s) => !s.suits?.includes(archetype) && s.id !== 'none');
  return [...fits, ...rest, ...SCENES.filter((s) => s.id === 'none')];
}

export const HERO_RULE = `## The hero is an experience, not a layout

This is the difference between the sites that win things and the sites that are merely tidy. Look at what the best do: a full-viewport light field; a drivable world with the name as extruded geometry; a word built out of buildings on an isometric island; a helmet you orbit; an embossed relief that moves under the pointer. Not one of them is a navigation bar above a headline beside a photograph.

So the first viewport must be given to *something happening*:

- **The scene fills the viewport.** Not a banner in a container: the whole screen.
- **The chrome floats and is minimal.** A wordmark in one corner, at most two controls in another. No full-width navigation bar across the top.
- **Something moves before the reader touches anything**, and something else responds when they do.
- **Type is part of the composition**, at viewport scale, overlapping or integrated with the scene — not a caption on top.
- **Commit.** Half a good idea applied tastefully reads as generated. Every reference site is committed to one idea to the point of being slightly too much, and that is why they are remembered.
- **The scene's motion becomes the site's motion system** — the same easing, the same palette behaviour, the same gesture recurs in hovers, transitions and section reveals further down.`;
