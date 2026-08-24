/**
 * Everything the dashboard knows, computed once.
 *
 * ── Why one pass ────────────────────────────────────────────────────────────
 *
 * The overview wants a dozen numbers off the same two tables. Twelve queries
 * for twelve panels is twelve round trips and twelve chances for two panels to
 * disagree about what "the last 30 days" means. So the rows come back once and
 * everything is derived here, in JavaScript, which also keeps it dialect-neutral
 * — the same code runs against the local SQLite file and against Postgres on a
 * host, and neither has to grow a `date_trunc` that the other lacks.
 *
 * The cost is honest: this reads up to 20,000 events into memory. On a site with
 * more traffic than that in a month, the right answer is a rollup table written
 * nightly, and the place to add it is here.
 */

import { db, sql } from './index';
import { STAGES } from './pipeline';
import type { Lead } from './schema';

export interface Series { label: string; value: number }

export interface Metrics {
  /** The window these cover, in days. */
  days: number;
  /* Headline counts, this window and the one before it. */
  now: Window;
  before: Window;
  /* Time series over the window, one entry per day, oldest first. */
  byDay: Array<{ day: string; label: string; views: number; visitors: number; leads: number }>;
  /** Seven rows (Mon-first) by twenty-four hours, in the site's own timezone. */
  heat: number[][];
  heatMax: number;
  /** Where they came from, biggest first. */
  sources: Series[];
  /** Which pages they read. */
  pages: Series[];
  /** Which form they filled in. */
  forms: Series[];
  /** How many are sitting in each stage right now. */
  pipeline: Array<{ id: string; label: string; n: number; value: number; won?: boolean; lost?: boolean }>;
  /** The always-on events, in funnel order. */
  funnel: Array<{ label: string; n: number }>;
  /** Median hours from arriving to the first thing the owner did. */
  medianResponseHours: number | null;
  /** Leads that have sat untouched for more than two days. */
  stale: Lead[];
  /** Everything that has happened, newest first. */
  newest: Lead[];
}

export interface Window {
  views: number;
  visitors: number;
  leads: number;
  won: number;
  lost: number;
  /** Money in the open pipeline. */
  openValue: number;
  wonValue: number;
  /** Visits that reached a form. */
  reachedForm: number;
}

const DAY = 86_400_000;
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const stageMeta = (id: string) => STAGES.find((s) => s.id === id);

export async function metrics(days = 30, locale = 'en-GB', timeZone?: string): Promise<Metrics> {
  const now = Date.now();
  const from = now - days * DAY;
  const prevFrom = from - days * DAY;

  const [rawEvents, leadRows, activityRows] = await Promise.all([
    db.all<{ at: number; name: string; path: string; sid: string; ref: string }>(
      sql`select at, name, path, sid, ref from events where at >= ${prevFrom} order by at desc limit 20000`,
    ),
    db.all<Record<string, unknown>>(sql`select * from leads where archived = 0 order by created_at desc limit 5000`),
    db.all<{ lead_id: string; at: number; by_who: string }>(
      sql`select lead_id, at, by_who from activities where by_who = 'owner' order by at asc limit 5000`,
    ),
  ]);

  /*
    The owner reading their own dashboard is not traffic.

    Without this, every visit to /admin counted as a page view, /admin appeared
    in "which pages they read", and the person checking their numbers was the
    largest single contributor to them.
  */
  const events = rawEvents.filter((e) => !e.path.startsWith('/admin'));

  const leads = leadRows.map(toLead);
  const inWindow = <T extends { at?: number; createdAt?: number }>(x: T, start: number, end: number) => {
    const t = x.at ?? x.createdAt ?? 0;
    return t >= start && t < end;
  };

  const windowFor = (start: number, end: number): Window => {
    const ev = events.filter((e) => e.at >= start && e.at < end);
    const views = ev.filter((e) => e.name === 'page_view').length;
    const visitors = new Set(ev.map((e) => e.sid).filter(Boolean)).size;
    const reachedForm = new Set(ev.filter((e) => e.name === 'form_start').map((e) => e.sid)).size;
    const ls = leads.filter((l) => inWindow(l, start, end));
    const won = ls.filter((l) => stageMeta(l.stage)?.won).length;
    const lost = ls.filter((l) => stageMeta(l.stage)?.lost).length;
    return {
      views, visitors, reachedForm, leads: ls.length, won, lost,
      openValue: ls.filter((l) => !stageMeta(l.stage)?.won && !stageMeta(l.stage)?.lost).reduce((n, l) => n + l.value, 0),
      wonValue: ls.filter((l) => stageMeta(l.stage)?.won).reduce((n, l) => n + l.value, 0),
    };
  };

  /* Per day, oldest first, with no gaps — an empty Tuesday is data. */
  const fmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', ...(timeZone ? { timeZone } : {}) });
  const key = (t: number) => new Date(t).toISOString().slice(0, 10);
  const byDay: Metrics['byDay'] = [];
  const dayIndex = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const t = now - i * DAY;
    dayIndex.set(key(t), byDay.length);
    byDay.push({ day: key(t), label: fmt.format(new Date(t)), views: 0, visitors: 0, leads: 0 });
  }
  const seenPerDay = new Map<number, Set<string>>();
  for (const e of events) {
    if (e.at < from) continue;
    const i = dayIndex.get(key(e.at));
    if (i === undefined) continue;
    if (e.name === 'page_view') byDay[i].views++;
    if (e.sid) {
      const seen = seenPerDay.get(i) ?? new Set<string>();
      if (!seen.has(e.sid)) { seen.add(e.sid); byDay[i].visitors++; seenPerDay.set(i, seen); }
    }
  }
  for (const l of leads) {
    const i = dayIndex.get(key(l.createdAt));
    if (i !== undefined) byDay[i].leads++;
  }

  /* When people turn up. Monday-first, because a week starts on Monday. */
  const heat: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const e of events) {
    if (e.at < from || e.name !== 'page_view') continue;
    const d = new Date(e.at);
    heat[(d.getDay() + 6) % 7][d.getHours()]++;
  }
  const heatMax = Math.max(0, ...heat.flat());

  /* Where from, what they read, which form. */
  const windowEvents = events.filter((e) => e.at >= from);
  const sources = rank(windowEvents.filter((e) => e.name === 'page_view').map((e) => hostOf(e.ref) || 'Typed or bookmarked'));
  const pages = rank(windowEvents.filter((e) => e.name === 'page_view').map((e) => e.path || '/'));
  const forms = rank(leads.filter((l) => inWindow(l, from, now)).map((l) => l.source || 'unknown'));

  const pipeline = STAGES.map((s) => {
    const of = leads.filter((l) => l.stage === s.id);
    return { id: s.id, label: s.label, n: of.length, value: of.reduce((n, l) => n + l.value, 0), won: s.won, lost: s.lost };
  });

  const count = (name: string) => windowEvents.filter((e) => e.name === name).length;
  const funnel = [
    { label: 'Arrived', n: new Set(windowEvents.map((e) => e.sid).filter(Boolean)).size || count('page_view') },
    { label: 'Read a section', n: new Set(windowEvents.filter((e) => e.name === 'section_view').map((e) => e.sid)).size },
    { label: 'Pressed something', n: new Set(windowEvents.filter((e) => e.name === 'cta_click').map((e) => e.sid)).size },
    { label: 'Started a form', n: new Set(windowEvents.filter((e) => e.name === 'form_start').map((e) => e.sid)).size },
    { label: 'Sent it', n: leads.filter((l) => inWindow(l, from, now)).length },
  ];

  /* How long the owner takes to answer. The number that actually loses business. */
  const firstTouch = new Map<string, number>();
  for (const a of activityRows) if (!firstTouch.has(a.lead_id)) firstTouch.set(a.lead_id, a.at);
  const gaps = leads
    .map((l) => { const t = firstTouch.get(l.id); return t ? (t - l.createdAt) / 3_600_000 : null; })
    .filter((n): n is number => n !== null && n >= 0)
    .sort((a, b) => a - b);
  const medianResponseHours = gaps.length ? Math.round(gaps[Math.floor(gaps.length / 2)] * 10) / 10 : null;

  const stale = leads
    .filter((l) => !stageMeta(l.stage)?.won && !stageMeta(l.stage)?.lost && now - l.updatedAt > 2 * DAY)
    .slice(0, 8);

  return {
    days,
    now: windowFor(from, now + 1),
    before: windowFor(prevFrom, from),
    byDay,
    heat,
    heatMax,
    sources,
    pages,
    forms,
    pipeline,
    funnel,
    medianResponseHours,
    stale,
    newest: leads.slice(0, 8),
  };
}

function rank(values: string[], limit = 8): Series[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, limit);
}

function hostOf(url: string): string {
  if (!url) return '';
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url.slice(0, 40); }
}

function toLead(r: Record<string, unknown>): Lead {
  return {
    id: String(r.id), createdAt: Number(r.created_at), updatedAt: Number(r.updated_at), stage: String(r.stage), source: String(r.source),
    name: String(r.name ?? ''), email: String(r.email ?? ''), phone: String(r.phone ?? ''), company: String(r.company ?? ''), message: String(r.message ?? ''),
    fields: String(r.fields ?? '{}'), page: String(r.page ?? ''), value: Number(r.value ?? 0), tags: String(r.tags ?? ''), archived: Number(r.archived ?? 0),
  };
}

/* ---------------------------------------------------------------------------
   Turning numbers into the four a person should look at first
--------------------------------------------------------------------------- */

export function change(now: number, before: number): { delta: string; up: boolean } | undefined {
  if (before === 0 && now === 0) return undefined;
  if (before === 0) return { delta: 'new', up: true };
  const pct = Math.round(((now - before) / before) * 100);
  return { delta: `${Math.abs(pct)}%`, up: pct >= 0 };
}
