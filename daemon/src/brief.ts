/**
 * The compiler: choices in, a brief an experienced studio would have written
 * out. This is the product. The clicking is the interface; this file is the
 * value, because the quality of what Claude Code produces is decided almost
 * completely by what it is asked for, and knowing what to ask for — a funnel,
 * named events, a performance budget, which of twelve ways of doing 3D — is
 * the skill a non-coder does not have.
 *
 * It produces four kinds of text:
 *   - the master brief, written to BRIEF.md in the project and read every turn
 *   - one prompt per generation stage
 *   - the appended system prompt every session runs under (house rules, the
 *     options block the chat chips are parsed from)
 *   - change briefs for the quick-action bar
 */

import type { Plan, Spec } from '@superbuilds/protocol';
import {
  ANALYTICS, ATMOSPHERES, CRM, CURSOR_STYLES, FEATURES, GOALS, HERO_RULE, HOVER_STYLES, LAYOUTS, MOTION_INTENSITY,
  PAGES, PALETTES, SCROLL_STYLES, TRANSITIONS, TYPOGRAPHY, archetypeFor, sceneFor,
  SIGNATURES, RHYTHMS, IMAGERY_DEVICES, beliefsFor, SCENES, THEMES,
} from './catalogue/index.ts';
import type { Choice } from '@superbuilds/protocol';

const label = (list: Choice[], id: string) => list.find((c) => c.id === id)?.label ?? id;

/**
 * The intent answers arrive either as a catalogue id (they pressed a card) or
 * as a sentence (they typed one). Resolve the first, pass the second through,
 * and include the blurb where it carries the actual instruction.
 */
function said(list: Choice[], value: string | undefined): string | undefined {
  if (!value) return undefined;
  const found = list.find((c) => c.id === value);
  if (!found) return value;
  return found.blurb ? `${found.label} — ${found.blurb}` : found.label;
}

/* ---------------------------------------------------------------------------
   Direction per choice: the part nobody knows to ask for
--------------------------------------------------------------------------- */

const ATMOSPHERE_DIRECTION: Record<string, string> = {
  'quiet-gallery': 'Let the imagery carry everything. Type is small, one weight, never competing. Very large margins; a 12-column grid used at 8 or fewer. Almost no colour beyond the work itself. Nothing has a border unless it is a control. One decorative flourish and it becomes an ordinary page with small type.',
  'bold-editorial': 'A display face at 6–10vw for headlines, set tight (-0.03em), allowed to wrap to two or three lines. A hard-edged 12-column grid with visible alignment. Pull quotes, asymmetric spreads, hairline rules. Body copy no wider than 68 characters.',
  cinematic: 'Full-bleed imagery and scene with a dark scrim; content enters over it. Near-black ground, one warm accent. Sections reveal with 500–800ms eases; 12–20vh of vertical padding. Nothing bright, nothing fast.',
  technical: 'Dense, exact, information-first. A 4px spacing scale used strictly. Monospace for anything numeric, versioned or literal. Hairline rules instead of cards. 13–15px body and high density, like a good dashboard.',
  'warm-direct': 'Plain language, generous line height (1.7), rounded corners, one friendly accent. Short sections that each say one thing. People rather than objects in photography. Buttons that look pressable and say what happens.',
  'plain-confident': 'No decoration at all. Black on white or white on black, one accent, hairline rules. A single readable column with full-width breaks. If it can be removed without loss, remove it.',
  calm: 'Soft, generous, unhurried. Large space, gentle radii (12–16px), muted accent, nothing above 60% contrast except the primary action. Reassuring microcopy. No urgency devices.',
  kinetic: 'High contrast, heavy weights, diagonal energy. Motion carries the page: a marquee that responds to scroll velocity, counters that run as they arrive, sections that shear slightly as they cross the viewport. Accent at full saturation across large areas. The type should feel like it is moving even when still.',
  appetite: 'Close-up photography with shallow depth of field, warm grading, texture in the background. Warm, slightly rounded type. Prices and hours legible on a phone held one-handed.',
  retail: 'Product on plain grounds, price adjacent and unambiguous, the buy action visible without scrolling on mobile. A grid of cards with consistent aspect ratios. Trust marks near the checkout, not the footer.',
  establishment: 'Sober and spacious. A serif for headlines, neutral sans for body, two accent uses per page at most. Wide margins, slow rhythm. Credentials stated factually, never as badges.',
  futurist: 'Lab-precise and luminous. Thin rules, small caps labels, generous dark space, the accent used as light rather than paint. Numbers and specifications as design elements. Every edge aligned to a grid.',
};

/** Fonts named for `next/font/google`, so the scaffold can write `app/fonts.ts`. */
export const TYPE_DIRECTION: Record<string, { display: string; body: string; mono?: string; note: string }> = {
  grotesk: { display: 'Inter', body: 'Inter', note: 'Headline weights 600–700, body 400 at 16px/1.65, tracking -0.02em on display.' },
  editorial: { display: 'Fraunces', body: 'Inter', note: 'Fraunces for headlines with optical size; Inter for body. Never mix at the same size.' },
  brutal: { display: 'Syne', body: 'Inter', note: 'Syne 800 at viewport scale, tracking -0.04em, line-height 0.9. Body Inter 400.' },
  'serif-body': { display: 'Source Serif 4', body: 'Source Serif 4', note: 'Body 17–18px/1.75 for long reading; headlines 500 weight.' },
  humanist: { display: 'Nunito Sans', body: 'Nunito Sans', note: 'Larger x-height; body 16–17px/1.7; headlines 700.' },
  'display-serif': { display: 'Instrument Serif', body: 'Inter', note: 'Instrument Serif only at very large sizes; Inter everywhere else.' },
  'mono-accent': { display: 'Inter', body: 'Inter', mono: 'JetBrains Mono', note: 'Inter for prose; JetBrains Mono for figures, labels, code and anything tabular.' },
  condensed: { display: 'Barlow Condensed', body: 'Barlow', note: 'Barlow Condensed 700–800 uppercase for display, tight leading; Barlow 400 body.' },
  geometric: { display: 'Outfit', body: 'Outfit', mono: 'JetBrains Mono', note: 'Outfit 600 display with wide tracking on small caps labels; 400 body.' },
};

const LAYOUT_DIRECTION: Record<string, string> = {
  'immersive-scene': 'A fixed full-viewport WebGL canvas beneath everything; DOM sections scroll over it with deliberate transparency so the scene is seen through and between them. Chrome floats: wordmark top-left, one or two controls top-right, nothing across the top. The scene responds to scroll position for the whole page, not only the hero.',
  'split-stage': 'Two columns from tablet up: one holds a sticky scene or image that changes with each chapter, the other scrolls the content. On phones the stage becomes a pinned strip at the top. Chapters drive the stage: scrolling into a section changes what the stage shows.',
  'editorial-grid': 'A strict 12-column grid with visible gutters and hairline rules. Headlines span 8–12 columns, body 5–6. Images break the grid on purpose once per page. Numbers and captions in small caps along the rules.',
  'horizontal-journey': 'The main content is a horizontally pinned track: vertical scroll moves it sideways (GSAP ScrollTrigger pin + x translate). A progress rail shows chapters. Vertical sections before and after frame it. On phones it falls back to vertical chapters.',
  'stacked-cards': 'Each section is a card that pins while the next slides up over it, with a slight scale and dim on the one beneath. Rounded top corners on cards; the scene shows between them. Works natively on phones.',
  bento: 'A modular grid of tiles of differing span, each a small live thing: a stat that counts, a mini scene, a looping clip, a form. Tiles lift on hover; the grid reflows to one column on phones without losing the order of the story.',
  'long-scroll-story': 'One narrative page with pinned chapters; the scene advances with scroll (scrubbed), captions arrive per chapter, a thin progress line on the edge. Every section is a beat. Secondary pages are simple and fast.',
  'minimal-column': 'A single readable column (max 68ch) with generous vertical rhythm and occasional full-bleed breaks for imagery, a map, or the scene. The fastest to read and the easiest to keep honest; the hero still clears the hero rule.',
};

const MOTION_DIRECTION: Record<string, string> = {
  calm: 'Elements fade and rise 8–12px as they enter the viewport, 400ms, staggered 60ms, once. Interactive state 120–160ms. No pins.',
  expressive: 'Sequenced reveals: headlines split into lines and rise with a 40ms stagger; images unmask; numbers count. The scene reacts to scroll velocity. One pinned section per page at most. Beats 500–700ms.',
  cinematic: 'Scroll-linked sequences: pinned chapters, scrubbed scene progress, a hero that transforms as it leaves, page transitions. Beats 600–900ms. Every section has an entrance, and the entrances rhyme.',
};

const SCROLL_DIRECTION: Record<string, string> = {
  native: 'Native browser scroll. No smoothing library. Scroll-linked effects via ScrollTrigger reading the native position.',
  smooth: 'Lenis smooth scroll, wired to GSAP ticker, duration 1.1, easing ease-out-expo. Disabled under prefers-reduced-motion and on touch devices where native feels better.',
  pinned: 'Lenis plus ScrollTrigger pins: key sections hold while their content plays out (pinSpacing true), released cleanly. Never pin on phones below 640px.',
  scrub: 'Lenis plus ScrollTrigger with `scrub: true` driving the scene\'s progress uniform from 0 to 1 across the page; chapters mark what the scene does at each quarter.',
};

const HOVER_DIRECTION: Record<string, string> = {
  plain: 'Hover is colour and underline, 150ms. Focus rings visible and in the accent.',
  lift: 'Cards and buttons tilt 2–6° toward the pointer and lift with a deeper shadow from one consistent light source. Note the trap: `perspective` creates a containing block. 200ms ease-out.',
  magnetic: 'Primary buttons are magnetic within a 60px radius, translating up to 8px toward the pointer and springing back (spring stiffness 300, damping 20). Text inside moves a third as far.',
  reveal: 'Links and images reveal from under a mask on hover: a clip-path or a sliding panel in the accent, 350ms, with the image scaling from 1.08 to 1. Line links get an underline that draws left to right.',
  distort: 'Images in WebGL planes (drei Image or a custom shader) with a displacement or RGB-shift on hover, strength eased by pointer velocity; DOM fallback is a subtle scale. Budget carefully; keep to gallery and work pages.',
};

const CURSOR_DIRECTION: Record<string, string> = {
  system: 'The system cursor. No custom cursor.',
  dot: 'A 10px dot in the accent that follows the pointer with a slight lag (lerp 0.2) and grows to 40px over interactive elements, mixing blend-mode difference. Hidden on touch.',
  ring: 'A thin 36px ring lagging the pointer (lerp 0.12) with a dot at the true position; the ring tightens over links and fills on press. Hidden on touch.',
  label: 'A cursor that says what will happen: a small pill following the pointer reading View, Drag, Play, Open as appropriate, set via data-cursor attributes. Hidden on touch.',
};

const TRANSITION_DIRECTION: Record<string, string> = {
  instant: 'No page transition beyond the browser\'s own.',
  fade: 'A 250ms crossfade between routes via the View Transitions API with a CSS fallback.',
  wipe: 'A full-screen panel in the accent wipes in from the bottom, holds 120ms while the route changes, and wipes out to the top. 700ms total. Respect reduced motion: fall back to fade.',
  morph: 'Shared elements — the hero image, the title — travel to their new position with `view-transition-name`; everything else crossfades. Keep names unique per page.',
};

const GOAL_FUNNEL: Record<string, string[]> = {
  enquiries: ['land', 'view_work', 'start_enquiry', 'submit_enquiry'],
  bookings: ['land', 'view_service', 'open_booking', 'confirm_booking'],
  calls: ['land', 'view_service', 'tap_call'],
  sales: ['land', 'view_product', 'add_to_cart', 'begin_checkout', 'purchase'],
  signups: ['land', 'view_pricing', 'start_signup', 'complete_signup'],
  consultations: ['land', 'view_service', 'open_booking', 'confirm_booking'],
  subscribers: ['land', 'read_content', 'start_subscribe', 'confirm_subscribe'],
  donations: ['land', 'view_impact', 'choose_amount', 'complete_donation'],
};

const ANALYTICS_DIRECTION: Record<string, string> = {
  custom: 'The built-in provider is already wired: `track()` posts to `/api/events` and the CRM shows it. Keep it on.',
  vercel: 'Add `@vercel/analytics` (`<Analytics />` in the root layout) and `@vercel/speed-insights`. No configuration.',
  posthog: 'Initialise posthog-js in `instrumentation-client.ts` with `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST`, `capture_pageview: false`, and capture page views on route change. Register the PostHog provider in `lib/analytics.ts` so the same `track()` calls reach it.',
  ga4: 'Use `@next/third-parties/google` `<GoogleAnalytics gaId=… />` with `NEXT_PUBLIC_GA_ID`; register a GA provider in `lib/analytics.ts` that calls `gtag(\'event\', …)`. Add a small consent banner that defers loading until accepted.',
  plausible: 'Add the Plausible script with `data-domain` from `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`; register a provider that calls `window.plausible(name, {props})`.',
};

/* ---------------------------------------------------------------------------
   The master brief
--------------------------------------------------------------------------- */

export function masterBrief(spec: Spec): string {
  const arch = archetypeFor(spec.archetype);
  const sector = arch.sectors.find((s) => s.id === spec.sector);
  const scene = sceneFor(spec.scene);
  const listed = PALETTES.find((p) => p.id === spec.palette) ?? PALETTES[0];
  // Colours mixed by hand replace the palette they started from. The label
  // still matters in the brief, because "the Ember palette, moved" tells the
  // build something "five hex codes" does not.
  const cp = spec.customPalette;
  const palette = cp
    ? { label: `their own five (nearest listed: ${listed.label})`, swatch: [cp.bg, cp.fg, cp.accent, cp.muted, cp.surface] }
    : listed;
  const type = TYPE_DIRECTION[spec.typography] ?? TYPE_DIRECTION.grotesk;
  const funnel = GOAL_FUNNEL[spec.goal] ?? GOAL_FUNNEL.enquiries;
  const pages = spec.pages.map((p) => label(PAGES, p));
  const features = spec.features.map((f) => label(FEATURES, f));
  const d = spec.details ?? {};

  const out: string[] = [];
  const say = (...lines: string[]) => out.push(...lines, '');

  say(`# Brief: ${spec.name}`);
  say(
    'You are building a complete, production-quality website. The person who commissioned it does not write code and will judge it entirely on how it looks, how it feels to move through, and whether it brings them work. Treat this brief as the requirements document. Everything in it was chosen deliberately, by pressing things, and the choices are not suggestions.',
  );

  say('## The business', '',
    `- What it is: ${arch.label}${sector ? ` — ${sector.label}` : ''}`,
    `- Who the site is for: ${arch.audience}`,
    `- What the site must achieve: ${label(GOALS, spec.goal)}`,
    ...(d.tagline ? [`- How they describe themselves: "${d.tagline}"`] : []),
    ...(d.location ? [`- Where: ${d.location}`] : []),
    ...(d.founded ? [`- Since: ${d.founded}`] : []),
    ...(d.knownFor?.length ? [`- Known for: ${d.knownFor.join('; ')}`] : []),
    ...(d.offerings?.length ? [`- Offers: ${d.offerings.join('; ')}`] : []),
    ...(d.phone ? [`- Phone: ${d.phone}`] : []),
    ...(d.email ? [`- Email: ${d.email}`] : []),
    ...(d.hours ? [`- Hours: ${d.hours}`] : []),
    ...(d.instagram ? [`- Instagram: ${d.instagram}`] : []),
    ...(spec.notes ? [`- In their own words: ${spec.notes}`] : []),
  );

  say('## What it contains', '',
    `- Pages: ${pages.join(', ')}`,
    `- Features: ${features.length ? features.join(', ') : 'none beyond the pages'}`,
    `- Funnel to instrument, in order: ${funnel.join(' → ')}`,
  );

  say('## The organising idea', '',
    'Before anything else, decide the one idea the whole site commits to — the sentence a visitor would use to describe it to a friend. It must come from the business, not from the template. Write it at the top of README.md under "The idea" and make every later decision serve it. A site with a competent everything and no idea is the failure mode; a site with one strong idea and some rough edges is the success.',
  );

  say('## The signature move', '',
    spec.signature
      ? `They chose: ${said(SIGNATURES, spec.signature)}. Turn it into one interaction that belongs to this business, not a theme.`
      : 'They did not name one, so you decide — and it must come from this business, not from a library of effects.',
    '',
    spec.signature === 'decide' ? 'They asked you to choose it. Do, and say plainly which you picked and why it belongs to this business.' : '',
    'Every site this will be compared against has exactly one thing a visitor would screenshot and send to somebody: Lusion has physics you can throw, Bruno Simon has a car you drive around the portfolio, Active Theory has the transition that folds the page. Not five things. One.',
    '',
    'Decide it now, name it in one sentence in `design.config.ts` under `signature` and in README.md under "The signature move", and build it during the identity stage rather than leaving it for polish. It must be discoverable without instruction — on scroll or on the first pointer move, never behind a hidden gesture — it must degrade honestly on a phone and under reduced motion, and nothing else on the site may compete with it.',
    '',
    'Read the `scroll-craft` skill before choosing.',
  );

  say('## The scroll journey', '',
    spec.belief
      ? `**What a visitor must believe by the end:** ${said(beliefsFor(spec.goal), spec.belief)}`
      : 'Decide, in one sentence, what a visitor must believe by the end. Not a feature list — a belief. Write it in README.md.',
    '',
    spec.rhythm
      ? `**Where it should feel calm and where intense:** ${said(RHYTHMS, spec.rhythm)}`
      : '**Rhythm:** the page must breathe — an intense hero, a calm reading section, an intense chapter, a calm close. Three intense sections in a row read the same as none. Put the intensity where the decision is made.',
    '',
    'Write the beats in order before any markup: the four to eight things the reader should understand, with the evidence for the belief placed where they decide, not in a footer. Then give each beat a scroll device from `components/ui/Scroll.tsx` — `Pinned`, `HorizontalTrack`, `Counter`, `Focus`, `Draw`, `Marquee` — and never the same device twice in a row.',
    '',
    'The test for every section: cover the copy and scroll it. If nothing changed except position, it has not earned its scroll. Reveal-on-arrival is the baseline, not a device.',
    '',
    'Pace it. The commonest failure is a sequence that plays out in 300px of scroll, so the reader sees a flicker rather than a change. Pinned sequences want two to three viewport heights. Check by screenshotting four points through each one and looking at them.',
  );

  say(HERO_RULE);

  say(`## The scene: ${scene.label}`, '', scene.brief, '', `**Adapt it to this business:** ${scene.adapt}`, '',
    'The scene already exists as working code in `components/scenes/` — the same component the person previewed while choosing. Start from it. Change its geometry, material, palette behaviour and what it responds to so it belongs to this business and no other.',
    '',
    '**It does not stop at the fold.** Mount it with `<SceneLayer />` in the root layout, not `<SceneCanvas />` inside the hero: one fixed canvas beneath the whole document, with page content composited over it through `<SceneContent>`. Sections tell the scene what to do while they are on screen with `data-scene-frame="n"`, and dim it where they need to be read with `data-scene-dim="0.6"`. A canvas that dies after 100vh is the clearest single difference between a good dark page and an experience, and it is the thing every reference site does.',
    '',
    '**Portrait is a different composition, not a narrower one.** The scene receives `portrait` (true below 720px). Use it to move the camera, re-centre the subject and drop background elements. Shrinking a landscape composition crops the subject out of frame, which is how a strong hero becomes meaningless on a phone — check it by screenshotting at 390px and looking at the result.',
    '',
    'Keep the performance contract: lazy behind the designed poster, pixel ratio capped at 2, paused when the tab is hidden, a still composition under prefers-reduced-motion or without WebGL.',
  );

  say('## How it looks', '',
    `- Atmosphere — ${label(ATMOSPHERES, spec.atmosphere)}: ${ATMOSPHERE_DIRECTION[spec.atmosphere] ?? ATMOSPHERE_DIRECTION['plain-confident']}`,
    `- Palette — ${palette.label}: background ${palette.swatch?.[0]}, foreground ${palette.swatch?.[1]}, accent ${palette.swatch?.[2]}, muted ${palette.swatch?.[3]}, surface ${palette.swatch?.[4]}. These are in \`design.config.ts\` already. The accent is for emphasis and interactive state, never long text. Derive every other colour from these with color-mix; do not introduce a fourth hue.`,
    `- Typography — ${label(TYPOGRAPHY, spec.typography)}: ${type.display} for display, ${type.body} for body${type.mono ? `, ${type.mono} for figures and labels` : ''}. ${type.note} Fonts are already loaded in \`app/fonts.ts\`.`,
    `- Theme: ${spec.theme === 'both' ? 'both, following the system by default with a switch; both must be coherent' : spec.theme === 'light' ? 'light only' : 'dark only'}.`,
    `- Layout system — ${label(LAYOUTS, spec.layout)}: ${LAYOUT_DIRECTION[spec.layout] ?? LAYOUT_DIRECTION['immersive-scene']}`,
  );

  say('## How it moves', '',
    `- Intensity — ${label(MOTION_INTENSITY, spec.motionIntensity)}: ${MOTION_DIRECTION[spec.motionIntensity] ?? MOTION_DIRECTION.expressive}`,
    `- Scroll — ${label(SCROLL_STYLES, spec.scrollStyle)}: ${SCROLL_DIRECTION[spec.scrollStyle] ?? SCROLL_DIRECTION.smooth}`,
    `- Hover — ${label(HOVER_STYLES, spec.hoverStyle)}: ${HOVER_DIRECTION[spec.hoverStyle] ?? HOVER_DIRECTION.lift}`,
    `- Cursor — ${label(CURSOR_STYLES, spec.cursorStyle)}: ${CURSOR_DIRECTION[spec.cursorStyle] ?? CURSOR_DIRECTION.dot}`,
    `- Page transitions — ${label(TRANSITIONS, spec.transition)}: ${TRANSITION_DIRECTION[spec.transition] ?? TRANSITION_DIRECTION.fade}`,
    '- The motion system recurs. Whatever gesture the hero makes — the ease, the direction, the way the accent behaves — is the gesture of every reveal, hover and transition. Name it in `design.config.ts` under `motion` and use those values only.',
    '- Everything respects `prefers-reduced-motion`: motion becomes a fade or nothing, the scene becomes its still.',
  );

  if (spec.dna?.length) {
    say('## Reference, not imitation', '',
      'The person pointed at a website they admire. What follows is the extracted design DNA. Build something that shares its *qualities* — not its layout, not its copy, not a recognisable section of it. A reader who knows the reference must not be able to point at a part of this site and say "that is from there".',
      ...spec.dna.flatMap((r) => [
        '', `- Summary: ${r.summary}`, `- Palette feeling: ${r.palette.join(', ')}`, `- Type: ${r.typography.display} over ${r.typography.body}; ${r.typography.scale}`,
        `- Layout: ${r.layout}`, `- Motion: ${r.motion}`, `- 3D: ${r.threeD}`, `- Hero: ${r.hero}`,
        `- Keep the spirit of: ${r.keep.join('; ')}`, `- Avoid: ${r.avoid.join('; ')}`,
      ]),
    );
  }

  say('## Forms, analytics and the CRM', '',
    spec.crm === 'custom'
      ? 'Every form is a `<Form name="…">` posting to `/api/forms/[name]`, which validates, rate-limits and writes a lead plus an activity to the CRM at `/admin`. Map each form to a pipeline stage in `db/pipeline.ts` (contact → "New enquiry", booking → "Booking requested", newsletter → "Subscriber"). The CRM inherits `design.config.ts` — check `/admin` after changing tokens. Define the KPIs in `app/admin/kpis.ts` so they mean something to this business (for a restaurant: bookings this week, covers, no-shows; for a SaaS: signups, activation, MRR when Stripe exists).'
      : spec.crm === 'email'
        ? 'Forms post to `/api/forms/[name]`, which sends an email with Resend (`RESEND_API_KEY`, `CONTACT_EMAIL` in `.env.local`). Remove the `/admin` routes and the CRM database if they are not wanted — but leave `lib/analytics.ts` in place.'
        : 'No forms yet. Leave the intake routes in place but do not add forms to pages; the person can add them later from the chat.',
    '',
    `Analytics: ${spec.analytics.map((a) => `${label(ANALYTICS, a)} — ${ANALYTICS_DIRECTION[a] ?? ''}`).join(' ')}`,
    '',
    `Instrument the funnel with exactly these event names through \`track()\`: ${funnel.join(', ')}. Plus \`section_view\` with the section id, \`scroll_depth\` at 25/50/75/100, \`cta_click\` with the label. Nothing else fires by default.`,
  );

  say('## The pictures', '', imageryBrief(spec));

  say('## Performance, accessibility, honesty', '',
    '- Budget: Lighthouse Performance ≥ 85 on mobile with the scene lazy-loaded behind its poster; LCP under 2.5s; the WebGL bundle under 180KB gzipped; images via `next/image` at real sizes; fonts subset.',
    '- Keyboard reachable, visible focus, real contrast, semantic landmarks, alt text that describes.',
    '- Never invent testimonials, reviews, numbers, awards, clients or addresses. Where real content is missing, write honest placeholder copy in the voice of the business and mark it with `<!-- TODO: confirm -->` in the source and a checklist in README.md under "Things to confirm".',
    '- Keep `/admin` out of `robots.txt`, keep every secret server-only, keep the security headers in `next.config.ts`.',
  );

  say('## The rubric this will be judged against', '', RUBRIC);

  return out.join('\n').trimEnd();
}

export const RUBRIC = [
  '1. **Hero is an experience.** The first viewport is a full-screen scene or composition with floating chrome; something moves before interaction and responds to it.',
  '2. **Meaningful 3D.** The scene could belong to no other business. No generic spheres, torus knots, particle wallpaper, floating glass blobs.',
  '3. **One committed idea**, stated in README, visible on every page.',
  '4. **A motion system**, named in design.config.ts, recurring in reveals, hovers and transitions. Nothing moves in a way the hero did not establish.',
  '5. **Typography with a point of view**: viewport-scale display type, a real scale, correct measure, no default weights everywhere.',
  '6. **Palette discipline**: the tokens only; accent as emphasis; no AI-slop gradients, glassmorphism cards, purple-to-blue fades, or glowing orbs.',
  '7. **Layout system** followed, not a stack of equal bands.',
  '8. **Copy in the voice of the business**, specific, no "Welcome to our website", no filler.',
  '9. **Forms work end to end** and land in the CRM with the right stage; the CRM wears the site\'s tokens.',
  '10. **Performance and access**: reduced-motion, lazy WebGL with poster, budgets met, keyboard and contrast.',
  '11. **Security intact**: headers, validation, rate limit, admin auth, no secret client-side.',
  '12. **Mobile is designed, not shrunk**: the hero still works at 390px, the scene is recomposed for portrait rather than cropped, pins released, horizontal tracks fall back.',
  '13. **The scene is alive for the whole page**, not only the hero — mounted as a layer, following the chapters, dimmed where reading happens.',
  '14. **Every section earns its scroll.** Cover the copy and scroll it: if nothing changed but position, it fails. Sequences paced slowly enough to read.',
  '15. **A signature move**, named in design.config.ts and README, discoverable without instruction, with nothing competing with it.',
  '16. **No empty rectangles.** Everywhere a photograph would go holds either a real photograph or a composed plate. No stock imagery, no grey boxes, no dashed outlines.',
  '17. **Controls belong to the site**: no native select or date input anywhere, and dates, times and numbers in the business own locale.',
].join('\n');

/* ---------------------------------------------------------------------------
   What to do about the pictures — the answer that most often decides
   whether a finished site reads as finished.
--------------------------------------------------------------------------- */

function imageryBrief(spec: Spec): string {
  const im = spec.imagery;
  const lines: string[] = [];

  if (im?.kind === 'have' || im?.kind === 'some') {
    lines.push(
      im.folder
        ? `Photographs were provided and copied into \`public/media/\`, and are listed in README.md under "Assets".${im.describes ? ` They are of: ${im.describes}.` : ''}`
        : `They say they have photographs${im.describes ? ` — ${im.describes}` : ''} but have not supplied them yet.`,
      '',
      'Use them through `next/image` with real `sizes`, crop them deliberately rather than dropping them into a box, and caption them in small caps saying what the thing is. One image carrying a section beats four sharing it. Never upscale a small file into a full-bleed hero.',
    );
    if (im.kind === 'some') {
      lines.push('', 'Where a photograph is still missing, use `<Figure>` with no `src` at exactly the aspect ratio the real one will occupy, so nothing moves when it arrives — and list the shot that is needed in README.md under "Things to confirm", described well enough for them to go and take it.');
    }
  } else {
    lines.push(
      'There are no photographs, and there will not be any. That is a design brief, not a limitation: several of the sites this will be compared against have almost none.',
      '',
      'Design with type, colour, rule, real data and the scene. `<Figure>` in `components/ui/Figure.tsx` renders composed plates for exactly this — `type` (one word at 15–25vw, outlined, cropped by its frame; usually the best answer), `field`, `draft` (a measured technical drawing, very strong for products, spaces and processes) and `band`. Pass `seed={i}` across a run so three in a row are not identical.',
    );
    if (im?.instead?.length) lines.push('', `They picked these in particular: ${im.instead.map((d) => said(IMAGERY_DEVICES, d)).join('; ')}.`);
  }

  lines.push(
    '',
    '**The rule, either way: never render an empty rounded rectangle.** A grey box with a number in the corner, a `bg-surface` div with an aspect ratio and nothing inside it, a dashed outline saying "image" — that is the single most common reason a generated site reads as unfinished. If you are about to write a div whose only content is its own dimensions, use `<Figure>` instead.',
    '',
    '**And no stock photography.** No Unsplash, no Pexels, no offices, handshakes or laptops, nothing hotlinked. It reads as generated precisely because it is generic. Never invent a photograph of the owner, the premises, the team or a client, and never a logo wall of clients who have not been named.',
    '',
    'Read the `imagery` skill before building any section that wants a picture.',
  );

  return lines.join('\n');
}

/* ---------------------------------------------------------------------------
   Stages
--------------------------------------------------------------------------- */

export interface StageDef { id: string; label: string; blurb: string; prompt: (spec: Spec) => string }

const PREAMBLE = 'Read `BRIEF.md` and `CLAUDE.md` first if you have not this session. Work in this project only. When you finish the stage, run `npm run build` and fix anything it reports before declaring the stage done. End with one short paragraph saying what you did and what you chose, then the options block.';

export const STAGES: StageDef[] = [
  {
    id: 'identity', label: 'Identity and hero', blurb: 'Tokens, type, the organising idea, the scene adapted to the business',
    prompt: (spec) => [
      `Stage 1 of ${spec.review ? 5 : 4}: identity and the hero.`, '', PREAMBLE, '',
      '1. Decide the organising idea and the signature move. Write both in README.md — "The idea" in two sentences, "The signature move" in one — and put the signature into `design.config.ts` under `signature`. Read the `scroll-craft` skill first.',
      '2. Tune `design.config.ts`: keep the palette, set the type scale, radius, spacing rhythm and the motion values (durations, eases, the named gesture) so they match the atmosphere in the brief.',
      `3. Adapt the chosen scene (\`components/scenes/${sceneComponent(spec.scene)}.tsx\`) to this business exactly as the brief asks: geometry, material, what it responds to, what it means. Keep the SceneCanvas contract (poster, lazy, reduced motion, DPR cap, pause off-screen).`,
      '4. Mount the scene page-wide: `<SceneLayer />` in `app/layout.tsx` with the page inside `<SceneContent>`, not `<SceneCanvas />` inside the hero. The canvas must be alive under the whole document, following `data-scene-frame` on each section.',
      '5. Build the home page hero so it clears the hero rule: full viewport, floating chrome, type as part of the composition, something moving before any interaction. Build the signature move here too — it is not polish, it is the thing the site is remembered for.',
      '6. Design the poster still for the scene (`public/scene-poster.svg` or a rendered PNG) so the page is designed before WebGL loads.',
      '7. Run `npm run build`. Then screenshot the home page at both sizes: `npm run shot -- /` and `npm run shot -- / --mobile`, and look at both with the Read tool. Desktop: does the hero clear the rule? Mobile: is the *subject* of the scene still in frame, or has a landscape composition been cropped until it means nothing? Recompose for `portrait` rather than shrinking. Fix both before finishing.',
    ].join('\n'),
  },
  {
    id: 'pages', label: 'Pages and content', blurb: 'Every page, real copy in the business\'s voice, navigation, forms wired',
    prompt: (spec) => [
      `Stage 2 of ${spec.review ? 5 : 4}: every page.`, '', PREAMBLE, '',
      `Build these pages, in the layout system the brief names: ${spec.pages.map((p) => label(PAGES, p)).join(', ')}.`,
      `Features to include: ${spec.features.map((f) => label(FEATURES, f)).join(', ') || 'none beyond the pages'}.`,
      'Before writing any markup, write the beats of the home page in order in README.md under "The journey" — the four to eight things a reader should understand, and where the evidence for the belief sits. Then give each beat a scroll device from `components/ui/Scroll.tsx` (`Pinned`, `HorizontalTrack`, `Counter`, `Focus`, `Draw`, `Marquee`), never the same one twice in a row, and mark each section with `data-scene-frame` so the scene follows the story. Reveal-on-arrival is the baseline, not a device: a page whose only motion is things fading in has not earned its scroll.',
      'Every place a picture would go gets a real photograph or a composed `<Figure>` plate — never an empty rounded rectangle, never stock imagery. Read the `imagery` skill.',
      'Write real copy in the voice of the business from the brief: specific, short, no filler. Where a fact is unknown, write an honest placeholder and list it under "Things to confirm" in README.md.',
      'Every form is `<Form name="…">` posting to `/api/forms/[name]` with the right fields and a success state that tells the person it worked. Wire navigation (floating chrome, a menu that is a designed moment, a footer that earns its space), the sitemap, metadata and Open Graph images.',
      'Run `npm run build`, then `npm run shot -- /<each page>` and look at every screenshot. You are checking three things: the pages belong to the same site as the hero; no section is an empty rectangle; and no form shows an operating-system widget. Forms use `<Form>` — its select and date fields are the site\'s own controls in the site\'s own locale, so never reach for a raw `<select>` or `<input type="date">`.',
    ].join('\n'),
  },
  {
    id: 'motion', label: 'Motion system', blurb: 'Scroll, reveals, hovers, cursor, transitions — one recurring gesture',
    prompt: (spec) => [
      `Stage 3 of ${spec.review ? 5 : 4}: the motion system.`, '', PREAMBLE, '',
      'Implement the scroll style, hover style, cursor and page transition exactly as the brief describes, using the values in `design.config.ts` → `motion` and nothing else. Make the hero\'s gesture recur: the same ease and direction in section reveals, the accent behaving the same way on hover as it does in the scene.',
      'Then pace it. Run `npm run shot -- / --scroll` and look at all six frames in order. Two adjacent frames that are identical mean a section is not earning its scroll; a sequence that resolves entirely between two frames is too fast: if the reader cannot stop halfway and understand what they are seeing, the sequence is too fast — pinned sequences want two to three viewport heights, not one. The commonest complaint about work like this is that it plays out in a flick of the trackpad.',
      'Make the page breathe. If three sections in a row are intense, none of them stands out; put the intensity where the decision is made and let the reading sections be calm.',
      'Check every pinned or scrubbed section on a 390px viewport (`npm run shot -- / --mobile`), release pins there if the brief says so, and make sure `prefers-reduced-motion` turns everything into a fade or nothing — test by setting it in the shot script (`--reduced`).',
      'Run `npm run build`.',
    ].join('\n'),
  },
  {
    id: 'crm', label: 'CRM and analytics', blurb: 'Forms → leads → pipeline; KPIs that mean something; events wired',
    prompt: (spec) => [
      `Stage 4 of ${spec.review ? 5 : 4}: the CRM and analytics.`, '', PREAMBLE, '',
      spec.crm === 'custom'
        ? [
          'The CRM already has the machinery: every number is computed in one pass by `db/metrics.ts`, the charts are server-rendered SVG in `app/admin/charts.tsx`, and the colours come from `lib/ramp.ts`. You are not building a dashboard from nothing — you are making the one that is there mean something for *this* business.',
          '',
          '1. **Name the pipeline for this business** in `db/pipeline.ts`. A restaurant has "Booking requested → Confirmed → Seated → No-show", a builder has "Enquiry → Surveyed → Quoted → Won", a studio has "Brief → Proposal → Retained". Keep the ids stable and mark which stages count as won and lost. Map every form on the site to the stage it should land in.',
          '2. **Rewrite the headline numbers on `/admin` for this trade.** The four tiles at the top and the four below them are generic on purpose; replace them with the numbers whose owner would check them daily. Covers this week against a target. No-shows. Average spend. Repeat customers. Each tile needs a target somebody could actually hit and a sentence saying what it is.',
          '3. **Say what each figure means in the person\'s own words.** Every `Figure` takes a `note`. Use it. "Where people stop" is more use than "Funnel", and the owner of this business has never read the word "conversion".',
          '4. **Leave the chart rules alone.** One accent, so every scale is sequential: magnitude is lightness, identity is a label. Never a second y-axis. Never a number on every point. Every chart keeps its table twin. If you need a form that is not in `charts.tsx`, add it there in the same style rather than inlining an SVG in a page.',
          '5. **Seed nothing.** An empty dashboard must be honest and say what will appear there and when.',
          '',
          'Then look at it: `npm run shot -- /admin` and `npm run shot -- /admin/analytics`, and read both. It must wear the site\'s tokens, and it must be legible — a dashboard that is beautiful and unreadable is one nobody opens twice.',
        ].join('\n')
        : 'Confirm the forms reach their destination as the brief says and remove the CRM routes if they are not wanted.',
      `Wire analytics as the brief says (${spec.analytics.map((a) => label(ANALYTICS, a)).join(', ')}) through \`lib/analytics.ts\` so every \`track()\` reaches every provider chosen. Instrument the funnel events named in the brief.`,
      'Submit a test lead through the real contact form with `npm run test:forms` and confirm it appears in `/admin/leads`. Run `npm run build`.',
    ].join('\n'),
  },
  {
    id: 'review', label: 'Award jury', blurb: 'Score against the rubric; fix what fails',
    prompt: () => [
      'Stage 5 of 5: the review.', '', PREAMBLE, '',
      'You are now the jury, and you are a harsh one. Take fresh screenshots of every page at desktop and 390px (`npm run shot -- --all`) and read every one of them. Score the site 1–5 against each line of the rubric in BRIEF.md, honestly, in a table in `REVIEW.md`. Scoring your own work 4 everywhere is the failure mode of this stage; find the three worst things and say so plainly.',
      'Look for these specifically, because they are what the last builds got wrong: a scene that dies after the first viewport; sections that are empty rounded rectangles where a picture should be; a native select or `mm/dd/yyyy` date input in a form; a hero whose subject is cropped out of frame at 390px; a page whose only motion is things fading in; and no signature move at all.',
      'For every line under 4, fix it now — the hero first, then the signature move, then the scene through the page, then imagery, then scroll craft, then 3D meaning, then the idea, then motion, then type, then palette. Re-shoot and re-score after fixing.',
      'Then the CRM, which is half of what you built and gets looked at more often than the site: shoot `/admin` and `/admin/leads` and read them. Are the headline numbers the ones this owner would check daily, or the generic ones? Does every chart say what it means in their words? Is the empty state honest? Does it wear the site\'s own colours and type?',
      'Then the security list: grep the client bundle for any secret name, confirm headers in `next.config.ts`, confirm `/admin` needs a session, confirm rate limits and validation on every intake route, confirm `robots.txt` excludes `/admin`.',
      'Finish with the final scores and what changed.',
    ].join('\n'),
  },
];

export function stagesFor(spec: Spec): StageDef[] {
  return STAGES.filter((s) => s.id !== 'review' || spec.review);
}

/** The component file name for a scene id, matching design-library/scenes. */
export function sceneComponent(id: string): string {
  const map: Record<string, string> = {
    none: 'TypeScene', field: 'FieldScene', relief: 'ReliefScene', wordmark: 'WordmarkScene', object: 'ObjectScene',
    liquid: 'LiquidScene', diorama: 'DioramaScene', cloth: 'ClothScene', terrain: 'TerrainScene', morph: 'MorphScene',
    glass: 'GlassScene', exploded: 'ExplodedScene', ribbons: 'RibbonsScene',
  };
  return map[id] ?? 'FieldScene';
}

/* ---------------------------------------------------------------------------
   The system prompt every session runs under
--------------------------------------------------------------------------- */

export function systemPromptFor(projectName: string, opts: { stage?: string } = {}): string {
  return [
    `You are the designer-developer of "${projectName}", a website generated by Super Builds for somebody who does not write code. They see your replies in a chat beside a live preview and press buttons rather than type.`,
    '',
    'House rules:',
    '- This project was scaffolded from a template you should respect: `design.config.ts` is the only place colour, type, radius and motion values live; `components/scenes/` holds the hero scene; `lib/analytics.ts` is the only way events are sent; `/admin` is the CRM and must keep working; `db/` is Drizzle and queries are never string-built.',
    '- Read `BRIEF.md` and `CLAUDE.md` before making design decisions. The brief outranks your taste.',
    '- Keep secrets server-only. Never put a value in a prompt or a reply; refer to variables by name. Never read `.env*` files aloud.',
    '- Never kill a process you did not start. No `taskkill /im node`, `pkill node`, `killall node`: Super Builds and this conversation are Node processes.',
    '- Never delete or write outside this project folder.',
    '- Change as little as a request needs. Do not upgrade dependencies, reformat files or rename things in passing.',
    '- After a change that affects how a page looks, run `npm run build` (or at least `npx tsc --noEmit`) before replying; the preview is hot-reloading beside the person and a broken build is what they will see.',
    '',
    'How to reply:',
    '- Write for a non-coder: what you changed and where to look, in two to five short sentences. No file lists unless asked. No code unless asked.',
    '- When a request is ambiguous, make the choice a good designer would make, say what you chose, and offer the alternative as an option.',
    '- Always end your reply with a fenced block tagged `sb-options` containing a JSON array of 2 to 5 short follow-up messages the person might want to send next, phrased in the first person as they would say them (for example ["Make the hero text bigger", "Show me the contact page", "Publish it"]). Keep each under 60 characters. This block is turned into buttons; never put anything else after it.',
    ...(opts.stage ? ['', `Current generation stage: ${opts.stage}.`] : []),
  ].join('\n');
}

/* ---------------------------------------------------------------------------
   Quick actions
--------------------------------------------------------------------------- */

export const CHANGES: Choice[] = [
  { id: 'add-page', label: 'Add a page', icon: 'plus', blurb: 'A new page in the same design as the rest' },
  { id: 'add-feature', label: 'Add something it can do', icon: 'spark', blurb: 'A form, a gallery, booking, payments' },
  { id: 'restyle', label: 'Change how it looks', icon: 'palette', blurb: 'Colour, type, spacing, without rebuilding' },
  { id: 'content', label: 'Change the words or pictures', icon: 'edit', blurb: 'Copy, photographs, prices, hours' },
  { id: 'hero', label: 'Change the hero scene', icon: 'cube', blurb: 'A different 3D idea, or tune this one' },
  { id: 'fix', label: 'Something is wrong', icon: 'alert', blurb: 'It looks broken, or does not work' },
  { id: 'faster', label: 'Make it faster', icon: 'bolt', blurb: 'Images, fonts, whatever is slowing it down' },
  { id: 'mobile', label: 'Check it on a phone', icon: 'phone', blurb: 'Screenshots at 390px and fixes' },
  { id: 'crm', label: 'Change the CRM', icon: 'grid', blurb: 'Stages, the numbers on the dashboard, what each chart says' },
];

const CHANGE_DIRECTION: Record<string, string> = {
  'add-page': 'Add the page named below. Build it from the components and tokens the site already has: read `design.config.ts` and two existing pages first and match them exactly. Add it to the navigation and the sitemap.',
  'add-feature': 'Add the capability named below in the manner the rest of the site does things. Reuse the existing `<Form>`, error and success states, spacing. If it needs a key, read it from `process.env`, add a commented placeholder to `.env.local`, and say which variable to fill in — never ask for a value in the conversation.',
  restyle: 'Change the look through `design.config.ts` and `app/globals.css`, not by editing components. If something can only be changed by touching twenty components, that is a bug in the design system; fix that first. Keep both themes coherent if the site has two. Check `/admin` still looks right.',
  content: 'Change the words and images named below and nothing structural. Do not improve the layout, rename a component or reorganise a folder. The person asked for a copy change and any diff beyond that is noise they have to review.',
  hero: 'Change or tune the hero scene in `components/scenes/`. Keep the SceneCanvas contract (poster, lazy, reduced motion, DPR cap). If switching scenes, start from the corresponding component in `components/scenes/` and adapt it to the business as BRIEF.md describes. Re-shoot the home page and look at it.',
  fix: 'Diagnose before changing anything. Reproduce it (build, or shoot the page), say what the cause is, then make the smallest change that addresses the cause. If the real fix is large, say so before starting.',
  faster: 'Measure first: `npm run build` and read the route sizes. Fix the biggest thing: images at the wrong size, fonts not subset, a client component that should be a server one, a scene asset not compressed. Do not strip the motion to hit a number.',
  mobile: 'Take screenshots at 390px of every page (`npm run shot -- --all --mobile`), read them, and fix what is wrong: pins that should release, text that overflows, the hero that no longer clears the rule, tap targets under 44px.',
  crm: 'Change the CRM as asked through `db/pipeline.ts`, `app/admin/kpis.ts` and the admin components. Keep every form landing in a stage. The CRM must stay honest when empty.',
};

export function changeBrief(kind: string, targets: string[], notes: string | undefined, projectName: string): string {
  const out: string[] = [];
  const say = (...l: string[]) => out.push(...l, '');
  say(`# Change: ${projectName}`);
  say('This site already exists and somebody depends on it. You are making one specific change, chosen from a list, not reviewing the project or improving it generally.');
  say('## What they asked for', '', `**${label(CHANGES, kind)}**`, ...targets.map((t) => `- ${t}`));
  if (notes) say(`In their own words: ${notes}`);
  say('## How to do it', '', CHANGE_DIRECTION[kind] ?? CHANGE_DIRECTION.fix);
  say('## The fence', '',
    '- Change as little as possible. Every extra file in the diff is something the person has to understand.',
    '- Do not upgrade anything. No dependency bumps, no framework migration, no "while I was here".',
    '- Do not reformat, rename or move files unless the change literally is that.',
    '- Do not touch `.env.local` except to add a commented placeholder.',
    '- Never kill a process you did not start.',
    '',
    'Run the build afterwards and check the thing you changed plus one page you did not.',
  );
  return out.join('\n').trimEnd();
}

/* ---------------------------------------------------------------------------
   Bounded asks: clarifying questions, names, reference DNA
--------------------------------------------------------------------------- */

export const QUESTIONS_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array', minItems: 2, maxItems: 5,
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          question: { type: 'string' },
          why: { type: 'string' },
          options: { type: 'array', minItems: 2, maxItems: 5, items: { type: 'object', properties: { label: { type: 'string' }, hint: { type: 'string' } }, required: ['label'] } },
          multi: { type: 'boolean' },
        },
        required: ['id', 'question', 'options'],
      },
    },
  },
  required: ['questions'],
};

export function questionsPrompt(spec: Spec): string {
  const arch = archetypeFor(spec.archetype);
  return [
    'You help somebody who does not write code specify a website. They have chosen everything below by pressing buttons. Before it is built, ask the 2 to 5 things that only they can know and that would change the design — not things a designer can decide, not anything already answered.',
    'Every question must come with 2 to 5 answers to pick from, written as the person would say them, plus a short "why this matters". Mark a question multi if several answers can be true. Do not ask for the business name, colours, pages or features: those are chosen. Good questions: what they are best known for; who their ideal customer is; what a visitor should feel in the first three seconds; what they never want the site to look like; what the one number or fact is that proves they are good.',
    '', `Kind: ${arch.label}${spec.sector ? ` (${spec.sector})` : ''}. Goal: ${label(GOALS, spec.goal)}. Atmosphere: ${label(ATMOSPHERES, spec.atmosphere)}. Scene: ${sceneFor(spec.scene).label}.`,
    spec.details?.tagline ? `Tagline: ${spec.details.tagline}.` : '', spec.notes ? `Notes: ${spec.notes}` : '',
  ].filter(Boolean).join('\n');
}

export const NAMES_SCHEMA = {
  type: 'object',
  properties: { names: { type: 'array', minItems: 6, maxItems: 8, items: { type: 'object', properties: { name: { type: 'string' }, why: { type: 'string' } }, required: ['name'] } } },
  required: ['names'],
};

export function namesPrompt(spec: Spec): string {
  const arch = archetypeFor(spec.archetype);
  return `Suggest 6 to 8 business names for a ${arch.label.toLowerCase()}${spec.sector ? ` (${spec.sector})` : ''}${spec.details?.location ? ` in ${spec.details.location}` : ''} with a ${label(ATMOSPHERES, spec.atmosphere).toLowerCase()} feel. Short, pronounceable, not already famous brands, no puns that age badly. One line each on why.`;
}

/**
 * The extraction answers two things at once.
 *
 * The prose half is what a person reads: what this site is doing and why it
 * works. The `suggests` half is what the wizard uses: the nearest id in our own
 * catalogue for every choice it is about to ask. Splitting these into two calls
 * would double the cost and halve the agreement between them, because the
 * second call would be reasoning from the first call's summary rather than from
 * the screenshots.
 *
 * Every id is constrained by `enum`, so a hallucinated option cannot reach the
 * spec. A missing one is fine and means "no strong opinion".
 */
const HEX = { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' };

export const DNA_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    palette: { type: 'array', items: { type: 'string' } },
    typography: { type: 'object', properties: { display: { type: 'string' }, body: { type: 'string' }, scale: { type: 'string' } }, required: ['display', 'body', 'scale'] },
    layout: { type: 'string' },
    motion: { type: 'string' },
    threeD: { type: 'string' },
    hero: { type: 'string' },
    keep: { type: 'array', items: { type: 'string' } },
    avoid: { type: 'array', items: { type: 'string' } },
    suggests: {
      type: 'object',
      properties: {
        palette: { type: 'string', enum: PALETTES.map((c) => c.id) },
        typography: { type: 'string', enum: TYPOGRAPHY.map((c) => c.id) },
        atmosphere: { type: 'string', enum: ATMOSPHERES.map((c) => c.id) },
        layout: { type: 'string', enum: LAYOUTS.map((c) => c.id) },
        scene: { type: 'string', enum: SCENES.map((c) => c.id) },
        motionIntensity: { type: 'string', enum: MOTION_INTENSITY.map((c) => c.id) },
        scrollStyle: { type: 'string', enum: SCROLL_STYLES.map((c) => c.id) },
        hoverStyle: { type: 'string', enum: HOVER_STYLES.map((c) => c.id) },
        cursorStyle: { type: 'string', enum: CURSOR_STYLES.map((c) => c.id) },
        transition: { type: 'string', enum: TRANSITIONS.map((c) => c.id) },
        theme: { type: 'string', enum: THEMES.map((c) => c.id) },
        signature: { type: 'string' },
      },
    },
    customPalette: {
      type: 'object',
      properties: { bg: HEX, fg: HEX, accent: HEX, muted: HEX, surface: HEX },
      required: ['bg', 'fg', 'accent', 'muted', 'surface'],
    },
  },
  required: ['summary', 'palette', 'typography', 'layout', 'motion', 'threeD', 'hero', 'keep', 'avoid'],
};

function options(label: string, list: Choice[]): string {
  return `${label}: ${list.map((c) => `${c.id} (${c.label}${c.blurb ? ` — ${c.blurb}` : ''})`).join('; ')}`;
}

export function dnaPrompt(url: string, shots: string[], htmlSummary: string): string {
  return [
    `Study this website as a design critic: ${url}`,
    'Screenshots at successive scroll positions are at these paths — read every one with the Read tool before answering:',
    ...shots.map((s) => `- ${s}`),
    '', 'What its HTML reveals (fonts, libraries, meta):', htmlSummary.slice(0, 3000),
    '',
    'Answer the schema. `palette`: the four or five dominant colours as hex with a word each. `typography.scale`: how large display type runs relative to the viewport and how it is set. `layout`: the page\'s organising system in one sentence. `motion`: what moves, how, and what it responds to. `threeD`: what WebGL or depth is used for, or "none". `hero`: what the first viewport does. `keep`: 3–6 qualities worth carrying into a *different* site. `avoid`: 2–5 things that must not be copied because they are this site\'s signature.',
    '',
    'Then fill in `suggests`. Somebody is about to be asked these same questions about their own site, and your answers become the pre-selected options they will disagree with. Pick the nearest one in each list from what you actually saw — not what would flatter the site, and not what is most common. Leave a field out entirely rather than guess.',
    '',
    options('palette', PALETTES),
    options('typography', TYPOGRAPHY),
    options('atmosphere', ATMOSPHERES),
    options('layout', LAYOUTS),
    options('scene', SCENES),
    options('motionIntensity', MOTION_INTENSITY),
    options('scrollStyle', SCROLL_STYLES),
    options('hoverStyle', HOVER_STYLES),
    options('cursorStyle', CURSOR_STYLES),
    options('transition', TRANSITIONS),
    options('theme', THEMES),
    `signature: the one memorable move, as one short sentence, or one of these ids: ${SIGNATURES.map((c) => c.id).join(', ')}`,
    '',
    'Finally `customPalette`: this site\'s own five colours sampled from the screenshots, as six-digit hex — `bg` the page ground, `fg` the body text, `accent` the one colour used for emphasis, `muted` the quiet text, `surface` the raised panels. These are offered to the person as a starting point they can drag; they are not a licence to reproduce the site.',
  ].join('\n');
}

/* ---------------------------------------------------------------------------
   The plan shown before building
--------------------------------------------------------------------------- */

export function planFor(spec: Spec): Plan {
  const secrets: Plan['secrets'] = [];
  const caveats: string[] = [];
  for (const id of spec.analytics) {
    const a = ANALYTICS.find((x) => x.id === id);
    for (const key of a?.needs ?? []) secrets.push({ key, label: a!.label, where: `${a!.label} dashboard` });
    if (a?.caveat) caveats.push(`${a.label}: ${a.caveat}`);
  }
  const crm = CRM.find((c) => c.id === spec.crm);
  for (const key of crm?.needs ?? []) secrets.push({ key, label: crm!.label, where: 'your account' });
  if (crm?.caveat) caveats.push(`${crm.label}: ${crm.caveat}`);
  for (const id of spec.features) {
    const f = FEATURES.find((x) => x.id === id);
    for (const key of f?.needs ?? []) secrets.push({ key, label: f!.label, where: `${f!.label} provider` });
    if (f?.caveat) caveats.push(`${f.label}: ${f.caveat}`);
  }
  const scene = sceneFor(spec.scene);
  if (scene.weight === 'heavy') caveats.push(`${scene.label} is the heaviest kind of scene; the build will render it at lower resolution on phones.`);

  const stages = stagesFor(spec).map((s) => ({ id: s.id, label: s.label, blurb: s.blurb }));
  /*
    Calibrated on a real four-stage build (restaurant, diorama, four pages):
    57 minutes, 176 tool calls, about $30 of API-equivalent usage (the CLI's
    total_cost_usd is cumulative; the stages were roughly 6 / 8 / 7 / 8). The
    range is wide on purpose and says so.
  */
  const pagesN = spec.pages.length;
  const low = 8 + pagesN * 2.5 + (spec.review ? 8 : 0) + (scene.weight === 'heavy' ? 5 : scene.weight === 'medium' ? 3 : 0);
  const high = low * 2.2;

  return {
    brief: masterBrief(spec),
    stages,
    secrets,
    files: ['app/', 'components/scenes/', 'components/ui/', 'lib/analytics.ts', 'db/', 'app/admin/', 'design.config.ts', 'BRIEF.md', 'CLAUDE.md', 'README.md'],
    caveats,
    estimate: {
      lowUsd: Math.round(low), highUsd: Math.round(high),
      minutes: [25 + pagesN * 4 + (spec.review ? 10 : 0), 45 + pagesN * 8 + (spec.review ? 15 : 0)],
      caveat: 'A range, not a quote, and it is API-equivalent — on a Claude subscription it shows as usage, not a bill. A real four-page build took about an hour.',
    },
  };
}
