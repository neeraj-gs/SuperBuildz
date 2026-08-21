/**
 * One database, two dialects. `node:sqlite` locally — Node's own, no native
 * addon, a file in data/ — and Postgres when DATABASE_URL is set, which is
 * the case on Vercel. Every query is written with Drizzle's `sql` template
 * and compiled by the matching dialect, so it is parameterised by
 * construction; the driver underneath is the platform's own.
 */

import { sql, type SQL } from 'drizzle-orm';
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';
import { PgDialect } from 'drizzle-orm/pg-core';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ddl } from './sql';

export const dialect: 'sqlite' | 'postgres' = process.env.DATABASE_URL?.startsWith('postgres') ? 'postgres' : 'sqlite';

type Rows = Array<Record<string, unknown>>;
interface Adapter { all(q: SQL): Promise<Rows>; run(q: SQL): Promise<void>; raw(statement: string): Promise<void> }

let adapter: Adapter | null = null;
let ready: Promise<void> | null = null;

function open(): Adapter {
  if (adapter) return adapter;
  if (dialect === 'postgres') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const postgres = require('postgres') as typeof import('postgres');
    const client = postgres(process.env.DATABASE_URL!, { max: 4, prepare: false });
    const pg = new PgDialect();
    adapter = {
      async all(q) { const { sql: text, params } = pg.sqlToQuery(q); return (await client.unsafe(text, params as never[])) as unknown as Rows; },
      async run(q) { const { sql: text, params } = pg.sqlToQuery(q); await client.unsafe(text, params as never[]); },
      async raw(statement) { await client.unsafe(statement); },
    };
  } else {
    // Through the runtime, not the bundler: Turbopack cannot resolve `node:sqlite`
    // as a commonjs external, and Node 22.3+ exposes builtins this way for exactly this case.
    const getBuiltin = (process as unknown as { getBuiltinModule?: (id: string) => unknown }).getBuiltinModule;
    if (!getBuiltin) throw new Error('This Node cannot load node:sqlite. Use Node 22.5 or newer, or set DATABASE_URL to a Postgres database.');
    const { DatabaseSync } = getBuiltin('node:sqlite') as typeof import('node:sqlite');
    const dir = join(process.cwd(), 'data');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const client = new DatabaseSync(join(dir, 'site.db'));
    client.exec('pragma journal_mode = wal; pragma busy_timeout = 3000;');
    const lite = new SQLiteSyncDialect();
    adapter = {
      async all(q) { const { sql: text, params } = lite.sqlToQuery(q); return client.prepare(text).all(...(params as never[])) as Rows; },
      async run(q) { const { sql: text, params } = lite.sqlToQuery(q); client.prepare(text).run(...(params as never[])); },
      async raw(statement) { client.exec(statement); },
    };
  }
  return adapter;
}

async function ensure(): Promise<void> {
  if (!ready) {
    ready = (async () => { const a = open(); for (const stmt of ddl(dialect)) await a.raw(stmt); })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

export const db = {
  async all<T = Record<string, unknown>>(q: SQL): Promise<T[]> { await ensure(); return (await open().all(q)) as T[]; },
  async get<T = Record<string, unknown>>(q: SQL): Promise<T | undefined> { return (await this.all<T>(q))[0]; },
  async run(q: SQL): Promise<void> { await ensure(); await open().run(q); },
  async execute(q: SQL) { await ensure(); return open().all(q); },
};

export { sql };
