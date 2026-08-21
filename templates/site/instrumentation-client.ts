/**
 * Runs once in the browser before the app hydrates. PostHog initialises here
 * when it was chosen and registers itself as a provider, so every `track()`
 * reaches it. Page views are captured on route change by PageTransition.
 */
import { registerProvider } from '@/lib/analytics';

const chosen = (process.env.NEXT_PUBLIC_ANALYTICS ?? 'custom').split(',').map((s) => s.trim());
if (chosen.includes('posthog') && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  void import('posthog-js').then(({ default: posthog }) => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
      capture_pageview: false,
      capture_pageleave: true,
      persistence: 'localStorage+cookie',
    });
    registerProvider({ name: 'posthog', track: (n, p) => posthog.capture(n === 'page_view' ? '$pageview' : n, p) });
  });
}
