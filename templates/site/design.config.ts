/**
 * design.config.ts — the single source of truth for how this site looks and moves.
 *
 * This is the template default; Super Builds overwrites it from the choices
 * made in the wizard. Change values here, not in components.
 */

export const design = {
  name: 'Your Site',
  archetype: 'other',
  theme: 'dark' as 'dark' | 'light' | 'both',
  palette: {
    id: 'ink',
    bg: '#0A0B0D',
    fg: '#EDE9E0',
    accent: '#C8FF3D',
    muted: '#6C6F78',
    surface: '#15171B',
    alt: { bg: '#EDE9E0', fg: '#0A0B0D', accent: '#C8FF3D', muted: '#6C6F78', surface: '#F3F1EC' },
  },
  type: {
    id: 'grotesk',
    display: 'Inter',
    body: 'Inter',
    mono: 'JetBrains Mono',
    displaySize: 'clamp(3rem, 9vw, 9.5rem)',
    displayTracking: '-0.035em',
    displayLeading: '0.92',
    bodySize: '1.0625rem',
    bodyLeading: '1.65',
    measure: '66ch',
  },
  shape: { radius: '8px', radiusLg: '16px', hairline: '1px' },
  space: { section: 'clamp(5rem, 14vh, 11rem)', gutter: 'clamp(1rem, 3vw, 2.5rem)' },
  motion: {
    intensity: 'expressive',
    scroll: 'smooth',
    hover: 'lift',
    cursor: 'dot',
    transition: 'fade',
    gesture: 'rise-and-settle',
    easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
    easeInOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
    fast: 160,
    base: 560,
    slow: 900,
    stagger: 60,
    rise: 24,
  },
  scene: { id: 'field', component: 'FieldScene', weight: 'medium' },
  layout: 'immersive-scene',
  atmosphere: 'plain-confident',
};

export type Design = typeof design;
