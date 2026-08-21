---
name: award-rubric
description: The standard the site is judged against — what the award-winning reference sites actually do, the twelve-line rubric, the AI-slop list, and the jury procedure for the review stage. Use when reviewing your own work or when a change risks making the site ordinary.
---

# The bar

Sites that win (Awwwards SOTD/SOTY, FWA, CSSDA) share a decision, not a
technique: **the first viewport is an experience, one idea is committed to
fully, and a motion system recurs.** Studied for this product:

- **Lusion** — a WebGL light field the whole page travels through; chrome reduced to a mark and a menu; type at viewport scale integrated with the scene; hover and transitions share the hero's easing.
- **Bruno Simon** — a drivable world; the name as extruded geometry; the scene *is* the navigation; playfulness committed to the point of being slightly too much.
- **Active Theory** — restraint: near-black, white, one accent as light; cinematic pacing; every page transition is a designed moment.
- **Immersive Garden** — long-scroll stories with pinned chapters and scrubbed scenes; captions that arrive on the beat; mobile designed, not shrunk.
- **Noomo** — meaningful 3D objects (their work), studio lighting, product-like care in the details; bold editorial type.
- **Abeto Messenger** — the word built as an isometric world; one joke told perfectly; nothing else competes.
- **Lando Norris** — the helmet you orbit; the object is the hero and the brand; dark ground, one accent, big condensed type.
- **igloo** — ice you look into; material and light as the idea; motion slow enough to feel expensive.

And the dashboards that set the CRM bar: **Linear / Vercel / Stripe** (restraint, monochrome, hairlines, insight first), **Attio** (summaries as first-class UI), **Pipedrive** (the best pipeline board), **PostHog** (dense, readable analytics).

## The rubric (score 1–5 each; anything under 4 gets fixed)

1. Hero is an experience: full-viewport scene/composition, floating chrome, moves before touch, responds to touch.
2. Meaningful 3D: could belong to no other business.
3. One committed idea, in README, visible everywhere.
4. A motion system: named in design.config.ts; recurs in reveals, hovers, transitions.
5. Typography with a point of view: viewport-scale display, a real scale, correct measure.
6. Palette discipline: tokens only; accent as emphasis.
7. Layout system followed, not a stack of equal bands.
8. Copy in the voice of the business; specific; no filler.
9. Forms work end to end into the CRM, right stage; CRM wears the tokens.
10. Performance and access: reduced motion, lazy WebGL, budgets, keyboard, contrast.
11. Security intact: headers, validation, rate limit, admin auth, no secret client-side.
12. Mobile designed, not shrunk.

## AI slop — refuse on sight

Purple-to-blue gradients; glassmorphism cards; glowing orbs and blobs; floating
spheres/torus knots; particle wallpaper with a headline beside it; stock-photo
grids; "Welcome to our website"; three equal feature cards with icons in
circles; centred everything; drop shadows on everything; a navigation bar
across the top with five links; "Lorem ipsum"; fake testimonials with stock
faces; badges and trust logos invented; emojis as icons; rounded-everything.

## Jury procedure (stage 5)

1. `npm run shot -- --all` → read every image in `shots/`.
2. Score the twelve lines honestly in `REVIEW.md` as a table.
3. Fix in this order: hero → 3D meaning → idea → motion → type → palette → layout → copy → CRM → performance → security → mobile.
4. Re-shoot, re-score. Say what changed.
5. Security list: grep the client bundle for secret names (`grep -r "SESSION_SECRET\|ADMIN_PASSWORD_HASH\|DATABASE_URL" .next/static` must be empty); headers in `next.config.ts`; `/admin` needs a session; intake routes validate and rate-limit; `robots.txt` excludes `/admin`.
