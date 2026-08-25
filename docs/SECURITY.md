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
| CORS allows only the daemon's own origin and the Vite dev origin | Same reason. |
| Never reads `~/.claude.json`, `~/.claude/.credentials.json`, `~/.vercel/auth.json` or any vendor credential file | The CLIs are the interface: `claude auth status`, `vercel whoami`. Nothing secret is returned by either. |
| Never sets an auth env var on a spawned process; never calls a model provider | Only Claude Code talks to Anthropic; only the Vercel CLI talks to Vercel. |
| Third-party keys a site needs (PostHog, Stripe, a database URL) go into *that site's* `.env.local`, written once, never stored by us, and referenced in prompts only by variable name | A key in a transcript is a key in a log. The model never sees a value. |
| Install by recipe id, never by command | The browser cannot name a command line the daemon will run. Unknown ids are reported, not ignored. |
| Terminals are opened with a script file, not an argument string | Quoting across three platforms is where launchers become injection. |
| The Claude Code session runs with `bypassPermissions` **and** a PreToolUse hook that the daemon answers | Generation has to run unattended for a non-coder. The hook refuses: killing Node by name (`taskkill /im node`, `pkill node`), deleting or writing outside the project folder, `rm -rf /`, `format`, `shutdown`, reading `.env` files from other projects, and any command naming `~/.claude`, `~/.superbuilds` or `~/.vercel`. Refusals are logged into the conversation so the person sees what was stopped. |
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
| Static files served by the daemon come only from `ui/dist` and `~/.superbuilds/{captures,thumbs}` | Nothing else on disk is reachable over HTTP. |
| The folder picker's two routes are POSTs behind the per-boot token, return directory *names* only, and open no file | Browsing to choose a folder is not a secret operation, but a list of what is on somebody's disk is theirs. The only thing read besides names is whether a `package.json` or `index.html` exists, which is what makes the list useful. `node_modules`, `.git`, build output and dot-folders are skipped, and the listing is capped at 400 entries. |
| The native picker is spawned with an argument array, never a shell string, and is killed after three minutes with no answer | `execFile` with an array cannot be turned into a command by a path with a quote in it. The PowerShell path is a `-Command` string, so the one value interpolated into it — the starting folder — is escaped as a single-quoted PowerShell literal. A dialog nobody answers must not hold a request open forever. |
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
