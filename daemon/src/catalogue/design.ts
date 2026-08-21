/**
 * How it should look and move — every choice expressed as a consequence rather
 * than an adjective. "Modern and clean" means nothing and is why generated
 * sites all look the same. Each entry here maps to a paragraph of concrete
 * direction in brief.ts: type scale, spacing, contrast, what moves and how far.
 */

import type { Choice } from '@superbuilds/protocol';

export const GOALS: Choice[] = [
  { id: 'enquiries', label: 'Get enquiries', blurb: 'A form, and a reason to fill it in', icon: 'mail' },
  { id: 'bookings', label: 'Get bookings', blurb: 'A calendar, and as few steps as possible', icon: 'calendar' },
  { id: 'calls', label: 'Get phone calls', blurb: 'The number, everywhere, tappable', icon: 'phone' },
  { id: 'sales', label: 'Sell something', blurb: 'Checkout, trust marks, no surprises', icon: 'bag' },
  { id: 'signups', label: 'Get signups', blurb: 'Free first, commitment later', icon: 'user' },
  { id: 'consultations', label: 'Book consultations', blurb: 'Qualify first, then a slot', icon: 'chat' },
  { id: 'subscribers', label: 'Grow an audience', blurb: 'One good reason to hand over an email', icon: 'bell' },
  { id: 'donations', label: 'Raise money', blurb: 'The need, the proof, the amount', icon: 'heart' },
];

export const PAGES: Choice[] = [
  { id: 'home', label: 'Home' }, { id: 'about', label: 'About' }, { id: 'contact', label: 'Contact' },
  { id: 'services', label: 'Services' }, { id: 'work', label: 'Work' }, { id: 'menu', label: 'Menu' },
  { id: 'shop', label: 'Shop' }, { id: 'product', label: 'Product detail' }, { id: 'pricing', label: 'Pricing' },
  { id: 'features', label: 'Features' }, { id: 'team', label: 'Team' }, { id: 'listings', label: 'Listings' },
  { id: 'classes', label: 'Classes' }, { id: 'programme', label: 'Programme' }, { id: 'courses', label: 'Courses' },
  { id: 'admissions', label: 'Admissions' }, { id: 'spaces', label: 'Spaces' }, { id: 'areas', label: 'Areas covered' },
  { id: 'results', label: 'Results' }, { id: 'impact', label: 'Impact' }, { id: 'cause', label: 'The cause' },
  { id: 'insights', label: 'Insights' }, { id: 'writing', label: 'Writing' }, { id: 'gallery', label: 'Gallery' },
  { id: 'docs', label: 'Docs' }, { id: 'blog', label: 'Blog' }, { id: 'changelog', label: 'Changelog' },
  { id: 'careers', label: 'Careers' }, { id: 'press', label: 'Press' }, { id: 'legal', label: 'Privacy and terms' },
];

export const FEATURES: Choice[] = [
  { id: 'contact-form', label: 'Contact form', icon: 'mail', blurb: 'Validated, and it tells you it worked. Lands in your CRM.' },
  { id: 'booking', label: 'Booking request', icon: 'calendar', blurb: 'Pick a date and a slot; you confirm from the CRM' },
  { id: 'payments', label: 'Payments', icon: 'card', blurb: 'Stripe checkout, receipts, refunds', caveat: 'Needs a Stripe account', needs: ['STRIPE_SECRET_KEY', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'] },
  { id: 'gallery', label: 'Image gallery', icon: 'image', blurb: 'Lightbox, lazy loading, real sizes' },
  { id: 'testimonials', label: 'Testimonials', icon: 'quote', blurb: 'Proof, placed where the doubt is' },
  { id: 'reviews', label: 'Reviews', icon: 'star', blurb: 'Ratings, and a link to the real ones' },
  { id: 'faq', label: 'FAQ', icon: 'help', blurb: 'The objections, answered before they are asked' },
  { id: 'map', label: 'Map and directions', icon: 'pin', blurb: 'Where you are, and how to get there' },
  { id: 'hours', label: 'Opening hours', icon: 'clock', blurb: 'Including whether you are open right now' },
  { id: 'newsletter', label: 'Email signup', icon: 'bell', blurb: 'Lands in the CRM as a subscriber' },
  { id: 'blog', label: 'Blog or articles', icon: 'doc', blurb: 'Markdown in, pages out' },
  { id: 'search', label: 'Search', icon: 'search', blurb: 'Across whatever there is a lot of' },
  { id: 'pricing-table', label: 'Pricing table', icon: 'table', blurb: 'Three tiers, one recommended' },
  { id: 'changelog', label: 'Changelog', icon: 'list', blurb: 'What shipped, and when' },
  { id: 'quote', label: 'Quote calculator', icon: 'calc', blurb: 'A rough price before they call' },
  { id: 'chat', label: 'Chat widget', icon: 'chat', blurb: 'Questions answered from the CRM' },
  { id: 'multilang', label: 'Two languages', icon: 'globe', blurb: 'Every page in a second language' },
  { id: 'dark-toggle', label: 'Theme switch', icon: 'moon', blurb: 'Light and dark, remembered' },
];

/**
 * Palettes as [background, foreground, accent, accent-2, surface]. Each was
 * checked for contrast at the body size; the accent is for emphasis and
 * interactive states, never for long text.
 */
export const PALETTES: Choice[] = [
  { id: 'ink', label: 'Ink', blurb: 'Near-black, bone, one volt of green', swatch: ['#0A0B0D', '#EDE9E0', '#C8FF3D', '#6C6F78', '#15171B'], tags: ['dark'] },
  { id: 'paper', label: 'Paper', blurb: 'Warm white, ink, a stroke of vermilion', swatch: ['#FAF7F1', '#16150F', '#D9442B', '#8C877A', '#F0ECE3'], tags: ['light'] },
  { id: 'obsidian', label: 'Obsidian', blurb: 'Black and white with electric blue', swatch: ['#050507', '#FFFFFF', '#3B6CFF', '#8A8F9C', '#111216'], tags: ['dark'] },
  { id: 'ember', label: 'Ember', blurb: 'Charcoal, cream, and heat', swatch: ['#15100D', '#F6EEE3', '#FF7A3D', '#A08F83', '#221A15'], tags: ['dark', 'warm'] },
  { id: 'slate', label: 'Slate', blurb: 'Blue-black, mist, a clear sky', swatch: ['#0F151C', '#E6ECF2', '#6DB3FF', '#7D8996', '#18212A'], tags: ['dark'] },
  { id: 'forest', label: 'Forest', blurb: 'Deep green, cream, lime', swatch: ['#0C1A13', '#F2EFE4', '#B7F46C', '#7E9385', '#13261C'], tags: ['dark', 'natural'] },
  { id: 'sand', label: 'Sand', blurb: 'Bone, espresso, terracotta', swatch: ['#F1EBE0', '#2B2119', '#C4613A', '#9A8B7B', '#E7DFD0'], tags: ['light', 'warm'] },
  { id: 'ultraviolet', label: 'Ultraviolet', blurb: 'Black, white, violet light', swatch: ['#07060B', '#F4F1FF', '#8B6CFF', '#8C88A3', '#120F1C'], tags: ['dark'] },
  { id: 'clean', label: 'Clean', blurb: 'White, navy, teal', swatch: ['#FFFFFF', '#0F1A2B', '#1FA89E', '#6B7A8C', '#F2F6F9'], tags: ['light'] },
  { id: 'rose', label: 'Rose', blurb: 'Off-white, plum, rose', swatch: ['#FBF5F4', '#2B1621', '#E2566E', '#9C7F88', '#F4E9EA'], tags: ['light', 'warm'] },
  { id: 'midnight-gold', label: 'Midnight gold', blurb: 'Navy, ivory, brass', swatch: ['#0B1220', '#F3EEE2', '#D4B36A', '#8290A8', '#141C2E'], tags: ['dark', 'luxury'] },
  { id: 'acid', label: 'Acid', blurb: 'Black, white, acid yellow', swatch: ['#0A0A0A', '#FAFAFA', '#E8FF3A', '#7A7A7A', '#151515'], tags: ['dark', 'loud'] },
  { id: 'mono', label: 'Mono', blurb: 'Pure black and white; one grey', swatch: ['#000000', '#FFFFFF', '#FFFFFF', '#8A8A8A', '#0E0E0E'], tags: ['dark', 'strict'] },
  { id: 'ocean', label: 'Ocean', blurb: 'Deep teal, foam, coral', swatch: ['#07232A', '#E8F4F2', '#FF8A6A', '#6F9A9A', '#0E3139'], tags: ['dark'] },
  { id: 'signal', label: 'Signal', blurb: 'White, black, red. Nothing else.', swatch: ['#FFFFFF', '#0A0A0A', '#E5251B', '#808080', '#F3F3F3'], tags: ['light', 'loud'] },
  { id: 'dusk', label: 'Dusk', blurb: 'Plum-black, peach, magenta', swatch: ['#14090F', '#FFE3D3', '#FF4FA3', '#9C7A86', '#22121A'], tags: ['dark', 'warm'] },
  { id: 'trade', label: 'Trade', blurb: 'Deep navy, white, safety orange', swatch: ['#10223A', '#FFFFFF', '#F59E2B', '#8CA0B8', '#1A2E4A'], tags: ['dark'] },
];

export const TYPOGRAPHY: Choice[] = [
  { id: 'grotesk', label: 'Modern sans', blurb: 'Inter or Geist. Neutral, reads anywhere', preview: 'grotesk' },
  { id: 'editorial', label: 'Editorial pair', blurb: 'A display serif over a clean sans', preview: 'editorial' },
  { id: 'brutal', label: 'Heavy display', blurb: 'Extra-bold wide grotesk at viewport scale', preview: 'brutal' },
  { id: 'serif-body', label: 'Serif throughout', blurb: 'Reads long, feels established', preview: 'serif' },
  { id: 'humanist', label: 'Humanist sans', blurb: 'Warmer, rounder, approachable', preview: 'humanist' },
  { id: 'display-serif', label: 'Big display serif', blurb: 'Headlines that carry the page', preview: 'display-serif' },
  { id: 'mono-accent', label: 'Sans with mono', blurb: 'Technical detail set apart', preview: 'mono' },
  { id: 'condensed', label: 'Condensed impact', blurb: 'Tall, tight, athletic', preview: 'condensed' },
  { id: 'geometric', label: 'Geometric future', blurb: 'Round, wide, precise', preview: 'geometric' },
];

export const ATMOSPHERES: Choice[] = [
  { id: 'quiet-gallery', label: 'Quiet gallery', blurb: 'The work is loud, so nothing else is' },
  { id: 'bold-editorial', label: 'Bold editorial', blurb: 'Big type, strong grid, magazine confidence' },
  { id: 'cinematic', label: 'Cinematic', blurb: 'Full-bleed, slow reveals, dark' },
  { id: 'technical', label: 'Technical', blurb: 'Dense, exact, monospace where it earns it' },
  { id: 'warm-direct', label: 'Warm and direct', blurb: 'Friendly, plain, gets to the point' },
  { id: 'plain-confident', label: 'Plain and confident', blurb: 'No decoration, nothing hidden' },
  { id: 'calm', label: 'Calm', blurb: 'Generous space, soft edges, reassuring' },
  { id: 'kinetic', label: 'Kinetic', blurb: 'Motion, energy, high contrast' },
  { id: 'appetite', label: 'Appetite', blurb: 'Close-up, warm light, texture' },
  { id: 'retail', label: 'Retail', blurb: 'Product first, price clear, buy obvious' },
  { id: 'establishment', label: 'Establishment', blurb: 'Sober, spacious, quietly expensive' },
  { id: 'futurist', label: 'Futurist', blurb: 'Lab-precise, luminous, engineered' },
];

/** Layout systems: how the whole page is organised, not how one section looks. */
export const LAYOUTS: Choice[] = [
  { id: 'immersive-scene', label: 'Immersive scene', blurb: 'The scene fills the screen and stays; content scrolls over and through it. Floating chrome.', preview: 'immersive' },
  { id: 'split-stage', label: 'Split stage', blurb: 'A sticky scene on one half; the story scrolls on the other.', preview: 'split' },
  { id: 'editorial-grid', label: 'Editorial grid', blurb: 'A strict magazine grid: big type, asymmetric spreads, hairline rules.', preview: 'editorial' },
  { id: 'horizontal-journey', label: 'Horizontal journey', blurb: 'Chapters slide sideways as you scroll down. A progress rail keeps you placed.', preview: 'horizontal' },
  { id: 'stacked-cards', label: 'Stacked cards', blurb: 'Each section pins and the next slides over it, like a deck.', preview: 'stacked' },
  { id: 'bento', label: 'Bento', blurb: 'A modular grid of live tiles, each a small interaction.', preview: 'bento' },
  { id: 'long-scroll-story', label: 'Long-scroll story', blurb: 'One narrative scroll with pinned chapters and a scene that advances with you.', preview: 'story' },
  { id: 'minimal-column', label: 'Minimal column', blurb: 'A single readable column with full-bleed breaks. Fastest to read.', preview: 'column' },
];

export const MOTION_INTENSITY: Choice[] = [
  { id: 'calm', label: 'Calm', blurb: 'Things arrive as you reach them. Nothing shouts.' },
  { id: 'expressive', label: 'Expressive', blurb: 'Sequenced reveals, split headlines, a scene that reacts.' },
  { id: 'cinematic', label: 'Cinematic', blurb: 'Pinned sequences, scroll-scrubbed scenes, transitions between pages.' },
];

export const SCROLL_STYLES: Choice[] = [
  { id: 'native', label: 'Native', blurb: 'The browser\'s own scroll. Instant, familiar.' },
  { id: 'smooth', label: 'Smooth', blurb: 'Lenis easing. Heavier, more premium.' },
  { id: 'pinned', label: 'Pinned chapters', blurb: 'Sections hold while their content plays out.' },
  { id: 'scrub', label: 'Scroll-scrubbed', blurb: 'The 3D scene advances exactly with the scroll position.' },
];

export const HOVER_STYLES: Choice[] = [
  { id: 'plain', label: 'Plain', blurb: 'Colour and underline. Honest.' },
  { id: 'lift', label: 'Lift', blurb: 'A 2–6° tilt and a deeper shadow.' },
  { id: 'magnetic', label: 'Magnetic', blurb: 'Buttons pull towards the pointer.' },
  { id: 'reveal', label: 'Reveal', blurb: 'Images and lines slide out from under a mask.' },
  { id: 'distort', label: 'Distort', blurb: 'Images ripple under the pointer in WebGL.', weight: 'heavy' },
];

export const CURSOR_STYLES: Choice[] = [
  { id: 'system', label: 'System', blurb: 'The cursor people already have.' },
  { id: 'dot', label: 'Dot', blurb: 'A small dot that grows over links.' },
  { id: 'ring', label: 'Ring', blurb: 'A ring that lags the pointer.' },
  { id: 'label', label: 'Labelled', blurb: 'The cursor says what it does: View, Drag, Play.' },
];

export const TRANSITIONS: Choice[] = [
  { id: 'instant', label: 'Instant', blurb: 'No page transition.' },
  { id: 'fade', label: 'Fade', blurb: 'A short crossfade between pages.' },
  { id: 'wipe', label: 'Curtain', blurb: 'A coloured panel wipes across.' },
  { id: 'morph', label: 'Morph', blurb: 'Shared elements travel to their new place.' },
];

export const THEMES: Choice[] = [
  { id: 'dark', label: 'Dark only' },
  { id: 'light', label: 'Light only' },
  { id: 'both', label: 'Both, with a switch', blurb: 'Follows the visitor\'s system by default' },
];
