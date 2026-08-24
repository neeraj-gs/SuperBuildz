/**
 * Where the numbers are, when they are not here.
 *
 * ── The honest answer to "show me my analytics" ─────────────────────────────
 *
 * The built-in provider posts to this site's own `/api/events`, so its numbers
 * are on the page next to this file and there is nothing to link to. Every other
 * provider keeps its data on somebody else's server behind somebody else's
 * login, and rendering it here would mean shipping six vendors' read APIs, six
 * sets of server-side credentials, and a cache — a month of work to draw
 * somebody else's dashboard worse than they draw it.
 *
 * So this is a card and a link, and it says plainly which it is. A dashboard
 * that pretends to have data it cannot reach is worse than one that says "your
 * PostHog numbers are here" and takes you there in one press.
 *
 * The list mirrors `daemon/src/analytics.ts` in Super Builds, which is what
 * writes NEXT_PUBLIC_ANALYTICS in the first place.
 */

export interface Provider {
  id: string;
  label: string;
  blurb: string;
  /** `{host}` becomes this site's domain where the provider's URL takes one. */
  dashboard?: string;
  /** True for the one whose numbers are on this page already. */
  builtin?: boolean;
}

export const PROVIDERS: Provider[] = [
  { id: 'custom', label: 'Built in', blurb: 'Every page view, section, click and form. The numbers on this page.', builtin: true },
  { id: 'vercel', label: 'Vercel Analytics', blurb: 'Page views, referrers and Web Vitals, beside the deploy.', dashboard: 'https://vercel.com/dashboard/analytics' },
  { id: 'netlify', label: 'Netlify Analytics', blurb: 'Counted at the CDN, so ad blockers cannot hide traffic.', dashboard: 'https://app.netlify.com/' },
  { id: 'posthog', label: 'PostHog', blurb: 'Funnels, retention, session replay, feature flags.', dashboard: 'https://us.posthog.com/' },
  { id: 'ga4', label: 'Google Analytics', blurb: 'GA4, with this site\'s funnel steps wired as events.', dashboard: 'https://analytics.google.com/' },
  { id: 'plausible', label: 'Plausible', blurb: 'Privacy-first, one page, no cookie banner.', dashboard: 'https://plausible.io/{host}' },
  { id: 'amplitude', label: 'Amplitude', blurb: 'Cohorts, paths and retention curves.', dashboard: 'https://app.amplitude.com/' },
  { id: 'mixpanel', label: 'Mixpanel', blurb: 'Event analytics with strong funnel and flow reports.', dashboard: 'https://mixpanel.com/report' },
  { id: 'umami', label: 'Umami', blurb: 'Open source, privacy-friendly, no cookies.', dashboard: 'https://cloud.umami.is/' },
  { id: 'fathom', label: 'Fathom', blurb: 'One screen that says what happened.', dashboard: 'https://app.usefathom.com/' },
  { id: 'simple', label: 'Simple Analytics', blurb: 'No cookies, no fingerprinting.', dashboard: 'https://dashboard.simpleanalytics.com/{host}' },
  { id: 'cloudflare', label: 'Cloudflare Web Analytics', blurb: 'Free, privacy-first, Core Web Vitals included.', dashboard: 'https://dash.cloudflare.com/' },
];

/** Which are switched on for this site, in the order they were listed. */
export function chosenProviders(): Provider[] {
  const ids = (process.env.NEXT_PUBLIC_ANALYTICS ?? 'custom').split(',').map((s) => s.trim()).filter(Boolean);
  return ids.map((id) => PROVIDERS.find((p) => p.id === id)).filter((p): p is Provider => !!p);
}

/** A link to the provider's own dashboard, deep-linked where the URL allows. */
export function dashboardUrl(p: Provider, host?: string): string | undefined {
  if (!p.dashboard) return undefined;
  if (!p.dashboard.includes('{host}')) return p.dashboard;
  // Without a domain a templated link 404s; send them to the top instead.
  return host ? p.dashboard.replace('{host}', host) : p.dashboard.replace(/\/?\{host\}.*$/, '/');
}
