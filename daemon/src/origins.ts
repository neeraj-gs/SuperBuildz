/**
 * Which browsers the daemon answers, and why the answer is not a list of ports.
 *
 * ── The bug this exists for ────────────────────────────────────────────────
 *
 * The allowlist used to be four literal strings: the daemon's own origin and
 * `127.0.0.1:5180`, the port Vite happens to use. Then somebody ran a second
 * project that already had 5180, Vite moved itself to 5181 — which it does
 * silently and by design — and the whole product broke in three different
 * disguises at once:
 *
 *   · "Internal Server Error" on anything that changed state. The rejection
 *     was raised as an exception, so Fastify turned a CORS decision into a 500.
 *   · "daemon offline" forever, because the socket carries the token and the
 *     socket was closed on the same rule.
 *   · Everything else looking fine, because a browser sends no `Origin` on a
 *     same-origin GET, so the project list still loaded.
 *
 * Three symptoms, one line, and nothing on screen connecting them to a port
 * number. A rule that fails like that is the wrong rule.
 *
 * ── What the rule is now ───────────────────────────────────────────────────
 *
 * Any loopback origin, on any port. Which is a real widening, so it is paired
 * with two things in `index.ts` that make it safe rather than merely
 * convenient:
 *
 *   · a `Host` check, which is the actual defence against DNS rebinding —
 *     a remote page pointing a name it controls at 127.0.0.1 arrives with its
 *     own `Host`, and never with a loopback one;
 *   · the per-boot token extended to every route that returns the person's
 *     own data, not only to the ones that change it. CORS was never the
 *     boundary; it protects a *remote* page from reading the response. The
 *     token is what stops a local one, and it now guards reads too.
 *
 * Net of the three, a page from the internet is refused exactly as before, a
 * page on another local port can no longer read a project's files (it could,
 * on 5180), and a moved port breaks nothing.
 */

/**
 * `localhost`, `::1`, or anything in 127.0.0.0/8.
 *
 * Deliberately not `*.localhost`: RFC 6761 says those resolve to loopback and
 * Chrome honours it, but it is a name a resolver could be made to answer
 * differently, and nothing here needs it.
 */
export function isLoopbackHostname(hostname: string): boolean {
  const name = hostname.trim().toLowerCase().replace(/^\[/, '').replace(/\]$/, '');
  if (name === 'localhost') return true;
  if (name === '::1' || name === '0:0:0:0:0:0:0:1') return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(name);
  if (!m) return false;
  const octets = m.slice(1).map(Number);
  if (octets.some((n) => n > 255)) return false;
  return octets[0] === 127;
}

/**
 * May a page from this origin talk to us?
 *
 * An absent origin is allowed: browsers omit it on same-origin GETs, and a
 * request with no origin at all is not a browser doing something on another
 * page's behalf. The token guard is what stands behind this.
 */
export function originAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  if (origin === 'null') return false;      // a sandboxed frame or a file:// page
  let url: URL;
  try { url = new URL(origin); } catch { return false; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  return isLoopbackHostname(url.hostname);
}

/**
 * Is this request addressed to us by a loopback name?
 *
 * The defence against DNS rebinding, and the reason the origin rule above can
 * be as loose as it is. `evil.example` resolving to 127.0.0.1 reaches the
 * socket with `Host: evil.example`, which is not loopback, and is refused
 * before it reaches a route.
 *
 * A missing `Host` is allowed. HTTP/1.1 requires one and every browser sends
 * one, so its absence means a script or a probe, which this check was never
 * about.
 */
export function hostAllowed(host: string | undefined): boolean {
  if (!host) return true;
  try { return isLoopbackHostname(new URL(`http://${host}`).hostname); } catch { return false; }
}

/**
 * Routes that answer with the person's own work: their projects, the files
 * inside them, and every transcript. Guarded on GET as well as on POST.
 *
 * The open remainder — health, the catalogue, what is installed on the machine
 * — is what the interface reads before the socket has handed it a token, and
 * none of it is anybody's.
 */
export function needsToken(method: string, url: string): boolean {
  if (method === 'OPTIONS') return false;
  if (!url.startsWith('/api/')) return false;
  if (method !== 'GET' && method !== 'HEAD') return true;
  const path = url.split('?')[0];
  return path.startsWith('/api/projects') || path.startsWith('/api/sessions') || path === '/api/capacity';
}
