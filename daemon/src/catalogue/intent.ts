/**
 * The four questions that decide whether a site is memorable.
 *
 * Everything else in the catalogue is about how the site looks. These are
 * about what it is *for*, and they are the questions a good studio asks in the
 * first meeting: what must somebody believe by the end, what is the one thing
 * this site does that others do not, where should it feel calm and where
 * intense, and what pictures actually exist.
 *
 * They are asked as choices rather than as a text box, for the same reason
 * everything else here is. Somebody who has never commissioned a website
 * cannot answer "what should your signature interaction be?" from a blank
 * field — but they can recognise the right answer instantly when they see six
 * of them. Every list still ends with a way to say something else.
 */

import type { Choice } from '@superbuilds/protocol';

/* ---------------------------------------------------------------------------
   What must a visitor believe by the end
--------------------------------------------------------------------------- */

/** Keyed by goal, because the belief that matters depends on the ask. */
export const BELIEFS: Record<string, Choice[]> = {
  enquiries: [
    { id: 'safe-hands', label: 'These people know exactly what they are doing.' },
    { id: 'understood', label: 'They have solved my problem before, for someone like me.' },
    { id: 'worth-it', label: 'They cost more, and that is the point.' },
    { id: 'easy-start', label: 'Getting in touch will not turn into a sales process.' },
  ],
  bookings: [
    { id: 'worth-the-trip', label: 'This is worth going out of my way for.' },
    { id: 'right-tonight', label: 'This is the right place for the occasion I have in mind.' },
    { id: 'no-friction', label: 'Booking will take under a minute and be honoured.' },
    { id: 'regulars', label: 'The people who go here go back.' },
  ],
  calls: [
    { id: 'available', label: 'Someone will actually answer.' },
    { id: 'local-trusted', label: 'They are near me and people here use them.' },
    { id: 'no-cowboys', label: 'They will turn up, do it properly and not surprise me with a bill.' },
  ],
  sales: [
    { id: 'made-well', label: 'This is made better than the cheaper one.' },
    { id: 'for-me', label: 'This was made for someone exactly like me.' },
    { id: 'no-risk', label: 'If it is wrong, sending it back will be painless.' },
    { id: 'want-it', label: 'I want it, and I have stopped comparing.' },
  ],
  signups: [
    { id: 'obvious-value', label: 'I will get something useful before I pay anything.' },
    { id: 'serious-tool', label: 'This is built by people who use it themselves.' },
    { id: 'quick-start', label: 'I can have it working today, not next quarter.' },
  ],
  consultations: [
    { id: 'expertise', label: 'They know more about this than I do, and will say so plainly.' },
    { id: 'no-pressure', label: 'The first conversation is a conversation, not a pitch.' },
    { id: 'right-fit', label: 'They take the kind of work I have.' },
  ],
  subscribers: [
    { id: 'worth-inbox', label: 'This is worth a place in my inbox.' },
    { id: 'has-a-view', label: 'They have a point of view I do not get elsewhere.' },
    { id: 'not-spam', label: 'They will not sell my address or email me daily.' },
  ],
  donations: [
    { id: 'real-need', label: 'This need is real, and specific, and near.' },
    { id: 'money-lands', label: 'My money will reach it, and I will find out what it did.' },
    { id: 'small-matters', label: 'Even a small amount changes something.' },
  ],
};

export const BELIEFS_ANY: Choice[] = [
  { id: 'remember', label: 'I will remember this one.' },
  { id: 'care', label: 'Somebody cares about the details here.' },
  { id: 'honest', label: 'Nothing here is exaggerated.' },
];

export function beliefsFor(goal: string): Choice[] {
  return [...(BELIEFS[goal] ?? BELIEFS.enquiries), ...BELIEFS_ANY];
}

/* ---------------------------------------------------------------------------
   The signature move
--------------------------------------------------------------------------- */

/**
 * Deliberately concrete. "An interactive hero" is not a signature move;
 * "the fire answers your pointer and the whole page warms as you scroll" is,
 * because a build can either do it or fail to, and a visitor can either
 * notice it or not.
 */
export const SIGNATURES: Choice[] = [
  { id: 'subject-responds', label: 'The subject answers the pointer', blurb: 'The thing the business is about moves toward you, or away, as you move', icon: 'mouse' },
  { id: 'scroll-transforms', label: 'One object transforms down the page', blurb: 'It is built, taken apart, cooked, worn or finished as you scroll', icon: 'cube' },
  { id: 'sideways-journey', label: 'The page turns sideways', blurb: 'A chapter where scrolling down moves you along instead', icon: 'arrowRight' },
  { id: 'evidence-unlocks', label: 'Proof unlocks as you read', blurb: 'A counter of sources, awards or numbers that fills as you pass each one', icon: 'check' },
  { id: 'time-of-day', label: 'The site knows the time', blurb: 'Light, colour and copy change with the hour where the visitor is', icon: 'clock' },
  { id: 'the-room', label: 'You look around the room', blurb: 'The place itself, explorable — the pointer turns your head', icon: 'diorama' },
  { id: 'type-is-the-thing', label: 'The words are the object', blurb: 'The name is physical: extruded, lit, and moved by you', icon: 'wordmark' },
  { id: 'trail', label: 'You leave a trail', blurb: 'Ink, smoke, sparks or light follow the pointer and fade', icon: 'spark' },
  { id: 'before-after', label: 'Drag to see before and after', blurb: 'The visitor controls the reveal of the thing that changed', icon: 'sliders' },
  { id: 'live-number', label: 'Something real, live on the page', blurb: 'Tonight\'s covers, this week\'s stock, the queue — pulled fresh', icon: 'chart' },
  { id: 'decide', label: 'Let it decide for me', blurb: 'Claude picks the one that fits this business and names it', icon: 'sparkle' },
];

/* ---------------------------------------------------------------------------
   Rhythm
--------------------------------------------------------------------------- */

export const RHYTHMS: Choice[] = [
  {
    id: 'loud-then-calm', label: 'Loud, then calm',
    blurb: 'A hero that grabs, then quiet reading, one intense chapter near the decision',
  },
  {
    id: 'slow-build', label: 'A slow build',
    blurb: 'Restrained at the top and most intense at the end, just before the ask',
  },
  {
    id: 'calm-throughout', label: 'Calm the whole way',
    blurb: 'One committed hero and then nothing that competes with reading',
  },
  {
    id: 'alternating', label: 'Alternating',
    blurb: 'Intense, calm, intense, calm — every reading section framed by a moment',
  },
];

/* ---------------------------------------------------------------------------
   Pictures
--------------------------------------------------------------------------- */

export const IMAGERY_KINDS: Choice[] = [
  { id: 'none', label: 'None, and there will not be any', blurb: 'Design it with type, colour, rule and the 3D scene. Several award-winning sites have almost no photography.', icon: 'type' },
  { id: 'have', label: 'I have photographs', blurb: 'Point at a folder — they are copied into the project and used properly', icon: 'image' },
  { id: 'some', label: 'A few, more later', blurb: 'Use what there is; design the frames for the rest so nothing moves when they arrive', icon: 'frame' },
];

/**
 * What to put where a photograph would have gone. These are real components
 * in the template, not adjectives, so choosing one is choosing something that
 * will actually be built.
 */
export const IMAGERY_DEVICES: Choice[] = [
  { id: 'type', label: 'One word, enormous', blurb: 'A word from the business set at plate scale, outlined, cropped by its frame', icon: 'type' },
  { id: 'draft', label: 'A measured drawing', blurb: 'The thing described as a technical diagram on a hairline grid', icon: 'grid' },
  { id: 'field', label: 'A field of colour', blurb: 'One token colour with a single drawn mark', icon: 'palette' },
  { id: 'band', label: 'Bands', blurb: 'Two-tone diagonals — strongest in a run of three', icon: 'list' },
  { id: 'scene', label: 'The 3D scene', blurb: 'Let the scene be the picture in that section, rather than a plate', icon: 'cube' },
  { id: 'numbers', label: 'Real numbers and real words', blurb: 'A figure that counts up, or one sentence set large — as much weight as a photograph', icon: 'chart' },
];
