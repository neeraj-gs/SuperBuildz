/**
 * One event schema, any provider. Every event on the site goes through
 * `track()`; providers register themselves from analytics-client.tsx. The
 * built-in provider posts to /api/events, which the CRM reads. Event names
 * for the funnel are in BRIEF.md; these are the always-on ones:
 *
 *   page_view {path}   section_view {id}   scroll_depth {depth}
 *   cta_click {label}  form_start {form}   form_submit {form}
 */

export type EventProps = Record<string, string | number | boolean | undefined>;
export type Provider = { name: string; track: (name: string, props: EventProps) => void };

const providers: Provider[] = [];
const queue: Array<[string, EventProps]> = [];

export function registerProvider(p: Provider) {
  if (providers.some((x) => x.name === p.name)) return;
  providers.push(p);
  // Anything tracked before the provider arrived.
  for (const [n, props] of queue) { try { p.track(n, props); } catch {} }
}

export function track(name: string, props: EventProps = {}) {
  if (typeof window === 'undefined') return;
  const full = { ...props, ts: Date.now() };
  if (!providers.length) { queue.push([name, full]); if (queue.length > 50) queue.shift(); }
  for (const p of providers) { try { p.track(name, full); } catch {} }
}

/** The built-in provider: beacons to the site's own endpoint. */
export const builtinProvider: Provider = {
  name: 'custom',
  track(name, props) {
    const body = JSON.stringify({ name, props, path: location.pathname, ref: document.referrer || undefined, sid: sessionId() });
    if (navigator.sendBeacon) navigator.sendBeacon('/api/events', new Blob([body], { type: 'application/json' }));
    else void fetch('/api/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true });
  },
};

function sessionId(): string {
  try {
    let id = sessionStorage.getItem('sb:sid');
    if (!id) { id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36); sessionStorage.setItem('sb:sid', id); }
    return id;
  } catch { return 'anon'; }
}
