/**
 * The same page, in two places, told what it is allowed to do.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * The landing page is now both the tool's own front door and a page on the
 * internet, and those want different things from the same sections. Inside the
 * app, "Build a site" starts a build and the footer is a list of doors into the
 * product. On the public page there is no product to open — the visitor has not
 * got it yet — so the same press has to mean "get the app", and every one of
 * those doors would be a link to a screen that does not exist.
 *
 * The wrong way to do that is a `mode` prop threaded through fourteen
 * components, or worse, `display: none` on the buttons that do not apply.
 * Hidden navigation is still navigation: it ships in the bundle, it is in the
 * accessibility tree until you remember to hide it there too, and the first
 * person to press Tab finds it.
 *
 * So the actions are injected. The public build hands over a host whose
 * `start` opens the download panel and whose product links are simply absent,
 * and the components render what the host gives them. The difference is
 * structural rather than cosmetic, which is the only kind that survives.
 *
 * ── Why the default is the public one ───────────────────────────────────────
 *
 * Because the failure modes are not symmetrical. A public page that
 * accidentally renders an app control is a broken link on the internet; an app
 * that accidentally renders the public version of a button is a slightly odd
 * label. Forgetting the provider should fail in the harmless direction.
 */

import { createContext, useContext, type ReactNode } from 'react';

export interface LandingHost {
  /** `app` is the tool's own front door. `public` is the page on the internet. */
  mode: 'app' | 'public';
  /** Requirements are satisfied on this machine. Meaningless in public mode. */
  ready?: boolean;
  /** What the primary button says. The app and the internet want different words. */
  startLabel: string;
  /** The primary action: start a build, or go to the download block. */
  start(): void;
  /**
   * The rest are **optional on purpose**, and undefined is how the public page
   * says a control does not exist. Not disabled, not hidden — absent, so there
   * is nothing in the bundle, nothing in the accessibility tree, and nothing
   * for Tab to find.
   */
  revamp?: () => void;
  requirements?: () => void;
  /** Doors into the product, for the footer. Empty on the public page. */
  doors: Array<{ label: string; onClick: () => void }>;
}

/** What a page with no product behind it can do: ask for the app, and nothing else. */
const PUBLIC_FALLBACK: LandingHost = {
  mode: 'public',
  startLabel: 'Get the app',
  start: () => { document.getElementById('get')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
  doors: [],
};

const Ctx = createContext<LandingHost>(PUBLIC_FALLBACK);

export function LandingHostProvider({ host, children }: { host: LandingHost; children: ReactNode }) {
  return <Ctx.Provider value={host}>{children}</Ctx.Provider>;
}

export const useHost = () => useContext(Ctx);
