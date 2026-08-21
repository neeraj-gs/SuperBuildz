---
name: crm-admin
description: How the CRM at /admin is wired — forms → leads → pipeline stages, KPIs, activities, events, the database, auth — and how to change it for the business. Use when touching forms, the pipeline, the dashboard or analytics.
---

# The CRM

Everything the site collects lands in `/admin`, behind the owner login, in the
site's own tokens. It is honest when empty and never seeded with fake data.

## Map

| File | What it owns |
| --- | --- |
| `db/pipeline.ts` | `STAGES` (ids stable, labels free; mark `won`/`lost`) and `FORMS` (which form → which stage, how to title the lead, default value) |
| `app/admin/kpis.ts` | the four KPI cards: value, delta vs the previous 30 days, target, sparkline |
| `db/repo.ts` | every read/write: `createLead`, `leads`, `moveStage`, `addActivity`, `recordEvent`, `counts` |
| `db/index.ts`, `db/sql.ts` | the two dialects and the DDL (idempotent, run at first connect) |
| `app/api/forms/[form]/route.ts` | intake: zod, rate limit, honeypot, time-to-submit |
| `app/api/events/route.ts` | the built-in analytics sink |
| `app/admin/*` | overview, leads (board + table), lead detail, analytics, settings |
| `lib/auth.ts` | scrypt credential, signed HttpOnly cookie, same-origin guard |

## Adding a form

1. `<Form name="booking" fields={[…]} />` on the page. Field names become
   columns where they match (`name`, `email`, `phone`, `company`, `message`)
   and land in `fields` JSON otherwise.
2. Add `booking` to `FORMS` in `db/pipeline.ts` with its starting stage.
3. `npm run test:forms booking` and look in `/admin/leads`.

## Renaming the pipeline for the business

Edit `STAGES`. Restaurant: New enquiry → Booking requested → Confirmed → Seated
(won) → No-show (lost). SaaS: Signed up → Activated → Trialling → Paying (won)
→ Churned (lost). Keep `new` as the first id so existing leads keep working, or
migrate with a one-off `update leads set stage = …` through `db.run(sql\`…\`)`.

## KPIs that mean something

`kpis()` receives counts for now and before. Replace the generic four with the
business's: bookings this week vs last, average reply time (from activities:
created → first `email`/`call`), conversion from `view_service` to
`open_booking`, revenue this month (sum of `value` on won leads). Each has a
`target` string so the card says what good looks like.

## Analytics events

`track(name, props)` in `lib/analytics.ts` is the only way. Always-on: `page_view`, `section_view`, `scroll_depth`, `cta_click`, `form_start`, `form_submit`. Add the funnel events BRIEF.md names (e.g. `view_service`, `open_booking`) where they happen: `data-track="cta_click" data-label="Book"` on a `<Button>`, or `track('open_booking')` in a handler. The overview's funnel reads `counts.byName`; add your names to its `funnelNames` in `app/admin/page.tsx`.

## Database

Local: `data/site.db` (SQLite via `node:sqlite`). Deployed: `DATABASE_URL`
(Postgres). Never build SQL from strings; use the `sql` template:
`db.all(sql\`select * from leads where stage = ${stage}\`)`. New columns go in
`db/sql.ts` (`create table if not exists` will not add them — add an
`alter table … add column` guarded by a try/catch in `ensure()`), and in
`repo.ts` mappers.

## Security (do not loosen)

Every mutation is a server action that calls `guard()` (session + same-origin).
Login is rate-limited and delayed on failure. The CSV export escapes formula
prefixes. `/admin` and `/api` are disallowed in `robots.txt`. Nothing in
`app/admin` may run without `currentAdmin()`.
