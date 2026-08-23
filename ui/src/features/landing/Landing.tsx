/**
 * The landing page. Also the first screen of the app, which is why it has to
 * be the argument for the product: a site generator whose own front door is
 * ordinary would be its own counter-example.
 *
 * Held to the same rules the generated sites are held to — one committed idea
 * (a page assembling itself), a motion system that recurs (everything rises
 * on the same ease), a measure on every line of prose, and the accent used as
 * light rather than paint.
 */

import { lazy, Suspense, useEffect, useState } from 'react';
import { navigate, useStore } from '@/lib/store';
import { Button, Logo, Count, Index, Reveal, cx } from '@/components/ui';
import { Icon } from '@/components/icons';

const HeroScene = lazy(() => import('./HeroScene').then((m) => ({ default: m.HeroScene })));

const SCENES = [
  ['field', 'A field you move through', 'Light streaks that part around the pointer'],
  ['relief', 'Pressed into a surface', 'Your mark embossed, lit by one moving light'],
  ['wordmark', 'The name, as an object', 'Extruded, bevelled, settling with weight'],
  ['object', 'One thing, turning', 'The product, studio-lit, orbited by scroll'],
  ['liquid', 'Something that flows', 'A shader surface the pointer disturbs'],
  ['diorama', 'A small world', 'An isometric room you can look around'],
  ['cloth', 'Cloth in the wind', 'Silk, canvas, a flag that catches light'],
  ['terrain', 'The ground beneath it', 'A topographic map the camera flies over'],
  ['morph', 'Particles that become things', 'Logo, product, word — one into the next'],
  ['glass', 'Light through glass', 'Refraction bending the type behind it'],
  ['exploded', 'Taken apart', 'Components drift apart as you scroll, labelled'],
  ['ribbons', 'Ribbons that follow you', 'Glossy tubes weaving through the type'],
] as const;

const STEPS = [
  ['Choose', 'Pick the shape of your business and it answers the next twenty questions. Then disagree with the defaults — palette, type, layout, scene, motion. Every choice previews live.', 'sliders'],
  ['Pick a direction', 'Three complete visual directions are built and shown side by side. You look at them, you pick one. Nothing to describe.', 'layout'],
  ['Watch it build', 'A Claude Code session you already pay for takes a real Next.js project — scenes, CRM, analytics included — and makes it yours, stage by stage.', 'cube'],
  ['Tune and publish', 'Drag sliders for spacing, grain, weight, pace. Say what you want in chat, or press one of the chips it offers. Then one press to Vercel.', 'rocket'],
] as const;

export function Landing() {
  const detection = useStore((s) => s.detection);
  const ready = detection?.ok;
  const go = () => navigate(ready ? { name: 'new' } : { name: 'setup' });

  return (
    <div>
      {/* ---------------------------------------------------------- Hero -- */}
      <section className="relative min-h-[min(90svh,820px)] flex overflow-hidden -mt-[52px] pt-[52px] border-b border-line">
        {/* The scene lives in the right half on wide screens and behind the
            type, heavily faded, on narrow ones — so nothing is ever unreadable. */}
        <div className="absolute inset-y-0 right-0 w-full lg:w-[52%] opacity-40 lg:opacity-100">
          <Suspense fallback={null}>
            <HeroScene className="absolute inset-0" />
          </Suspense>
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(90deg,var(--color-ink)_0%,transparent_38%)] hidden lg:block" />
          <div className="absolute inset-x-0 bottom-0 h-24 pointer-events-none bg-[linear-gradient(0deg,var(--color-ink),transparent)]" />
        </div>

        <div className="relative shell-wide w-full flex flex-col justify-center py-16">
          <div className="max-w-[640px]">
            <p className="legend rise text-volt mb-5">A website generator for people who press things</p>
            <h1 className="d1 rise s1">
              Press things.<br />Ship something<br /><span className="serif">people remember.</span>
            </h1>
            <p className="rise s3 mt-7 text-[16.5px] leading-[1.6] text-bone-2 max-w-[46ch]">
              Choose a kind of business, a colour, a 3D scene you can watch move. Your own Claude Code
              builds an award-grade site with a matching CRM, shows you three directions to pick from,
              and publishes it in one press.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-8 rise s4">
              <Button variant="primary" size="lg" iconRight="arrowRight" onClick={go}>
                {ready ? 'Build a site' : 'Start — check requirements'}
              </Button>
              <Button variant="ghost" size="lg" onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })}>
                How it works
              </Button>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-9 rise s5">
              {['No account', 'No token held', 'Nothing leaves this machine'].map((t) => (
                <span key={t} className="telemetry text-bone-3 flex items-center gap-1.5"><Icon name="check" size={12} className="text-volt" />{t}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- Marquee -- */}
      <div className="border-y border-line overflow-hidden py-2.5 bg-ink-2">
        <div className="marquee flex gap-8 whitespace-nowrap telemetry text-bone-3 w-max">
          {Array.from({ length: 2 }).map((_, k) => (
            <span key={k} className="flex gap-8">
              {['13 hero scenes, all real WebGL', '8 layout systems', '17 palettes', '3 directions to choose from', 'a motion system that recurs', 'forms land in your own CRM', 'PostHog · Vercel · GA4 · Plausible', 'one-press publish', 'undo any change'].map((t) => (
                <span key={t} className="flex items-center gap-8"><span>{t}</span><span className="text-volt-3">◆</span></span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* --------------------------------------------------- How it works -- */}
      <Section id="how" n={1} label="How it works">
        <SectionHead
          title={<>Four presses between an idea and a <span className="serif">published site.</span></>}
          lede="Nothing is typed that can be chosen. Nothing is created, installed or spent until the last press."
        />
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-px bg-line mt-10 border border-line rounded-[14px] overflow-hidden">
          {STEPS.map(([t, b, ic], i) => (
            <Reveal key={t} delay={i * 70} className="bg-ink-2 h-full">
              <div className="p-6 h-full flex flex-col group hover:bg-ink-3 transition-colors">
                <div className="flex items-center justify-between mb-12">
                  <span className="telemetry text-volt">{String(i + 1).padStart(2, '0')}</span>
                  <Icon name={ic} size={17} className="text-bone-4 group-hover:text-volt transition-colors" />
                </div>
                <div className="d4 mb-2">{t}</div>
                <p className="text-[13.5px] leading-relaxed text-bone-3">{b}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* -------------------------------------------------------- Scenes -- */}
      <Section n={2} label="Meaningful 3D" bordered>
        <div className="grid lg:grid-cols-[1fr_auto] gap-8 items-end">
          <SectionHead title={<>The hero is an <span className="serif">experience,</span> not a layout.</>} />
          <p className="copy lg:text-right lg:max-w-[42ch]">
            Thirteen scenes that exist as working code, previewed live as you choose, then adapted to
            your business — never a floating sphere, never particles for their own sake. And the
            canvas does not stop at the fold: it stays alive under the whole page.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 mt-10">
          {SCENES.map(([id, t, b], i) => (
            <Reveal key={id} delay={Math.min(i, 8) * 40}>
              <button onClick={go} className="opt flex items-start gap-3.5 group w-full h-full">
                <span className="grid place-items-center w-9 h-9 rounded-lg bg-ink text-volt shrink-0 border border-line group-hover:bg-volt group-hover:text-[color:var(--color-volt-ink)] group-hover:border-volt transition-colors">
                  <Icon name={id} size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-[13.5px] leading-snug">{t}</span>
                  <span className="block text-[12.5px] leading-snug text-bone-3 mt-1">{b}</span>
                </span>
              </button>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------------- Directions -- */}
      <Section n={3} label="Three directions" bordered>
        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-12 items-center">
          <div>
            <SectionHead title={<>You cannot describe a design. You <span className="serif">can</span> point at one.</>} />
            <p className="copy mt-5">
              After the identity stage, three complete visual directions are built from your choices —
              different palettes, different type, different composition — and shown side by side,
              scrolling in sync. Pick the one you want and the build continues in it.
            </p>
            <p className="copy mt-4">
              Then a panel of sliders: spacing, display scale, grain, contrast, reveal distance,
              pace. Drag them and the site changes under you. No prompt to write.
            </p>
            <Button className="mt-7" variant="primary" iconRight="arrowRight" onClick={go}>Try it</Button>
          </div>
          <DirectionsMock />
        </div>
      </Section>

      {/* ----------------------------------------------------------- CRM -- */}
      <Section n={4} label="A CRM that matches" bordered>
        <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-12 items-center">
          <div>
            <SectionHead title={<>Every form lands somewhere you will <span className="serif">actually look.</span></>} />
            <p className="copy mt-5">
              Pipeline kanban, KPI cards with targets, activity timelines, funnels, tables — at{' '}
              <code className="telemetry text-volt">/admin</code>, behind a login, in the site's own
              tokens. Runs locally on SQLite with no account; on Vercel with a free Postgres.
            </p>
            <ul className="mt-6 grid sm:grid-cols-2 gap-y-2 gap-x-6 text-[13.5px] text-bone-2">
              {['Leads and stages, drag to move', 'KPIs with trend and target', 'Funnel from your real events', 'Activity per lead', 'CSV export', 'Dark and light, inherited', 'Honest when empty', 'Secure by default'].map((t) => (
                <li key={t} className="flex items-center gap-2"><Icon name="check" size={13} className="text-volt shrink-0" />{t}</li>
              ))}
            </ul>
          </div>
          <CrmMock />
        </div>
      </Section>

      {/* ----------------------------------------------------------- Bar -- */}
      <Section n={5} label="The quality bar" bordered>
        <SectionHead title={<>Built to the standard of the sites that <span className="serif">win things.</span></>} />
        <div className="grid md:grid-cols-3 gap-8 mt-10">
          {[
            ['One committed idea', 'Every generated site names its organising idea and serves it on every page. Half a good idea applied tastefully is what reads as generated.'],
            ['The scroll is the medium', 'Sections earn their scroll: pinned sequences, counters that scrub, galleries that move sideways, one thing at a time. Slow enough to read.'],
            ['No AI slop', 'No gradient fades, no glass cards, no glowing orbs, no empty placeholder rectangles, no "Welcome to our website". A rubric checks, and a jury stage fixes.'],
          ].map(([t, b], i) => (
            <Reveal key={t} delay={i * 80}>
              <div className="border-t border-line-2 pt-5">
                <div className="d4 mb-2">{t}</div>
                <p className="text-[13.5px] leading-relaxed text-bone-3">{b}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-14 pt-8 border-t border-line">
          {[[13, 'hero scenes'], [8, 'layout systems'], [17, 'palettes'], [6, 'build stages']].map(([n, l]) => (
            <div key={String(l)}>
              <div className="d2 text-volt"><Count to={Number(n)} /></div>
              <div className="legend mt-1.5">{l}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------ Promises -- */}
      <Section n={6} label="Yours, entirely" bordered>
        <div className="grid lg:grid-cols-2 gap-12">
          <div>
            <SectionHead title={<>No login. No token. <span className="serif">No server.</span></>} />
            <p className="copy mt-5">
              Super Builds is a program on your laptop. It starts the Claude Code you already
              installed, against the plan you already pay for. Publishing signs you into Vercel
              through your own browser. Every site it makes is an ordinary Next.js project in a
              folder you own.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button variant="primary" iconRight="arrowRight" onClick={go}>Start</Button>
              <Button variant="ghost" onClick={() => navigate({ name: 'setup' })}>Check requirements</Button>
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
                <li className="panel p-4 flex gap-3.5">
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
      </Section>

      <footer className="border-t border-line py-8">
        <div className="shell-wide flex flex-wrap items-center justify-between gap-4">
          <Logo />
          <span className="telemetry text-bone-4">
            Claude Code · React Three Fiber · Next.js · GSAP · Drizzle. Everything runs here.
          </span>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------- pieces -- */

function Section({ n, label, children, id, bordered }: { n: number; label: string; children: React.ReactNode; id?: string; bordered?: boolean }) {
  return (
    <section id={id} className={cx('py-20 md:py-24', bordered && 'border-t border-line')}>
      <div className="shell-wide">
        <Index n={n} className="mb-10">{label}</Index>
        {children}
      </div>
    </section>
  );
}

function SectionHead({ title, lede }: { title: React.ReactNode; lede?: string }) {
  return (
    <div>
      <h2 className="d2 max-w-[21ch]">{title}</h2>
      {lede && <p className="copy mt-4">{lede}</p>}
    </div>
  );
}

/** Three directions, side by side — a drawing of the real screen. */
function DirectionsMock() {
  const [picked, setPicked] = useState(1);
  const cols = [
    { name: 'monolith', note: 'near-black · marble · condensed', page: '#0B0C0E', ink: '#EFEDE8', accent: '#7C8AA0' },
    { name: 'ember', note: 'warm dark · serif display · firelight', page: '#120C08', ink: '#F2E7DA', accent: '#E4622F' },
    { name: 'stillpage', note: 'cream paper · halftone · editorial', page: '#EFE9DD', ink: '#16150F', accent: '#2F5D50' },
  ];
  return (
    <div className="panel overflow-hidden noise relative">
      <div className="flex items-center justify-between px-3 h-9 border-b border-line">
        <span className="telemetry text-bone-3">3 directions · click a name to go fullscreen</span>
        <span className="telemetry text-bone-4 hidden sm:inline">sync scroll</span>
      </div>
      <div className="grid grid-cols-3 gap-px bg-line">
        {cols.map((c, i) => (
          <button key={c.name} onClick={() => setPicked(i)} className="text-left group relative" style={{ background: c.page }}>
            <div className={cx('px-2 py-1.5 flex items-center gap-1.5 border-b transition-colors', picked === i ? 'border-volt/50' : 'border-transparent')}>
              <span className="telemetry text-[10px] truncate" style={{ color: c.ink }}>{c.name}</span>
              <span className="telemetry text-[9px] truncate opacity-40 hidden md:inline" style={{ color: c.ink }}>{c.note}</span>
            </div>
            <div className="p-3 aspect-[3/4.4]">
              <div className="h-1.5 w-8 rounded-full mb-4" style={{ background: c.accent }} />
              <div className="space-y-1.5 mb-4">
                <div className="h-2.5 w-full rounded-sm" style={{ background: c.ink, opacity: 0.9 }} />
                <div className="h-2.5 w-4/5 rounded-sm" style={{ background: c.ink, opacity: 0.9 }} />
                <div className="h-2.5 w-2/3 rounded-sm" style={{ background: c.accent }} />
              </div>
              <div className="rounded-sm mb-3" style={{ background: c.ink, opacity: 0.12, aspectRatio: '16/10' }} />
              <div className="space-y-1">
                {[1, 0.85, 0.6].map((w, k) => <div key={k} className="h-1 rounded-full" style={{ background: c.ink, opacity: 0.2, width: `${w * 100}%` }} />)}
              </div>
            </div>
            {picked === i && <span className="absolute inset-0 ring-1 ring-inset ring-volt pointer-events-none" />}
          </button>
        ))}
      </div>
      <div className="px-3 h-9 flex items-center justify-between border-t border-line">
        <span className="telemetry text-bone-3">picked · <span className="text-volt">{cols[picked].name}</span></span>
        <span className="telemetry text-bone-4">build continues in this direction</span>
      </div>
    </div>
  );
}

/** A drawn dashboard, in the system's tokens, honest about being a drawing. */
function CrmMock() {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 2600); return () => clearInterval(id); }, []);
  const kpis = [['New leads', 42 + (tick % 3), '+18%'], ['Bookings', 17 + (tick % 2), '+6%'], ['Reply time', '1.8h', '−22%'], ['Won this month', '€12.4k', '+31%']];
  const cols = [['New', 5], ['Contacted', 4], ['Quoted', 3], ['Won', 2]] as const;
  return (
    <div className="panel p-4 relative overflow-hidden noise">
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-volt" /><span className="telemetry text-bone-3">ember-and-oak.com/admin</span></div>
        <span className="telemetry text-bone-4">drawn, not a screenshot</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        {kpis.map(([l, v, d]) => (
          <div key={l} className="panel-2 p-2.5">
            <div className="legend !text-[9px] truncate">{l}</div>
            <div className="d4 !text-[19px] mt-1 num">{v}</div>
            <div className="telemetry text-volt mt-0.5 !text-[10px]">{d}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {cols.map(([name, n], ci) => (
          <div key={name} className="panel-2 p-1.5 min-h-[136px]">
            <div className="flex justify-between items-center px-1 mb-1.5">
              <span className="legend !text-[9px]">{name}</span>
              <span className="telemetry text-bone-4 !text-[10px]">{n}</span>
            </div>
            {Array.from({ length: n }).map((_, i) => (
              <div key={i} className={cx('rounded border p-1.5 mb-1', (i + ci + tick) % 5 === 0 ? 'border-volt-3 bg-volt-2' : 'border-line bg-ink')}>
                <div className="h-1 w-2/3 rounded bg-bone-4 mb-1" />
                <div className="h-1 w-1/3 rounded bg-bone-4/50" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
