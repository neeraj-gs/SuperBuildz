/**
 * What the site plugs into. Anything that needs a key says so by variable
 * name; values are written into the generated project's `.env.local` and never
 * into Super Builds.
 */

import type { Choice } from '@superbuilds/protocol';

export const ANALYTICS: Choice[] = [
  { id: 'custom', label: 'Built in — your CRM', icon: 'chart', blurb: 'Every event and every form lands in the /admin dashboard you own. No cookies, no third party.', caveat: 'Included. Nothing leaves the server.' },
  { id: 'vercel', label: 'Vercel Analytics', icon: 'vercel', blurb: 'Page views and Web Vitals in the Vercel dashboard. One line, privacy-friendly.', caveat: 'Works once the site is on Vercel' },
  { id: 'posthog', label: 'PostHog', icon: 'posthog', blurb: 'Product analytics, funnels, session replay, feature flags.', needs: ['NEXT_PUBLIC_POSTHOG_KEY', 'NEXT_PUBLIC_POSTHOG_HOST'], caveat: 'Free tier is generous; needs an account' },
  { id: 'ga4', label: 'Google Analytics', icon: 'google', blurb: 'GA4, with the funnel steps wired as events.', needs: ['NEXT_PUBLIC_GA_ID'], caveat: 'Needs a Google account and a cookie banner in most countries' },
  { id: 'plausible', label: 'Plausible', icon: 'plausible', blurb: 'Privacy-first, no cookie banner needed.', needs: ['NEXT_PUBLIC_PLAUSIBLE_DOMAIN'], caveat: 'Paid after the trial' },
];

export const CRM: Choice[] = [
  { id: 'custom', label: 'A CRM of your own at /admin', icon: 'grid', blurb: 'Pipeline, leads, activity, KPIs, funnels — in your site\'s own colours. Forms land here automatically.', caveat: 'Included. Runs locally with no account; on Vercel it needs a Postgres URL (free tiers exist).' },
  { id: 'email', label: 'Just email me', icon: 'mail', blurb: 'Every form becomes an email. No dashboard.', needs: ['RESEND_API_KEY', 'CONTACT_EMAIL'], caveat: 'Needs a free Resend account' },
  { id: 'none', label: 'No forms yet', icon: 'dots', blurb: 'Add it later from the chat' },
];

export const DEPLOY: Choice[] = [
  { id: 'vercel', label: 'Vercel', icon: 'vercel', blurb: 'Made by the people who make Next.js. Free for personal sites; you sign in through your own browser.', caveat: 'Super Builds never sees the token' },
  { id: 'local', label: 'Just this machine for now', icon: 'house', blurb: 'Runs here. Decide later; nothing about this is final.' },
];
