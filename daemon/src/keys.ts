/**
 * "It needs a key." Asked for, rather than mentioned.
 *
 * ── The failure this replaces ───────────────────────────────────────────────
 *
 * A site that will not draw because `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is not
 * set is a fifteen-second fix and a dead end, in that order. Everything the
 * tool could do about it was a sentence: the preview panel said the name of
 * the variable, Claude said the name of the variable in a paragraph half way up
 * a transcript nobody reads to the end, and both then pointed at a file editor.
 * Which is to say the tool knew exactly what was wrong, knew exactly what would
 * fix it, and made somebody who does not write code go and edit a dotfile.
 *
 * A key is the one thing in this product that genuinely cannot be chosen from a
 * list — it has to be typed, once. So it gets the only treatment that makes
 * sense: a field, with the name of the service, a link to the page the key is
 * on, and a sentence saying where the value goes.
 *
 * ── Where "needed" comes from ───────────────────────────────────────────────
 *
 * Four sources, and the distinction between *needed* and *available* is the
 * whole of it — a tool that demands every optional key is a tool people learn
 * to dismiss.
 *
 *   the preview     the browser said the site would not start without it.
 *                   The strongest signal there is: the site is broken now.
 *   a placeholder   a commented, empty line in the project's own `.env.local`.
 *                   That is the convention Claude is told to follow when it
 *                   adds something that needs a key, so it means "I built this
 *                   and it is waiting for you".
 *   the example     an *uncommented* entry in `.env.example` that `.env.local`
 *                   does not have. Commented entries there are the menu, not
 *                   the bill, and are never asked for.
 *   Claude          an `sb-notice` block naming the variable. See `notices.ts`.
 *
 * ── What is never asked for ─────────────────────────────────────────────────
 *
 * The four Super Builds writes itself. Asking somebody to invent a
 * `SESSION_SECRET` or paste back a scrypt hash is asking a question whose only
 * correct answer is the one already on disk.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { KeyRequest, KeyField, SiteHealth } from '@superbuilds/protocol';
import { envEntries, setEnvValue } from './env.ts';
import { PROVIDERS } from './analytics.ts';
import { DEV_PASSWORD_KEY } from './admin.ts';

/** Written by the scaffold, derived, or owned by a screen of its own. */
const OURS = new Set(['SESSION_SECRET', 'ADMIN_PASSWORD_HASH', 'ADMIN_EMAIL', 'SITE_NAME', 'NEXT_PUBLIC_ANALYTICS', DEV_PASSWORD_KEY]);

/**
 * Services a generated site plausibly reaches for, and where their keys live.
 *
 * Matched on the variable name. Analytics is deliberately absent: those keys
 * already have a catalogue with labels, placeholders and dashboard links in
 * `analytics.ts`, and two lists of the same thing drift the moment one is
 * edited. It is folded in below instead.
 */
interface Service {
  /** Matches the whole variable name, or a distinctive part of it. */
  match: RegExp;
  name: string;
  what: string;
  keysUrl?: string;
  placeholder?: string;
}

const SERVICES: Service[] = [
  { match: /^NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY$/, name: 'Clerk', what: 'lets people sign in to the site', keysUrl: 'https://dashboard.clerk.com/last-active?path=api-keys', placeholder: 'pk_test_…' },
  { match: /^CLERK_SECRET_KEY$/, name: 'Clerk', what: 'lets the server check who is signed in', keysUrl: 'https://dashboard.clerk.com/last-active?path=api-keys', placeholder: 'sk_test_…' },
  { match: /\bCLERK\b/, name: 'Clerk', what: 'signing in', keysUrl: 'https://dashboard.clerk.com/last-active?path=api-keys' },

  { match: /^NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY$/, name: 'Stripe', what: 'shows the payment form in the browser', keysUrl: 'https://dashboard.stripe.com/apikeys', placeholder: 'pk_live_…' },
  { match: /^STRIPE_SECRET_KEY$/, name: 'Stripe', what: 'takes the payment on the server', keysUrl: 'https://dashboard.stripe.com/apikeys', placeholder: 'sk_live_…' },
  { match: /^STRIPE_WEBHOOK_SECRET$/, name: 'Stripe', what: 'proves a payment notification really came from Stripe', keysUrl: 'https://dashboard.stripe.com/webhooks', placeholder: 'whsec_…' },
  { match: /\bSTRIPE\b/, name: 'Stripe', what: 'payments', keysUrl: 'https://dashboard.stripe.com/apikeys' },

  { match: /^RESEND_API_KEY$/, name: 'Resend', what: 'sends the emails your forms trigger', keysUrl: 'https://resend.com/api-keys', placeholder: 're_…' },
  { match: /^SENDGRID_API_KEY$/, name: 'SendGrid', what: 'sends the emails your forms trigger', keysUrl: 'https://app.sendgrid.com/settings/api_keys', placeholder: 'SG.…' },
  { match: /^POSTMARK_(?:API_)?TOKEN$/, name: 'Postmark', what: 'sends the emails your forms trigger', keysUrl: 'https://account.postmarkapp.com/servers' },

  { match: /^DATABASE_URL$/, name: 'your database', what: 'is where leads and form submissions are stored once the site is published', keysUrl: 'https://console.neon.tech/', placeholder: 'postgres://user:pass@host/db' },
  { match: /\bSUPABASE\b/, name: 'Supabase', what: 'your database and storage', keysUrl: 'https://supabase.com/dashboard/project/_/settings/api' },
  { match: /^(?:UPSTASH|REDIS)_/, name: 'Upstash', what: 'rate limiting and caching', keysUrl: 'https://console.upstash.com/' },

  { match: /^NEXT_PUBLIC_(?:GOOGLE_)?MAPS_API_KEY$|\bGOOGLE_MAPS\b/, name: 'Google Maps', what: 'draws the map on the contact page', keysUrl: 'https://console.cloud.google.com/google/maps-apis/credentials' },
  { match: /\bMAPBOX\b/, name: 'Mapbox', what: 'draws the map', keysUrl: 'https://console.mapbox.com/account/access-tokens/', placeholder: 'pk.…' },

  { match: /\bCLOUDINARY\b/, name: 'Cloudinary', what: 'stores and resizes your images', keysUrl: 'https://console.cloudinary.com/settings/api-keys' },
  { match: /\bUPLOADTHING\b/, name: 'UploadThing', what: 'handles file uploads', keysUrl: 'https://uploadthing.com/dashboard' },

  { match: /^OPENAI_API_KEY$/, name: 'OpenAI', what: 'powers whatever the site asks a model to do', keysUrl: 'https://platform.openai.com/api-keys', placeholder: 'sk-…' },
  { match: /^ANTHROPIC_API_KEY$/, name: 'Anthropic', what: 'powers whatever the site asks a model to do', keysUrl: 'https://console.anthropic.com/settings/keys', placeholder: 'sk-ant-…' },

  { match: /\bTWILIO\b/, name: 'Twilio', what: 'sends text messages', keysUrl: 'https://console.twilio.com/' },
  { match: /\bALGOLIA\b/, name: 'Algolia', what: 'the search box', keysUrl: 'https://dashboard.algolia.com/account/api-keys/all' },
  { match: /\bTURNSTILE\b/, name: 'Cloudflare Turnstile', what: 'keeps bots out of your forms', keysUrl: 'https://dash.cloudflare.com/?to=/:account/turnstile' },
  { match: /\bRECAPTCHA\b/, name: 'reCAPTCHA', what: 'keeps bots out of your forms', keysUrl: 'https://www.google.com/recaptcha/admin' },
  { match: /\bSANITY\b/, name: 'Sanity', what: 'where the site reads its words and pictures from', keysUrl: 'https://www.sanity.io/manage' },
  { match: /\bCONTENTFUL\b/, name: 'Contentful', what: 'where the site reads its words and pictures from', keysUrl: 'https://app.contentful.com/' },
  { match: /\bSHOPIFY\b/, name: 'Shopify', what: 'your products and checkout', keysUrl: 'https://admin.shopify.com/' },
  { match: /^(?:AUTH|NEXTAUTH)_SECRET$/, name: 'sign-in', what: 'signs the session cookie. Any long random string will do', placeholder: 'a long random string' },
  { match: /^(?:AUTH|NEXTAUTH)_URL$/, name: 'sign-in', what: 'is the address the site is served from', placeholder: 'http://localhost:3000' },
  { match: /^CONTACT_EMAIL$/, name: 'your inbox', what: 'is where form submissions are emailed', placeholder: 'you@yourbusiness.com' },
];

/** The analytics catalogue, keyed by variable name, so it is not written twice. */
function analyticsField(name: string): KeyField | undefined {
  for (const p of PROVIDERS) {
    const f = p.fields.find((x) => x.key === name);
    if (!f) continue;
    return {
      name,
      label: `${p.label} — ${f.label}`,
      what: f.hint ?? p.blurb,
      keysUrl: p.keysUrl,
      placeholder: f.placeholder,
      secret: !name.startsWith('NEXT_PUBLIC_'),
    };
  }
  return undefined;
}

/**
 * Everything worth saying about one variable, whether or not it is recognised.
 *
 * An unrecognised key is still perfectly askable — it just gets no link, and
 * the honest label is its own name. Refusing to ask for what it does not
 * recognise would make this useless for the interesting half of the world.
 */
export function describeKey(name: string): KeyField {
  const fromAnalytics = analyticsField(name);
  if (fromAnalytics) return fromAnalytics;

  const service = SERVICES.find((s) => s.match.test(name));
  const secret = !name.startsWith('NEXT_PUBLIC_');
  if (!service) {
    return { name, label: name, what: 'The site asks for this and has not got it.', secret };
  }
  return {
    name,
    label: name,
    service: service.name,
    what: `${service.name} ${service.what}.`,
    keysUrl: service.keysUrl,
    placeholder: service.placeholder,
    secret,
  };
}

/* ------------------------------------------------------------- detection -- */

/** Commented, empty declarations: `# STRIPE_SECRET_KEY=` — the placeholder convention. */
function placeholders(projectPath: string): string[] {
  const file = join(projectPath, '.env.local');
  if (!existsSync(file)) return [];
  const out: string[] = [];
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*#\s*([A-Z][A-Z0-9_]{1,63})\s*=\s*(.*)$/.exec(raw);
    // A commented line with a value in it is a note somebody left, not a request.
    if (m && !m[2].trim()) out.push(m[1]);
  }
  return out;
}

/** Uncommented entries in the example the project ships with. */
function fromExample(projectPath: string): string[] {
  for (const name of ['.env.example', '.env.local.example']) {
    const file = join(projectPath, name);
    if (!existsSync(file)) continue;
    return readFileSync(file, 'utf8')
      .split('\n')
      .map((l) => /^\s*([A-Z][A-Z0-9_]{1,63})\s*=/.exec(l)?.[1])
      .filter((k): k is string => !!k);
  }
  return [];
}

/**
 * What this project is waiting for.
 *
 * `health` is the preview's last look at the site — when it named a variable,
 * that one goes first and says why, because "your site is blank right now" is a
 * different sentence from "this will matter when you publish".
 */
export function keysNeeded(projectPath: string, health?: SiteHealth): KeyRequest[] {
  const filled = new Set(envEntries(projectPath).filter((e) => e.value.trim()).map((e) => e.key));
  const seen = new Set<string>();
  const out: KeyRequest[] = [];

  const add = (name: string, from: KeyRequest['from'], urgent: boolean, why?: string) => {
    if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(name)) return;
    if (OURS.has(name) || filled.has(name) || seen.has(name)) return;
    seen.add(name);
    out.push({ ...describeKey(name), from, urgent, why });
  };

  if (health?.missingEnv) {
    add(health.missingEnv, 'preview', true, 'The site is blank right now because this is missing.');
  }
  for (const name of placeholders(projectPath)) add(name, 'placeholder', false, 'Something in the site was built to use this and is waiting for it.');
  for (const name of fromExample(projectPath)) add(name, 'example', false, 'The project lists this as one it needs.');

  return out;
}

/**
 * Write the values in.
 *
 * The values are a parameter, a file write, and then gone: nothing here
 * returns them, logs them, broadcasts them or puts them in a transcript. The
 * caller gets back the names it accepted, which is the most that can be said
 * about a secret without saying the secret.
 */
export function fillKeys(projectPath: string, values: Record<string, unknown>): string[] {
  const written: string[] = [];
  for (const [name, raw] of Object.entries(values)) {
    if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(name)) throw new Error(`${name} is not a shape an environment variable comes in.`);
    if (OURS.has(name)) throw new Error(`${name} is written by Super Builds itself and is not set from here.`);
    if (typeof raw !== 'string') throw new Error(`The value for ${name} is not text.`);
    // A newline would end the line and start another declaration.
    const value = raw.replace(/[\r\n]+/g, ' ').trim();
    if (!value) continue;
    if (value.length > 4096) throw new Error(`That value for ${name} is too long to be a key.`);
    if (!setEnvValue(projectPath, name, value)) throw new Error(`Could not write ${name}.`);
    written.push(name);
  }
  return written;
}
