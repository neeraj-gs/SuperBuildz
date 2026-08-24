'use client';

import { useEffect, useRef } from 'react';
import { builtinProvider, registerProvider, track } from './analytics';

/**
 * Loads whichever destinations NEXT_PUBLIC_ANALYTICS names, and teaches each
 * one the site's own event vocabulary.
 *
 * ── Why most of these load from a CDN rather than npm ───────────────────────
 *
 * A provider that ships as a dependency is installed for every site whether or
 * not it is used, and eleven of them would add minutes to every scaffold and
 * megabytes to every lockfile for code that mostly never runs. These load a
 * script tag on demand, so a site with the built-in provider downloads nothing
 * at all. The hosts are allow-listed in the CSP from the same table
 * (lib/analytics-hosts.ts), which is what stops a silent refusal.
 *
 * ── One vocabulary ─────────────────────────────────────────────────────────
 *
 * Every provider is handed the same event names. Where a vendor insists on its
 * own name for the page view — `$pageview`, `pageview` — the adapter translates
 * it and nothing else in the site has to know.
 */
const chosen = (process.env.NEXT_PUBLIC_ANALYTICS ?? 'custom').split(',').map((s) => s.trim()).filter(Boolean);

/** Append a script once, and resolve when it has loaded. */
function loadScript(src: string, attrs: Record<string, string> = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.async = true; s.defer = true;
    for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`could not load ${src}`));
    document.head.appendChild(s);
  });
}

type W = Window & Record<string, unknown>;

export function AnalyticsProviders() {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const w = window as unknown as W;
    const env = process.env;

    if (chosen.includes('custom')) registerProvider(builtinProvider);

    // Netlify Analytics counts at the CDN. There is nothing to load, and that
    // is the whole selling point — no script means no ad blocker to dodge.

    if (chosen.includes('ga4') && env.NEXT_PUBLIC_GA_ID) {
      const id = env.NEXT_PUBLIC_GA_ID;
      void loadScript(`https://www.googletagmanager.com/gtag/js?id=${id}`).catch(() => {});
      const dl = (w.dataLayer = (w.dataLayer as unknown[]) ?? []) as unknown[];
      const gtag = (...a: unknown[]) => { dl.push(a); };
      w.gtag = gtag;
      gtag('js', new Date());
      gtag('config', id, { send_page_view: false });
      registerProvider({ name: 'ga4', track: (n, p) => gtag('event', n, p) });
    }

    if (chosen.includes('plausible') && env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN) {
      void loadScript('https://plausible.io/js/script.manual.tagged-events.js', { 'data-domain': env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN }).catch(() => {});
      registerProvider({ name: 'plausible', track: (n, p) => (w.plausible as ((n: string, o?: unknown) => void) | undefined)?.(n === 'page_view' ? 'pageview' : n, { props: p }) });
    }

    if (chosen.includes('amplitude') && env.NEXT_PUBLIC_AMPLITUDE_KEY) {
      void loadScript('https://cdn.amplitude.com/libs/analytics-browser-2.11.1-min.js.gz')
        .then(() => {
          const amp = w.amplitude as { init?: (k: string, o?: unknown) => void; track?: (n: string, p?: unknown) => void } | undefined;
          amp?.init?.(env.NEXT_PUBLIC_AMPLITUDE_KEY!, { defaultTracking: { pageViews: false } });
          registerProvider({ name: 'amplitude', track: (n, p) => amp?.track?.(n, p) });
        })
        .catch(() => {});
    }

    if (chosen.includes('mixpanel') && env.NEXT_PUBLIC_MIXPANEL_TOKEN) {
      void loadScript('https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js')
        .then(() => {
          const mp = w.mixpanel as { init?: (t: string, o?: unknown) => void; track?: (n: string, p?: unknown) => void } | undefined;
          mp?.init?.(env.NEXT_PUBLIC_MIXPANEL_TOKEN!, { track_pageview: false, persistence: 'localStorage' });
          registerProvider({ name: 'mixpanel', track: (n, p) => mp?.track?.(n, p) });
        })
        .catch(() => {});
    }

    if (chosen.includes('umami') && env.NEXT_PUBLIC_UMAMI_WEBSITE_ID) {
      const src = env.NEXT_PUBLIC_UMAMI_SRC || 'https://cloud.umami.is/script.js';
      void loadScript(src, { 'data-website-id': env.NEXT_PUBLIC_UMAMI_WEBSITE_ID, 'data-auto-track': 'false' }).catch(() => {});
      registerProvider({ name: 'umami', track: (n, p) => (w.umami as { track?: (n: string, p?: unknown) => void } | undefined)?.track?.(n, p) });
    }

    if (chosen.includes('fathom') && env.NEXT_PUBLIC_FATHOM_SITE_ID) {
      void loadScript('https://cdn.usefathom.com/script.js', { 'data-site': env.NEXT_PUBLIC_FATHOM_SITE_ID, 'data-auto': 'false' }).catch(() => {});
      const f = () => w.fathom as { trackPageview?: () => void; trackEvent?: (n: string, o?: unknown) => void } | undefined;
      // Fathom counts events, not properties. Sending the name alone is the
      // honest mapping; inventing a property bag it will throw away is not.
      registerProvider({ name: 'fathom', track: (n) => (n === 'page_view' ? f()?.trackPageview?.() : f()?.trackEvent?.(n)) });
    }

    if (chosen.includes('simple')) {
      void loadScript('https://scripts.simpleanalyticscdn.com/latest.js', { 'data-auto-collect': 'false' }).catch(() => {});
      registerProvider({ name: 'simple', track: (n) => (w.sa_event as ((n: string) => void) | undefined)?.(n) });
    }

    if (chosen.includes('cloudflare') && env.NEXT_PUBLIC_CF_BEACON_TOKEN) {
      // Cloudflare's beacon reports page views and Web Vitals and takes no
      // custom events, so it is loaded and then left alone.
      void loadScript('https://static.cloudflareinsights.com/beacon.min.js', { 'data-cf-beacon': JSON.stringify({ token: env.NEXT_PUBLIC_CF_BEACON_TOKEN }) }).catch(() => {});
    }
  }, []);

  return chosen.includes('vercel') ? <VercelBits /> : null;
}

function VercelBits() {
  // Loaded lazily so a site without Vercel never ships the code.
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return; done.current = true;
    void import('@vercel/analytics').then(({ inject, track: vt }) => { inject(); registerProvider({ name: 'vercel', track: (n, p) => { if (n !== 'page_view') vt(n, p as Record<string, string | number | boolean>); } }); }).catch(() => {});
    void import('@vercel/speed-insights').then(({ injectSpeedInsights }) => injectSpeedInsights()).catch(() => {});
  }, []);
  return null;
}

/** Fires section_view once when a section is seen. Used by Section. */
export function SectionView({ id }: { id: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current?.parentElement; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { track('section_view', { id }); io.disconnect(); } }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, [id]);
  return <span ref={ref} hidden />;
}
