'use client';

/**
 * One framed scene, in a box.
 *
 * Prefer `<SceneLayer />` — a single canvas under the whole document — for the
 * site's main scene; a canvas that ends at the fold is what separates a good
 * dark page from an experience. This is for the cases where a scene genuinely
 * belongs inside one frame: a product on a detail page, a stage in a
 * split-stage layout, a card that happens to be 3D.
 *
 * The contract, either way:
 *
 *  - lazy: the WebGL bundle loads after first paint, behind a designed poster
 *  - pixel ratio capped at 2, lower on heavy scenes on small screens
 *  - paused when off screen or the tab is hidden
 *  - reduced motion or no WebGL: the poster stays, nothing animates
 *  - progress (0..1 page scroll) and pointer (NDC) are refs the host writes
 */

import { Canvas } from '@react-three/fiber';
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { design } from '@/design.config';
import type { SceneProps } from '@/components/scenes/_shared';
import { paletteFor, type Theme } from '@/lib/tokens';
import { SCENE_LOADERS } from '@/components/scenes/loaders';


export function SceneCanvas({ component = design.scene.component, className, name = design.name, poster = '/scene-poster.svg', progressSource = 'page' }: {
  component?: string; className?: string; name?: string; poster?: string; progressSource?: 'page' | 'none';
}) {
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [webgl, setWebgl] = useState(true);
  const [theme, setTheme] = useState<Theme>(() => (typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'));
  const host = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  const pointer = useRef<[number, number]>([0, 0]);
  const Scene = useMemo(() => lazy(SCENE_LOADERS[component] ?? SCENE_LOADERS.FieldScene), [component]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onMq = () => setReduced(mq.matches);
    mq.addEventListener('change', onMq);
    try { const c = document.createElement('canvas'); setWebgl(!!(c.getContext('webgl2') || c.getContext('webgl'))); } catch { setWebgl(false); }
    // Load after first paint, and only once the hero is on screen.
    const el = host.current;
    const io = new IntersectionObserver(([e]) => { setVisible(e.isIntersecting); if (e.isIntersecting) setReady(true); }, { threshold: 0.01 });
    if (el) io.observe(el);
    const onVis = () => setVisible(document.visibilityState === 'visible' && (el ? el.getBoundingClientRect().bottom > 0 : true));
    document.addEventListener('visibilitychange', onVis);
    const onScroll = () => { if (progressSource === 'page') progress.current = Math.min(1, window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight)); };
    const onMove = (e: PointerEvent) => { pointer.current = [(e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1)]; };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', onMove, { passive: true });
    const themeObs = new MutationObserver(() => setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'));
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    onScroll();
    return () => { mq.removeEventListener('change', onMq); io.disconnect(); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('scroll', onScroll); window.removeEventListener('pointermove', onMove); themeObs.disconnect(); };
  }, [progressSource]);

  const palette = paletteFor(theme);
  const heavy = design.scene.weight === 'heavy';
  const small = typeof window !== 'undefined' && window.innerWidth < 640;
  const dpr: [number, number] = heavy && small ? [0.75, 1] : [1, 2];
  const showScene = ready && !reduced && webgl;

  return (
    <div ref={host} className={className} aria-hidden="true" style={{ position: 'absolute', inset: 0, background: palette.bg }}>
      {/* The poster: designed, not blank. Fades out when the scene is up. */}
      <img src={poster} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'opacity 900ms var(--ease-out)', opacity: showScene ? 0 : 1 }} />
      {showScene && (
        <Canvas dpr={dpr} camera={{ position: [0, 0, 6], fov: 40 }} gl={{ antialias: !heavy, alpha: false, powerPreference: 'high-performance' }} frameloop={visible ? 'always' : 'demand'} shadows style={{ position: 'absolute', inset: 0 }}>
          <Suspense fallback={null}>
            <Scene palette={palette} progress={progress} pointer={pointer} name={name} quality="full" />
          </Suspense>
        </Canvas>
      )}
    </div>
  );
}
