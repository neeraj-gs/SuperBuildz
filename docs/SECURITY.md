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
| Static files served by the daemon come only from `ui/dist` and `~/.superbuilds/{captures,thumbs}` | Nothing else on disk is reachable over HTTP. |

## What it makes

Every generated site starts from `templates/site`, which ships with:

| Decision | Why |
| --- | --- |
| Security headers from `next.config.ts`: CSP (self + the analytics hosts actually chosen, `frame-ancestors 'none'`), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS in production | Defaults, not options. The brief forbids loosening them without saying why in the README. |
| All intake (`/api/forms/[form]`, `/api/events`) validated with `zod`; bodies capped at 64KB; IP rate limited (sliding window, in memory per instance, Postgres-backed when deployed) | A public form is a public write endpoint. |
| Honeypot field + time-to-submit check on every form | Cheap, invisible, stops most bots. |
| Admin: single owner credential created at scaffold; `scrypt` (N=2^15) from `node:crypto`; constant-time compare; HttpOnly, Secure, SameSite=Lax session cookie signed with HMAC; 12-hour expiry; login rate-limited and delayed on failure | No OAuth dependency, no native addon, and the password is shown once and written nowhere else. |
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
