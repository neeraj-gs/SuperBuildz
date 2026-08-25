/**
 * Four presses, told at the pace somebody reads them.
 *
 * ── Why this is not four cards ─────────────────────────────────────────────
 *
 * It was four cards: same size, same icon-then-heading-then-paragraph, read in
 * two seconds and remembered for none of them. Four equal boxes is what a page
 * does when it has decided in advance that all four things weigh the same,
 * which is exactly the thing this product tells generated sites not to do.
 *
 * So the section takes four screens of scroll and gives each press the whole
 * of one of them, with the interface it is describing drawn beside it. The
 * step is the argument; the fragment is the evidence. Scroll is the only
 * control, because the scroll was going to happen anyway.
 *
 * The numbers stay, and they are the one place on this page where numbers are
 * honest: this is a sequence, and the order is the information.
 */

import { useEffect, useRef, useState } from 'react';
import { cx } from '@/components/ui';
import { Icon } from '@/components/icons';

const STEPS = [
  {
    title: 'Choose',
    lede: 'Pick the shape of your business and it answers the next twenty questions. Then disagree with the defaults, screen by screen — colour, type, layout, scene, motion — with the thing you are choosing previewed beside you.',
    foot: 'Eighteen screens. Not one of them needs a sentence typed into it.',
  },
  {
    title: 'Pick a direction',
    lede: 'Three complete visual directions get built from your answers and shown side by side, scrolling in sync. Different palettes, different type, different composition. You look at them and point at one.',
    foot: 'Nobody can describe a design. Everybody can recognise one.',
  },
  {
    title: 'Watch it build',
    lede: 'The Claude Code you already pay for takes a real Next.js project — scenes, CRM, analytics, forms already in it — and makes it yours, stage by stage, on your machine, in a folder you own.',
    foot: 'Every stage is a git commit. Any of it can be undone.',
  },
  {
    title: 'Tune and publish',
    lede: 'Drag spacing, weight, grain and pace and the site changes under your hand. Say what you want in chat, or press one of the things it offers. Then one press to Vercel, through your own browser.',
    foot: 'No account here. No token held. Nothing leaves the machine.',
  },
];

export function Steps() {
  const wrap = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const [pinned, setPinned] = useState(true);

  useEffect(() => {
    /*
      Pinned only where there is room for two columns. On a phone the step and
      the screen beside it have to stack, and stacking them inside one held
      viewport means both are cropped — so the phone gets the plain version,
      four blocks, scrolled normally. Same for anybody who asked for less
      motion.
    */
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const wide = window.matchMedia('(min-width: 1024px)');
    const decide = () => setPinned(!reduced && wide.matches);
    decide();
    wide.addEventListener('change', decide);
    if (reduced) return () => wide.removeEventListener('change', decide);

    let queued = false;
    const read = () => {
      const el = wrap.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const travel = r.height - window.innerHeight;
      const p = travel > 0 ? Math.min(1, Math.max(0, -r.top / travel)) : 0;
      // Nudged past the boundary so a step holds while it is being read
      // rather than flicking over at the exact halfway point.
      setAt(Math.min(STEPS.length - 1, Math.floor(p * STEPS.length * 0.999)));
    };
    const onScroll = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; read(); }); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', read);
    read();
    return () => {
      wide.removeEventListener('change', decide);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', read);
    };
  }, []);

  if (!pinned) {
    return (
      <div className="grid gap-12 mt-14">
        {STEPS.map((s, i) => (
          <div key={s.title} className="grid lg:grid-cols-2 gap-8 items-center">
            <Words i={i} step={s} on />
            <Fragment i={i} on />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div ref={wrap} style={{ height: `${STEPS.length * 92}vh` }} className="relative mt-10">
      <div className="sticky top-[52px] h-[calc(100svh-52px)] flex items-center">
        <div className="w-full grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] gap-10 lg:gap-16 items-center">
          <div className="relative min-w-0">
            {STEPS.map((s, i) => (
              <div
                key={s.title}
                className={cx('transition-[opacity,transform] duration-500', i === at ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0')}
                style={{ transform: i === at ? 'none' : 'translateY(10px)', transitionTimingFunction: 'var(--sb-ease)' }}
                aria-hidden={i !== at}
              >
                <Words i={i} step={s} on={i === at} />
              </div>
            ))}

            <ol className="flex gap-2 mt-9">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex-1 min-w-0">
                  <span className={cx('block h-[3px] rounded-full transition-colors duration-300', i === at ? 'bg-volt' : i < at ? 'bg-volt-3' : 'bg-line-2')} />
                  <span className={cx('mt-2 block telemetry truncate transition-colors', i === at ? 'text-bone' : 'text-bone-4')}>{s.title}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="relative aspect-[4/3] lg:aspect-[16/11]">
            {STEPS.map((_, i) => (
              <div key={i} className={cx('absolute inset-0 transition-opacity duration-500', i === at ? 'opacity-100' : 'opacity-0')} aria-hidden={i !== at}>
                <Fragment i={i} on={i === at} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Words({ i, step, on }: { i: number; step: typeof STEPS[number]; on: boolean }) {
  return (
    <div>
      <span className="telemetry text-volt">{String(i + 1).padStart(2, '0')} of 04</span>
      <h3 className="d2 mt-3">{step.title}</h3>
      <p className="copy mt-4">{step.lede}</p>
      <p className={cx('mt-5 pt-4 border-t border-line text-[13px] text-bone-3 transition-opacity duration-700', on ? 'opacity-100' : 'opacity-0')}>{step.foot}</p>
    </div>
  );
}

/* ------------------------------------------------------- the evidence -- */

/** The four screens, drawn — honest about being drawings, exact about the shapes. */
function Fragment({ i, on }: { i: number; on: boolean }) {
  if (i === 0) return <Choosing on={on} />;
  if (i === 1) return <ThreeDirections on={on} />;
  if (i === 2) return <Building on={on} />;
  return <Tuning on={on} />;
}

function Shell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="panel h-full overflow-hidden noise relative bg-ink-2/80 backdrop-blur-sm flex flex-col">
      <div className="h-9 shrink-0 px-3 flex items-center justify-between border-b border-line">
        <span className="telemetry text-bone-3 truncate">{label}</span>
        <span className="flex gap-1.5 shrink-0"><i className="block w-6 h-1.5 rounded-full bg-bone-4/50" /><i className="block w-2 h-1.5 rounded-full bg-volt" /></span>
      </div>
      <div className="flex-1 min-h-0 p-3.5">{children}</div>
    </div>
  );
}

const OPTIONS = [
  ['Restaurant or bar', 'a menu, a table, a photograph'],
  ['Clinic or practice', 'trust, hours, a booking'],
  ['Studio or agency', 'the work, and who made it'],
  ['Shop', 'a product, and a way to buy it'],
];

function Choosing({ on }: { on: boolean }) {
  const [pick, setPick] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setPick((p) => (p + 1) % OPTIONS.length), 1700);
    return () => clearInterval(id);
  }, [on]);
  return (
    <Shell label="what are you making?">
      <div className="h-full flex flex-col gap-3">
        <div className="grid grid-cols-2 grid-rows-2 gap-2 flex-1 min-h-0">
          {OPTIONS.map(([t, b], i) => (
            <div key={t} data-on={i === pick} className="opt !p-3 flex flex-col justify-center">
              <div className="font-semibold text-[13px] leading-tight pr-4">{t}</div>
              <div className="text-[11.5px] text-bone-3 leading-snug mt-1">{b}</div>
            </div>
          ))}
        </div>
        <div className="shrink-0">
          <span className="legend">and the twenty answers it just filled in</span>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {['ember', 'a serif that eats', 'bands', 'liquid', 'calm', 'dark', 'menu', 'booking', 'photographs'].map((t) => (
              <span key={t} className="chip !h-6 !px-2 !text-[11px] !cursor-default">{t}</span>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}

const DIRS = [
  { name: 'monolith', page: '#0B0C0E', ink: '#EFEDE8', accent: '#7C8AA0' },
  { name: 'ember', page: '#120C08', ink: '#F2E7DA', accent: '#E4622F' },
  { name: 'stillpage', page: '#EFE9DD', ink: '#16150F', accent: '#2F5D50' },
];

function ThreeDirections({ on }: { on: boolean }) {
  const [pick, setPick] = useState(1);
  const [scroll, setScroll] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setScroll((s) => (s + 1) % 3), 1100);
    return () => clearInterval(id);
  }, [on]);
  return (
    <Shell label="three directions · scrolling in sync">
      <div className="grid grid-cols-3 gap-2 h-full">
        {DIRS.map((d, i) => (
          <button
            key={d.name}
            onClick={() => setPick(i)}
            className={cx('relative rounded-lg overflow-hidden border text-left transition-colors', pick === i ? 'border-volt' : 'border-line')}
            style={{ background: d.page }}
          >
            <span className="block px-2 py-1.5 telemetry !text-[10px] truncate" style={{ color: d.ink }}>{d.name}</span>
            <span className="block px-2.5 transition-transform duration-700" style={{ transform: `translateY(${-scroll * 12}px)`, transitionTimingFunction: 'var(--sb-ease)' }}>
              <i className="block h-1.5 w-7 rounded-full mb-3" style={{ background: d.accent }} />
              <i className="block h-2.5 w-full rounded-sm mb-1.5" style={{ background: d.ink, opacity: 0.9 }} />
              <i className="block h-2.5 w-3/4 rounded-sm mb-1.5" style={{ background: d.ink, opacity: 0.9 }} />
              <i className="block h-2.5 w-1/2 rounded-sm mb-3" style={{ background: d.accent }} />
              <i className="block rounded-sm mb-2" style={{ background: d.ink, opacity: 0.12, aspectRatio: '16/10' }} />
              {[1, 0.8, 0.6].map((w, k) => <i key={k} className="block h-1 rounded-full mb-1" style={{ background: d.ink, opacity: 0.22, width: `${w * 100}%` }} />)}
            </span>
            {pick === i && <span className="absolute inset-0 ring-1 ring-inset ring-volt pointer-events-none" />}
          </button>
        ))}
      </div>
    </Shell>
  );
}

const STAGES = [
  ['foundation', 'tokens, fonts, the shell'],
  ['identity', 'the hero, and the one memorable move'],
  ['pages', 'every page you asked for'],
  ['crm', 'forms, dashboard, login'],
  ['motion', 'the gesture that recurs'],
  ['review', 'scored against the rubric, then fixed'],
];

function Building({ on }: { on: boolean }) {
  const [done, setDone] = useState(2);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setDone((d) => (d + 1) % (STAGES.length + 1)), 1300);
    return () => clearInterval(id);
  }, [on]);
  return (
    <Shell label="claude code · your subscription, your machine">
      <div className="h-full flex flex-col">
        <ol className="grid gap-1.5">
          {STAGES.map(([id, blurb], i) => {
            const state = i < done ? 'done' : i === done ? 'running' : 'waiting';
            return (
              <li key={id} className={cx('flex items-center gap-2.5 rounded-md px-2.5 py-1.5 border', state === 'running' ? 'border-volt-3 bg-volt-2' : 'border-line')}>
                {state === 'done' ? <Icon name="check" size={12} className="text-volt shrink-0" />
                  : state === 'running' ? <span className="w-[7px] h-[7px] rounded-full bg-volt pulse-dot shrink-0" />
                    : <span className="w-[7px] h-[7px] rounded-full bg-bone-4 shrink-0" />}
                <span className={cx('text-[12.5px] shrink-0', state === 'waiting' ? 'text-bone-4' : 'text-bone')}>{id}</span>
                <span className="telemetry text-bone-4 truncate hidden sm:inline">{blurb}</span>
              </li>
            );
          })}
        </ol>
        <div className="mt-auto pt-3 border-t border-line">
          <div className="h-[3px] rounded-full bg-ink-3 overflow-hidden">
            <div className="h-full bg-volt transition-[width] duration-700" style={{ width: `${(done / STAGES.length) * 100}%`, transitionTimingFunction: 'var(--sb-ease)' }} />
          </div>
          <p className="telemetry text-bone-4 mt-2">committed after every stage · stop it whenever you like</p>
        </div>
      </div>
    </Shell>
  );
}

const KNOBS = [['Section rhythm', 0.62], ['Display scale', 0.48], ['Grain', 0.22], ['Reveal distance', 0.7], ['Pace', 0.35]] as const;

function Tuning({ on }: { on: boolean }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setT((n) => n + 1), 1500);
    return () => clearInterval(id);
  }, [on]);
  return (
    <Shell label="tune · nothing typed, nothing spent">
      <div className="h-full grid grid-cols-[1fr_auto] gap-4">
        <div className="grid content-between gap-3 h-full">
          {KNOBS.map(([label, base], i) => {
            const v = Math.min(0.96, Math.max(0.06, base + Math.sin(t * 0.9 + i * 1.7) * 0.16));
            return (
              <div key={label}>
                <div className="flex items-baseline justify-between">
                  <span className="text-[12px] text-bone-2">{label}</span>
                  <span className="telemetry text-bone-4 !text-[11px]">{v.toFixed(2)}</span>
                </div>
                <div className="relative h-[2px] bg-line-2 rounded-full mt-2">
                  <span className="absolute -top-[5px] w-3 h-3 rounded-full bg-bone transition-[left] duration-[1400ms]" style={{ left: `calc(${v * 100}% - 6px)`, transitionTimingFunction: 'var(--sb-ease)' }} />
                </div>
              </div>
            );
          })}
        </div>
        {/* The site, changing under the sliders — the reason to drag them. */}
        <div className="w-[104px] rounded-lg border border-line bg-ink p-2 flex flex-col gap-1.5">
          <span className="telemetry text-bone-4 !text-[10px]">live</span>
          {/* Both of these change on the compositor — scaled, not resized —
              so the mini-page redraws without relaying out the panel. */}
          <i className="block h-1.5 w-full rounded-full bg-volt origin-left transition-transform duration-[1400ms]" style={{ transform: `scaleX(${0.4 + (t % 3) * 0.14})` }} />
          <i className="block h-9 rounded bg-bone-4/20 origin-top transition-transform duration-[1400ms]" style={{ transform: `scaleY(${0.72 + (t % 3) * 0.14})` }} />
          <i className="block h-1 rounded-full bg-bone-4/40" />
          <i className="block h-1 rounded-full bg-bone-4/30 w-2/3" />
          <i className="block h-1 rounded-full bg-bone-4/20 w-1/2" />
          <span className="grid grid-cols-2 gap-1 mt-1">
            {[0, 1, 2, 3].map((k) => <i key={k} className="block rounded bg-bone-4/12" style={{ aspectRatio: '4/3' }} />)}
          </span>
          <span className="mt-auto btn btn-primary btn-sm !h-7 !w-full !text-[11px] justify-center">Publish</span>
        </div>
      </div>
    </Shell>
  );
}
