'use client';

import { useEffect } from 'react';
import { design } from '@/design.config';

/**
 * Lenis smooth scroll, when the tokens ask for it, wired to GSAP's ticker so
 * ScrollTrigger reads the same position. Off under reduced motion and on
 * touch, where native feels better. Also fires scroll_depth at 25/50/75/100.
 */
export function SmoothScroll() {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const touch = window.matchMedia('(hover: none)').matches;
    let cleanup = () => {};
    if (design.motion.scroll !== 'native' && !reduced && !touch) {
      let cancelled = false;
      void Promise.all([import('lenis'), import('gsap'), import('gsap/ScrollTrigger')]).then(([{ default: Lenis }, { gsap }, { ScrollTrigger }]) => {
        if (cancelled) return;
        gsap.registerPlugin(ScrollTrigger);
        const lenis = new Lenis({ duration: 1.1, easing: (t: number) => 1 - Math.pow(1 - t, 4), smoothWheel: true });
        lenis.on('scroll', ScrollTrigger.update);
        const tick = (time: number) => lenis.raf(time * 1000);
        gsap.ticker.add(tick);
        gsap.ticker.lagSmoothing(0);
        cleanup = () => { gsap.ticker.remove(tick); lenis.destroy(); };
      });
      return () => { cancelled = true; cleanup(); };
    }
    return cleanup;
  }, []);

  useEffect(() => {
    const marks = new Set<number>();
    const on = () => {
      const p = window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      for (const m of [25, 50, 75, 100]) if (p * 100 >= m - 0.5 && !marks.has(m)) { marks.add(m); void import('@/lib/analytics').then(({ track }) => track('scroll_depth', { depth: m })); }
    };
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return null;
}
