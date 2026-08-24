/**
 * What the site plugs into. Anything that needs a key says so by variable
 * name; values are written into the generated project's `.env.local` and never
 * into Super Builds.
 */

import type { Choice } from '@superbuilds/protocol';
import { analyticsChoices } from '../analytics.ts';

/**
 * Analytics comes from `analytics.ts`, which also knows each provider's keys
 * and its dashboard. Two lists drift; one does not.
 */
export const ANALYTICS: Choice[] = analyticsChoices();

export const CRM: Choice[] = [
  { id: 'custom', label: 'A CRM of your own at /admin', icon: 'grid', blurb: 'Pipeline, leads, activity, KPIs, funnels — in your site\'s own colours. Forms land here automatically.', caveat: 'Included. Runs locally with no account; on Vercel it needs a Postgres URL (free tiers exist).' },
  { id: 'email', label: 'Just email me', icon: 'mail', blurb: 'Every form becomes an email. No dashboard.', needs: ['RESEND_API_KEY', 'CONTACT_EMAIL'], caveat: 'Needs a free Resend account' },
  { id: 'none', label: 'No forms yet', icon: 'dots', blurb: 'Add it later from the chat' },
];

export const DEPLOY: Choice[] = [
  { id: 'vercel', label: 'Vercel', icon: 'vercel', blurb: 'Made by the people who make Next.js. Free for personal sites; you sign in through your own browser.', caveat: 'Super Builds never sees the token' },
  { id: 'local', label: 'Just this machine for now', icon: 'house', blurb: 'Runs here. Decide later; nothing about this is final.' },
];
