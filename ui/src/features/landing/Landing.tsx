/**
 * The landing page. Also the first screen of the app, which is why it has to
 * be the argument for the product: a site generator whose own front door is
 * ordinary is its own counter-example.
 *
 * ── What changed, and why ──────────────────────────────────────────────────
 *
 * The page used to say that a hero should be an experience, that the canvas
 * should stay alive under the whole page, and that identical card grids are
 * what "generated" looks like — and then it put a scene in one corner of the
 * first screen and spent the next six sections on card grids with a numbered
 * label over each one. Everything below the fold was a list of claims.
 *
 * Now every section has to *be* the thing it claims:
 *
 *   the four presses    a sequence you scroll through, one press per screen,
 *                       with the actual interface drawn beside each one
 *   thirteen scenes     an index you run your eye down, one specimen beside it
 *   three directions    three real pages, scrolling in sync, one pickable
 *   the CRM             a working figure with its own hover and a table twin
 *   several at once     a board that plays: four conversations, three
 *                       projects, one queue, and the notebook they share
 *
 * And behind all of it, one object the length of the page — a website's parts
 * floating apart, drawing together, splitting into three, becoming a
 * dashboard, multiplying into several projects, and settling. Each chapter is
 * the section in front of it. See `Spine.tsx`.
 *
 * ── The eyebrows are gone ──────────────────────────────────────────────────
 *
 * `01 ──── HOW IT WORKS` over every section is the index rule the rest of the
 * tool is built from, and on this page it was doing the opposite of its job:
 * six numbered labels in a row is the single most recognisable tell of a page
 * nobody art-directed. It survives in exactly one place here — the four
 * presses — because that is a real sequence where the order is the
 * information. Everywhere else the heading carries itself.
 */

import { lazy, Suspense, useEffect, useState } from 'react';
import { useHost } from './host';
import { Button, Logo, Count, Reveal, cx } from '@/components/ui';
import { Icon } from '@/components/icons';
import { useChapter, type ChapterId } from './Spine';
import { Steps } from './Steps';
import { Scenes } from './Scenes';
import { Crm } from './Crm';
import { Parallel } from './Parallel';
import { Contact } from './Contact';
import { Demo, playDemo } from './Demo';
import { Faq } from './Faq';
import { Download } from './Download';

const Spine = lazy(() => import('./Spine').then((m) => ({ default: m.Spine })));

const PROVIDERS = ['Vercel', 'Netlify', 'PostHog', 'GA4', 'Plausible', 'Amplitude', 'Mixpanel', 'Umami', 'Fathom', 'Simple', 'Cloudflare', 'the built-in one'];

export function Landing() {
  /*
    Every control that would take somebody into the tool comes from the host,
    and the public one simply does not supply them. Removed rather than
    disabled: a greyed-out button on a page where the product does not exist is
    an invitation to wonder what is wrong with your browser.
  */
  const host = useHost();
  const go = host.start;

  return (
    <div className="relative">
      {/*
        Fixed, behind everything, and never in the way: it takes no pointer
        events, and every band of prose sits on its own ground so nothing is
        ever read against moving geometry.
      */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <Suspense fallback={null}><Spine className="absolute inset-0" /></Suspense>
        {/*
          Ground under the reading column, and a floor at the bottom of the
          viewport: the object is allowed to be behind the page, never behind a
          sentence. On a phone there is no column to hide behind — the text is
          the full width — so the whole thing goes to a suggestion instead.
        */}
        <div className="absolute inset-0 bg-[linear-gradient(100deg,var(--color-ink)_0%,var(--color-ink)_26%,transparent_62%)] hidden lg:block" />
        <div className="absolute inset-0 bg-ink/88 lg:hidden" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(0deg,var(--color-ink),transparent)]" />
      </div>

      <div className="relative z-10">
        {/* ---------------------------------------------------------- Hero -- */}
        <Chapter id="explode" className="min-h-[min(92svh,880px)] flex items-center -mt-[52px] pt-[52px]">
          <div className="shell-wide w-full py-16">
            <div className="max-w-[660px]">
              <p className="legend rise text-volt mb-5">A website generator for people who press things</p>
              <h1 className="d1 rise s1 text-balance">
                Press things.<br />Ship something<br /><span className="serif">people remember.</span>
              </h1>
              <p className="rise s3 mt-7 text-[16.5px] leading-[1.6] text-bone-2 max-w-[46ch]">
                Choose a kind of business, a colour, a 3D scene you can watch move. Your own Claude Code
                builds an award-grade site with a matching CRM, shows you three directions to pick from,
                and publishes it in one press.
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-8 rise s4">
                <Button variant="primary" size="lg" iconRight="arrowRight" onClick={go}>{host.startLabel}</Button>
                {host.revamp
                  ? <Button variant="ghost" size="lg" icon="refresh" onClick={host.revamp}>Revamp one you have</Button>
                  : <Button variant="ghost" size="lg" icon="play" onClick={playDemo}>Watch a full run</Button>}
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 mt-9 rise s5">
                {['No account', 'No token held', 'Nothing leaves this machine'].map((t) => (
                  <span key={t} className="telemetry text-bone-3 flex items-center gap-1.5"><Icon name="check" size={12} className="text-volt" />{t}</span>
                ))}
              </div>
            </div>
          </div>
        </Chapter>

        {/* ------------------------------------------------------- Marquee -- */}
        <div className="border-y border-line overflow-hidden py-2.5 bg-ink-2/90 backdrop-blur-sm">
          <div className="marquee flex gap-8 whitespace-nowrap telemetry text-bone-3 w-max">
            {Array.from({ length: 2 }).map((_, k) => (
              <span key={k} className="flex gap-8">
                {['13 hero scenes, all real WebGL', '8 layout systems', '17 palettes', '3 directions to choose from', 'forms land in your own CRM', '12 places to send your analytics', 'several projects at once', 'one-press publish', 'undo any change'].map((t) => (
                  <span key={t} className="flex items-center gap-8"><span>{t}</span><span className="text-volt-3">◆</span></span>
                ))}
              </span>
            ))}
          </div>
        </div>

        {/* ----------------------------------------------------------- Demo -- */}
        {/*
          Directly under the hero, because the first thing somebody wants after
          "press things, ship something people remember" is to see somebody
          press things. It is a plain section rather than a `Chapter`: it does
          not claim a movement of the object behind the page, so the scene holds
          whatever the hero left it on while you watch.
        */}
        {/*
          Public only, and directly under the hero. It is the whole reason
          somebody is on the page rather than in the app, and it carries the
          answer to the question its own bad news provokes — what does it
          actually do — as a row of the same weight.
        */}
        {host.mode === 'public' && <Download />}

        <Demo />

        {/* --------------------------------------------------- Four presses -- */}
        <Chapter id="assemble" className="py-20 md:py-24">
          <div className="shell-wide">
            <div className="max-w-[46ch]">
              <h2 className="d2 text-balance">Four presses between an idea and a <span className="serif">published site.</span></h2>
              <p className="copy mt-4">
                Nothing is typed that can be chosen. Nothing is created, installed or spent until the
                last press.
              </p>
            </div>
            <Steps />
          </div>
        </Chapter>

        {/* -------------------------------------------------------- Scenes -- */}
        <Chapter id="index" className="py-20 md:py-24 border-t border-line">
          <div className="shell-wide">
            <div className="max-w-[46ch] mb-12">
              <h2 className="d2 text-balance">The hero is an <span className="serif">experience,</span> not a layout.</h2>
              <p className="copy mt-4">
                Thirteen of them, and not one is a floating sphere. Run your eye down the list — the
                specimen beside it changes as you go.
              </p>
            </div>
            <Scenes onPick={go} />
          </div>
        </Chapter>

        {/* ---------------------------------------------------- Directions -- */}
        <Chapter id="directions" className="py-20 md:py-24 border-t border-line">
          <div className="shell-wide">
            <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-10 lg:gap-14 items-center">
              <div>
                <h2 className="d2 text-balance">You cannot describe a design. You <span className="serif">can</span> point at one.</h2>
                <p className="copy mt-5">
                  After the identity stage, three complete visual directions get built from your
                  answers — different palettes, different type, different composition — and shown side
                  by side, scrolling in sync. Pick the one you want and the build continues in it.
                </p>
                <p className="copy mt-4">
                  Then a panel of sliders: spacing, display scale, grain, contrast, reveal distance,
                  pace. Drag them and the site changes under you. No prompt to write.
                </p>
                <Button className="mt-7" variant="primary" iconRight="arrowRight" onClick={go}>Try it</Button>
              </div>
              <DirectionsBoard />
            </div>
          </div>
        </Chapter>

        {/* ----------------------------------------------------------- CRM -- */}
        <Chapter id="dashboard" className="py-20 md:py-24 border-t border-line">
          <div className="shell-wide">
            <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-10 lg:gap-14 items-start">
              <div>
                <h2 className="d2 text-balance">Every form lands somewhere you will <span className="serif">actually look.</span></h2>
                <p className="copy mt-5">
                  Pipeline with money on it, KPIs against targets, a day-by-hour heatmap, the journey
                  with its drop-off, who has gone cold — at <code className="telemetry text-volt">/admin</code>,
                  behind a login, in the site's own colours and type. SQLite on your machine, Postgres
                  on Vercel, no account either way.
                </p>
                <ul className="mt-6 grid sm:grid-cols-2 lg:grid-cols-1 gap-y-2 gap-x-6 text-[13.5px] text-bone-2">
                  {['Leads and stages, drag to move', 'Targets, not just totals', 'Funnel from real events', 'Activity per lead', 'CSV export', 'Honest when empty'].map((t) => (
                    <li key={t} className="flex items-center gap-2"><Icon name="check" size={13} className="text-volt shrink-0" />{t}</li>
                  ))}
                </ul>
                <p className="text-[13px] text-bone-3 mt-7 pt-5 border-t border-line">
                  And if you would rather read your numbers somewhere else, the site can send them to
                  any of these instead — the keys go in from the project screen, and the link to your
                  own dashboard sits in the tool.
                </p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {PROVIDERS.map((p) => <span key={p} className="telemetry text-bone-3 border border-line rounded-full px-2.5 py-1">{p}</span>)}
                </div>
              </div>
              <div className="lg:sticky lg:top-[76px]"><Crm /></div>
            </div>
          </div>
        </Chapter>

        {/* ------------------------------------------- Several at once (new) -- */}
        <Chapter id="parallel" className="py-20 md:py-24 border-t border-line">
          <div className="shell-wide">
            <div className="max-w-[52ch] mb-10">
              <h2 className="d2 text-balance">Three projects. Four conversations. <span className="serif">One machine.</span></h2>
              <p className="copy mt-4">
                Open as many projects as you like, and as many conversations inside each one as the
                work needs. They run at the same time, on the same laptop, and they know what the
                others have done.
              </p>
            </div>

            <Parallel />

            <div className="grid md:grid-cols-3 gap-8 mt-12">
              {[
                ['Nothing waits on anything else', 'A conversation about the menu page and one about the booking form are two Claude Code sessions, not one queue. Each project is its own folder and its own git repository, so two of them can be mid-change at once without ever touching the same file.'],
                ['The queue is shown, not hidden', 'Your machine runs as many at once as it comfortably can — half its cores, so the laptop stays usable — and anything over that waits and then starts on its own. A message that has not begun says it is second in line rather than spinning at you.'],
                ['They are not strangers', 'The moment a project has two conversations they would otherwise be two assistants with amnesia, one undoing what the other was just told. So every one of them reads the same notebook: what you have said once and never want to repeat, and a line written each time any conversation finishes a turn.'],
              ].map(([t, b], i) => (
                <Reveal key={t} delay={i * 80}>
                  <div className="border-t border-line-2 pt-5">
                    <h3 className="d4 mb-2 text-balance">{t}</h3>
                    <p className="text-[13.5px] leading-relaxed text-bone-3">{b}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </Chapter>

        {/* ----------------------------------------------------- The bar -- */}
        <Chapter id="rest" className="py-20 md:py-24 border-t border-line">
          <div className="shell-wide">
            <div className="max-w-[46ch]">
              <h2 className="d2 text-balance">Built to the standard of the sites that <span className="serif">win things.</span></h2>
              <p className="copy mt-4">
                The rubric is in the repository, the jury stage reads it, and what fails it gets fixed
                before you ever see the site.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 mt-12">
              {[
                ['One committed idea', 'Every generated site names its organising idea and serves it on every page. Half a good idea applied tastefully is exactly what reads as generated.'],
                ['The scroll is the medium', 'Sections earn their scroll: pinned sequences, counters that scrub, galleries that move sideways, one thing at a time — slow enough to actually read.'],
                ['No slop', 'No gradient fades, no glass cards, no glowing orbs, no rows of identical boxes, no "Welcome to our website". A rubric checks and a jury stage fixes.'],
              ].map(([t, b], i) => (
                <Reveal key={t} delay={i * 80}>
                  <div className="border-t border-line-2 pt-5">
                    <h3 className="d4 mb-2">{t}</h3>
                    <p className="text-[13.5px] leading-relaxed text-bone-3">{b}</p>
                  </div>
                </Reveal>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-14 pt-8 border-t border-line">
              {[[13, 'hero scenes'], [8, 'layout systems'], [17, 'palettes'], [16, 'kinds of business']].map(([n, l]) => (
                <div key={String(l)}>
                  <div className="d2 text-volt"><Count to={Number(n)} /></div>
                  <div className="legend mt-1.5">{l}</div>
                </div>
              ))}
            </div>
          </div>
        </Chapter>

        {/* ------------------------------------------------------ Promises -- */}
        <section className="py-20 md:py-24 border-t border-line">
          <div className="shell-wide grid lg:grid-cols-2 gap-10 lg:gap-14">
            <div>
              <h2 className="d2 text-balance">No login. No token. <span className="serif">No server.</span></h2>
              <p className="copy mt-5">
                Super Builds is a program on your laptop. It starts the Claude Code you already
                installed, against the plan you already pay for. Publishing signs you into Vercel
                through your own browser. Every site it makes is an ordinary Next.js project in a
                folder you own, and you can point it at a site you already have instead.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button variant="primary" size="lg" iconRight="arrowRight" onClick={go}>{host.startLabel}</Button>
                {host.requirements && <Button variant="ghost" size="lg" onClick={host.requirements}>Check requirements</Button>}
              </div>
            </div>
            <ul className="grid gap-2">
              {[
                ['lock', 'Never reads a credential file', 'It asks Claude Code and the Vercel CLI about themselves. Nothing secret comes back.'],
                ['shield', 'Never holds a token', "Keys a site needs go into that site's .env.local once, and nowhere else."],
                ['eye', 'Never calls a model provider', 'Only your Claude Code talks to Anthropic.'],
                ['house', 'Binds to 127.0.0.1', 'Nothing on your network can reach it; every change needs a per-boot token.'],
                ['undo', 'Everything can be undone', 'A checkpoint before every change and a git commit after.'],
              ].map(([ic, t, b], i) => (
                <Reveal key={t} delay={i * 55}>
                  <li className="panel bg-ink-2/80 backdrop-blur-sm p-4 flex gap-3.5">
                    <Icon name={ic} size={17} className="text-volt shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-[13.5px]">{t}</div>
                      <div className="text-bone-3 text-[12.5px] leading-relaxed mt-0.5">{b}</div>
                    </div>
                  </li>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* -------------------------------------------------------- Contact -- */}
        <Contact />

        {/* ------------------------------------------------------------ FAQ -- */}
        <Faq />

        <Footer onStart={go} ready={host.ready} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- pieces -- */

/**
 * The bottom of the page.
 *
 * ── What was there, and why it went ─────────────────────────────────────────
 *
 * "Claude Code · React Three Fiber · Next.js · GSAP · Drizzle. Everything runs
 * here." — a list of dependencies, centred, in a footer. Two of those five
 * names mean something to the person this page is for, and the sentence they
 * were carrying ("everything runs here") is already the headline of the
 * section immediately above it. It was filler wearing a badge.
 *
 * ── What a footer here is actually for ──────────────────────────────────────
 *
 * Somebody who read the whole page and did not press anything. That is not an
 * uninterested reader — it is one who reached the bottom looking for the thing
 * they wanted and did not find it on the way. So the footer is that: every
 * door in the product, every place on this page, and every way to reach me,
 * named in words, in three columns you can scan rather than one line you have
 * to read.
 */
function Footer({ onStart, ready }: { onStart: () => void; ready?: boolean }) {
  const host = useHost();
  const COLUMNS: Array<{ title: string; links: Array<{ label: string; onClick?: () => void; href?: string }> }> = [
    // On the public page `doors` is empty and the whole column goes with it,
    // rather than standing there with nothing under its heading.
    ...(host.doors.length
      ? [{
        title: 'Build',
        links: [
          { label: ready ? 'A new site' : 'Start — check requirements', onClick: onStart },
          ...host.doors,
        ],
      }]
      : []),
    {
      title: 'This page',
      links: [
        ...(host.mode === 'public' ? [{ label: 'Get the app', href: '#get' }] : []),
        { label: 'Watch a full run', href: '#demo' },
        { label: 'How you get it', href: '#contact' },
        { label: 'Questions', href: '#faq' },
        // A button rather than `#top`: the hero registers itself with the scene
        // behind the page by id, and giving it a second, DOM one to be jumped
        // to is two meanings for one attribute.
        { label: 'Back to the top', onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
      ],
    },
    {
      title: 'Neeraj GS',
      links: [
        { label: 'Email', href: 'mailto:gsneeraj2002@gmail.com?subject=Super%20Builds' },
        { label: 'Portfolio', href: 'https://www.neerajgs.dev/' },
        { label: 'LinkedIn', href: 'https://www.linkedin.com/in/neeraj-gs' },
        { label: 'X', href: 'https://x.com/neeraj_gs_05' },
        { label: 'GitHub', href: 'https://github.com/neeraj-gs' },
      ],
    },
  ];

  return (
    <footer className="border-t border-line bg-ink/80 backdrop-blur-sm">
      {/* Written out rather than composed, because Tailwind only ships classes
          it can see as literals in the source. Two columns on the public page,
          three inside the app. */}
      <div className={cx('shell-wide py-12 md:py-14 grid gap-10 md:gap-8', COLUMNS.length === 2 ? 'md:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))]' : 'md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]')}>
        <div className="min-w-0">
          <Logo />
          <p className="text-[13px] leading-relaxed text-bone-3 mt-4 max-w-[34ch]">
            A website generator for people who press things. It runs on your laptop, drives the
            Claude Code you already have, and every site it makes is a folder you own.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-5">
            {['No account', 'No token held', 'Nothing leaves this machine'].map((t) => (
              <span key={t} className="telemetry text-bone-4 flex items-center gap-1.5">
                <Icon name="check" size={11} className="text-volt-3" />{t}
              </span>
            ))}
          </div>
        </div>

        {COLUMNS.map((col) => (
          <nav key={col.title} className="min-w-0">
            <h3 className="legend">{col.title}</h3>
            <ul className="mt-3.5 grid gap-2">
              {col.links.map((l) => (
                <li key={l.label}>
                  {l.href ? (
                    <a
                      href={l.href}
                      {...(l.href.startsWith('http') ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
                      className="text-[13px] text-bone-3 hover:text-bone transition-colors"
                    >
                      {l.label}
                    </a>
                  ) : (
                    <button onClick={l.onClick} className="text-[13px] text-bone-3 hover:text-bone transition-colors text-left">
                      {l.label}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-line">
        <div className="shell-wide py-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <span className="telemetry text-bone-4">© {new Date().getFullYear()} Neeraj GS</span>
          <span className="telemetry text-bone-4">
            There is no service here to cancel, and nothing that can be taken away.
          </span>
        </div>
      </div>
    </footer>
  );
}

/**
 * A section that tells the scene behind it which chapter it is.
 *
 * Registering the element rather than a scroll fraction means a section can be
 * moved, cut or added and the scene still describes whatever is actually on
 * screen.
 */
function Chapter({ id, className, children }: { id: ChapterId; className?: string; children: React.ReactNode }) {
  const ref = useChapter(id);
  return <section ref={ref as React.RefObject<HTMLElement>} className={className}>{children}</section>;
}

/**
 * Three directions, scrolling in sync — a drawing of the real screen, doing
 * the one thing that screen does that a still image cannot show.
 */
function DirectionsBoard() {
  const [picked, setPicked] = useState(1);
  const [scroll, setScroll] = useState(0);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (held || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setScroll((s) => (s + 1) % 4), 1400);
    return () => clearInterval(id);
  }, [held]);

  const cols = [
    { name: 'monolith', note: 'near-black · marble · condensed', page: '#0B0C0E', ink: '#EFEDE8', accent: '#7C8AA0' },
    { name: 'ember', note: 'warm dark · serif display · firelight', page: '#120C08', ink: '#F2E7DA', accent: '#E4622F' },
    { name: 'stillpage', note: 'cream paper · halftone · editorial', page: '#EFE9DD', ink: '#16150F', accent: '#2F5D50' },
  ];

  return (
    <div
      className="panel overflow-hidden noise relative bg-ink-2/80 backdrop-blur-sm"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
    >
      <div className="flex items-center justify-between px-3 h-9 border-b border-line">
        <span className="telemetry text-bone-3">3 directions · press one to keep it</span>
        <span className="telemetry text-bone-4 hidden sm:inline">{held ? 'held' : 'scrolling in sync'}</span>
      </div>
      <div className="grid grid-cols-3 gap-px bg-line">
        {cols.map((c, i) => (
          <button key={c.name} onClick={() => setPicked(i)} className="text-left relative overflow-hidden" style={{ background: c.page }}>
            <div className={cx('px-2 py-1.5 flex items-center gap-1.5 border-b transition-colors', picked === i ? 'border-volt/50' : 'border-transparent')}>
              <span className="telemetry !text-[10px] truncate" style={{ color: c.ink }}>{c.name}</span>
              <span className="telemetry !text-[9px] truncate opacity-40 hidden md:inline" style={{ color: c.ink }}>{c.note}</span>
            </div>
            <div className="p-3 aspect-[3/4.4] overflow-hidden">
              <div
                className="transition-transform duration-[1200ms]"
                style={{ transform: `translateY(${-scroll * 26}px)`, transitionTimingFunction: 'var(--sb-ease)' }}
              >
                <div className="h-1.5 w-8 rounded-full mb-4" style={{ background: c.accent }} />
                <div className="space-y-1.5 mb-4">
                  <div className="h-2.5 w-full rounded-sm" style={{ background: c.ink, opacity: 0.9 }} />
                  <div className="h-2.5 w-4/5 rounded-sm" style={{ background: c.ink, opacity: 0.9 }} />
                  <div className="h-2.5 w-2/3 rounded-sm" style={{ background: c.accent }} />
                </div>
                <div className="rounded-sm mb-3" style={{ background: c.ink, opacity: 0.12, aspectRatio: '16/10' }} />
                <div className="space-y-1 mb-4">
                  {[1, 0.85, 0.6].map((w, k) => <div key={k} className="h-1 rounded-full" style={{ background: c.ink, opacity: 0.2, width: `${w * 100}%` }} />)}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[0, 1, 2, 3].map((k) => <div key={k} className="rounded-sm" style={{ background: c.ink, opacity: 0.09, aspectRatio: '4/3' }} />)}
                </div>
              </div>
            </div>
            {picked === i && <span className="absolute inset-0 ring-1 ring-inset ring-volt pointer-events-none" />}
          </button>
        ))}
      </div>
      <div className="px-3 h-9 flex items-center justify-between border-t border-line">
        <span className="telemetry text-bone-3">keeping · <span className="text-volt">{cols[picked].name}</span></span>
        <span className="telemetry text-bone-4">the build continues in it</span>
      </div>
    </div>
  );
}
