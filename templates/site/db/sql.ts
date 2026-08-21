/** DDL for both dialects. Run once at first connect, idempotent. */

export function ddl(dialect: 'sqlite' | 'postgres'): string[] {
  const pk = 'text primary key';
  const int = dialect === 'postgres' ? 'bigint' : 'integer';
  const num = dialect === 'postgres' ? 'double precision' : 'real';
  return [
    `create table if not exists leads (
      id ${pk}, created_at ${int} not null, updated_at ${int} not null, stage text not null, source text not null,
      name text not null default '', email text not null default '', phone text not null default '', company text not null default '',
      message text not null default '', fields text not null default '{}', page text not null default '', value ${num} not null default 0,
      tags text not null default '', archived integer not null default 0
    )`,
    `create index if not exists leads_stage on leads (stage, archived)`,
    `create index if not exists leads_created on leads (created_at)`,
    `create table if not exists activities (
      id ${pk}, lead_id text not null, at ${int} not null, kind text not null, text text not null default '', by_who text not null default 'site'
    )`,
    `create index if not exists activities_lead on activities (lead_id, at)`,
    `create table if not exists events (
      id ${pk}, at ${int} not null, name text not null, path text not null default '', sid text not null default '', ref text not null default '', props text not null default '{}'
    )`,
    `create index if not exists events_at on events (at)`,
    `create index if not exists events_name on events (name, at)`,
    `create table if not exists rate_limits (key text not null, bucket ${int} not null, count integer not null default 0, primary key (key, bucket))`,
    `create table if not exists settings (key text primary key, value text not null)`,
  ];
}
