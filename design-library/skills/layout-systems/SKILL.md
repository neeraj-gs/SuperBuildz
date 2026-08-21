---
name: layout-systems
description: How to build each layout system (immersive scene, split stage, editorial grid, horizontal journey, stacked cards, bento, long-scroll story, minimal column) from the template's components. Use when building pages.
---

# Layout systems

`design.config.ts` → `layout` names one. It is how the *whole page* is
organised, not how a section looks. Build every page in it; secondary pages
may be simpler but must still belong.

Shared pieces: `<Section id tone bleed>`, `<Reveal>`, `.container-x`,
`.section`, `.display`, `.display-sm`, `.eyebrow`, `.measure`, the tokens
`--gutter`, `--section`, `--radius`, `--radius-lg`.

## immersive-scene
Fixed full-viewport `SceneCanvas` beneath everything (it already is in the hero; for the whole page, move it to `app/page.tsx` as a fixed layer and give sections `position: relative; z-index: 1` with backgrounds at 85–92% opacity via `color-mix(in srgb, var(--bg) 88%, transparent)` so the scene shows through between them). Chrome floats (already). The scene reads page progress, so it changes as the reader goes down.

## split-stage
```tsx
<div className="grid lg:grid-cols-2">
  <aside className="lg:sticky lg:top-0 lg:h-screen"><Stage /></aside>
  <div>{chapters}</div>
</div>
```
`Stage` swaps what it shows by which chapter is in view (IntersectionObserver on chapters sets a state the stage reads). On phones the stage becomes a pinned strip (`h-[40vh] sticky top-0`).

## editorial-grid
`grid grid-cols-12 gap-[var(--gutter)]`; headlines `col-span-12 lg:col-span-8`, body `lg:col-span-5`, images break the grid once per page (`col-span-12 -mx-[var(--gutter)]`). Hairline rules between rows: `border-t hairline`. Small caps captions along rules with `.eyebrow`.

## horizontal-journey
See motion-system → Horizontal journey. A `Progress` rail: a fixed thin bar with chapter ticks; update width from the same ScrollTrigger. Framed by a vertical intro and outro.

## stacked-cards
Each section is `sticky top-0 min-h-screen rounded-t-[var(--radius-lg)] border-t hairline` with its own `bg-bg` / `bg-surface` alternation; the scene shows between. Scale/dim the previous (motion-system).

## bento
`grid grid-cols-2 md:grid-cols-4 auto-rows-[minmax(140px,auto)] gap-[var(--gutter)]`; tiles span 1–2 columns/rows; each tile is a small live thing (a counter, a mini scene in its own small `SceneCanvas` with `progressSource="none"`, a looping clip, a form). Reflows to one column on phones without losing story order.

## long-scroll-story
Pinned chapters in sequence (motion-system → Pinned), a scrubbed scene, captions per chapter, a thin progress line on the edge. Secondary pages are simple and fast.

## minimal-column
`.container-x max-w-[68ch] mx-auto` for text; full-bleed breaks (`bleed` Section) for imagery, a map, or the scene. The hero still clears the hero rule.

## For every layout

- 390px first: check `npm run shot -- / --mobile`.
- One idea per section; a section that says two things is two sections.
- The footer earns its space (it is where a lost reader looks).
- Add every page to `app/sitemap.ts` and the nav links in `Nav`/`Footer`.
