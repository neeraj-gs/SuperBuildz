import { currentAdmin } from '@/lib/auth';
import { repo } from '@/db/repo';
import { csvCell } from '@/lib/security';

export const runtime = 'nodejs';

/** Leads as CSV, for the owner only. Formula-prefix escaped. */
export async function GET() {
  if (!(await currentAdmin())) return new Response('Unauthorized', { status: 401 });
  const leads = await repo.leads({ limit: 10000 });
  const head = ['created', 'stage', 'source', 'name', 'email', 'phone', 'company', 'value', 'tags', 'message', 'page'];
  const lines = [head.join(',')];
  for (const l of leads) lines.push([new Date(l.createdAt).toISOString(), l.stage, l.source, l.name, l.email, l.phone, l.company, l.value, l.tags, l.message, l.page].map(csvCell).join(','));
  return new Response(lines.join('\r\n'), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`, 'cache-control': 'no-store' } });
}
