/**
 * Every form posts here. Validated with zod, rate-limited per IP, honeypot and
 * time-to-submit checked, then written as a lead in the stage the pipeline
 * names for this form. Nothing else on the site writes leads.
 */

import { z } from 'zod';
import { repo } from '@/db/repo';
import { FORMS } from '@/db/pipeline';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { clean, json } from '@/lib/security';

export const runtime = 'nodejs';

const Base = z.object({
  name: z.string().max(120).optional(),
  email: z.string().email().max(200).optional(),
  phone: z.string().max(40).optional(),
  company: z.string().max(120).optional(),
  message: z.string().max(4000).optional(),
  website: z.string().max(200).optional(),       // honeypot: a real person never fills it
  _t: z.number().optional(),                     // ms since the form was shown
  _page: z.string().max(256).optional(),
}).passthrough();

export async function POST(req: Request, { params }: { params: Promise<{ form: string }> }) {
  const { form } = await params;
  const def = FORMS[form];
  if (!def) return json({ error: 'That form does not exist.' }, 404);

  const ip = clientIp(req);
  const rl = await rateLimit(`form:${ip}`, 8, 10 * 60 * 1000);
  if (!rl.ok) return json({ error: 'Too many messages from this connection. Try again in a few minutes.' }, 429);

  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > 64 * 1024) return json({ error: 'That is too long.' }, 413);

  let body: unknown;
  try { body = await req.json(); } catch { return json({ error: 'Could not read the form.' }, 400); }
  const parsed = Base.safeParse(body);
  if (!parsed.success) return json({ error: 'Please check the highlighted fields.', issues: parsed.error.issues.map((i) => i.path.join('.')) }, 400);
  const data = parsed.data;

  // Bots fill the honeypot and submit in under two seconds. Pretend it worked.
  if ((data.website && data.website.length) || (typeof data._t === 'number' && data._t < 1500)) return json({ ok: true });
  if (!data.email && !data.phone && !data.name) return json({ error: 'Leave a way to reach you.' }, 400);

  const { name, email, phone, company, message, _t, _page, website, ...rest } = data;
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(rest)) if (typeof v === 'string' || typeof v === 'number') fields[clean(k, 40)] = clean(v, 1000);

  const lead = await repo.createLead({
    stage: def.stage, source: form,
    name: clean(name ?? def.title({ ...fields, name: name ?? '', email: email ?? '' }), 120), email: clean(email, 200), phone: clean(phone, 40), company: clean(company, 120),
    message: clean(message, 4000), fields, page: clean(_page, 256), value: def.value ?? 0,
  });
  void repo.recordEvent({ name: 'form_submit', path: clean(_page, 256), props: { form }, sid: 'server' }).catch(() => {});
  return json({ ok: true, id: lead.id });
}
