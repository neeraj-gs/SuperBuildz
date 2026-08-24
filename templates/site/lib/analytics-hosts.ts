/**
 * Which hosts each analytics provider needs, for the Content-Security-Policy.
 *
 * This is separate from `analytics-client.tsx` for one reason: `next.config.ts`
 * builds the CSP and cannot import a file with JSX in it. Keeping the host list
 * here means the policy and the loader are written from the same table, so
 * adding a provider cannot half-work — which is the specific failure where a
 * script tag is appended, the browser silently refuses it, and the dashboard
 * stays empty with no error anybody sees.
 *
 * No entry means no third-party host: `custom` posts to this site's own
 * endpoint, and `netlify` counts requests at the CDN with nothing in the page.
 */

export interface Hosts { script: string[]; connect: string[] }

export function analyticsHosts(ids: string[], env: Record<string, string | undefined> = {}): Hosts {
  const script: string[] = [];
  const connect: string[] = [];
  const on = (id: string) => ids.includes(id);

  if (on('vercel')) {
    script.push('https://va.vercel-scripts.com');
    connect.push('https://vitals.vercel-insights.com', 'https://va.vercel-scripts.com');
  }
  if (on('posthog')) {
    const host = env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
    script.push(host, 'https://us-assets.i.posthog.com', 'https://eu-assets.i.posthog.com');
    connect.push(host, 'https://us.i.posthog.com', 'https://eu.i.posthog.com');
  }
  if (on('ga4')) {
    script.push('https://www.googletagmanager.com');
    connect.push('https://www.google-analytics.com', 'https://analytics.google.com', 'https://www.googletagmanager.com');
  }
  if (on('plausible')) {
    script.push('https://plausible.io');
    connect.push('https://plausible.io');
  }
  if (on('amplitude')) {
    script.push('https://cdn.amplitude.com');
    connect.push('https://api2.amplitude.com', 'https://api.eu.amplitude.com');
  }
  if (on('mixpanel')) {
    script.push('https://cdn.mxpnl.com');
    connect.push('https://api-js.mixpanel.com', 'https://api.mixpanel.com');
  }
  if (on('umami')) {
    // Self-hosted Umami lives wherever the person put it, so the script URL
    // decides the host rather than a constant.
    const src = env.NEXT_PUBLIC_UMAMI_SRC || 'https://cloud.umami.is/script.js';
    try { const origin = new URL(src).origin; script.push(origin); connect.push(origin); } catch { /* a bad URL loads nothing anyway */ }
  }
  if (on('fathom')) {
    script.push('https://cdn.usefathom.com');
    connect.push('https://cdn.usefathom.com');
  }
  if (on('simple')) {
    script.push('https://scripts.simpleanalyticscdn.com');
    connect.push('https://queue.simpleanalyticscdn.com');
  }
  if (on('cloudflare')) {
    script.push('https://static.cloudflareinsights.com');
    connect.push('https://cloudflareinsights.com');
  }

  return { script: [...new Set(script)], connect: [...new Set(connect)] };
}
