---
name: scroll-craft
description: Use when composing or reviewing any page of this site. The scroll is the medium — how to make a section earn it, pace it so it can be read, and pick the one signature move the site is remembered for.
---

# Scroll craft

A page that scrolls is not a document being revealed. It is a sequence the
reader is driving. The single thing that separates the sites this project is
measured against from a competent dark page is that **the reader's scroll does
something**, continuously, and they can feel that they are the one doing it.

Read this before you compose a page, and again when a section feels flat.

## The test

Cover the copy. Scroll the section. If nothing changed except position, the
section has not earned its scroll — it is a slide, and it should either become
one beat inside a device below, or be deleted.

## The devices

They are already built in `components/ui/Scroll.tsx`. Compose them; do not
re-derive ScrollTrigger.

| Device | What it is for | Watch out for |
| --- | --- | --- |
| `Pinned` | Something holds still while its content plays out. The workhorse. | Needs 1.5–3 viewport heights of `distance` or it flickers past. |
| `HorizontalTrack` | A run of items the reader moves through sideways. Galleries, chapters, a menu, a timeline. | Falls back to a swipe strip below 720px. Never pin on touch. |
| `Counter` | A real number running to its value. The cheapest device and the most noticed. | Only for numbers somebody actually measured. Never animate an invented one. |
| `Focus` | One thing at a time: the item nearest the middle is present, the rest recede. | Wants 3–7 items. With two it reads as a bug. |
| `Draw` | A rule, a border, a map route, a diagram stroking itself in. | Give each path a real length; `stroke-dasharray` on a zero-length path does nothing. |
| `Marquee` | A band that drifts and drifts faster with scroll velocity. | One per page. Two is a carnival. |
| `SceneLayer` frames | The WebGL scene changes with the chapter — `data-scene-frame` on the section. | The strongest device available here. Use it. |

And the plain one that is still the most common: **reveal on arrival**
(`Reveal`). It is the baseline, not a device. A page whose only motion is
reveal-on-arrival has no scroll craft.

## Pace

The most frequent real-world complaint about generated scroll work, in order:

1. **"It goes too fast."** A pinned sequence over 100vh of scroll plays out in
   half a flick of a trackpad. Default to `distance={2}`; go to 3 for anything
   with more than four beats. If the reader cannot stop halfway and understand
   what they are looking at, it is too fast.
2. **"It doesn't last long enough."** An animation that resolves and then sits
   there for the rest of the pin. Spread the beats across the whole progress.
3. **"It's a bit bland."** Every section is reveal-on-arrival. Vary the device.

Rhythm matters more than intensity. A page should breathe: an intense hero, a
calm reading section, an intense chapter, a calm close. Three intense sections
in a row read the same as none, because nothing stands out. If the brief says
where it should feel calm and where intense, follow that; if it does not,
alternate and put the intensity where the decision is made.

## The signature move

Every site in the reference set has exactly one thing you would screenshot and
send to somebody. Not five. One.

- Lusion: the physics you can throw.
- Bruno Simon: you drive a car around the portfolio.
- Active Theory: the transition that folds the page.

Yours is named in `design.config.ts` under `signature` and in README.md under
"The signature move". Rules:

- It comes from **the business**, not from a library of effects. A restaurant
  whose fire is the point should have fire that responds; a studio whose work
  is precision should have something that snaps to a grid.
- It is **discoverable without instruction** — it happens on scroll or on the
  first pointer move, not behind a hidden gesture.
- Nothing else competes with it. If two things on the page are trying to be
  the memorable one, neither is.
- It works, or degrades honestly, on a phone and under `prefers-reduced-motion`.

If you cannot name the signature move in one sentence, the site does not have
one yet, and that is the first thing to fix — before polish, before copy.

## Composing a page

1. Write the **beats**: the four to eight things the reader should understand,
   in order. This is the scroll journey from the brief.
2. Decide **what the reader must believe by the end**, and put the evidence
   for it where the decision happens, not in a footer.
3. Assign a device per beat. No two adjacent beats use the same device.
4. Mark the sections with `data-scene-frame` so the scene follows the story.
5. Set the pace, then **check it by scrolling it yourself** — screenshot at
   four points through each pinned section (`npm run shot`) and look at them.
   A sequence that reads correctly in the code and wrong on screen is wrong.

## What not to do

- Do not scroll-jack: never take over the wheel, never animate `scrollTop`,
  never trap the reader in a section they cannot leave.
- Do not pin on phones. Do not pin two things at once.
- Do not use parallax as the only device. Background-moves-slower is 2014.
- Do not attach an effect to every section because effects are available. The
  calm sections are what make the intense ones land.
- Do not let a scroll device hide content from search engines or screen
  readers: the DOM order is the reading order, always.
