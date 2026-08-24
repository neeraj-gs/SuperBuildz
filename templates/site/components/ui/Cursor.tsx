'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { design } from '@/design.config';

/**
 * The custom cursor, when the tokens ask for one: a dot that grows over
 * interactive things, a lagging ring, or a label that says what will happen
 * (from data-cursor on the element). Hidden on touch.
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

export function Cursor() {
  // A dashboard wants the pointer it came with.
  const kind = useOnAdmin() ? 'system' : design.motion.cursor;
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState('');
  const [hot, setHot] = useState(false);
  useEffect(() => {
    if (kind === 'system' || window.matchMedia('(hover: none)').matches) return;
    let x = 0, y = 0, rx = 0, ry = 0, raf = 0;
    const move = (e: PointerEvent) => {
      x = e.clientX; y = e.clientY;
      if (dot.current) dot.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      const t = (e.target as HTMLElement | null)?.closest?.('a, button, [data-cursor], input, textarea, select, [role=button]') as HTMLElement | null;
      setHot(!!t);
      setLabel(t?.dataset.cursor ?? (t ? 'View' : ''));
    };
    const tick = () => { rx += (x - rx) * 0.14; ry += (y - ry) * 0.14; if (ring.current) ring.current.style.transform = `translate3d(${rx}px, ${ry}px, 0)`; raf = requestAnimationFrame(tick); };
    window.addEventListener('pointermove', move, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => { window.removeEventListener('pointermove', move); cancelAnimationFrame(raf); };
  }, [kind]);
  if (kind === 'system') return null;
  return (
    <div aria-hidden="true" className="hidden [@media(hover:hover)]:block pointer-events-none fixed inset-0 z-[100]">
      {kind === 'dot' && <div ref={dot} className="absolute left-0 top-0 will-change-transform"><div className="-translate-x-1/2 -translate-y-1/2 rounded-full bg-accent mix-blend-difference transition-transform duration-200" style={{ width: 36, height: 36, transform: `translate(-50%,-50%) scale(${hot ? 1 : 0.28})` }} /></div>}
      {kind === 'ring' && <>
        <div ref={dot} className="absolute left-0 top-0 will-change-transform"><div className="-translate-x-1/2 -translate-y-1/2 rounded-full bg-accent" style={{ width: 6, height: 6 }} /></div>
        <div ref={ring} className="absolute left-0 top-0 will-change-transform"><div className="rounded-full border-2 border-accent transition-transform duration-200" style={{ width: 38, height: 38, transform: `translate(-50%,-50%) scale(${hot ? 0.65 : 1})` }} /></div>
      </>}
      {kind === 'label' && <>
        <div ref={dot} className="absolute left-0 top-0 will-change-transform"><div className="-translate-x-1/2 -translate-y-1/2 rounded-full bg-accent transition-opacity" style={{ width: 8, height: 8, opacity: hot ? 0 : 1 }} /></div>
        <div ref={ring} className="absolute left-0 top-0 will-change-transform"><div className="-translate-x-1/2 -translate-y-1/2 rounded-full px-3 py-1 text-xs font-medium bg-accent text-bg transition-opacity" style={{ opacity: hot ? 1 : 0 }}>{label || 'View'}</div></div>
      </>}
    </div>
  );
}
