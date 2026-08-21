'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { design } from '@/design.config';
import { track } from '@/lib/analytics';

/**
 * Page transitions, and the page_view event. `fade` and `morph` use the View
 * Transitions API where it exists (CSS in globals.css); `wipe` draws a curtain
 * in the accent. All fall back to nothing under reduced motion.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const path = usePathname();
  const curtain = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useEffect(() => {
    track('page_view', { path });
    if (first.current) { first.current = false; return; }
    if (design.motion.transition === 'wipe' && curtain.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const el = curtain.current;
      el.style.transition = 'none'; el.style.transform = 'translateY(0)';
      requestAnimationFrame(() => { el.style.transition = 'transform 550ms var(--ease-in-out)'; el.style.transform = 'translateY(-101%)'; });
    }
  }, [path]);
  return (
    <>
      {children}
      {design.motion.transition === 'wipe' && <div ref={curtain} aria-hidden="true" className="fixed inset-0 z-[90] pointer-events-none bg-accent" style={{ transform: 'translateY(101%)' }} />}
    </>
  );
}
