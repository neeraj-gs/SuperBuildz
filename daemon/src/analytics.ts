/**
 * Where the numbers go, and where the person goes to read them.
 *
 * ── Two halves, and the second one was missing ──────────────────────────────
 *
 * Choosing an analytics provider in the wizard only ever wrote a name into
 * `NEXT_PUBLIC_ANALYTICS`. The keys that make the name mean anything were left
 * as commented-out lines in `.env.local` with no way to fill them in, which is
 * the same as not offering the provider at all. So this module owns both
 * halves: what to switch on, and what each one needs before it works.
 *
 * ── Why a link is a legitimate answer ───────────────────────────────────────
 *
 * The built-in provider posts to the site's own `/api/events` and the numbers
 * appear in the CRM at /admin, which Super Builds can show. Everything else
 * keeps its numbers on someone else's server, behind someone else's login, and
 * pretending otherwise would mean shipping API credentials for six vendors and
 * a read-through cache — a month of work to render somebody else's dashboard
 * worse than they do. So for those, this module knows the URL of the real
 * dashboard and the site says: your numbers are here. Deep-linked to the
 * property where the provider's URL scheme allows it.
 *
 * The built-in one is always available and always free, so a site is never
 * left with no analytics at all because an account was not created.
 */

import type { AnalyticsProviderInfo, AnalyticsState, Choice } from '@superbuilds/protocol';
import { envEntries, setEnvValue } from './env.ts';
import { getProject } from './projects.ts';

/**
 * Every destination, with the keys it needs and the dashboard it lives on.
 *
 * `{host}` in a dashboard URL is replaced with the deployed domain when there
 * is one. Where a provider's dashboard cannot be deep-linked without an
 * account id we send the person to the top of it rather than guessing.
 */
export const PROVIDERS: AnalyticsProviderInfo[] = [
  {
    id: 'custom',
    label: 'Built in — your own CRM',
    icon: 'chart',
    blurb: 'Every page view, section, click and form lands in the /admin dashboard you own. No cookies, no third party, no account.',
    fields: [],
    builtin: true,
    caveat: 'Included. Nothing leaves your server.',
  },
  {
    id: 'vercel',
    label: 'Vercel Analytics',
    icon: 'vercel',
    blurb: 'Page views, referrers and Web Vitals, in the Vercel dashboard beside the deploy.',
    fields: [],
    dashboard: 'https://vercel.com/dashboard/analytics',
    caveat: 'Free tier included with a Vercel deploy. Nothing to paste.',
  },
  {
    id: 'netlify',
    label: 'Netlify Analytics',
    icon: 'globe',
    blurb: 'Server-side, counted from the CDN log — nothing to load in the browser, so ad blockers cannot hide traffic.',
    fields: [],
    dashboard: 'https://app.netlify.com/',
    caveat: 'Paid add-on, and only counts when the site is hosted on Netlify.',
  },
  {
    id: 'posthog',
    label: 'PostHog',
    icon: 'posthog',
    blurb: 'Product analytics: funnels, retention, session replay, feature flags.',
    fields: [
      { key: 'NEXT_PUBLIC_POSTHOG_KEY', label: 'Project API key', placeholder: 'phc_…', hint: 'Project settings → Project API key. Safe in the browser; it can only write.' },
      { key: 'NEXT_PUBLIC_POSTHOG_HOST', label: 'Host', placeholder: 'https://us.i.posthog.com', optional: true, hint: 'Leave blank for PostHog Cloud US.' },
    ],
    dashboard: 'https://us.posthog.com/',
    keysUrl: 'https://us.posthog.com/settings/project',
    caveat: 'Generous free tier; needs an account.',
  },
  {
    id: 'ga4',
    label: 'Google Analytics 4',
    icon: 'google',
    blurb: 'The one everybody has. Funnel steps are wired as events.',
    fields: [{ key: 'NEXT_PUBLIC_GA_ID', label: 'Measurement ID', placeholder: 'G-XXXXXXXXXX', hint: 'Admin → Data streams → your stream.' }],
    dashboard: 'https://analytics.google.com/',
    keysUrl: 'https://analytics.google.com/analytics/web/#/admin/streams/table',
    caveat: 'Free. Sets cookies, so most of Europe needs a consent banner.',
  },
  {
    id: 'plausible',
    label: 'Plausible',
    icon: 'plausible',
    blurb: 'Privacy-first and tiny. One page, no cookie banner needed.',
    fields: [{ key: 'NEXT_PUBLIC_PLAUSIBLE_DOMAIN', label: 'Domain', placeholder: 'yoursite.com', hint: 'Exactly as you added it in Plausible.' }],
    dashboard: 'https://plausible.io/{host}',
    keysUrl: 'https://plausible.io/sites',
    caveat: 'Paid after the trial.',
  },
  {
    id: 'amplitude',
    label: 'Amplitude',
    icon: 'chart',
    blurb: 'Behavioural analytics: cohorts, paths, retention curves.',
    fields: [{ key: 'NEXT_PUBLIC_AMPLITUDE_KEY', label: 'API key', placeholder: 'a1b2c3…', hint: 'Settings → Projects → your project → API key.' }],
    dashboard: 'https://app.amplitude.com/',
    keysUrl: 'https://app.amplitude.com/analytics/settings/projects',
    caveat: 'Free up to a generous event ceiling; needs an account.',
  },
  {
    id: 'mixpanel',
    label: 'Mixpanel',
    icon: 'chart',
    blurb: 'Event analytics with strong funnel and flow reports.',
    fields: [{ key: 'NEXT_PUBLIC_MIXPANEL_TOKEN', label: 'Project token', placeholder: '32 hex characters', hint: 'Settings → Project settings → Project token.' }],
    dashboard: 'https://mixpanel.com/report',
    keysUrl: 'https://mixpanel.com/settings/project',
    caveat: 'Free tier; needs an account.',
  },
  {
    id: 'umami',
    label: 'Umami',
    icon: 'chart',
    blurb: 'Open source and self-hostable. Privacy-friendly, no cookies.',
    fields: [
      { key: 'NEXT_PUBLIC_UMAMI_WEBSITE_ID', label: 'Website ID', placeholder: 'a UUID', hint: 'Settings → Websites → Edit → Website ID.' },
      { key: 'NEXT_PUBLIC_UMAMI_SRC', label: 'Script URL', placeholder: 'https://cloud.umami.is/script.js', optional: true, hint: 'Only if you host Umami yourself.' },
    ],
    dashboard: 'https://cloud.umami.is/',
    keysUrl: 'https://cloud.umami.is/settings/websites',
    caveat: 'Free if you host it; a cheap cloud plan if you would rather not.',
  },
  {
    id: 'fathom',
    label: 'Fathom',
    icon: 'chart',
    blurb: 'Simple, fast, privacy-first. One screen that says what happened.',
    fields: [{ key: 'NEXT_PUBLIC_FATHOM_SITE_ID', label: 'Site ID', placeholder: 'ABCDEFGH', hint: 'Settings → Sites → your site.' }],
    dashboard: 'https://app.usefathom.com/',
    keysUrl: 'https://app.usefathom.com/sites',
    caveat: 'Paid, no free tier.',
  },
  {
    id: 'simple',
    label: 'Simple Analytics',
    icon: 'chart',
    blurb: 'No cookies, no fingerprinting, one page of numbers.',
    fields: [],
    dashboard: 'https://dashboard.simpleanalytics.com/{host}',
    keysUrl: 'https://dashboard.simpleanalytics.com/',
    caveat: 'Paid after the trial. Nothing to paste — it reads the domain.',
  },
  {
    id: 'cloudflare',
    label: 'Cloudflare Web Analytics',
    icon: 'globe',
    blurb: 'Free, privacy-first, Core Web Vitals included.',
    fields: [{ key: 'NEXT_PUBLIC_CF_BEACON_TOKEN', label: 'Beacon token', placeholder: 'a 32-character token', hint: 'Cloudflare → Analytics → Web Analytics → your site.' }],
    dashboard: 'https://dash.cloudflare.com/',
    keysUrl: 'https://dash.cloudflare.com/',
    caveat: 'Free, and works on any host.',
  },
];

export function providerFor(id: string): AnalyticsProviderInfo | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

/**
 * The wizard's list, derived from the same registry.
 *
 * It used to be a separate hand-written array, which is how a wizard ends up
 * offering a provider the site cannot actually load.
 */
export function analyticsChoices(): Choice[] {
  return PROVIDERS.map((p) => ({
    id: p.id,
    label: p.label,
    icon: p.icon,
    blurb: p.blurb,
    caveat: p.caveat,
    ...(p.fields.length ? { needs: p.fields.filter((f) => !f.optional).map((f) => f.key) } : {}),
  }));
}

/** Environment variables a set of chosen providers needs filled in. */
export function keysNeededFor(ids: string[]): string[] {
  const out: string[] = [];
  for (const id of ids) for (const f of providerFor(id)?.fields ?? []) if (!f.optional) out.push(f.key);
  return [...new Set(out)];
}

function hostOf(projectId: string): string | undefined {
  const url = getProject(projectId)?.deploy?.url;
  if (!url) return undefined;
  try { return new URL(url).host; } catch { return undefined; }
}

/** Substitute the real domain into a dashboard URL, where the provider takes one. */
export function dashboardUrl(p: AnalyticsProviderInfo, host?: string): string | undefined {
  if (!p.dashboard) return undefined;
  if (!p.dashboard.includes('{host}')) return p.dashboard;
  // Without a domain the templated link would 404; send them to the top instead.
  if (!host) return p.dashboard.replace(/\/?\{host\}.*$/, '/');
  return p.dashboard.replace('{host}', host);
}

export function analyticsState(projectId: string): AnalyticsState {
  const project = getProject(projectId);
  if (!project) throw new Error('Unknown project.');
  const env = new Map(envEntries(project.path).map((e) => [e.key, e.value]));
  const declared = (env.get('NEXT_PUBLIC_ANALYTICS') ?? project.spec?.analytics?.join(',') ?? 'custom')
    .split(',').map((s) => s.trim()).filter((id) => PROVIDERS.some((p) => p.id === id));
  const filled: Record<string, string[]> = {};
  for (const p of PROVIDERS) filled[p.id] = p.fields.filter((f) => (env.get(f.key) ?? '').length > 0).map((f) => f.key);
  return { projectId, enabled: [...new Set(declared)], providers: PROVIDERS, filled, host: hostOf(projectId) };
}

/**
 * Switch providers on or off.
 *
 * Writing the list into `.env.local` rather than only into the spec is what
 * makes the change take effect without a rebuild: the site reads
 * `NEXT_PUBLIC_ANALYTICS` at boot, so a restart of the preview is enough.
 */
export function setAnalytics(projectId: string, ids: string[]): AnalyticsState {
  const project = getProject(projectId);
  if (!project) throw new Error('Unknown project.');
  const clean = [...new Set(ids.map(String).filter((id) => PROVIDERS.some((p) => p.id === id)))];
  setEnvValue(project.path, 'NEXT_PUBLIC_ANALYTICS', clean.join(','));
  return analyticsState(projectId);
}

/** Fill in one provider's keys. Values pass through memory into .env.local and are not kept. */
export function setAnalyticsKeys(projectId: string, values: Record<string, string>): AnalyticsState {
  const project = getProject(projectId);
  if (!project) throw new Error('Unknown project.');
  const allowed = new Set(PROVIDERS.flatMap((p) => p.fields.map((f) => f.key)));
  for (const [key, value] of Object.entries(values)) {
    if (!allowed.has(key)) throw new Error(`${key} is not a key any analytics provider asks for.`);
    if (typeof value !== 'string' || value.length > 400) throw new Error(`That value for ${key} does not look right.`);
    setEnvValue(project.path, key, value.trim());
  }
  return analyticsState(projectId);
}
