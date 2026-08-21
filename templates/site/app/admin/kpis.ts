/**
 * The four numbers the owner should see first, each with a target and a
 * trend. Stage 4 of the build rewrites these for the business; the template
 * ships ones that are true for any site. Each KPI gets the last-30-days
 * counts and the 30 days before, and returns a value, a delta and a target.
 */

import type { repo } from '@/db/repo';

type Counts = Awaited<ReturnType<typeof repo.counts>>;

export interface Kpi { id: string; label: string; value: string; delta?: string; target?: string; good?: boolean; spark?: number[] }

export function kpis(now: Counts, before: Counts, stagesWon: string[]): Kpi[] {
  const won = stagesWon.reduce((n, s) => n + (now.byStage[s] ?? 0), 0);
  const pct = (a: number, b: number) => (b === 0 ? (a > 0 ? '+100%' : '±0%') : `${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)}%`);
  const views = now.byName['page_view'] ?? 0, viewsBefore = before.byName['page_view'] ?? 0;
  const conv = views ? (now.leads / views) * 100 : 0;
  return [
    { id: 'leads', label: 'New leads · 30d', value: String(now.leads), delta: pct(now.leads, before.leads), target: 'target 20', good: now.leads >= before.leads, spark: now.byDay.map((d) => d.leads) },
    { id: 'views', label: 'Page views · 30d', value: String(views), delta: pct(views, viewsBefore), good: views >= viewsBefore, spark: now.byDay.map((d) => d.views) },
    { id: 'conv', label: 'Visit → lead', value: `${conv.toFixed(1)}%`, target: 'target 2%', good: conv >= 2 },
    { id: 'won', label: 'Won · open pipeline', value: String(won), target: 'all time', good: won > 0 },
  ];
}
