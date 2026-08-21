---
name: hero-scenes
description: How to adapt the hero scene in components/scenes/ to the business — every scene's levers, the SceneCanvas contract, loading real models, procedural geometry, performance budgets. Use when building or changing the 3D hero.
---

# Hero scenes

The scene is the reason somebody remembers the site. It already runs; your job
is to make it belong to this business and no other. Read `BRIEF.md` → "The
scene" for what was chosen and the adaptation hook.

## The contract (never break it)

`components/SceneCanvas.tsx` owns: lazy loading behind `public/scene-poster.svg`,
DPR cap `[1, 2]` (lower on heavy scenes on phones), pause when off-screen or the
tab is hidden, reduced-motion → poster only, no WebGL → poster only. Scenes
receive `{ palette, progress, pointer, name, quality }` and **nothing else** —
no window listeners of their own, colours from `palette`, scroll from
`progress.current` (0..1 of the page), pointer from `pointer.current` (NDC).

Budget: WebGL bundle under 180KB gzipped beyond three itself; 60fps on a
mid-range laptop; a still worth looking at as the poster.

## Each scene's levers

| Scene | What to change first | Second | Never |
| --- | --- | --- | --- |
| FieldScene | what the points *are* (seeds, sparks, snow, data) — sprite texture, colour, density | flow direction, how scroll accelerates | a generic starfield with the headline beside it |
| ReliefScene | the pressed mark — replace the ring/bar in `height()` with the logo/monogram (sample an SVG to a texture and read it in the vertex shader) | material (plaster/sand/metal via noise scale, spec) | a photo as the heightmap |
| WordmarkScene | material that says something (chrome/ceramic/glass/brushed) | the settle motion, shadow ground | loading a runtime typeface — bake geometry |
| ObjectScene | the object: a GLB (`useGLTF`) of the real product, or procedural with honest proportions | studio lighting, env map | torus knots, blobs, cubes |
| LiquidScene | which two colours; what liquid (viscosity = fbm scale/speed) | pointer ripple strength | three colours |
| DioramaScene | three or four props that are *this* place | the name built into geometry | thirty generic props |
| ClothScene | the printed mark on the fabric; weave (normal detail), weight (wind amplitude) | pole/hanging rig | photoreal texture maps |
| TerrainScene | the real area (sample elevation or draw contours), markers where they work | camera path with scroll | photo textures |
| MorphScene | 3–5 targets that tell the story (sample SVG paths with `SVGLoader` → points) | chaos between states | random shapes |
| GlassScene | shard shapes that are theirs (lens, tumbler, gem, tablet) | what is behind the glass (type, the mark) | rainbow dispersion everywhere |
| ExplodedScene | the actual assembly (GLB parts or primitives), labels per part via `Html` from drei | axis and order of explosion | unlabeled explosion |
| RibbonsScene | path at rest traces a letterform or the mark | material finish | more than three ribbons |
| TypeScene | the one word or number that is the business, in the DOM at viewport scale | light colour/sweep | a headline beside a photograph |

## Recipes

**A real model.** Put a GLB in `public/models/`, then:
```tsx
import { useGLTF } from '@react-three/drei';
const { scene } = useGLTF('/models/thing.glb'); // draco-compress first: npx gltf-transform optimize in.glb out.glb
<primitive object={scene} />
```
Keep under 2MB. Preload with `useGLTF.preload('/models/thing.glb')`.

**Sample an SVG into points (Morph targets, Relief marks).**
```ts
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
const data = new SVGLoader().parse(svgText);
const pts: THREE.Vector3[] = [];
for (const path of data.paths) for (const shape of SVGLoader.createShapes(path)) for (const p of shape.getSpacedPoints(400)) pts.push(new THREE.Vector3(p.x, -p.y, 0));
```
Normalise to fit [-1.5, 1.5]. Do it at module load, not per frame.

**Labels in 3D (Exploded, Diorama).** `import { Html } from '@react-three/drei'` → `<Html position={[x,y,z]} center distanceFactor={8}><span className="eyebrow">Frame</span></Html>`. Hide on phones if they crowd.

**Scroll-scrubbed progress.** `progress.current` is already the page progress; for a section-local scrub, the host can pass a different ref. Ease it: `const p = THREE.MathUtils.smoothstep(progress.current, 0.1, 0.7)`.

**Lower quality on phones.** `quality === 'preview'` is the wizard; in the site, check `window.innerWidth < 640` once and halve counts/segments.

## Lighting that does not look rendered

One key (directional or spot, warm-neutral), one rim from behind-left in the accent, soft fill, and an environment (`<Environment preset="studio" environmentIntensity={0.6} />`) so metals have something to reflect. Flat ambient-only lighting is what makes a render look like a render.

## Check your work

`npm run shot -- /` then read `shots/home.png`. Ask: could this hero belong to another business? If yes, it is not done.
