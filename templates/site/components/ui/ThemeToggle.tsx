'use client';

import { useEffect, useState } from 'react';
import { design } from '@/design.config';
import { cssVariables, type Theme } from '@/lib/tokens';

/** Applies a theme by rewriting the CSS variables on <html>. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  for (const [k, v] of Object.entries(cssVariables(theme))) root.style.setProperty(k, v);
  try { localStorage.setItem('theme', theme); } catch {}
}

/** Runs before paint so a remembered theme does not flash. Only when both themes exist. */
export function ThemeScript() {
  if (design.theme !== 'both') return null;
  const code = `try{var t=localStorage.getItem('theme');if(!t){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t;document.documentElement.dataset.themePending='1'}catch(e){}`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');
  useEffect(() => {
    const t = (document.documentElement.dataset.theme as Theme) || 'dark';
    setTheme(t);
    if (document.documentElement.dataset.themePending) { applyTheme(t); delete document.documentElement.dataset.themePending; }
  }, []);
  const flip = () => { const n: Theme = theme === 'dark' ? 'light' : 'dark'; setTheme(n); applyTheme(n); };
  return (
    <button onClick={flip} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} className="h-10 w-10 rounded-full border hairline grid place-items-center text-sm" data-cursor="Theme">
      {theme === 'dark' ? '☾' : '☀'}
    </button>
  );
}
