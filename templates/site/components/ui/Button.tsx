'use client';

import Link from 'next/link';
import { useRef, type ButtonHTMLAttributes, type MouseEvent } from 'react';
import { design } from '@/design.config';
import { track } from '@/lib/analytics';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  href?: string; variant?: 'solid' | 'ghost' | 'quiet'; size?: 'md' | 'lg';
  'data-track'?: string; 'data-label'?: string;
};

/**
 * One button, three weights. Magnetic when the hover system says so: it
 * leans toward the pointer within a small radius and springs back.
 */
export function Button({ href, variant = 'solid', size = 'md', className = '', children, onClick, ...rest }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const magnetic = design.motion.hover === 'magnetic';
  const move = (e: MouseEvent) => {
    if (!magnetic || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    ref.current.style.transform = `translate(${dx * 0.18}px, ${dy * 0.18}px)`;
  };
  const leave = () => { if (ref.current) ref.current.style.transform = ''; };
  const fire = (e: MouseEvent<HTMLElement>) => {
    const ev = rest['data-track']; if (ev) track(ev, { label: rest['data-label'] ?? String(children) });
    onClick?.(e as MouseEvent<HTMLButtonElement>);
  };
  const base = `inline-flex items-center justify-center gap-2 font-medium select-none transition-[transform,background,color,border-color] duration-[var(--fast)] ease-[var(--ease-out)] rounded-full ${size === 'lg' ? 'h-14 px-8 text-lg' : 'h-12 px-6'} `
    + (variant === 'solid' ? 'bg-accent text-bg hover:brightness-110' : variant === 'ghost' ? 'border hairline text-fg hover:border-fg/50' : 'text-fg/80 hover:text-fg') + ' ' + className;
  const style = { transition: 'transform 300ms var(--ease-out), background 160ms, color 160ms, border-color 160ms' } as React.CSSProperties;
  if (href) {
    return <Link ref={(el) => { ref.current = el; }} href={href} className={base} style={style} onMouseMove={move} onMouseLeave={leave} onClick={fire} data-cursor="Go">{children}</Link>;
  }
  return <button ref={(el) => { ref.current = el; }} className={base} style={style} onMouseMove={move} onMouseLeave={leave} onClick={fire} {...rest}>{children}</button>;
}
