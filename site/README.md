# The public landing page

The same landing page the app opens with, built on its own and deployable
anywhere that serves static files. No copy of it lives here — every component
comes from `../ui/src/features/landing/`, so a change lands on both at once.

## What is different from the app's copy

Nothing is hidden. The controls that would take somebody into the tool are
**not supplied**, so they are not rendered, not in the bundle, and not
reachable by Tab. That is the whole of `../ui/src/features/landing/host.tsx`:
the app passes `revamp`, `requirements` and a list of doors; this build passes
none of them.

The proof is the bundle. The app's is ~396KB and contains the store, the API
client and a websocket; this one is ~95KB and contains none of them — grep it
for `WebSocket` or `/api/` and you will find nothing. `src/main.tsx` imports
nothing from `lib/`, and if it ever needs to, something on the landing page has
quietly started depending on there being a daemon behind it.

What this build adds is the **Get the app** block: the three platforms, and the
honest sentence about why there is no link yet.

## Running it

```
npm run dev:site      # http://127.0.0.1:5190
npm run build:site    # -> site/dist
```

## The demo video

One variable, read at build time. Set it wherever you deploy and the page has
the video without a commit:

```
VITE_DEMO_URL=https://drive.google.com/file/d/<id>/view
VITE_DEMO_LENGTH=1 min 57
```

A Loom share link, a Google Drive share link, a YouTube link or a direct `.mp4`
all work — `../ui/src/features/landing/embed.ts` recognises which and rewrites
it to that host's embed form. Unset, the section shows its "being recorded"
state, which is a designed state rather than a hole.

## Deploying

`vercel.json` is here and builds from the repository root, because the source
is one folder up.

**`"ignoreCommand": "exit 1"` in that file is load-bearing, and it needs saying
here because `vercel.json` has a strict schema and will not accept a comment.**
Vercel skips a build when nothing under the project's root directory changed.
This project's root directory is a lie about where its inputs are — every
component it renders lives in `../ui/src` — so the first push that touched the
landing page and not this folder was cancelled before it started, leaving the
deployed page on the previous build with no failure anywhere to notice. `exit 1`
means build; `exit 0` would mean skip. There is no commit this project can
safely ignore.

From this directory:

```
vercel --prod
```

Anything that serves a folder works just as well — it is one HTML file, one
stylesheet and two scripts. There is no server side and nothing to configure.
