/**
 * The choices, drawn, while they are being made.
 *
 * A small honest site that rebuilds itself as options change: the real scene
 * in WebGL with the real palette, the type treatment, the layout system as a
 * wireframe, the motion pace, the cursor. Not a preview of *the* site — that
 * gets generated and will be better — but an answer to "what does Ember look
 * like with the relief scene and the split layout", which is the question
 * this panel is for.
 */

import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Catalogue, Spec } from '@superbuilds/protocol';
import { sceneComponentFor, type ScenePalette } from '@scenes/index';
import { cx } from '@/components/ui';

const FACES: Record<string, { display: string; body: string; weight: number; tracking: string; transform?: string }> = {
  grotesk: { display: 'var(--font-sans)', body: 'var(--font-sans)', weight: 700, tracking: '-0.03em' },
  editorial: { display: 'Georgia, "Times New Roman", serif', body: 'var(--font-sans)', weight: 500, tracking: '-0.02em' },
  brutal: { display: 'var(--font-display)', body: 'var(--font-sans)', weight: 800, tracking: '-0.04em' },
  'serif-body': { display: 'Georgia, serif', body: 'Georgia, serif', weight: 500, tracking: '-0.01em' },
  humanist: { display: 'var(--font-sans)', body: 'var(--font-sans)', weight: 700, tracking: '-0.01em' },
  'display-serif': { display: '"Instrument Serif", Georgia, serif', body: 'var(--font-sans)', weight: 400, tracking: '-0.02em' },
  'mono-accent': { display: 'var(--font-sans)', body: 'var(--font-mono)', weight: 600, tracking: '-0.02em' },
  condensed: { display: 'var(--font-display)', body: 'var(--font-sans)', weight: 800, tracking: '-0.02em', transform: 'uppercase' },
  geometric: { display: 'var(--font-sans)', body: 'var(--font-sans)', weight: 600, tracking: '0.01em' },
};

export function LivePreview({ spec, catalogue, name }: { spec: Partial<Spec>; catalogue: Catalogue; name: string }) {
  const pal = catalogue.palettes.find((p) => p.id === spec.palette) ?? catalogue.palettes[0];
  const [bg, fg, accent, muted, surface] = pal.swatch ?? ['#0A0B0D', '#EDE9E0', '#C8FF3D', '#6C6F78', '#15171B'];
  const palette: ScenePalette = useMemo(() => {
    // Light theme flips ground and ink, keeps the accent.
    if (spec.theme === 'light' && isDark(bg)) return { bg: fg, fg: bg, accent, muted, surface: '#F3F1EC' };
    if (spec.theme === 'dark' && !isDark(bg)) return { bg: fg, fg: bg, accent, muted, surface: '#15171B' };
    return { bg, fg, accent, muted, surface };
  }, [bg, fg, accent, muted, surface, spec.theme]);
  const face = FACES[spec.typography ?? 'grotesk'] ?? FACES.grotesk;
  const Scene = sceneComponentFor(spec.scene ?? 'field');
  const pace = spec.motionIntensity === 'calm' ? 420 : spec.motionIntensity === 'cinematic' ? 820 : 600;
  const signature = [spec.palette, spec.typography, spec.atmosphere, spec.layout, spec.scene, spec.motionIntensity, spec.theme, spec.hoverStyle, spec.cursorStyle].join(':');
  const [beat, setBeat] = useState(0);
  useEffect(() => { setBeat((n) => n + 1); }, [signature]);

  const progress = useRef(0);
  const pointer = useRef<[number, number]>([0, 0]);
  const frame = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const [hoverLabel, setHoverLabel] = useState('');
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = frame.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const onMove = (e: React.PointerEvent) => {
    const r = frame.current?.getBoundingClientRect(); if (!r) return;
    pointer.current = [((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1)];
    if (cursor.current) { cursor.current.style.transform = `translate(${e.clientX - r.left}px, ${e.clientY - r.top}px)`; }
  };
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => { const t = e.currentTarget; progress.current = Math.min(1, t.scrollTop / Math.max(1, t.scrollHeight - t.clientHeight)); };

  const vars = { '--p-bg': palette.bg, '--p-fg': palette.fg, '--p-accent': palette.accent, '--p-muted': palette.muted, '--p-surface': palette.surface, '--pace': `${pace}ms` } as CSSProperties;
  const layout = spec.layout ?? 'immersive-scene';
  const title = name?.trim() || 'Your name here';
  const cursorStyle = spec.cursorStyle ?? 'dot';
  const hover = spec.hoverStyle ?? 'lift';
  const radius = ['calm', 'warm-direct', 'appetite'].includes(spec.atmosphere ?? '') ? 14 : ['technical', 'futurist', 'plain-confident', 'bold-editorial'].includes(spec.atmosphere ?? '') ? 2 : 8;

  return (
    <div className="sticky top-20">
      <div className="flex items-center justify-between mb-2">
        <span className="legend">Live preview</span>
        <span className="telemetry text-bone-3">your choices, not the finished site · scroll inside</span>
      </div>
      <div ref={frame} onPointerMove={onMove} onPointerLeave={() => setHoverLabel('')} className="relative rounded-2xl overflow-hidden border border-line-2 aspect-[4/3] bg-ink-2" style={{ ...vars, cursor: cursorStyle === 'system' ? 'auto' : 'none' }}>
        <div className="absolute inset-0 overflow-y-auto overflow-x-hidden" onScroll={onScroll} style={{ background: palette.bg, color: palette.fg, fontFamily: face.body, scrollbarWidth: 'none' }}>
          {/* Hero: the scene, full frame, with floating chrome and viewport type */}
          <div className={cx('relative', layout === 'split-stage' ? 'grid grid-cols-2' : '')} style={{ height: layout === 'split-stage' ? '100%' : '100%', minHeight: 300 }}>
            <div className={cx('relative', layout === 'split-stage' ? 'h-full' : 'absolute inset-0')}>
              <Canvas key={spec.scene + palette.bg} dpr={[1, 1.5]} camera={{ position: [0, 0, 6], fov: 40 }} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }} frameloop={visible ? 'always' : 'demand'} shadows>
                <Suspense fallback={null}>
                  <Scene palette={palette} progress={progress} pointer={pointer} name={title} quality="preview" />
                </Suspense>
              </Canvas>
            </div>
            <div className={cx('relative pointer-events-none flex flex-col justify-between p-5', layout === 'split-stage' ? 'h-full' : 'absolute inset-0')} key={beat}>
              <div className="flex items-center justify-between">
                <span className="rise text-[11px] tracking-[0.18em] uppercase" style={{ fontFamily: face.display, animationDuration: 'var(--pace)' }}>{title.slice(0, 18)}</span>
                <span className="rise d2 flex gap-1.5" style={{ animationDuration: 'var(--pace)' }}><i className="block w-8 h-1.5 rounded" style={{ background: palette.fg, opacity: .8 }} /><i className="block w-3 h-1.5 rounded" style={{ background: palette.accent }} /></span>
              </div>
              <div>
                <div className="rise d1 leading-[0.92]" style={{ fontFamily: face.display, fontWeight: face.weight, letterSpacing: face.tracking, fontSize: 'clamp(28px, 7.5cqw, 54px)', textTransform: face.transform as CSSProperties['textTransform'], animationDuration: 'var(--pace)', textShadow: `0 2px 30px ${palette.bg}` }}>
                  {title}<br /><span style={{ color: palette.accent }}>{tagFor(spec.archetype)}</span>
                </div>
                <div className="rise d3 flex gap-2 mt-4" style={{ animationDuration: 'var(--pace)' }}>
                  <span className="inline-block h-7 w-24 rounded-full" style={{ background: palette.accent, borderRadius: radius * 2 }} />
                  <span className="inline-block h-7 w-16 rounded-full border" style={{ borderColor: palette.fg, opacity: .7, borderRadius: radius * 2 }} />
                </div>
              </div>
            </div>
          </div>
          {/* Below the fold: the layout system as wireframe */}
          <LayoutBlocks layout={layout} palette={palette} radius={radius} hover={hover} onHover={setHoverLabel} pace={pace} beat={beat} face={face} atmosphere={spec.atmosphere ?? ''} />
        </div>
        {cursorStyle !== 'system' && (
          <div ref={cursor} className="absolute left-0 top-0 pointer-events-none z-10 will-change-transform" style={{ transition: 'transform 60ms linear' }}>
            {cursorStyle === 'dot' && <span className="block rounded-full" style={{ width: 34, height: 34, background: palette.accent, mixBlendMode: 'difference', transform: `translate(-50%, -50%) scale(${hoverLabel ? 1 : 0.3})`, transition: 'transform 160ms var(--sb-ease)' }} />}
            {cursorStyle === 'ring' && <span className="block rounded-full border-2" style={{ width: 36, height: 36, borderColor: palette.accent, transform: `translate(-50%, -50%) scale(${hoverLabel ? 0.6 : 1})`, transition: 'transform 200ms var(--sb-ease)' }} />}
            {cursorStyle === 'label' && <span className="block -translate-x-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: palette.accent, color: palette.bg, opacity: hoverLabel ? 1 : 0, transition: 'opacity 150ms' }}>{hoverLabel || 'View'}</span>}
            {cursorStyle === 'label' && <span className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ width: 8, height: 8, background: palette.accent, opacity: hoverLabel ? 0 : 1 }} />}
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 telemetry text-bone-3">
        <span>{pal.label}</span><span>·</span><span>{catalogue.typography.find((t) => t.id === spec.typography)?.label}</span><span>·</span><span>{catalogue.layouts.find((l) => l.id === spec.layout)?.label}</span><span>·</span><span>{catalogue.scenes.find((s) => s.id === spec.scene)?.label}</span>
      </div>
    </div>
  );
}

function isDark(hex: string) { const n = parseInt(hex.replace('#', ''), 16); return ((n >> 16) & 255) * 0.2126 + ((n >> 8) & 255) * 0.7152 + (n & 255) * 0.0722 < 140; }

function tagFor(a?: string) {
  return ({ portfolio: 'Work that argues for itself.', agency: 'Ideas, built.', saas: 'Do the thing, faster.', hardware: 'Engineered to be looked at.', 'local-service': 'Sorted, today.', clinic: 'In good hands.', restaurant: 'Come hungry.', shop: 'Made to be kept.', fitness: 'Show up.', property: 'Imagine living here.', education: 'Learn it properly.', events: 'Be there.', professional: 'Careful with what matters.', nonprofit: 'Help us change this.', creator: 'New work, often.' } as Record<string, string>)[a ?? ''] ?? 'Something worth remembering.';
}

function LayoutBlocks({ layout, palette, radius, hover, onHover, pace, beat, face, atmosphere }: { layout: string; palette: ScenePalette; radius: number; hover: string; onHover: (s: string) => void; pace: number; beat: number; face: { display: string; weight: number; tracking: string }; atmosphere: string }) {
  const dense = atmosphere === 'technical' || atmosphere === 'futurist';
  const gap = dense ? 6 : 10;
  const block = (h: number, k: number, accent = false, label = 'View'): React.ReactNode => (
    <div key={k} onPointerEnter={() => onHover(label)} onPointerLeave={() => onHover('')} className={cx('rise', hover === 'lift' && 'hover:-translate-y-1 hover:shadow-lg', hover === 'magnetic' && 'hover:scale-[1.03]', hover === 'reveal' && 'hover:brightness-125', hover === 'distort' && 'hover:skew-x-1')}
      style={{ height: h, background: accent ? palette.accent : palette.surface, borderRadius: radius, border: `1px solid ${palette.muted}33`, transition: `transform ${Math.max(160, pace / 3)}ms var(--sb-ease), filter 200ms`, animationDuration: `${pace}ms`, animationDelay: `${k * 60}ms` }} />
  );
  const heading = (w: string, k: number) => <div key={`h${k}`} className="rise" style={{ fontFamily: face.display, fontWeight: face.weight, letterSpacing: face.tracking, fontSize: 18, width: w, height: 18, lineHeight: 1, animationDuration: `${pace}ms` }}>{['Work', 'About', 'Services', 'Contact'][k % 4]}</div>;
  const lines = (n: number, k: number) => <div key={`l${k}`} className="flex flex-col gap-1.5">{Array.from({ length: n }, (_, i) => <div key={i} style={{ height: 5, width: `${90 - i * 17}%`, background: palette.muted, opacity: .55, borderRadius: 3 }} />)}</div>;

  return (
    <div key={beat} className="p-5" style={{ display: 'flex', flexDirection: 'column', gap: gap * 2 }}>
      {layout === 'immersive-scene' && <>
        <div style={{ marginTop: 28 }}>{heading('40%', 0)}{lines(3, 0)}</div>
        <div className="grid grid-cols-3" style={{ gap }}>{[70, 90, 70].map((h, i) => block(h, i, i === 1))}</div>
        <div>{heading('55%', 1)}{lines(2, 1)}</div>
        <div className="grid grid-cols-2" style={{ gap }}>{[60, 60].map((h, i) => block(h, i + 3))}</div>
      </>}
      {layout === 'split-stage' && <>
        {[0, 1, 2].map((i) => <div key={i} className="grid grid-cols-2" style={{ gap }}><div>{heading('70%', i)}{lines(4, i)}</div>{block(84, i + 10, i === 1)}</div>)}
      </>}
      {layout === 'editorial-grid' && <>
        <div className="grid grid-cols-12" style={{ gap: 6 }}>
          <div className="col-span-8">{heading('100%', 0)}</div><div className="col-span-4">{lines(3, 0)}</div>
          <div className="col-span-5">{block(90, 0)}</div><div className="col-span-7">{block(90, 1, true)}</div>
          <div className="col-span-12" style={{ height: 1, background: palette.muted, opacity: .5 }} />
          <div className="col-span-4">{lines(3, 1)}</div><div className="col-span-4">{lines(3, 2)}</div><div className="col-span-4">{lines(3, 3)}</div>
        </div>
      </>}
      {layout === 'horizontal-journey' && <>
        <div className="flex overflow-hidden" style={{ gap }}>{[0, 1, 2, 3].map((i) => <div key={i} className="shrink-0" style={{ width: '58%' }}>{block(110, i, i === 2, 'Drag')}{heading('60%', i)}</div>)}</div>
        <div style={{ height: 2, background: palette.muted, opacity: .4 }}><div style={{ width: '35%', height: 2, background: palette.accent }} /></div>
        <div>{heading('50%', 9)}{lines(2, 9)}</div>
      </>}
      {layout === 'stacked-cards' && <>
        {[0, 1, 2].map((i) => <div key={i} style={{ marginTop: i ? -36 : 0, padding: 14, background: i === 1 ? palette.accent : palette.surface, borderRadius: radius * 2, border: `1px solid ${palette.muted}33`, boxShadow: `0 -10px 30px ${palette.bg}` }} className="rise"><div style={{ color: i === 1 ? palette.bg : palette.fg }}>{heading('50%', i)}</div>{lines(3, i)}</div>)}
      </>}
      {layout === 'bento' && <>
        <div className="grid grid-cols-4 grid-rows-3" style={{ gap, gridAutoRows: 46 }}>
          <div className="col-span-2 row-span-2">{block(100, 0)}</div><div>{block(46, 1, true, 'Play')}</div><div>{block(46, 2)}</div>
          <div className="col-span-2">{block(46, 3)}</div><div className="col-span-2">{block(46, 4)}</div><div className="col-span-2">{block(46, 5, true)}</div>
        </div>
      </>}
      {layout === 'long-scroll-story' && <>
        {[0, 1, 2].map((i) => <div key={i} className="grid grid-cols-[3px_1fr]" style={{ gap: 12 }}><div style={{ background: i === 0 ? palette.accent : palette.muted, opacity: .7, borderRadius: 2 }} /><div>{heading('60%', i)}{lines(3, i)}{block(64, i + 20, false, 'Read')}</div></div>)}
      </>}
      {layout === 'minimal-column' && <>
        <div className="mx-auto" style={{ width: '80%' }}>{heading('70%', 0)}{lines(5, 0)}</div>
        {block(80, 1, false, 'Read')}
        <div className="mx-auto" style={{ width: '80%' }}>{heading('50%', 1)}{lines(4, 1)}</div>
      </>}
      <div className="mt-2 flex items-center justify-between" style={{ borderTop: `1px solid ${palette.muted}44`, paddingTop: 10 }}>
        <span style={{ width: 60, height: 6, background: palette.fg, opacity: .7, borderRadius: 3 }} />
        <span className="flex gap-2">{[0, 1, 2].map((i) => <span key={i} style={{ width: 18, height: 6, background: palette.muted, borderRadius: 3 }} />)}</span>
      </div>
    </div>
  );
}
