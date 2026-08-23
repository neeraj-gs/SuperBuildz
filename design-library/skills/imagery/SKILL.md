---
name: imagery
description: Use whenever a page needs a picture. What to do with the photographs the business has, and what to design instead when it has none — never an empty rounded rectangle, never stock.
---

# Imagery

Every section that would have a photograph is a decision. There are only three
honest answers, and the wrong answer is what most often makes an otherwise
good site look unfinished.

## The three answers

### 1. There are real photographs

They were copied into `public/media/` at scaffold time and listed in
`README.md` under "Assets". Use them.

- `next/image` always, with real `sizes`. The hero image gets `priority`.
- Crop deliberately. A photograph placed into a 16/9 box without thought is a
  worse use of a good photograph than not using it.
- One image per section carries more than four. If you have four good ones,
  make one big and let the others be small, or put them in a
  `HorizontalTrack` where the reader moves through them.
- Caption them in small caps. A caption that says what the thing *is* makes an
  ordinary photograph look considered.
- Never upscale. If the file is 900px wide, do not put it in a full-bleed hero.

### 2. There will be photographs, but not yet

Design the frame now and leave the slot. Use `<Figure>` with no `src`: it
renders a *composed* plate at exactly the aspect ratio the real image will
occupy, so when the photograph arrives nothing moves. List each one in
`README.md` under "Things to confirm" with what the shot should be — "the
counter at service, wide, low light" — so the person knows what to take.

### 3. There will never be photographs

This is the common case and it is a design brief, not a limitation. Some of
the best sites in the reference set have almost no photography.

Design **with what you have**: type, colour, rule, the scene, real data.

- **Type as image.** One word at 15–25vw, cropped by its frame, outlined
  rather than filled. This is `<Figure treatment="type" word="…">`. It is the
  safest and often the best answer.
- **A colour field with one mark.** `treatment="field"`.
- **A technical drawing.** Hairline grid with the thing described as a
  measured diagram — `treatment="draft"`. Very strong for products, spaces,
  processes.
- **Bands.** `treatment="band"`, good in a run of three where the run itself
  is the pattern.
- **The scene.** A `data-scene-frame` section where the WebGL scene *is* the
  picture is better than any placeholder.
- **Real numbers and real words.** A large quoted sentence set well, or a
  figure that counts up, occupies the same visual weight as a photograph and
  is more honest.

Vary the treatment across a run by passing `seed={i}`; three identical plates
in a row read as a template.

## The rule

> **Never render an empty rounded rectangle.**

A grey box with a number in the corner, a `bg-surface` div with a fixed aspect
ratio and nothing in it, a dashed outline saying "image" — these are the
single most common reason a generated site reads as unfinished. If you are
about to write a div whose only content is its own dimensions, use `<Figure>`
instead.

## What is forbidden

- **Stock photography.** No Unsplash, no Pexels, no generic office/handshake/
  laptop imagery, no `source.unsplash.com` URLs. It reads as generated
  precisely because it is generic, and it is often a licensing problem.
- **Inventing photographs of real things.** Do not describe a picture of the
  owner, the premises, the team or the product as though it exists.
- **Hotlinking anything.** Every asset is local, in `public/`.
- **A logo wall of clients who have not been named.** Never invent a client.

## If image generation is available

When the project has an image provider configured (a key in `.env.local`, named
in `README.md`), generated imagery is allowed for *atmosphere*, never for
evidence — a texture, an abstract plate, an illustrative scene. It must never
depict the actual premises, staff, product or customers, and each generated
file is listed in `README.md` under "Generated imagery" so nobody later
mistakes it for a photograph.

Composition matters more than the prompt: decide where the type goes **first**,
then generate an image with deliberate empty space there. An image with the
subject dead centre cannot carry a headline. And on phones, serve the still —
never a video — so an older device is not asked to decode one.

## Video

Same rules. If a clip exists, use `<video muted playsInline loop preload="metadata">`
with a `poster` that is a real frame, cap it at ~4MB, and swap to the poster
image below 720px. Never autoplay with sound. Never make the poster a blank
rectangle.
