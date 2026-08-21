/**
 * The landing page. Also the first screen of the app, which is why it has to
 * be the argument for the product: a site generator whose own front door is
 * ordinary would be its own counter-example.
 */

import { lazy, Suspense, useEffect, useState } from 'react';
import { navigate, useStore } from '@/lib/store';
import { Button, Logo, Count, cx } from '@/components/ui';
import { Icon } from '@/components/icons';

const HeroScene = lazy(() => import('./HeroScene').then((m) => ({ default: m.HeroScene })));

const SCENE_CARDS = [
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

export function Landing() {
  const detection = useStore((s) => s.detection);
  const ready = detection?.ok;
  const go = () => navigate(ready ? { name: 'new' } : { name: 'setup' });

  return (
    <div className="-mt-14">
      {/* Hero */}
      <section className="relative h-[100svh] min-h-[640px] overflow-hidden">
        <Suspense fallback={<div className="absolute inset-0 bg-ink" />}>
          <HeroScene className="absolute inset-0" />
        </Suspense>
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-ink/30 pointer-events-none" />
        <div className="relative h-full flex flex-col justify-between px-6 md:px-10 lg:px-14 pt-4 pb-10">
          <div className="h-10 flex items-center justify-between">
            <Logo />
            <div className="flex items-center gap-2">
              <Button variant="quiet" size="sm" onClick={() => navigate({ name: 'setup' })}>Requirements</Button>
              <Button variant="quiet" size="sm" onClick={() => navigate({ name: 'projects' })}>Projects</Button>
            </div>
          </div>
          <div className="max-w-[1100px]">
            <p className="legend rise mb-5 text-volt">A website generator for people who press things</p>
            <h1 className="display text-[clamp(3rem,9.4vw,9.6rem)] rise d1">
              Press things.<br />Ship something<br /><span className="text-volt">people remember.</span>
            </h1>
            <p className="lede rise d3 mt-7">
              Choose a kind of business, a colour, a 3D scene you can watch move, an analytics choice — and your own Claude Code builds an award-grade site with a matching CRM, previews it beside a chat, and publishes it in one press. No typing required. No account. Nothing leaves your machine.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-8 rise d4">
              <Button variant="primary" size="lg" iconRight="arrowRight" onClick={go}>{ready ? 'Build a site' : 'Start — check requirements'}</Button>
              <Button variant="ghost" size="lg" onClick={() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })}>How it works</Button>
              <span className="telemetry text-bone-3 ml-2">Runs on your Claude subscription · Publishes to Vercel</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="telemetry text-bone-3">Scroll, and watch the site assemble</span>
            <span className="telemetry text-bone-3 hidden md:inline">WebGL · R3F · GSAP · Next.js · Drizzle</span>
          </div>
        </div>
      </section>

      {/* Marquee */}
      <div className="border-y border-line overflow-hidden py-3 bg-ink-2">
        <div className="marquee flex gap-10 whitespace-nowrap telemetry text-bone-2 w-max">
          {Array.from({ length: 2 }).map((_, k) => (
            <span key={k} className="flex gap-10">
              {['13 hero scenes, all real WebGL', '8 layout systems', '17 palettes', 'a motion system that recurs', 'forms that land in your own CRM', 'PostHog · Vercel · GA4 · Plausible', 'one-press publish', 'your own Claude Code', 'no login, no token, no server', 'undo any change'].map((t) => <span key={t} className="flex items-center gap-10"><span>{t}</span><span className="text-volt">◆</span></span>)}
            </span>
          ))}
        </div>
      </div>

      {/* How it works */}
      <section id="how" className="px-6 md:px-10 lg:px-14 py-28 max-w-[1400px] mx-auto">
        <p className="legend mb-4">How it works</p>
        <h2 className="display text-[clamp(2rem,5vw,4.6rem)] max-w-[14ch]">Four presses between an idea and a published site.</h2>
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 mt-14">
          {[
            ['01', 'Choose', 'Pick the shape of your business and it answers the next twenty questions. Then disagree with the defaults: palette, type, layout, scene, motion, analytics. Every choice has a live preview.', 'sliders'],
            ['02', 'Watch it build', 'A Claude Code session you already pay for takes a real Next.js project — scenes, CRM, analytics included — and makes it yours, stage by stage, while the preview fills in.', 'cube'],
            ['03', 'Refine by chat', 'Say "make the hero slower" or press one of the chips Claude offers. Every change is a checkpoint you can undo. The preview hot-reloads beside you.', 'chat'],
            ['04', 'Publish', 'One press to Vercel, through your own browser. Forms start landing in your CRM at /admin, in your site\'s own colours.', 'rocket'],
          ].map(([n, t, b, ic]) => (
            <div key={n} className="panel p-7 relative overflow-hidden group">
              <div className="flex items-center justify-between mb-10"><span className="telemetry text-volt">{n}</span><Icon name={ic} size={20} className="text-bone-3 group-hover:text-volt transition-colors" /></div>
              <div className="display-sm text-[24px] mb-3">{t}</div>
              <p className="text-bone-2 text-[14.5px] leading-relaxed">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Scenes */}
      <section className="px-6 md:px-10 lg:px-14 py-24 border-t border-line">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex flex-wrap items-end justify-between gap-6 mb-12">
            <div>
              <p className="legend mb-4">Meaningful 3D</p>
              <h2 className="display text-[clamp(2rem,5vw,4.6rem)] max-w-[16ch]">The hero is an experience, not a layout.</h2>
            </div>
            <p className="lede max-w-[44ch]">Thirteen scenes that exist as working code, previewed live as you choose, then adapted to your business — never a floating sphere, never particles for their own sake.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {SCENE_CARDS.map(([id, t, b]) => (
              <button key={id} onClick={go} className="opt flex items-start gap-4 group">
                <span className="grid place-items-center w-11 h-11 rounded-xl bg-ink-3 text-volt shrink-0 group-hover:bg-volt group-hover:text-ink transition-colors"><Icon name={id} size={22} /></span>
                <span><span className="block font-semibold">{t}</span><span className="block text-[13px] text-bone-3 mt-0.5">{b}</span></span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* CRM */}
      <section className="px-6 md:px-10 lg:px-14 py-24 border-t border-line">
        <div className="max-w-[1400px] mx-auto grid lg:grid-cols-[1fr_1.3fr] gap-12 items-center">
          <div>
            <p className="legend mb-4">A CRM that matches</p>
            <h2 className="display text-[clamp(2rem,4.6vw,4.2rem)] max-w-[14ch]">Every form lands somewhere you will actually look.</h2>
            <p className="lede mt-6">Pipeline kanban, KPI cards with targets, activity timelines, funnels, tables — at <code className="telemetry text-volt">/admin</code>, behind a login, in the site's own tokens. Drawn from the restraint of Linear, Stripe and Vercel and the readability of Attio and Pipedrive. Runs locally on SQLite with no account; on Vercel with a free Postgres.</p>
            <ul className="mt-7 grid sm:grid-cols-2 gap-y-2 gap-x-6 text-[14px] text-bone-2">
              {['Leads and stages, drag to move', 'KPIs with trend and target', 'Funnel from your real events', 'Activity per lead', 'CSV export', 'Dark and light, inherited', 'Honest when empty', 'Secure by default'].map((t) => <li key={t} className="flex items-center gap-2"><Icon name="check" size={14} className="text-volt" />{t}</li>)}
            </ul>
          </div>
          <CrmMock />
        </div>
      </section>

      {/* Bar */}
      <section className="px-6 md:px-10 lg:px-14 py-24 border-t border-line">
        <div className="max-w-[1400px] mx-auto">
          <p className="legend mb-4">The quality bar</p>
          <h2 className="display text-[clamp(2rem,4.6vw,4.2rem)] max-w-[16ch]">Built to the standard of the sites that win things.</h2>
          <div className="grid md:grid-cols-3 gap-4 mt-12">
            {[
              ['One committed idea', 'Every generated site names its organising idea and serves it on every page. Half a good idea applied tastefully is what reads as generated.'],
              ['A motion system', 'The gesture the hero makes — its ease, its direction, how the accent behaves — recurs in every reveal, hover and transition.'],
              ['No AI slop', 'No gradient fades, no glass cards, no glowing orbs, no stock-photo grids, no "Welcome to our website". A rubric checks, and a review stage fixes.'],
            ].map(([t, b]) => (
              <div key={t} className="border-t border-line-2 pt-6"><div className="display-sm text-[20px] mb-2">{t}</div><p className="text-bone-2 text-[14.5px]">{b}</p></div>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16">
            {[[13, 'hero scenes'], [8, 'layout systems'], [17, 'palettes'], [5, 'build stages']].map(([n, l]) => (
              <div key={String(l)}><div className="display text-[56px] text-volt"><Count to={Number(n)} /></div><div className="legend mt-1">{l}</div></div>
            ))}
          </div>
        </div>
      </section>

      {/* Promises */}
      <section className="px-6 md:px-10 lg:px-14 py-24 border-t border-line">
        <div className="max-w-[1400px] mx-auto grid lg:grid-cols-2 gap-12">
          <div>
            <p className="legend mb-4">Yours, entirely</p>
            <h2 className="display text-[clamp(2rem,4.6vw,4.2rem)] max-w-[14ch]">No login. No token. No server.</h2>
            <p className="lede mt-6">Super Builds is a program on your laptop. It starts the Claude Code you already installed, against the plan you already pay for. Publishing signs you into Vercel through your own browser. Every site it makes is an ordinary Next.js project in a folder you own.</p>
            <div className="mt-8 flex gap-3"><Button variant="primary" iconRight="arrowRight" onClick={go}>Start</Button><Button variant="ghost" onClick={() => navigate({ name: 'setup' })}>Check requirements</Button></div>
          </div>
          <ul className="grid gap-3">
            {[
              ['lock', 'Never reads a credential file', 'It asks Claude Code and the Vercel CLI about themselves. Nothing secret comes back.'],
              ['shield', 'Never holds a token', 'Keys a site needs go into that site\'s .env.local once, and nowhere else.'],
              ['eye', 'Never calls a model provider', 'Only your Claude Code talks to Anthropic.'],
              ['house', 'Binds to 127.0.0.1', 'Nothing on your network can reach it; every change needs a per-boot token.'],
              ['undo', 'Everything can be undone', 'A checkpoint before every change and a git commit after.'],
            ].map(([ic, t, b]) => (
              <li key={t} className="panel p-5 flex gap-4"><Icon name={ic} size={20} className="text-volt shrink-0 mt-0.5" /><div><div className="font-semibold">{t}</div><div className="text-bone-3 text-[13.5px] mt-0.5">{b}</div></div></li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="px-6 md:px-10 lg:px-14 py-10 border-t border-line flex flex-wrap items-center justify-between gap-4">
        <Logo />
        <span className="telemetry text-bone-3">Built with Claude Code, React Three Fiber, Next.js, Drizzle. Everything runs here.</span>
      </footer>
    </div>
  );
}

/** A drawn dashboard, in the system's tokens, honest about being a drawing. */
function CrmMock() {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 2200); return () => clearInterval(id); }, []);
  const kpis = [['New leads', 42 + (tick % 3), '+18%'], ['Bookings', 17 + (tick % 2), '+6%'], ['Reply time', '1.8h', '−22%'], ['Won this month', '€12.4k', '+31%']];
  const cols = [['New', 5], ['Contacted', 4], ['Quoted', 3], ['Won', 2]] as const;
  return (
    <div className="panel p-5 relative overflow-hidden noise">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-volt" /><span className="telemetry text-bone-2">ember-and-oak.com / admin</span></div>
        <span className="telemetry text-bone-3">live · drawn</span>
      </div>
      <div className="grid grid-cols-4 gap-2 mb-4">
        {kpis.map(([l, v, d]) => (
          <div key={l} className="rounded-lg bg-ink-3 border border-line p-3">
            <div className="legend !text-[10px]">{l}</div>
            <div className="display-sm text-[22px] mt-1">{v}</div>
            <div className={cx('telemetry mt-1', String(d).startsWith('−') ? 'text-volt' : 'text-volt')}>{d}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {cols.map(([name, n], ci) => (
          <div key={name} className="rounded-lg bg-ink-3 border border-line p-2 min-h-[150px]">
            <div className="flex justify-between items-center px-1 mb-2"><span className="legend !text-[10px]">{name}</span><span className="telemetry text-bone-3">{n}</span></div>
            {Array.from({ length: n }).map((_, i) => (
              <div key={i} className={cx('rounded-md border p-2 mb-1.5 transition-transform', (i + ci + tick) % 5 === 0 ? 'border-volt/60 bg-volt-2' : 'border-line bg-ink-2')}>
                <div className="h-1.5 w-2/3 rounded bg-bone-4 mb-1.5" /><div className="h-1.5 w-1/3 rounded bg-bone-4/60" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
