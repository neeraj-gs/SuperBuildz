'use client';

/**
 * The scene, for the whole page — not just the hero.
 *
 * The sites this template is measured against (Lusion, Immersive Garden,
 * Active Theory) keep one WebGL canvas alive under the entire document and
 * composite DOM over it. A canvas that stops at 100vh is the single clearest
 * difference between "a good dark page" and an experience, so this is the
 * default and `SceneCanvas` is the exception.
 *
 * How it works
 * ------------
 * One fixed canvas behind everything. Sections declare what the scene should
 * be doing while they are on screen:
 *
 *     <section data-scene-frame="2" data-scene-dim="0.6"> … </section>
 *
 * The layer reports to the scene:
 *   - `progress`  0..1 across the whole document
 *   - `frame`     the index of the section currently in view, eased
 *   - `pointer`   NDC pointer
 *   - `portrait`  true below 720px, so a scene can recompose rather than crop
 *
 * and dims itself under sections that need to be read.
 *
 * The contract that keeps it fast is unchanged: lazy behind a designed
 * poster, DPR capped, paused when the tab is hidden, and replaced by the
 * still under `prefers-reduced-motion` or with no WebGL.
 */

import { Canvas } from '@react-three/fiber';
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { design } from '@/design.config';
import type { SceneProps } from '@/components/scenes/_shared';
import { paletteFor, type Theme } from '@/lib/tokens';
import { SCENE_LOADERS } from '@/components/scenes/loaders';

export function SceneLayer({
  component = design.scene.component,
  name = design.name,
  poster = '/scene-poster.svg',
  className = '',
}: { component?: string; name?: string; poster?: string; className?: string }) {
  const [ready, setReady] = useState(false);
  const [awake, setAwake] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [webgl, setWebgl] = useState(true);
  const [portrait, setPortrait] = useState(false);
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

  const host = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const frame = useRef(0);
  const pointer = useRef<[number, number]>([0, 0]);
  const Scene = useMemo(() => lazy(SCENE_LOADERS[component] ?? SCENE_LOADERS.FieldScene), [component]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pq = window.matchMedia('(max-width: 719px)');
    setReduced(mq.matches);
    setPortrait(pq.matches);
    const onMq = () => setReduced(mq.matches);
    const onPq = () => setPortrait(pq.matches);
    mq.addEventListener('change', onMq);
    pq.addEventListener('change', onPq);

    try {
      const c = document.createElement('canvas');
      setWebgl(!!(c.getContext('webgl2') || c.getContext('webgl')));
    } catch { setWebgl(false); }

    // Load after first paint so it never competes with LCP.
    const idle = (window.requestIdleCallback ?? ((f: () => void) => setTimeout(f, 200)))(() => setReady(true));

    let raf = 0;
    const sections = () => Array.from(document.querySelectorAll<HTMLElement>('[data-scene-frame]'));
    let cached: HTMLElement[] = [];
    let cachedAt = 0;

    const tick = () => {
      raf = 0;
      const doc = document.documentElement;
      progress.current = Math.min(1, window.scrollY / Math.max(1, doc.scrollHeight - window.innerHeight));

      // Re-read the sections at most once a second: pages add content lazily.
      const now = performance.now();
      if (now - cachedAt > 1000) { cached = sections(); cachedAt = now; }

      const mid = window.innerHeight * 0.45;
      let active = 0;
      let dim = 0;
      for (const el of cached) {
        const r = el.getBoundingClientRect();
        if (r.top <= mid && r.bottom >= mid) {
          active = Number(el.dataset.sceneFrame ?? 0);
          dim = Number(el.dataset.sceneDim ?? 0);
          break;
        }
      }
      frame.current += (active - frame.current) * 0.12;
      if (host.current) host.current.style.setProperty('--scene-dim', String(dim));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick); };
    const onMove = (e: PointerEvent) => {
      pointer.current = [(e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1)];
    };
    const onVis = () => setAwake(document.visibilityState === 'visible');

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('visibilitychange', onVis);

    const themeObs = new MutationObserver(() =>
      setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'));
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    tick();
    return () => {
      mq.removeEventListener('change', onMq);
      pq.removeEventListener('change', onPq);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('visibilitychange', onVis);
      themeObs.disconnect();
      if (raf) cancelAnimationFrame(raf);
      (window.cancelIdleCallback ?? clearTimeout)(idle as never);
    };
  }, []);

  const palette = paletteFor(theme);
  const heavy = design.scene.weight === 'heavy';
  const dpr: [number, number] = heavy && portrait ? [0.75, 1] : [1, 2];
  const show = ready && !reduced && webgl;

  return (
    <div
      ref={host}
      aria-hidden="true"
      className={`scene-layer ${className}`}
      style={{ position: 'fixed', inset: 0, zIndex: 0, background: palette.bg, pointerEvents: 'none' }}
    >
      <img
        src={poster}
        alt=""
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
          transition: 'opacity 900ms var(--ease-out)', opacity: show ? 0 : 1,
        }}
      />
      {show && (
        <Canvas
          dpr={dpr}
          camera={{ position: [0, 0, 6], fov: 40 }}
          gl={{ antialias: !heavy, alpha: false, powerPreference: 'high-performance' }}
          frameloop={awake ? 'always' : 'demand'}
          style={{ position: 'absolute', inset: 0 }}
        >
          <Suspense fallback={null}>
            <Scene palette={palette} progress={progress} pointer={pointer} frame={frame} portrait={portrait} name={name} quality="full" />
          </Suspense>
        </Canvas>
      )}
      {/* Sections that need to be read dim the scene beneath them rather than
          covering it — the scene stays present, just quieter. */}
      <div
        style={{
          position: 'absolute', inset: 0, background: palette.bg,
          opacity: 'var(--scene-dim, 0)' as unknown as number,
          transition: 'opacity 420ms var(--ease-out)',
        }}
      />
    </div>
  );
}

/** Wrap page content so it composites above the fixed scene. */
export function SceneContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={className} style={{ position: 'relative', zIndex: 1 }}>{children}</div>;
}

export type { ComponentType };
