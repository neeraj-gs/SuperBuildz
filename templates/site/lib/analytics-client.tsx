'use client';

import { useEffect, useRef } from 'react';
import { builtinProvider, registerProvider, track } from './analytics';

/**
 * Registers whichever providers NEXT_PUBLIC_ANALYTICS names. Vercel's
 * component is rendered here; PostHog initialises in instrumentation-client.ts
 * and registers itself; GA4 and Plausible load their script tags here.
 */
const chosen = (process.env.NEXT_PUBLIC_ANALYTICS ?? 'custom').split(',').map((s) => s.trim()).filter(Boolean);

export function AnalyticsProviders() {
  useEffect(() => {
    if (chosen.includes('custom')) registerProvider(builtinProvider);
    if (chosen.includes('ga4') && process.env.NEXT_PUBLIC_GA_ID) {
      const id = process.env.NEXT_PUBLIC_GA_ID;
      const s = document.createElement('script'); s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`; document.head.appendChild(s);
      const w = window as unknown as { dataLayer: unknown[]; gtag?: (...a: unknown[]) => void };
      w.dataLayer = w.dataLayer || [];
      w.gtag = function () { w.dataLayer.push(arguments); }; // eslint-disable-line prefer-rest-params
      w.gtag('js', new Date()); w.gtag('config', id, { send_page_view: false });
      registerProvider({ name: 'ga4', track: (n, p) => w.gtag?.('event', n, p) });
    }
    if (chosen.includes('plausible') && process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN) {
      const s = document.createElement('script'); s.defer = true; s.dataset.domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN; s.src = 'https://plausible.io/js/script.manual.tagged-events.js'; document.head.appendChild(s);
      const w = window as unknown as { plausible?: (n: string, o?: unknown) => void };
      registerProvider({ name: 'plausible', track: (n, p) => w.plausible?.(n === 'page_view' ? 'pageview' : n, { props: p }) });
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
