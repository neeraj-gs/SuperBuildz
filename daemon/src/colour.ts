/**
 * Making a sampled palette legible before anybody is offered it.
 *
 * ── The bug this exists for ────────────────────────────────────────────────
 *
 * A reference site is read and its five colours come back sampled from
 * screenshots. On a site that switches from a near-black hero into pale
 * chapters, "the page ground" and "the body text" are both defensible answers
 * and the model can hand back a light ground with light text. Adopt that and
 * the live preview goes blank, and if it survives to a build, so does the
 * site — the person pressed a button called "its colours" and got a page
 * nobody can read.
 *
 * A model can be told to be careful. It cannot be relied on to be, and this is
 * arithmetic, so it is done here: whatever comes back, body text clears 4.5:1
 * against its ground, quiet text and the accent clear 3:1, and panels are
 * distinguishable from the page. Everything else about the sample is left
 * exactly as it was — this repairs, it does not redesign.
 *
 * WCAG relative luminance, because that is the number the rule is written in.
 */

export interface Five { bg: string; fg: string; accent: string; muted: string; surface: string }

const HEX = /^#[0-9a-fA-F]{6}$/;

export function isHex(v: unknown): v is string { return typeof v === 'string' && HEX.test(v); }

export function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function hex([r, g, b]: [number, number, number]): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** WCAG relative luminance. */
export function luminance(colour: string): number {
  const [r, g, b] = rgb(colour).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1–21. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** A straight blend in sRGB. Good enough for nudging a colour towards a ground. */
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return hex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

/** Towards white or towards black, keeping the hue where it is. */
function push(colour: string, towardsLight: boolean, amount: number): string {
  return mix(colour, towardsLight ? '#ffffff' : '#000000', amount);
}

/**
 * The colour, moved along its own light/dark axis until it clears `want`
 * against the ground — and if it cannot (a mid grey on a mid grey), the
 * nearer of black and white.
 */
function legibleOn(ground: string, colour: string, want: number): string {
  if (contrast(ground, colour) >= want) return colour;
  const away = luminance(ground) > 0.5; // dark ground → lighten, light ground → darken
  const towardsLight = !away;
  for (let step = 0.08; step <= 1.0001; step += 0.08) {
    const moved = push(colour, towardsLight, step);
    if (contrast(ground, moved) >= want) return moved;
  }
  const black = contrast(ground, '#000000');
  const white = contrast(ground, '#ffffff');
  return black >= white ? '#000000' : '#ffffff';
}

/**
 * Five colours somebody can actually read.
 *
 * Returns undefined for anything that is not five six-digit hexes, which is
 * the same rule the spec itself applies: half a palette is worse than the one
 * it replaces.
 */
export function legiblePalette(p: Partial<Five> | undefined): Five | undefined {
  if (!p) return undefined;
  const { bg, fg, accent, muted, surface } = p;
  if (![bg, fg, accent, muted, surface].every(isHex)) return undefined;

  const ground = (bg as string).toLowerCase();

  /*
    The ground is never argued with, only the things written on it.

    Swapping ground and ink when the pair fails looks tempting and cannot
    work: contrast is symmetric, so the swapped pair fails by exactly the same
    number. And the ground is the one thing a screenshot makes unambiguous —
    it is most of the pixels. So the ground stands, and the ink moves along
    its own light/dark axis until it can be read, which keeps the sampled hue
    instead of replacing it with a colour nobody saw.
  */
  const ink = legibleOn(ground, (fg as string).toLowerCase(), 4.5);

  return {
    bg: ground,
    fg: ink,
    // Quiet text is still text: it has to clear the large-text rule at least.
    muted: legibleOn(ground, (muted as string).toLowerCase(), 3),
    // The accent is used as light — a state, a rule, one action. Below 3:1 it
    // stops being visible as any of those.
    accent: legibleOn(ground, (accent as string).toLowerCase(), 3),
    // A raised panel that is exactly the page is not a panel. Nudge it away
    // from the ground rather than towards a colour of our choosing.
    surface: contrast(ground, (surface as string).toLowerCase()) >= 1.06
      ? (surface as string).toLowerCase()
      : push(ground, luminance(ground) < 0.5, 0.07),
  };
}
