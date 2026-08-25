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
| 1 identity | tokens, type, palette, the scene adapted to the business, **the signature move**, the scene mounted page-wide | build passes; screenshots at 1440 **and 390** — a scene that crops its subject out of portrait fails |
| 2 pages | every chosen page, real copy, forms wired, navigation, **a scroll device per beat**, **`<Figure>` wherever a picture goes** | build passes; every screenshot looked at for empty rectangles and OS widgets |
| 3 motion | scroll system, hovers, transitions, reduced-motion, **pacing** | build passes; `npm run shot -- --scroll` six frames, read in order |
| 4 CRM | form → lead mapping, pipeline stages, KPI definitions, analytics events | build passes; a test submission lands in `/admin` |
| 5 review | the "award jury" pass: score against the rubric, fix what fails | build passes; Lighthouse-style budget checked |

Every stage is a checkpoint (`checkpoints.ts`) and a git commit, so anything can
be put back. The preview starts as soon as stage 0 finishes, so the person
watches the site appear. When stage 1 lands, three visual directions are
proposed in the background so they are waiting rather than costing a wait.

## 5a. What the sites were getting wrong, and where each fix lives

A real build (Ember and Oak, section 11) produced a hero that would pass a jury
and a page that would not. Studying it beside the reference sites — and two
walkthroughs of comparable tools, Nate Herk's ScrollCraft and Chase's
clone/remix cycle — gave five specific failures. Each is fixed in the
*template*, so every future site inherits it, rather than in a prompt that hopes:

| What went wrong | Where the fix lives |
| --- | --- |
| The scene died at 100vh; below it, a well-typeset dark page | `components/SceneLayer.tsx` — one canvas under the whole document, driven by `data-scene-frame` / `data-scene-dim` on each section. `SceneCanvas` is now the exception. |
| Sections were empty rounded rectangles with a number in the corner | `components/ui/Figure.tsx` — a real photograph, or a *composed* plate (`type` / `field` / `draft` / `band`). The template shipped the bad pattern itself, which is what got copied. |
| Forms showed OS widgets, and `mm/dd/yyyy` for a Lisbon restaurant | `components/ui/Controls.tsx` — `Select` and `DateField`, keyboard-complete, formatted with `Intl` against `design.locale`, which `scaffold.ts` derives from the business's location. |
| Portrait cropped the subject out of the hero | `SceneProps.portrait`, and the identity stage screenshots 390px and looks. |
| Nothing was memorable | The signature move: chosen in the wizard, decided in stage 1, named in `design.config.ts` and README, with nothing allowed to compete. `scroll-craft` skill + `components/ui/Scroll.tsx` (`Pinned`, `HorizontalTrack`, `Counter`, `Focus`, `Draw`, `Marquee`) make "every section earns its scroll" into working parts. |

The rubric grew from twelve lines to seventeen, the jury stage is on by
default, and it is told what these builds got wrong so it knows what to look
for rather than scoring its own work four everywhere.

## 5b. Choosing without describing: directions and the tune panel

The hardest moment in the flow is asking somebody who has never commissioned
design what they want it to look like. They cannot answer — describing a
design is a skill, recognising one is not. Two features exist for that.

**Three directions** (`daemon/src/directions.ts`, `ui/.../Directions.tsx`).
After the identity stage, three complete visual directions are proposed by a
bounded ask and rendered side by side *from the real site*, scrolling
together. `?direction=<id>` applies one for the length of a page view — no
cookie, no write, no effect on any other visitor. A direction is a named set
of tokens, not a different site: that limit is what makes it one cheap ask and
an instant preview instead of three builds and an hour, and palette, weight,
density and pace are what most people mean by "a different direction" anyway.

**The tune panel** (`daemon/src/tweaks.ts`, `ui/.../TweakPanel.tsx`). Eighteen
sliders and swatches — colour, type, space, motion, texture — plus presets and
a shuffle. A chat turn costs thirty seconds and some usage and assumes you
already know what you want; a slider is instant, free, reversible, and lets
you find out by moving it.

Both write to the project's `design.tweaks.json`, which `lib/tokens.ts` merges
over `design.config.ts`. Two files on purpose: a slider drag and an edit by
the build never touch the same file, Next hot-reloads on the write, `{}` is a
complete and obvious undo, and the designed values stay legible in the repo.

Two things this forced. Everything scalable is published as a base and a
multiplier (`--display-size-base` × `--display-scale`) with the derivation in
CSS, because reading the computed value back out of the cascade and
multiplying it in JavaScript is order-dependent and silently produced
`calc( * 1)`. And the WebGL scene reads the *live* CSS variables rather than
`design.config.ts`, or a light direction renders a pale page with a black hero
sitting in it.

## 5c. Getting at your own project: files, the CRM login, analytics, the prompt

Four things were unreachable from inside the tool, and all four had the same
shape: the product knew the answer and would not show it.

**The files.** `daemon/src/files.ts` lists, reads, writes, creates, deletes and
reverts anything inside the project folder; `ui/src/features/workspace/Files.tsx`
is a tree, tabs and an editor. The editor is a highlighted `<pre>` in normal
flow with a transparent `<textarea>` exactly on top of it, both driven from one
`TYPE` object so their metrics cannot drift apart. Highlighting is a regex
tokeniser (`highlight.ts`) covering tsx/ts/js, json, css, md, env and html —
about a hundred lines, against roughly three hundred kilobytes for a real
grammar, for a job that is "stop this being one grey wall".

Revert is `git checkout -- <path>`, which is honest about what it can do: every
generated project is a git repository from its first second.

**The CRM login.** `daemon/src/admin.ts`. The password is now kept beside the
hash while the site is local, so the tool can show it, set a new one, or forget
it; `templates/site/lib/auth.ts` grew `devLogin()` and the login form prefills
from it. The trade is written out in both files and in SECURITY.md.

**Analytics.** `daemon/src/analytics.ts` is the registry: twelve destinations,
each with the environment variables it needs, where to get them, and the URL of
the dashboard where the numbers actually live. The wizard's list is derived from
it (`analyticsChoices()`) so a provider cannot be offered that the site does not
know how to load, and `scaffold.ts` asks it which keys to stub. Only the
built-in provider reports into a dashboard Super Builds can render; for the
other eleven the honest answer is a deep link, and that is what the panel shows.

**The prompt.** `daemon/src/engine.ts` returns the exact text of every stage
turn, the command-line shape, the hooks, what the policy refuses, and the
plugins, skills, agents, commands and MCP servers found in `~/.claude` and the
project's own `.claude`. `BRIEF.md` is editable there, because a document that
decides what gets built and cannot be read is a document nobody can argue with.

`scripts/walk.mjs` presses through all of it and reports console errors per
panel — the routes were already covered by `shot.mjs`, and every recent bug has
been behind a button.

## 5c-ii. Choosing a folder

`daemon/src/picker.ts`. Revamp asked people to paste a path like
`C:\Users\you\code\the-site`, which is a thing graphical computers
have not required anybody to know since about 1994 — and getting it wrong
reads as "that is not a website I can read", which sounds like a verdict on
their site rather than a typo.

The browser cannot help: `<input webkitdirectory>` hands back relative paths
and a synthetic root name, never an absolute one. But the program that needs
the answer is the daemon, running as the person, on their machine. So Import
asks the operating system for its own picker — `FolderBrowserDialog` under
`-STA` on Windows, `choose folder` on macOS, zenity or kdialog otherwise — and
gets a real path back. When no native dialog can run (no desktop session, a
locked-down policy) the same answer is available by walking the disk inside the
window, folders that hold a website listed first and marked. Typing a path
still works and always will.

## 5d. Revamping a site that already exists

The second way in. A new build starts from a template and invents a business;
a revamp starts from a business and replaces the design. Everything between
those two ends is identical — the same eighteen questions, the same three
directions, the same tune panel, the same chat — because there is one product
here, not two, and what a person is choosing between is where the words come
from.

**`daemon/src/survey.ts`** establishes everything knowable without a model:
framework, router, routes, whether it is a git repository, whether the tree is
clean, how many images, and the site's own words sieved out of its source.
Pointing an agent at a folder and asking "what is this" burns twenty tool calls
rediscovering facts a hundred lines of `readdir` know exactly.

Public routes and routes behind a login are kept apart. A marketing page wants
a redesign; a table of somebody's customers wants the new colours and its layout
left alone, and conflating the two is how a revamp puts a full-bleed hero on the
page where the owner reads their bookings.

**`daemon/src/revamp.ts`** asks the one question the survey cannot — what is
this business, and which of our options would its owner have picked — and gets
back both prose and catalogue ids, so the wizard opens already answered. It also
owns `prepareRevamp` (a repository, a commit of whatever was lying around on
*their* branch, then `superbuilds/revamp`), the five stage prompts, and
`REVAMP.md`, which leads with the constraints rather than the ambitions because
on somebody's live site the constraints *are* the ambitious part.

`generate.ts` branches on `spec.mode`: stage zero is a branch instead of a
scaffold, and everything after it is the ordinary stage loop, the ordinary
session and the ordinary chat.

`preview.ts` grew a `devCommand()`: generated sites are always Next, where the
port flag is `-p`, and a revamped site is whatever somebody already had — Vite
and Astro want `--port`, and passing the wrong one makes the server exit with a
usage message that reads like our bug.

## 5e. The CRM, and why its charts are hand-written

The dashboard is half of what the tool makes and it is opened far more often
than the site. It was a grey table with four numbers on it.

**`db/metrics.ts`** computes everything in one pass. Twelve queries for twelve
panels is twelve round trips and twelve chances for two panels to disagree
about what "the last 30 days" means; the rows come back once and everything is
derived in JavaScript, which also keeps it dialect-neutral between the local
SQLite file and Postgres on a host.

**`app/admin/charts.tsx`** is a chart kit in one file: trend, ranked bars,
funnel with drop-off, part-to-whole, heatmap, stat tile, meter, sparkline. All
server components — the page ships as markup with nothing to hydrate. A charting
library would be 60–200KB of client bundle to draw six shapes that are twenty
lines of SVG each, and it would arrive with a palette that has nothing to do
with this site.

### One accent, so every scale is sequential

This dashboard cannot have a fixed eight-hue categorical palette, because its
colours belong to a site whose accent somebody picked — or mixed — an hour ago,
on a ground that might be near-black or near-white. So the rule is: **magnitude
is lightness, identity is a label.** No chart carries meaning in hue alone, no
chart has two y-axes, no chart puts a number on every point, and every chart has
a table twin so nothing is reachable only by hovering.

**`lib/ramp.ts`** solves the scale rather than choosing it: given the accent and
the surface, it walks OKLab lightness towards the surface and stops at the last
step that still clears 2:1 contrast, in whichever direction has room. Four or
five steps depending on what the ground will carry, adjacent steps at least 0.06
apart in L. The accent leads its own ramp wherever there is room for it. It is
computed at render time rather than baked into `design.config.ts`, so it follows
the theme *and* the tune panel.

`daemon/test/charts.test.ts` runs both checks against every palette in the
catalogue and against thirty-six arbitrary accents on both grounds — the first
version of the solver ran the ramp in the wrong direction and produced four
shades of near-black from a lime, which no amount of looking at one palette
would have caught.

### Three bugs the dashboard exposed in the site

The root layout wraps every route, `/admin` included, so the full-page 3D layer,
the custom cursor and Lenis smooth scroll were all running behind the CRM. Worse,
`body` was `transparent` and the *only* thing painting the page's ground was that
fixed scene layer — so removing it from `/admin` revealed there had never been a
background at all. All three are fixed at the source: the three components step
aside on `/admin`, and the page now has a ground of its own.

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

## 6a. Several conversations at once

A build is not one task. Somebody wants the menu page rewritten, the colours
tried three ways and the booking form fixed, and running all three through one
conversation means each waits for the last and the transcript becomes a place
nobody can find anything. So a project has as many conversations as it needs,
as tabs.

**`daemon/src/capacity.ts`** — ported in shape from PowerHouse, which learned it
the hard way. Nothing limited anything across conversations, so four open ones
plus a build launched five Claude Code processes, each a Node runtime plus a
model client plus whatever it spawns. On a laptop that is not parallelism, it is
swapping, and the symptom looks like the model being slow. The ceiling is
derived from the machine (half the cores, clamped to 2–6) rather than picked,
and a turn over it **waits and then runs**: refusing it pushes the problem back
to the person, and "try again in a minute" is a worse answer than "it is second
in line". The queue is shown in the tab bar, never hidden.

**`daemon/src/memory.ts`** — the other half, and the one parallelism creates.
The moment a project has two conversations they stop being one assistant and
become several with amnesia: one rewriting a page another has just been told is
fine. The cheap answer that works is a shared notebook,
`.superbuilds/memory.md`, in two halves. The top is the person's, typed once and
read into every conversation's system prompt — what the business is really like,
words never to use, a decision they do not want revisited. The bottom is a log
the daemon writes: one line per finished turn, which conversation, what it did,
capped at twenty. Every prompt also carries a line about what the *other*
conversations are doing right now, taken from the message each was last sent.

The daemon writes the log rather than asking the model to, because a model asked
to maintain a shared file will do it beautifully for three turns and then stop,
and nothing will notice.

## 6b. The tool's own front door

The landing page is the product's first argument, and for a while it was the
product's best counter-example: it told visitors that a hero should be an
experience, that the canvas should stay alive under the whole page, and that
rows of identical cards are what "generated" looks like — then put a WebGL
scene in one corner of the first screen and spent six sections on card grids
under numbered eyebrows.

**`ui/src/features/landing/Spine.tsx`** is the fix and the idea. One object,
fixed behind the whole page: a website's parts float apart, draw together into
a page, split into three directions, rearrange into a dashboard, multiply into
several projects at once, and settle. Fourteen plates keep their identity
throughout — the plate that is a headline in the first chapter is a column
header in the dashboard and the top of the second stack in the parallel one —
which is what makes it read as one thing moving rather than six things being
swapped.

Sections register themselves with a chapter name and the driver measures where
they actually are. Pinning chapters to fractions of the document would mean any
new paragraph anywhere silently desynchronises the page; measuring elements
means a section can be moved, cut or added without touching the scene. Each
chapter also says where the object sits and how loud it is, because some
sections are read and some are looked at, and nothing is ever read across
moving geometry.

The sections themselves had to stop *claiming* and start *being*: the four
presses are a pinned sequence with the actual interface drawn beside each step;
the thirteen scenes are an index with one specimen; the CRM is a working figure
with a hover readout and a table twin, drawn to the same chart rules the
generated dashboard is built to; and the parallel-sessions board plays a fixed
five-beat script — four conversations, three projects, one queue, one notebook
writing itself. The index rule survives in exactly one place, the four presses,
because that is a real sequence where the order is the information.

Under `prefers-reduced-motion` the pinned section becomes four ordinary blocks,
every ticker holds still, and the scene stops easing and stops following the
pointer: it is where the scroll says it is and nothing moves on its own.

## 6c. Ports, and the day one literal broke the product three ways

Worth writing down because the failure was so much larger than the cause, and
because every symptom pointed away from it.

Somebody started a second project that already had 5180. Vite did what Vite
does — took 5181 instead, quietly, by design. The daemon's CORS allowlist and
its socket origin check both named `127.0.0.1:5180` as a literal. What the
person saw was:

- **"Internal Server Error"** on anything that changed state. `@fastify/cors`
  was handed an `Error` for a disallowed origin, and Fastify turns that into a
  500 — so a CORS *decision* was reported as the daemon falling over.
- **"daemon offline"** in the header, permanently. The socket carries the
  per-boot token and the socket was being closed on the same rule.
- **Everything else looking fine.** The project list still loaded, because a
  browser sends no `Origin` header on a same-origin GET.

Three unrelated-looking symptoms, one line, and nothing on screen connecting any
of them to a port number. The fix is in three parts, and each is a different
kind of answer:

1. **The rule stops naming ports.** `daemon/src/origins.ts` allows any loopback
   origin and answers `(null, false)` rather than an error, so a refusal is a
   decision and not a 500. Safe because of a `Host` check that refuses DNS
   rebinding, and because the token now guards reads too — see `SECURITY.md`.
2. **The ports stop being literals.** `scripts/ports.mjs` finds a free interface
   port; `scripts/dev.mjs` hands the same number to both children. Neither can
   be wrong about the other because neither chose. `ui/package.json` no longer
   carries a port at all, which is where the drift started.
3. **The interface says what is wrong.** `ui/src/components/Connection.tsx`
   replaces two red words that were hidden below `md` with a control you can
   press at any width, carrying the answer from a live `/api/health` probe —
   and it distinguishes "nothing is answering" from "answering but refusing the
   socket", which are indistinguishable from inside the page and want completely
   different sentences. It reconnects on its own, and also the moment a tab
   becomes visible or the network returns, because a slept laptop has a dead
   socket and no event to say so.

The daemon also now says which port is taken when it cannot bind, instead of
exiting with a stack trace about a socket while `dev.mjs` kills Vite alongside
it.

## 7. Storage decisions

| What | Where | Why |
| --- | --- | --- |
| Super Builds' own state (projects, specs, sessions, checkpoints) | JSON under `~/.superbuilds/` | No database to install; inspectable; PowerHouz's pattern, proven |
| Generated sites | `~/SuperBuilds/<slug>/` by default; any folder | The person owns a normal Next.js project |
| Live design tweaks | `<project>/design.tweaks.json` | Merged over `design.config.ts` at render. Separate so a slider and the build never fight; `{}` is a full undo |
| Proposed directions | `<project>/directions.json` | Named token sets; `?direction=<id>` previews one without writing anything |
| The person's photographs | copied into `<project>/public/media/` | Copied, never referenced: a project that breaks because somebody tidied their Pictures folder is not one they own |
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
