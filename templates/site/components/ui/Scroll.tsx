'use client';

/**
 * The scroll devices.
 *
 * A section earns its scroll or it is a slide. These are the working parts a
 * page is composed from — pin something and play it out, run a number as it
 * arrives, move a track sideways, hold one thing at a time, draw a line as
 * the reader passes it. They exist here, tested, so that a build spends its
 * effort on *which* device belongs where rather than on re-deriving
 * ScrollTrigger each time.
 *
 * Two rules run through all of them:
 *
 *   Slow enough to read. The commonest failure is a sequence that plays out
 *   in 300px of scroll, so the reader sees a flicker rather than a change.
 *   Every `distance` here is in viewport heights and defaults generously.
 *
 *   Released on phones. Pins fight native scrolling on touch. Every device
 *   degrades to plain stacked content below `pinFrom` (default 720px).
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';

type GsapLike = {
  registerPlugin: (...p: unknown[]) => void;
  to: (t: unknown, v: Record<string, unknown>) => { kill: () => void };
  set: (t: unknown, v: Record<string, unknown>) => void;
};

/** Loads GSAP + ScrollTrigger once, lazily, and only when a device needs them. */
async function gsapWithScrollTrigger() {
  const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
  gsap.registerPlugin(ScrollTrigger);
  return { gsap: gsap as unknown as GsapLike, ScrollTrigger };
}

const usePinnable = (pinFrom: number) => {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${pinFrom}px) and (prefers-reduced-motion: no-preference)`);
    const on = () => setOk(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [pinFrom]);
  return ok;
};

/* ------------------------------------------------------------------ Pin -- */

/**
 * Holds a section still while its content plays out over `distance` viewport
 * heights. Children receive 0..1. Below `pinFrom` the children render once at
 * p = 1 and the section scrolls normally.
 */
export function Pinned({
  children, distance = 2, pinFrom = 720, className = '', id,
}: {
  children: (p: number) => ReactNode;
  distance?: number; pinFrom?: number; className?: string; id?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  const pinnable = usePinnable(pinFrom);

  useEffect(() => {
    if (!pinnable || !host.current) { setP(1); return; }
    let st: { kill: () => void } | undefined;
    let dead = false;
    void gsapWithScrollTrigger().then(({ ScrollTrigger }) => {
      if (dead || !host.current) return;
      st = ScrollTrigger.create({
        trigger: host.current,
        start: 'top top',
        end: `+=${distance * 100}%`,
        pin: true,
        pinSpacing: true,
        scrub: true,
        onUpdate: (self: { progress: number }) => setP(self.progress),
      });
    });
    return () => { dead = true; st?.kill(); };
  }, [pinnable, distance]);

  return (
    <section ref={host} id={id} className={`relative ${className}`} data-section={id}>
      {children(pinnable ? p : 1)}
    </section>
  );
}

/* ----------------------------------------------------------- Horizontal -- */

/**
 * Vertical scroll moves a track sideways. The reader is in control of the
 * pace, which is the whole point — it is the difference between a carousel
 * and a journey. Falls back to a native horizontal swipe strip on phones.
 */
export function HorizontalTrack({
  children, pinFrom = 720, className = '', id,
}: { children: ReactNode; pinFrom?: number; className?: string; id?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const pinnable = usePinnable(pinFrom);

  useEffect(() => {
    if (!pinnable || !host.current || !track.current) return;
    let st: { kill: () => void } | undefined;
    let dead = false;
    void gsapWithScrollTrigger().then(({ gsap, ScrollTrigger }) => {
      if (dead || !host.current || !track.current) return;
      const distance = () => Math.max(0, track.current!.scrollWidth - window.innerWidth);
      const tween = gsap.to(track.current, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: host.current,
          start: 'top top',
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 0.6,
          invalidateOnRefresh: true,
        },
      });
      st = { kill: () => { tween.kill(); ScrollTrigger.getAll().forEach((t: { kill: () => void }) => t.kill()); } };
    });
    return () => { dead = true; st?.kill(); };
  }, [pinnable]);

  return (
    <section ref={host} id={id} className={`relative overflow-hidden ${className}`} data-section={id}>
      <div
        ref={track}
        className={pinnable
          ? 'flex items-center gap-[var(--gutter)] will-change-transform'
          : 'flex items-center gap-[var(--gutter)] overflow-x-auto snap-x snap-mandatory scrollbar-none px-[var(--gutter)]'}
      >
        {children}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- Counter -- */

/**
 * A number that runs to its value as it arrives, once. Numbers that count are
 * the cheapest scroll device there is and the one readers notice most — but
 * only if the number is real. Never animate a number nobody measured.
 */
export function Counter({
  to, from = 0, duration = 1400, prefix = '', suffix = '', decimals = 0, className = '',
}: { to: number; from?: number; duration?: number; prefix?: string; suffix?: string; decimals?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(from);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(to); return; }
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const step = (t: number) => {
        const p = Math.min(1, (t - t0) / duration);
        setN(from + (to - from) * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, { threshold: 0.5 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to, from, duration]);

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {prefix}{n.toFixed(decimals)}{suffix}
    </span>
  );
}

/* ---------------------------------------------------------------- Focus -- */

/**
 * One thing at a time: a stack where only the item nearest the middle of the
 * viewport is at full presence and the others recede. The reader chooses what
 * they are looking at by scrolling, which is what makes it feel like control
 * rather than a slideshow.
 */
export function Focus({ children, className = '' }: { children: ReactNode[]; className?: string }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current; if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const tick = () => {
      raf = 0;
      const mid = window.innerHeight / 2;
      for (const child of Array.from(el.children) as HTMLElement[]) {
        const r = child.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - mid) / (window.innerHeight * 0.6);
        const k = Math.max(0, 1 - d);
        child.style.opacity = String(0.22 + k * 0.78);
        child.style.transform = `scale(${0.97 + k * 0.03})`;
      }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    tick();
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div ref={host} className={className} style={{ transition: 'none' }}>
      {children.map((c, i) => (
        <div key={i} style={{ transition: 'opacity 220ms linear, transform 220ms linear', willChange: 'opacity, transform' }}>{c}</div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- Draw -- */

/**
 * A rule, a border or a path that draws itself as the reader passes it.
 * Wrap any SVG whose paths should be stroked in as they arrive.
 */
export function Draw({ children, className = '', duration = 1200 }: { children: ReactNode; className?: string; duration?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const paths = Array.from(el.querySelectorAll<SVGGeometryElement>('path, line, circle, rect, polyline'));
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    for (const p of paths) {
      const len = p.getTotalLength?.() ?? 0;
      if (!len) continue;
      p.style.strokeDasharray = `${len}`;
      p.style.strokeDashoffset = `${len}`;
    }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      paths.forEach((p, i) => {
        p.style.transition = `stroke-dashoffset ${duration}ms var(--ease-out) ${i * 90}ms`;
        p.style.strokeDashoffset = '0';
      });
    }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, [duration]);
  return <div ref={ref} className={className}>{children}</div>;
}

/* -------------------------------------------------------------- Marquee -- */

/** A band that drifts, and drifts faster the faster the page is scrolling. */
export function Marquee({ children, speed = 40, className = '' }: { children: ReactNode; speed?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let x = 0; let last = performance.now(); let lastY = window.scrollY; let boost = 0; let raf = 0;
    const step = (t: number) => {
      const dt = Math.min(64, t - last); last = t;
      const dy = window.scrollY - lastY; lastY = window.scrollY;
      boost += (Math.min(3, Math.abs(dy) / 8) - boost) * 0.08;
      x -= (speed * (1 + boost) * dt) / 1000;
      const half = el.scrollWidth / 2;
      if (half && x <= -half) x += half;
      el.style.transform = `translate3d(${x}px,0,0)`;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [speed]);
  return (
    <div className={`overflow-hidden ${className}`}>
      <div ref={ref} className="flex w-max will-change-transform">{children}{children}</div>
    </div>
  );
}
