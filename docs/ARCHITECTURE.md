# Super Builds — Architecture

Super Builds is a local-first website generator for people who do not write
code. They press things — a kind of business, a colour direction, a 3D scene,
an analytics choice — and a Claude Code session they already pay for builds an
award-grade, 3D-led website with a matching CRM, previews it beside a chat, and
publishes it to Vercel in one press.

This document records what was decided, why, and what was deliberately not
built. It is written to be read before `daemon/src/index.ts`.

---

## 1. Where it came from

The reference codebase is **PowerHouz** (`D:\Developer\Claude-PowerHouse`), an
agent IDE that already proved the hard parts on this machine:

| PowerHouz module | What it proved | Reused here as |
| --- | --- | --- |
| `daemon/src/claude.ts` | `claude -p --input-format stream-json --output-format stream-json` with NDJSON framing, per-turn cost, interrupt, hook settings | `daemon/src/claude.ts` (ported, trimmed) |
| `detection.ts`, `install.ts`, `binaries.ts`, `terminal.ts` | Requirements screen, "do it for me" recipes, Windows `.cmd` shim resolution, opening a terminal that actually runs | ported and re-scoped to what Super Builds needs |
| `checkpoints.ts`, `ports.ts` | Undo per chat turn; stable ports for previews | ported |
| `builder.ts`, `scenes.ts` | A catalogue of choices compiled into a long, professional brief; "the hero is an experience, not a layout" | the seed of `daemon/src/catalogue/` and `brief.ts`, extended heavily |
| `preview.ts` | Start the project's dev server and report its URL | rewritten, simpler |

**Deliberately not reused:** the PowerHouz UI (a cockpit, not a product for
non-coders), the licence/plan/shop, multi-runtime workflow graphs, the
hero-video/Higgsfield pipeline, the MongoDB waitlist API.

## 2. The five promises (inherited, and kept)

1. **Never read a runtime's config or credential file.** Everything goes
   through `claude` itself (`claude auth status`, `claude mcp list`).
2. **The application never holds a token.** No Vercel token, no Supabase key,
   no Anthropic key in `daemon/` or `ui/`. Keys a generated site needs are
   written into *that site's* `.env.local`, and pushed to Vercel by the
   Vercel CLI, which keeps its own credential store.
3. **Never call a model provider.** Only the user's own Claude Code does.
4. **No login, no account, no server.** Super Builds is a program on a laptop.
5. **The daemon binds `127.0.0.1`** and every mutating route requires the
   per-boot token the UI is handed at load.

## 3. Shape

```
packages/protocol/   The contract between daemon and UI. The only seam.
daemon/src/          Fastify + ws on 127.0.0.1:7747. TypeScript run directly on Node 24.
ui/src/              React 19 + Vite + Tailwind v4 + React Three Fiber. Built into daemon-served static files.
design-library/      Scenes (R3F, shared by UI previews and generated sites), skills, references.
templates/site/      The Next.js starter every generated site begins from.
scripts/             launch.mjs (build + start + open window), dev.mjs (daemon + Vite with reload).
docs/                This file, SECURITY.md, decisions.
```

Node ≥ 22 for the UI build, 24 for the daemon (it runs `.ts` with no build
step). `npm start` builds the UI, starts the daemon and opens a Chromium
app-mode window — the same front door PowerHouz uses, and the one that becomes
an Electron shell later without changing anything underneath.

## 4. The generation model: template + agent, not agent from zero

The single most consequential decision. A generated site is **not** scaffolded
from nothing by the model. Every site starts as a copy of `templates/site/`:

- Next.js 16 (App Router), TypeScript, Tailwind v4
- React Three Fiber 9 + drei 10, GSAP + ScrollTrigger, Lenis, Motion
- `design.config.ts` — the token system (palette, type, radius, motion
  durations, easing) that every component reads and every restyle edits
- `components/scenes/` — twelve working hero scenes, the same code the wizard
  previews, parameterised by the tokens
- `app/admin/` — a complete CRM (login, overview, leads table + kanban,
  activity, analytics, settings) that inherits the site's tokens
- `lib/analytics.ts` — one event schema, pluggable providers (Vercel,
  PostHog, GA4, Plausible, the built-in CRM)
- `db/` — Drizzle ORM; `node:sqlite` locally, Postgres when `DATABASE_URL` is set
- `app/api/forms/[form]` and `app/api/events` — validated, rate-limited intake
- `CLAUDE.md` + `.claude/skills/` — the house rules and the reference knowledge
  the chat session reads before touching anything

Claude Code's job is then *design*: choose and adapt the scene to the business,
write the pages and copy, set the tokens, tune the motion system, wire the
forms to the CRM, and review its own work against the rubric. That is the part
a model is good at; scaffolding a CRM from scratch every time is the part it is
slow and inconsistent at. Reliability, speed and security all come from the
template; the distinctiveness comes from the brief and the session.

**Why this is the right trade.** The reference sites (Lusion, Bruno Simon,
Active Theory, Abeto Messenger, Immersive Garden, Lando Norris, igloo) are
remembered for *one committed idea in the hero* and a motion system that recurs.
The brief forces that. A CRM is remembered for being fast, readable and
trustworthy — qualities that come from tested code, not from regeneration.

## 5. Generation is staged and observable

`daemon/src/generate.ts` runs one Claude Code session in the project folder and
drives it turn by turn:

| Stage | What the turn asks for | Verified by |
| --- | --- | --- |
| 0 scaffold | daemon copies template, writes tokens, `.env.local`, `CLAUDE.md`, skills; `npm install` | exit code |
| 1 identity | tokens, type, palette, the hero scene adapted to the business | build passes; a screenshot is taken |
| 2 pages | every chosen page, real copy, forms wired, navigation | build passes; screenshots |
| 3 motion | scroll system, hovers, transitions, reduced-motion | build passes |
| 4 CRM | form → lead mapping, pipeline stages, KPI definitions, analytics events | build passes; a test submission lands in `/admin` |
| 5 review | the "award jury" pass: score against the rubric, fix what fails | build passes; Lighthouse-style budget checked |

Every stage is a checkpoint (`checkpoints.ts`) and a git commit, so anything can
be put back. The preview starts as soon as stage 0 finishes, so the person
watches the site appear.

## 6. The chat after generation

The same session continues as a conversation: a message, a streamed reply,
tool calls shown as they happen, the preview hot-reloading on the right.
Two things make it usable by somebody who does not want to type:

- **Option chips.** The appended system prompt asks Claude to end every reply
  with a fenced ```` ```sb-options ```` block: two to five short next steps
  phrased as messages. The daemon strips the block and the UI renders buttons.
  Pressing one sends the text. (Chosen over `--json-schema` because that
  constrains the whole result; here prose plus options is the shape wanted.)
- **Quick actions.** A persistent bar of change kinds — add a page, add a
  feature, change how it looks, change the words, something is wrong, make it
  faster, show me on a phone, publish — each compiled into a fenced change
  brief (PowerHouz's `CHANGES`, kept because it is right).

Every turn takes a checkpoint first and commits after, so "undo that" is a
button.

## 7. Storage decisions

| What | Where | Why |
| --- | --- | --- |
| Super Builds' own state (projects, specs, sessions, checkpoints) | JSON under `~/.superbuilds/` | No database to install; inspectable; PowerHouz's pattern, proven |
| Generated sites | `~/SuperBuilds/<slug>/` by default; any folder | The person owns a normal Next.js project |
| CRM data, locally | SQLite via Node's built-in `node:sqlite` through `drizzle-orm/node-sqlite` | Zero native addons, zero accounts, the site and its CRM run the moment they are generated |
| CRM data, deployed | Postgres via `DATABASE_URL` (Neon from the Vercel Marketplace, or Supabase) | Vercel's filesystem is ephemeral; Vercel Postgres is gone; Neon is the Vercel-native default, Supabase when auth/realtime/storage is wanted |
| Admin login | Owner credential created at generation; `scrypt` from `node:crypto`; HttpOnly session cookie | No OAuth dependency, no native hashing addon, secure by default |

Research behind the deployed-database default: Vercel Postgres no longer
exists; Neon is the Marketplace Postgres with the tightest Vercel integration
(autoscale to zero, branching); Supabase is the all-in-one when auth, storage
and realtime are also wanted. Both are offered; the URL is collected at deploy
time and pushed with `vercel env add`. Sources: Vercel knowledge update
(2026-06), layerbase.com "Best database for Next.js in 2026", Bytebase
"Neon vs Supabase", Drizzle docs `connect-node-sqlite`.

## 8. Deployment

"Publish" runs the **Vercel CLI in the project folder**: `vercel login` opens
the person's own browser (first time only, in a terminal window we open and
watch), then `vercel link --yes`, `vercel env add` for every key in
`.env.local`, then `vercel --prod --yes`. Logs stream into the UI; the URL is
parsed and kept on the project. The token lives in Vercel's own store, never
ours. The Vercel **MCP server** is also available to the chat session (it is
connected in the user's Claude Code), so "publish a preview" can be asked in
the conversation too.

## 9. Reference websites

When somebody pastes a URL, `reference.ts` drives Playwright (Chromium,
installed through the requirements screen): screenshots at 0/25/50/75/100%
scroll and a short scroll recording, shown in the preview pane. Then a
bounded Claude Code turn reads those images and answers a JSON schema —
palette, type, layout, motion, 3D, what to keep, what to avoid — and the
wizard shows "Understood: I'll build something *similar*, not a copy." The DNA
goes into the brief with an explicit instruction against imitation.

## 10. Security summary

See `SECURITY.md`. Headlines: daemon on loopback with a per-boot token;
hook-enforced deny-list on the session (no killing Node, no deleting outside the
project, no secrets in prompts); generated sites ship CSP, strict headers, CSRF
on admin mutations, zod validation, IP rate limiting, scrypt credentials,
HttpOnly cookies, parameterised queries only, and no secret in client code.

## 11. What a real build looked like (calibration, 2026-08-21)

A restaurant (fine dining, Lisbon), diorama scene, Ember palette, big display
serif, stacked-cards layout, four pages, booking + gallery + map + hours,
built-in CRM + Vercel Analytics, review stage off:

| Stage | Time | Tool calls | Usage (API-equivalent) |
| --- | --- | --- | --- |
| scaffold (template + npm install) | 0.5 min | — | — |
| identity and hero | 17 min | 57 | ~$6 |
| pages and content | 15 min | 50 | ~$8 |
| motion system | 13 min | 34 | ~$7 |
| CRM and analytics | 12 min | 35 | ~$8 |
| one follow-up change in chat | 1 min | 4 | ~$1 |

Three things learned and fixed the same day: Claude Code's `total_cost_usd`
is cumulative per process (the daemon now reports deltas); `.env.local` is
`$`-expanded by Next so hashes are colon-separated; reveal-on-scroll content is
invisible to a naive full-page screenshot, so `shot.mjs` walks the page first.
The hero it produced — the diorama rebuilt as a hearth with rising embers and
the initials on the wall, "Fire, slowly." across it — cleared the hero rule
without anyone typing a sentence of design direction. Undo of the follow-up
change restored the previous commit.

## 12. What is explicitly not in v1

Electron packaging (the daemon and UI are shaped for it; the shell comes next),
Codex/Gemini runtimes (the `Runtime` seam exists; only Claude is implemented),
click heatmaps in the CRM (needs its own recorder), a marketplace of pre-made
listings, Netlify/Cloudflare targets, uploads (assets are pointed at, not
copied).
