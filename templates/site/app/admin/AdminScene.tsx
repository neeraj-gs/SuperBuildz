'use client';

import { Suspense, lazy, useEffect, useState } from 'react';

/**
 * The site's own 3D scene, behind the dashboard's first band.
 *
 * ── Why a CRM has a WebGL header at all ─────────────────────────────────────
 *
 * Because it is the same business. Every other dashboard a small owner logs
 * into is a grey table that could belong to anyone; this one is theirs, and the
 * cheapest way to say so is the thing they chose for their own front page,
 * running quietly behind the four numbers they came to read.
 *
 * ── And why it is quiet ─────────────────────────────────────────────────────
 *
 * It is decoration on a working screen, so it behaves like decoration. It loads
 * after the numbers, never before them. It is heavily dimmed, so nothing in
 * front of it loses contrast. It stops rendering when the tab is hidden, and it
 * never starts at all on a narrow screen, under `prefers-reduced-motion`, or
 * where the browser cannot give a WebGL context — in every one of those cases
 * the band is a flat colour and the page is unchanged.
 */

// Lazily, and only in the browser: this is a few hundred kilobytes and the
// numbers are the reason anybody opened the page.
const Scene = lazy(() => import('@/components/SceneCanvas').then((m) => ({ default: m.SceneCanvas })));

export function AdminScene() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const narrow = window.matchMedia('(max-width: 900px)').matches;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (narrow || still) return;

    // A context probe rather than a user-agent guess: the honest question is
    // whether this browser will actually give us one.
    try {
      const canvas = document.createElement('canvas');
      if (!canvas.getContext('webgl2') && !canvas.getContext('webgl')) return;
    } catch { return; }

    // After the first paint, and after anything else waiting for the main
    // thread. The dashboard is the priority; this is the wallpaper.
    // `in window` narrows `window` to `never` in the else branch, so the check
    // reads the property off a widened alias instead.
    const w = window as Window & { requestIdleCallback?: (c: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setOn(true), { timeout: 2500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(() => setOn(true), 900);
    return () => window.clearTimeout(id);
  }, []);

  if (!on) return null;
  return (
    <div className="admin-scene" aria-hidden>
      <Suspense fallback={null}><Scene /></Suspense>
    </div>
  );
}
