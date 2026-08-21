'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * The gesture, applied: children rise and settle when they enter the
 * viewport, once, with the tokens' duration and stagger. Reduced motion makes
 * it a plain appearance (globals.css).
 */
export function Reveal({ children, delay = 0, as: Tag = 'div', className = '' }: { children: ReactNode; delay?: number; as?: 'div' | 'span' | 'li'; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.setAttribute('data-reveal', 'in'); io.disconnect(); } }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <Tag ref={ref as never} data-reveal="" className={className} style={{ ['--reveal-delay' as string]: `calc(var(--stagger) * ${delay})` }}>{children}</Tag>;
}
