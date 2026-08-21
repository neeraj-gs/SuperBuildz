/** The CRM's reads and writes. Parameterised through the `sql` template only. */

import { randomUUID } from 'node:crypto';
import { db, sql } from './index';
import type { Activity, Event, Lead } from './schema';
import { STAGES } from './pipeline';

const toLead = (r: Record<string, unknown>): Lead => ({
  id: String(r.id), createdAt: Number(r.created_at), updatedAt: Number(r.updated_at), stage: String(r.stage), source: String(r.source),
  name: String(r.name ?? ''), email: String(r.email ?? ''), phone: String(r.phone ?? ''), company: String(r.company ?? ''), message: String(r.message ?? ''),
  fields: String(r.fields ?? '{}'), page: String(r.page ?? ''), value: Number(r.value ?? 0), tags: String(r.tags ?? ''), archived: Number(r.archived ?? 0),
});
const toActivity = (r: Record<string, unknown>): Activity => ({ id: String(r.id), leadId: String(r.lead_id), at: Number(r.at), kind: String(r.kind), text: String(r.text ?? ''), by: String(r.by_who ?? 'site') });
const toEvent = (r: Record<string, unknown>): Event => ({ id: String(r.id), at: Number(r.at), name: String(r.name), path: String(r.path ?? ''), sid: String(r.sid ?? ''), ref: String(r.ref ?? ''), props: String(r.props ?? '{}') });

export const repo = {
  async createLead(input: { stage: string; source: string; name?: string; email?: string; phone?: string; company?: string; message?: string; fields?: Record<string, unknown>; page?: string; value?: number }): Promise<Lead> {
    const id = randomUUID(); const now = Date.now();
    await db.run(sql`insert into leads (id, created_at, updated_at, stage, source, name, email, phone, company, message, fields, page, value, tags, archived)
      values (${id}, ${now}, ${now}, ${input.stage}, ${input.source}, ${input.name ?? ''}, ${input.email ?? ''}, ${input.phone ?? ''}, ${input.company ?? ''}, ${input.message ?? ''}, ${JSON.stringify(input.fields ?? {})}, ${input.page ?? ''}, ${input.value ?? 0}, ${''}, ${0})`);
    await this.addActivity(id, 'created', `Arrived via the ${input.source} form`, 'site');
    return (await this.lead(id))!;
  },
  async lead(id: string): Promise<Lead | undefined> {
    const r = await db.get(sql`select * from leads where id = ${id}`);
    return r ? toLead(r) : undefined;
  },
  async leads(opts: { stage?: string; archived?: boolean; limit?: number; search?: string } = {}): Promise<Lead[]> {
    const conds = [sql`archived = ${opts.archived ? 1 : 0}`];
    if (opts.stage) conds.push(sql`stage = ${opts.stage}`);
    if (opts.search) { const q = `%${opts.search}%`; conds.push(sql`(name like ${q} or email like ${q} or company like ${q} or message like ${q})`); }
    const where = sql.join(conds, sql` and `);
    const rows = await db.all(sql`select * from leads where ${where} order by updated_at desc limit ${opts.limit ?? 500}`);
    return rows.map(toLead);
  },
  async moveStage(id: string, stage: string, by = 'owner'): Promise<void> {
    if (!STAGES.some((s) => s.id === stage)) throw new Error('Unknown stage');
    await db.run(sql`update leads set stage = ${stage}, updated_at = ${Date.now()} where id = ${id}`);
    await this.addActivity(id, 'stage', `Moved to ${STAGES.find((s) => s.id === stage)?.label ?? stage}`, by);
  },
  async updateLead(id: string, patch: Partial<Pick<Lead, 'name' | 'email' | 'phone' | 'company' | 'value' | 'tags' | 'archived'>>): Promise<void> {
    const sets: ReturnType<typeof sql>[] = [];
    if (patch.name !== undefined) sets.push(sql`name = ${patch.name}`);
    if (patch.email !== undefined) sets.push(sql`email = ${patch.email}`);
    if (patch.phone !== undefined) sets.push(sql`phone = ${patch.phone}`);
    if (patch.company !== undefined) sets.push(sql`company = ${patch.company}`);
    if (patch.value !== undefined) sets.push(sql`value = ${patch.value}`);
    if (patch.tags !== undefined) sets.push(sql`tags = ${patch.tags}`);
    if (patch.archived !== undefined) sets.push(sql`archived = ${patch.archived}`);
    if (!sets.length) return;
    sets.push(sql`updated_at = ${Date.now()}`);
    await db.run(sql`update leads set ${sql.join(sets, sql`, `)} where id = ${id}`);
  },
  async addActivity(leadId: string, kind: string, text: string, by = 'owner'): Promise<void> {
    await db.run(sql`insert into activities (id, lead_id, at, kind, text, by_who) values (${randomUUID()}, ${leadId}, ${Date.now()}, ${kind}, ${text}, ${by})`);
    await db.run(sql`update leads set updated_at = ${Date.now()} where id = ${leadId}`);
  },
  async activities(leadId: string): Promise<Activity[]> {
    return (await db.all(sql`select * from activities where lead_id = ${leadId} order by at desc limit 200`)).map(toActivity);
  },
  async recentActivity(limit = 30): Promise<Array<Activity & { leadName: string }>> {
    const rows = await db.all(sql`select a.*, l.name as lead_name, l.email as lead_email from activities a join leads l on l.id = a.lead_id order by a.at desc limit ${limit}`);
    return rows.map((r) => ({ ...toActivity(r), leadName: String(r.lead_name || r.lead_email || 'Lead') }));
  },
  async recordEvent(e: { name: string; path?: string; sid?: string; ref?: string; props?: Record<string, unknown> }): Promise<void> {
    await db.run(sql`insert into events (id, at, name, path, sid, ref, props) values (${randomUUID()}, ${Date.now()}, ${e.name.slice(0, 64)}, ${(e.path ?? '').slice(0, 256)}, ${(e.sid ?? '').slice(0, 64)}, ${(e.ref ?? '').slice(0, 256)}, ${JSON.stringify(e.props ?? {}).slice(0, 2000)})`);
  },
  async events(since: number, limit = 5000): Promise<Event[]> {
    return (await db.all(sql`select * from events where at >= ${since} order by at desc limit ${limit}`)).map(toEvent);
  },
  async counts(since: number): Promise<{ leads: number; events: number; sessions: number; byStage: Record<string, number>; byName: Record<string, number>; byPath: Record<string, number>; byRef: Record<string, number>; byDay: Array<{ day: string; leads: number; views: number }> }> {
    const leads = await db.all<{ stage: string; n: number }>(sql`select stage, count(*) as n from leads where archived = 0 group by stage`);
    const byStage: Record<string, number> = {}; for (const r of leads) byStage[String(r.stage)] = Number(r.n);
    const names = await db.all<{ name: string; n: number }>(sql`select name, count(*) as n from events where at >= ${since} group by name`);
    const byName: Record<string, number> = {}; for (const r of names) byName[String(r.name)] = Number(r.n);
    const paths = await db.all<{ path: string; n: number }>(sql`select path, count(*) as n from events where at >= ${since} and name = 'page_view' group by path order by n desc limit 20`);
    const byPath: Record<string, number> = {}; for (const r of paths) byPath[String(r.path)] = Number(r.n);
    const refs = await db.all<{ ref: string; n: number }>(sql`select ref, count(*) as n from events where at >= ${since} and name = 'page_view' and ref <> '' group by ref order by n desc limit 12`);
    const byRef: Record<string, number> = {}; for (const r of refs) byRef[hostOf(String(r.ref))] = (byRef[hostOf(String(r.ref))] ?? 0) + Number(r.n);
    const sessions = await db.get<{ n: number }>(sql`select count(distinct sid) as n from events where at >= ${since}`);
    const leadsN = await db.get<{ n: number }>(sql`select count(*) as n from leads where created_at >= ${since} and archived = 0`);
    const eventsN = await db.get<{ n: number }>(sql`select count(*) as n from events where at >= ${since}`);
    // Per day, computed in JS to stay dialect-neutral.
    const days = new Map<string, { leads: number; views: number }>();
    const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);
    for (let t = since; t <= Date.now(); t += 86400000) days.set(dayKey(t), { leads: 0, views: 0 });
    for (const r of await db.all<{ created_at: number }>(sql`select created_at from leads where created_at >= ${since} and archived = 0`)) { const k = dayKey(Number(r.created_at)); const d = days.get(k); if (d) d.leads++; }
    for (const r of await db.all<{ at: number }>(sql`select at from events where at >= ${since} and name = 'page_view'`)) { const k = dayKey(Number(r.at)); const d = days.get(k); if (d) d.views++; }
    return { leads: Number(leadsN?.n ?? 0), events: Number(eventsN?.n ?? 0), sessions: Number(sessions?.n ?? 0), byStage, byName, byPath, byRef, byDay: [...days.entries()].map(([day, v]) => ({ day, ...v })) };
  },
  async setting(key: string): Promise<string | undefined> { const r = await db.get<{ value: string }>(sql`select value from settings where key = ${key}`); return r?.value; },
  async setSetting(key: string, value: string): Promise<void> {
    await db.run(sql`delete from settings where key = ${key}`);
    await db.run(sql`insert into settings (key, value) values (${key}, ${value})`);
  },
};

function hostOf(url: string) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url.slice(0, 40); } }
