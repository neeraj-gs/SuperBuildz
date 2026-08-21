/** The built-in analytics sink. Small payloads, rate-limited, no PII stored. */

import { z } from 'zod';
import { repo } from '@/db/repo';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { clean, json } from '@/lib/security';

export const runtime = 'nodejs';

const Body = z.object({
  name: z.string().min(1).max(64).regex(/^[a-z0-9_:-]+$/i),
  path: z.string().max(256).optional(),
  ref: z.string().max(256).optional(),
  sid: z.string().max(64).optional(),
  props: z.record(z.union([z.string().max(200), z.number(), z.boolean()])).optional(),
});

export async function POST(req: Request) {
  const rl = await rateLimit(`events:${clientIp(req)}`, 240, 60 * 1000);
  if (!rl.ok) return json({ ok: false }, 429);
  let raw: unknown;
  try { raw = await req.json(); } catch { return json({ ok: false }, 400); }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return json({ ok: false }, 400);
  const e = parsed.data;
  const props: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(e.props ?? {})) props[clean(k, 40)] = typeof v === 'string' ? clean(v, 200) : v;
  delete props.ts;
  await repo.recordEvent({ name: e.name, path: clean(e.path, 256), ref: clean(e.ref, 256), sid: clean(e.sid, 64), props });
  return json({ ok: true });
}
