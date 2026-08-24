'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { design } from '@/design.config';

/**
 * Lenis smooth scroll, when the tokens ask for it, wired to GSAP's ticker so
 * ScrollTrigger reads the same position. Off under reduced motion and on
 * touch, where native feels better. Also fires scroll_depth at 25/50/75/100.
 */
/**
 * The site's chrome does not belong on the CRM.
 *
 * The root layout wraps every route, /admin included, so the full-page 3D
 * layer, the custom cursor and Lenis smooth scroll were all running behind a
 * dashboard — which looked like the scene leaking through the gaps between the
 * cards, felt like the page fighting the scroll wheel, and put a floating dot
 * over a table of somebody's customers. A dashboard is a tool and wants none of
 * it; the CRM draws its own contained, dimmed scene in its own hero instead.
 */
function useOnAdmin(): boolean {
  const path = usePathname();
  return !!path?.startsWith('/admin');
}

export function SmoothScroll() {
  const onAdmin = useOnAdmin();
  useEffect(() => {
    // Nothing hijacks the scroll wheel on a tool.
    if (onAdmin) return;
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
  }, [onAdmin]);

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
