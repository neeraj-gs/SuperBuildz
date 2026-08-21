# Super Builds

**Press things. Get an award-grade 3D website and a matching CRM. Built by your
own Claude Code, on your own machine, published to Vercel in one press.**

Super Builds is for people who do not write code. Every question is answered by
choosing — a kind of business, a colour direction, a 3D scene you can see move
before you commit, an analytics choice — and the system compiles those choices
into the brief an experienced studio would have written, hands it to Claude Code
in a real Next.js project, previews the result beside a chat, and publishes it.

Nothing is uploaded, no account is created, no token is held. It spawns the
Claude Code you already have, against the subscription you already pay for.

## Running it

Needs Node 22+ (24 for the daemon), git, and Claude Code installed and signed in.
The first screen checks all of this and offers to fix what is missing.

```sh
npm install
npm start            # builds the interface, starts the daemon, opens a window
```

For development with reload:

```sh
npm run dev          # daemon on 127.0.0.1:7747, UI on 127.0.0.1:5180
```

Verification:

```sh
npm run typecheck
npm test
npm run build
```

## What is in the box

```
packages/protocol/   The contract between daemon and UI
daemon/              Fastify + ws on 127.0.0.1:7747. Spawns claude, runs previews, deploys
ui/                  React + Vite + Tailwind + React Three Fiber
design-library/      3D scenes, skills, references — shared by the wizard and every generated site
templates/site/      The Next.js starter every site begins from (CRM, analytics, tokens, scenes)
docs/                ARCHITECTURE.md and SECURITY.md — every decision, and why
```

Read `docs/ARCHITECTURE.md` first.
