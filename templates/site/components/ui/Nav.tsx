'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { design } from '@/design.config';
import { ThemeToggle } from './ThemeToggle';

/**
 * Floating chrome: a wordmark in one corner, a menu button in the other, no
 * bar across the top. The menu itself is a designed moment — a full panel
 * with large type — not a dropdown.
 */
export function Nav({ links = [{ href: '/#about', label: 'About' }, { href: '/#work', label: 'Work' }, { href: '/#contact', label: 'Contact' }] }: { links?: Array<{ href: string; label: string }> }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on(); window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => { document.documentElement.style.overflow = open ? 'hidden' : ''; return () => { document.documentElement.style.overflow = ''; }; }, [open]);

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:px-3 focus:py-2 focus:bg-accent focus:text-bg focus:rounded">Skip to content</a>
      <header className="fixed top-0 inset-x-0 z-50 container-x py-4 flex items-center justify-between pointer-events-none">
        <Link href="/" className="pointer-events-auto font-display font-semibold tracking-tight text-lg mix-blend-difference text-white" data-cursor="Home">{design.name}</Link>
        <div className="pointer-events-auto flex items-center gap-2">
          {design.theme === 'both' && <ThemeToggle />}
          <button onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="site-menu" className="h-10 px-4 rounded-full border hairline backdrop-blur text-sm font-medium transition-colors" style={{ background: scrolled || open ? 'color-mix(in srgb, var(--bg) 70%, transparent)' : 'transparent' }} data-cursor="Menu">
            {open ? 'Close' : 'Menu'}
          </button>
        </div>
      </header>
      <div id="site-menu" aria-hidden={!open} className="fixed inset-0 z-40 transition-[opacity,visibility] duration-[var(--base)]" style={{ opacity: open ? 1 : 0, visibility: open ? 'visible' : 'hidden', background: 'var(--bg)' }}>
        <nav className="h-full container-x flex flex-col justify-center gap-2" aria-label="Main">
          {links.map((l, i) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="display-sm text-[clamp(2.4rem,8vw,6rem)] leading-none transition-[transform,opacity] hover:translate-x-3" style={{ transitionDuration: 'var(--base)', transitionTimingFunction: 'var(--ease-out)', transitionDelay: open ? `${i * 50}ms` : '0ms', opacity: open ? 1 : 0, transform: open ? 'none' : 'translateY(20px)' }} data-cursor="Go">
              {l.label}
            </Link>
          ))}
          <div className="eyebrow mt-10">{design.name}</div>
        </nav>
      </div>
    </>
  );
}
