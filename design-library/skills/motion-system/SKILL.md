---
name: motion-system
description: The site's motion system — reveals, scroll (Lenis + GSAP ScrollTrigger), pins, horizontal tracks, scrubbed scenes, hover styles, custom cursor, page transitions, reduced motion. Use when implementing or changing how anything moves.
---

# The motion system

One gesture, named in `design.config.ts` → `motion.gesture`, using only the
values there (`fast`, `base`, `slow`, `stagger`, `rise`, `easeOut`,
`easeInOut`). Whatever the hero does — its ease, its direction, how the accent
behaves — every reveal, hover and transition does the same. That recurrence is
what reads as a designed site rather than a set of effects.

## What the template already gives you

- `<Reveal delay={n}>` — rise-and-settle on enter, once. Delay is in staggers.
- `components/ui/SmoothScroll.tsx` — Lenis wired to GSAP's ticker when `motion.scroll !== 'native'`; off under reduced motion and on touch. Fires `scroll_depth`.
- `components/ui/Cursor.tsx` — dot / ring / label per `motion.cursor`. Use `data-cursor="Drag"` on elements to label.
- `components/ui/PageTransition.tsx` — fade / morph via View Transitions, wipe via a curtain.
- `globals.css` — `.hover-lift`, `.link-underline`, `[data-hover]` variants.

## Recipes (GSAP ScrollTrigger is installed)

Always inside `useEffect` in a `'use client'` component, always `gsap.context` for cleanup, always a `matchMedia` for reduced motion:

```tsx
'use client';
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

export function Pinned({ children }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference) and (min-width: 640px)', () => {
      const ctx = gsap.context(() => {
        gsap.timeline({ scrollTrigger: { trigger: ref.current, start: 'top top', end: '+=150%', pin: true, scrub: 0.6 } })
          .from('.beat', { y: 40, opacity: 0, stagger: 0.15 });
      }, ref);
      return () => ctx.revert();
    });
    return () => mm.revert();
  }, []);
  return <section ref={ref}>{children}</section>;
}
```

**Horizontal journey.** A wrapper `overflow-hidden` with an inner flex track; `gsap.to(track, { x: () => -(track.scrollWidth - window.innerWidth), ease: 'none', scrollTrigger: { trigger: wrapper, pin: true, scrub: 1, end: () => '+=' + track.scrollWidth } })`. Below 640px, do not pin; render the chapters vertically.

**Stacked cards.** Each card `position: sticky; top: 0`; as the next arrives, scale the previous to 0.96 and dim: `scrollTrigger: { trigger: next, start: 'top bottom', end: 'top top', scrub: true }`.

**Split headlines.** Split by lines at runtime (wrap words in spans, measure offsets) or by words; animate `y: '110%'` → 0 inside an `overflow-hidden` line wrapper, `stagger: design.motion.stagger / 1000`. Keep semantics: the h1 keeps its text, spans are `aria-hidden` copies, or use a single span per line.

**Counters.** `gsap.from(el, { textContent: 0, snap: { textContent: 1 }, duration: base/1000, scrollTrigger: { trigger: el, once: true } })`.

**Scrubbed scene.** `SceneCanvas` reads page progress already. For a chapter-driven scene, keep a `MutableRefObject<number>` in the page, write it from a ScrollTrigger `onUpdate: (st) => ref.current = st.progress`, and pass it to the scene via a prop on a copy of SceneCanvas.

**Marquee that responds to velocity.** A duplicated row, `gsap.to(row, { xPercent: -50, repeat: -1, ease: 'none', duration: 30 })`, then `ScrollTrigger.create({ onUpdate: (s) => tl.timeScale(1 + Math.abs(s.getVelocity()) / 800) })`.

**Magnetic buttons** are in `Button.tsx` when `motion.hover === 'magnetic'`.

**Image distortion on hover** (`hover === 'distort'`): drei `<Image>` in a small Canvas per gallery tile with a displacement shader; DOM fallback is `scale(1.04)`. Budget — gallery/work pages only.

## Rules

- Nothing moves in a way the hero did not establish.
- `prefers-reduced-motion` turns every effect into a fade or nothing; test with `npm run shot -- / --reduced`.
- Pins release below 640px; horizontal tracks fall back to vertical.
- Entrances happen once; do not replay on every scroll past.
- Durations from tokens only. `fast` for interactive state, `base` for reveals, `slow` for pins and hero beats.
- Never animate `width`/`height`/`top`/`left`; transform and opacity only.
