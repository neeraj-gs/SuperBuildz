/**
 * Which of the three the visitor is on.
 *
 * Used to put their own platform first and mark it, which is the one piece of
 * personalisation a download row earns: three identical cards make everybody
 * read all three, and the answer is on the machine already.
 *
 * It is a guess and is treated as one. All three are always shown and all three
 * are always pressable — a wrong guess costs a highlight in the wrong place,
 * never a download somebody cannot reach. Unknown is a fine answer.
 */

export type PlatformId = 'windows' | 'mac' | 'linux';

export interface Platform {
  id: PlatformId;
  name: string;
  /** What arrives, said in the words the file actually has. */
  formats: string;
  icon: string;
}

export const PLATFORMS: Platform[] = [
  { id: 'windows', name: 'Windows', formats: '.exe installer · x64', icon: 'grid' },
  { id: 'mac', name: 'macOS', formats: '.dmg · Apple silicon and Intel', icon: 'cube' },
  { id: 'linux', name: 'Linux', formats: 'AppImage · .deb', icon: 'terminal' },
];

/**
 * `navigator.platform` is deprecated and `userAgentData` is Chromium-only, so
 * both are read and neither is trusted. The user agent is the fallback because
 * it is the one string every browser still has.
 *
 * iOS and Android deliberately return undefined rather than being folded into
 * the nearest desktop: this is a program that runs a build on your own machine,
 * and telling somebody on a phone that their platform is macOS would be a lie
 * with a download button under it.
 */
export function guessPlatform(ua: string, platformHint?: string): PlatformId | undefined {
  const s = `${platformHint ?? ''} ${ua}`.toLowerCase();

  if (/iphone|ipad|ipod|android/.test(s)) return undefined;
  // An iPad on desktop mode reports as a Mac, but it has no `MacIntel` and it
  // does have touch points — the only reliable tell, and the caller passes it.
  if (/win/.test(s)) return 'windows';
  if (/mac|darwin/.test(s)) return 'mac';
  if (/linux|x11|ubuntu|fedora|cros/.test(s)) return 'linux';
  return undefined;
}

/** What the browser can tell us about itself, in one place so it can be stubbed. */
export function currentPlatform(): PlatformId | undefined {
  if (typeof navigator === 'undefined') return undefined;
  const data = (navigator as { userAgentData?: { platform?: string } }).userAgentData;
  const hint = data?.platform ?? (navigator as { platform?: string }).platform;
  // An iPad pretending to be a Mac has touch points; a Mac has none.
  if (/mac/i.test(hint ?? '') && (navigator.maxTouchPoints ?? 0) > 2) return undefined;
  return guessPlatform(navigator.userAgent, hint);
}
