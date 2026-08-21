/**
 * Sliding-window rate limit, in memory per instance. Enough for a public form
 * and the events endpoint on a single server or a warm Fluid Compute
 * instance. On Postgres deployments the `rate_limits` table is used too, so
 * limits hold across instances.
 */

import { db, dialect } from '@/db';
import { sql } from 'drizzle-orm';

const windows = new Map<string, number[]>();

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<{ ok: boolean; remaining: number }> {
  const now = Date.now();
  const arr = (windows.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  windows.set(key, arr);
  if (windows.size > 5000) { for (const [k, v] of windows) if (!v.some((t) => now - t < windowMs)) windows.delete(k); }
  const local = arr.length <= limit;
  if (!local) return { ok: false, remaining: 0 };

  if (dialect === 'postgres') {
    try {
      const bucket = Math.floor(now / windowMs);
      const rows = await db.execute(sql`insert into rate_limits (key, bucket, count) values (${key}, ${bucket}, 1) on conflict (key, bucket) do update set count = rate_limits.count + 1 returning count`) as unknown as Array<{ count: number }> | { rows?: Array<{ count: number }> };
      const count = Number((Array.isArray(rows) ? rows[0]?.count : rows.rows?.[0]?.count) ?? 0);
      if (count > limit) return { ok: false, remaining: 0 };
      return { ok: true, remaining: Math.max(0, limit - count) };
    } catch { /* fall back to the local window */ }
  }
  return { ok: true, remaining: Math.max(0, limit - arr.length) };
}

export function clientIp(req: Request): string {
  const h = req.headers;
  return (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? 'local').trim();
}
