---
name: site-craft
description: Copy, typography, imagery, metadata, accessibility and performance craft for the generated site — the details that separate a finished site from a generated one. Use when writing pages and polishing.
---

# Craft

## Copy

- Write in the voice of the business from BRIEF.md: specific nouns, short
  sentences, the name of the town, the thing they are known for.
- Headlines are claims or invitations, not labels. "Fire, slowly." beats
  "Welcome to Ember & Oak."
- One idea per section; the first sentence of a section is its headline
  restated for someone who skipped the headline.
- Buttons say what happens: "Book a table", "See the work", "Call now".
- Unknown facts: an honest placeholder in the voice (`Open Tuesday to Sunday
  <!-- TODO: confirm -->`) and a line under README "Things to confirm". Never
  invent testimonials, reviews, numbers, awards, addresses.

## Typography

- Display at viewport scale (`--display-size`), tight tracking, leading 0.9–1.0.
- A real scale: display → `display-sm` (1.8–3.2rem) → body (1.0625rem) → `eyebrow` (0.72rem caps). Nothing in between unless the atmosphere is "technical".
- Measure: body at 60–68ch. Never a full-width paragraph.
- Use the mono face for numbers, labels, captions along rules.
- Font loading is done (`app/fonts.ts`); do not add faces.

## Imagery

- No stock grids. When imagery is missing, compose with type, colour and the scene.
- Real images: `next/image` with real width/height, `sizes`, `priority` only for the hero poster.
- Optimise: WebP/AVIF, under 300KB each; a gallery page lazy-loads.

## Metadata

- `metadata` export on every page: title in the template, a real description.
- `app/opengraph-image.tsx` (Next's ImageResponse) drawn in the tokens: the name, the one line, the accent. Regenerate after restyles.
- `app/sitemap.ts` lists every page; `robots.ts` excludes `/admin`.

## Accessibility

- One `h1` per page; headings in order; landmarks (`main`, `nav`, `footer`).
- Every interactive thing reachable by keyboard with a visible focus (tokens have it).
- Contrast: body ≥ 4.5:1, large display ≥ 3:1. Check accent-on-bg for buttons.
- `alt` that describes; decorative images `alt=""`.
- Motion respects `prefers-reduced-motion` (the template does; keep it).
- Tap targets ≥ 44px on phones.

## Performance budget

- Lighthouse mobile Performance ≥ 85; LCP < 2.5s (the poster is the LCP).
- WebGL lazy behind the poster; scene bundle < 180KB gz beyond three.
- Server Components by default; `'use client'` only where there is interaction.
- `npm run build` and read the route sizes; anything over 250KB first-load JS has a reason or is fixed.

## Before declaring a stage done

`npm run build` passes; `npm run shot -- <pages>` read; mobile checked; no
console errors in the dev server log; README updated (the idea, things to
confirm).
