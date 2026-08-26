# Super Builds — Security

Two things are secured here and they are different: **the tool** (the daemon
and interface on the person's machine) and **what it makes** (a Next.js site
with a CRM that will be on the public internet). Every decision below says
which one it protects.

## The tool

| Decision | Why |
| --- | --- |
| Daemon binds `127.0.0.1` only | It spawns processes and reads the filesystem for whoever can reach it. On `0.0.0.0` that is remote code execution on the office wifi. |
| A per-boot random token; every mutating route and the hook callbacks require it | Any page in the person's browser can reach loopback. The token is handed to our UI over the socket on connect and never written anywhere. |
| CORS allows any **loopback** origin on any port, and never raises the refusal as an error | It used to be four literal strings including `127.0.0.1:5180`. A second project took 5180, Vite silently moved the interface to 5181, and one line broke the product three ways at once: every write answered `500 Internal Server Error` (the rejection was thrown, so Fastify turned a CORS decision into a fault), the socket was refused so the header read "daemon offline", and the project list still loaded — because a browser sends no `Origin` on a same-origin GET. Nothing on screen connected any of it to a port number. CORS was never the boundary anyway: it stops a *remote* page reading the response, which loopback-only preserves exactly. `daemon/src/origins.ts`, asserted in `daemon/test/origins.test.ts`. |
| Every request must arrive with a **loopback `Host`**, or it is refused 403 before it reaches a route | This is the actual defence against DNS rebinding, and the reason the origin rule above can be as loose as it is. A page on the internet can point a name it owns at `127.0.0.1` and talk to the daemon as same-origin, with no CORS involved. What it cannot forge is the name it asked for. |
| The per-boot token guards **reads** as well as writes: anything under `/api/projects`, `/api/sessions` or `/api/capacity` needs it | The compensation for widening the origin rule, and a tightening on the old behaviour rather than a loosening. `GET /api/projects/:id/file` returns source; any page on `127.0.0.1:5180` could already read it, and every loopback port could have after the change. Now none can. Health, the catalogue and what is installed stay open, because the interface reads them before the socket has handed it a token and none of them are anybody's. |
| Never reads `~/.claude.json`, `~/.claude/.credentials.json`, `~/.vercel/auth.json` or any vendor credential file | The CLIs are the interface: `claude auth status`, `vercel whoami`. Nothing secret is returned by either. |
| Never sets an auth env var on a spawned process; never calls a model provider | Only Claude Code talks to Anthropic; only the Vercel CLI talks to Vercel. |
| Third-party keys a site needs (PostHog, Stripe, a database URL) go into *that site's* `.env.local`, written once, never stored by us, and referenced in prompts only by variable name | A key in a transcript is a key in a log. The model never sees a value. |
| Install by recipe id, never by command | The browser cannot name a command line the daemon will run. Unknown ids are reported, not ignored. |
| Terminals are opened with a script file, not an argument string | Quoting across three platforms is where launchers become injection. |
| The Claude Code session runs with `bypassPermissions` **and** a PreToolUse hook that the daemon answers | Generation has to run unattended for a non-coder, so the hook is the only gate. `daemon/src/policy.ts`. |
| The hook has two tiers — **never**, and **ask the person** — where it used to have one | One tier gave the refusal list an impossible job: wide enough to protect the machine, narrow enough never to stop real work. It failed in the expensive direction. `\bformat\b`, written for `format C:`, refused `git log --format=%B`, `git log --pretty=format:%h`, `npm run format`, `gh pr list --format json`, `next lint --format compact` and `Get-Process \| Format-Table` — seven ordinary commands out of fifteen — in the middle of a paid build, with no way for the person watching to overrule it. A guard nobody can overrule is not a safe guard; it is one people learn to work around. Both directions are now asserted in `daemon/test/policy.test.ts`, and the *allowed* list is the longer half of that file. |
| **never** is exactly three: formatting or partitioning a disk, killing Node by name, and writing into `~/.superbuilds` | No answer makes these safe. The first two are irreversible from one press and neither has anything to do with building a website; the third would corrupt the tool mid-run. These are never put to anybody, and no toggle enables them. |
| Everything else stops, shows the person the **verbatim** command and what it would do, and takes `once` / `always in this conversation` / `no` | PreToolUse is synchronous: while the daemon has not replied, the tool call has not happened. So the question is asked in that gap and the answer *is* the reply — say yes and the original command runs, first time. The alternative was worse than it looks: a refusal Claude reads is a refusal Claude routes around, which is how the transcript in the bug report shows the model rewriting its plan four times rather than anybody being asked. `daemon/src/approvals.ts`. |
| Patterns are anchored at **command position**, not `\b` | `format` is a flag on half the git commands ever written; a disk format is `format C:` at the start of one. Position is the difference, so position is what is matched: start of input, or after a newline, `;`, `\|`, `&`, `(` or a `sudo`. |
| A yes is held **in memory, keyed by conversation**, and never persisted | A permission that outlives the reason it was given is how every "allow all" toggle ends up permanently on. Closing the app forgets it; a new conversation asks again. |
| Nobody watching means **no**, immediately | A build runs for an hour unattended on purpose. With no browser connected there is nobody to ask, so the daemon refuses in ~25ms with a sentence saying why, rather than stalling the build 150s per call to reach the same answer. Fail closed, and fail fast. |
| A question refuses itself after 150s; the PreToolUse hook timeout is 180s | The hook timeout must be the larger of the two, or it expires mid-question and decides by itself — the one outcome a permission prompt must never have. |
| Every outcome is written into the transcript and saved, not just broadcast | Allowed once, allowed for the conversation, allowed under a standing grant, refused, refused for want of an answer. A permission system nobody can audit afterwards is one nobody should trust, and a refusal that vanishes on reload cannot be checked. |
| Checkpoints before every turn; a git commit after | Anything a session did can be put back. |
| Paths in requests are resolved and must stay inside the project, or inside `~/.superbuilds` for captures and thumbnails | `..` is the oldest trick. |
| The file panel resolves every path and requires the result to be inside the project; `node_modules`, `.next`, `.git`, `.vercel`, `out` are neither listed nor writable; files over 1.5MB and anything with a NUL byte are read-only | Editing is allowed because the alternative is sending people to Notepad for an API key. The guard resolves first and compares after, which is the only check that survives `..`, symlinks and Windows short names. Six escape attempts are asserted in `daemon/test/files.test.ts`. |
| The CRM password is kept in the clear in the site's own `.env.local` as `ADMIN_DEV_PASSWORD` while the site is being built, and stripped from every deploy | Argued at length in `daemon/src/admin.ts`. The hash alone was correct and unusable: the plaintext was printed once on a build stage, scrolled away, and the owner was locked out of their own customer data with no way back except a text editor. The file is 0600 and git-ignored; anyone who can read it can already read the session secret, the database and the source, so this key opens no door those do not. `deployProject` skips it by name, the deploy panel does not list it, and “Forget it” removes the line while leaving the hash. |
| A revamp never starts until the folder is a git repository with everything committed, and all its work happens on `superbuilds/revamp` | This is somebody's live website. `git checkout <their branch>` has to be a complete undo, or the feature should not exist. If the folder is not a repository one is made and everything in it is committed first, on *their* branch, where they would look for it. |
| The survey never reads `.env` files, and the understanding turn runs with `Read`, `Glob` and `Grep` only | The point of a revamp is that the data and the keys are already theirs and stay theirs — including from us. The same PreToolUse hook that guards every other session guards this one. |
| A folder that is not a website is refused rather than scaffolded over; an empty folder is the failure rather than the prerequisite | The new-build check is exactly inverted here, and running the wrong one would either overwrite a project or refuse the only folder that makes sense. |
| Screenshot paths handed to the understanding turn must match `/captures/<id>/<file>` and are resolved against the captures directory | The browser supplies these, so an unchecked one is a path traversal into `Read`. |
| Images fetched from a link refuse private and link-local addresses, cap at 20MB, and only write into a staging folder under `~/.superbuilds/uploads` | A URL field that will fetch `169.254.169.254` on request is a server-side request forgery, and it does not stop being one because the server is a laptop. |
| A custom palette is five six-digit hexes or nothing | They are written into the generated `design.config.ts` as source. Half a palette is also refused: a page with two of the five moved is worse than the one it started from. |
| Colours *sampled* from a site — a reference or a revamp — are repaired to WCAG before anybody is offered them: body text to 4.5:1 against its ground, quiet text and the accent to 3:1, a panel that is exactly the page nudged off it. Colours a person mixed themselves are never overridden | A model reading "the ground" and "the text" off a site that inverts halfway down can hand back pale on pale, and pressing a button called "its colours" should not produce a page nobody can read. It is arithmetic, so it is done in `daemon/src/colour.ts` rather than asked for in a prompt. A deliberate choice is a different thing: the palette editor shows the contrast and lets the person decide. |
| Static files served by the daemon come only from `ui/dist` and `~/.superbuilds/{captures,thumbs}` | Nothing else on disk is reachable over HTTP. |
| The folder picker's two routes are POSTs behind the per-boot token, return directory *names* only, and open no file | Browsing to choose a folder is not a secret operation, but a list of what is on somebody's disk is theirs. The only thing read besides names is whether a `package.json` or `index.html` exists, which is what makes the list useful. `node_modules`, `.git`, build output and dot-folders are skipped, and the listing is capped at 400 entries. |
| The native picker is spawned with an argument array, never a shell string, and is killed after three minutes with no answer | `execFile` with an array cannot be turned into a command by a path with a quote in it. The PowerShell path is a `-Command` string, so the one value interpolated into it — the starting folder — is escaped as a single-quoted PowerShell literal. A dialog nobody answers must not hold a request open forever. |
| The board (`GET /api/sessions`) returns titles, counts, and one trimmed line of what was last said — never a transcript, and never a path | It is behind the token like everything else project-scoped, but it is also the one route that returns something about *every* project at once, so what it carries is worth stating. Code fences are stripped from the excerpt before it leaves the daemon: the last thing an assistant turn said is very often a file. |
| A conversation whose project no longer exists is left off the board rather than shown as an orphan | It has nothing to open, and a card that cannot be pressed is a bug report waiting to be filed. |
| The path a picker returns is `stat`ed before it is handed to anything that will act on it | The operating system is trusted; a folder that disappeared between the dialog closing and the answer arriving is not. |

## What it makes

Every generated site starts from `templates/site`, which ships with:

| Decision | Why |
| --- | --- |
| Security headers from `next.config.ts`: CSP (self + the analytics hosts actually chosen, `frame-ancestors 'none'`), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS in production | Defaults, not options. The brief forbids loosening them without saying why in the README. |
| All intake (`/api/forms/[form]`, `/api/events`) validated with `zod`; bodies capped at 64KB; IP rate limited (sliding window, in memory per instance, Postgres-backed when deployed) | A public form is a public write endpoint. |
| Honeypot field + time-to-submit check on every form | Cheap, invisible, stops most bots. |
| Admin: single owner credential created at scaffold; `scrypt` (N=2^15) from `node:crypto`; constant-time compare; HttpOnly, Secure, SameSite=Lax session cookie signed with HMAC; 12-hour expiry; login rate-limited and delayed on failure | No OAuth dependency and no native addon. The hash is the only credential that ever reaches a host. |
| The login form prefills only when `NODE_ENV !== 'production'` **and** `ADMIN_DEV_PASSWORD` is set — two guards, because one of them will eventually be wrong | `devLogin()` in `lib/auth.ts`. A published site prefills nothing even if the key somehow travelled with it. |
| Analytics script and connect hosts come from one table, `lib/analytics-hosts.ts`, read by both the CSP in `next.config.ts` and the loader in `lib/analytics-client.tsx` | Two lists drift, and the drift is silent: a script tag is appended, the browser refuses it under CSP, and the dashboard stays empty with nobody seeing an error. |
| CSRF: admin mutations require the session cookie **and** a same-origin check (`Origin`/`Sec-Fetch-Site`) | Cookies alone are not enough. |
| Drizzle ORM only; no string-built SQL | Parameterised by construction. |
| `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_PASSWORD_HASH` are server-only; nothing secret is prefixed `NEXT_PUBLIC_` | The brief and the review stage both check this. |
| `node:sqlite` file lives in `data/` which is git-ignored | The local CRM database is never committed. |
| Exports from the CRM are CSV with formula-prefix escaping | CSV injection is real. |
| `prefers-reduced-motion` honoured everywhere; WebGL lazy-loaded behind a poster | Accessibility is part of security's neighbour, quality; it is listed here because the review stage gates on it. |

## What the review stage checks

The optional last stage of generation re-reads the site with these exact
questions and fixes what fails: secrets in client bundles (`grep NEXT_PUBLIC_`
against the secret list), headers present in a production build, every form
validated, admin routes behind auth, rate limits wired, `robots.txt` excluding
`/admin`, no `dangerouslySetInnerHTML` with user content.

## Reporting

This is a local tool with no server. If you find a way for a page in a browser
to make the daemon do something without the token, that is a p0: open an issue
with the request that did it.
