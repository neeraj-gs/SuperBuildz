/**
 * One object, the length of the page.
 *
 * ── Why the canvas does not stop at the fold ────────────────────────────────
 *
 * The landing page told visitors that a hero should be an experience and that
 * "the canvas does not stop at the fold: it stays alive under the whole page",
 * and then put a WebGL scene in the top right corner of the first screen and
 * spent the rest of itself on rows of identical cards. A page that argues for
 * something it does not do is the strongest possible argument against itself.
 *
 * So there is one scene, fixed behind everything, and it is the page's own
 * argument acted out. A website's parts float apart, draw together into a
 * page, split into three directions to choose from, rearrange into a
 * dashboard, multiply into several projects being worked on at once, and
 * finally settle into one solid thing. Each of those is the section it sits
 * behind. Nothing here is decoration: it is the product, drawn.
 *
 * ── How a section drives it ────────────────────────────────────────────────
 *
 * Sections register themselves with a chapter name, and this measures where
 * they are. Pinning the chapters to fractions of the document would mean any
 * new paragraph anywhere silently desynchronises the whole page; measuring
 * the actual elements means the scene is always describing whatever you are
 * actually reading, and a section can be moved, cut or added without touching
 * this file.
 *
 * ── Drawn as an assembly diagram ────────────────────────────────────────────
 *
 * Solid dark plates with a hairline on every edge — the same line the whole
 * interface is built from, and the only way dark matte panels read against a
 * dark ground. The accent is the light on one edge, never a slab of paint.
 */

import { Canvas, useFrame } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

export type ChapterId = 'explode' | 'assemble' | 'index' | 'directions' | 'dashboard' | 'parallel' | 'rest';

/* ------------------------------------------------------- the registry -- */

const sections = new Map<ChapterId, HTMLElement>();
let version = 0;

/** Attach to the section that a chapter belongs to. */
export function useChapter(id: ChapterId) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    sections.set(id, el);
    version++;
    return () => { sections.delete(id); version++; };
  }, [id]);
  return ref;
}

/** Page order, which is the order the chapters play in. */
const ORDER: ChapterId[] = ['explode', 'assemble', 'index', 'directions', 'dashboard', 'parallel', 'rest'];

/* ----------------------------------------------------------- the page -- */

type Kind = 'plate' | 'rule' | 'ink' | 'accent';
interface Slot { x: number; y: number; w: number; h: number; z: number; rx: number; ry: number; kind: Kind; on: number }

const PLATES = 14;
const HIDDEN: Slot = { x: 0, y: 0, w: 0.001, h: 0.001, z: 0, rx: 0, ry: 0, kind: 'rule', on: 0 };

/** The page, assembled: masthead, two headline blocks, one lit image, three rules, a strip, three cards, a footer. */
const PAGE: Slot[] = [
  { x: 0.00, y: 0.90, w: 0.98, h: 0.030, z: 0, rx: 0, ry: 0, kind: 'rule', on: 1 },
  { x: -0.24, y: 0.64, w: 0.48, h: 0.070, z: 0, rx: 0, ry: 0, kind: 'ink', on: 1 },
  { x: -0.31, y: 0.52, w: 0.34, h: 0.070, z: 0, rx: 0, ry: 0, kind: 'ink', on: 1 },
  { x: 0.26, y: 0.30, w: 0.44, h: 0.400, z: 0, rx: 0, ry: 0, kind: 'accent', on: 1 },
  { x: -0.30, y: 0.27, w: 0.36, h: 0.014, z: 0, rx: 0, ry: 0, kind: 'rule', on: 1 },
  { x: -0.33, y: 0.20, w: 0.30, h: 0.014, z: 0, rx: 0, ry: 0, kind: 'rule', on: 1 },
  { x: -0.36, y: 0.13, w: 0.24, h: 0.014, z: 0, rx: 0, ry: 0, kind: 'rule', on: 1 },
  { x: 0.00, y: -0.11, w: 0.98, h: 0.150, z: 0, rx: 0, ry: 0, kind: 'plate', on: 1 },
  { x: -0.33, y: -0.42, w: 0.30, h: 0.160, z: 0, rx: 0, ry: 0, kind: 'plate', on: 1 },
  { x: 0.00, y: -0.42, w: 0.30, h: 0.160, z: 0, rx: 0, ry: 0, kind: 'plate', on: 1 },
  { x: 0.33, y: -0.42, w: 0.30, h: 0.160, z: 0, rx: 0, ry: 0, kind: 'plate', on: 1 },
  { x: 0.00, y: -0.66, w: 0.80, h: 0.020, z: 0, rx: 0, ry: 0, kind: 'rule', on: 1 },
  HIDDEN,
  HIDDEN,
];

/** How far forward each plate floats while exploded, and the tilt it rests at. */
const DRIFT: Array<[number, number, number]> = [
  [1.5, 0.16, -0.26], [0.7, -0.09, 0.20], [0.9, -0.07, 0.22], [2.1, 0.19, -0.34],
  [1.2, -0.05, 0.13], [1.4, -0.04, 0.17], [1.6, -0.03, 0.20], [2.7, 0.26, -0.15],
  [1.2, -0.14, 0.26], [1.8, 0.04, -0.10], [2.4, 0.13, -0.24], [0.9, 0.06, 0.08],
  [0, 0, 0], [0, 0, 0],
];

/**
 * Where every plate goes, in each chapter.
 *
 * Written as one function rather than seven tables because the plates keep
 * their identity throughout — the plate that is a headline in the first
 * chapter is a column header in the dashboard and the top of the second stack
 * in the parallel one. That continuity is the whole effect: things move, they
 * are not replaced.
 */
function layout(chapter: ChapterId, i: number): Slot {
  const page = PAGE[i];
  switch (chapter) {
    case 'explode': {
      const [z, rx, ry] = DRIFT[i];
      return { ...page, z, rx, ry };
    }
    case 'assemble':
      return { ...page, z: -i * 0.004 };

    /* The page recedes and turns, so the type in front of it can be read. */
    case 'index':
      return { ...page, x: page.x * 0.86 + 0.22, y: page.y * 0.86, z: -i * 0.05 - 0.4, rx: 0.06, ry: -0.42, on: page.on * 0.5 };

    /* Three directions, side by side — four plates each, the rest away. */
    case 'directions': {
      const col = Math.floor(i / 4);
      if (col > 2) return { ...HIDDEN };
      const within = i % 4;
      const x = (col - 1) * 0.62;
      const shape = [
        { y: 0.36, w: 0.10, h: 0.026, kind: 'accent' as Kind },
        { y: 0.22, w: 0.44, h: 0.052, kind: 'ink' as Kind },
        { y: 0.04, w: 0.44, h: 0.230, kind: 'plate' as Kind },
        { y: -0.22, w: 0.30, h: 0.020, kind: 'rule' as Kind },
      ][within];
      return { x, y: shape.y, w: shape.w * 0.62, h: shape.h, z: (col - 1) * 0.06, rx: 0, ry: (col - 1) * -0.16, kind: shape.kind, on: 1 };
    }

    /* The CRM: four figures, a chart with its bars, three columns of cards. */
    case 'dashboard': {
      if (i < 4) return { x: (i - 1.5) * 0.25, y: 0.46, w: 0.22, h: 0.130, z: 0, rx: 0, ry: 0, kind: i === 3 ? 'accent' : 'plate', on: 1 };
      if (i === 7) return { x: 0, y: 0.10, w: 0.98, h: 0.300, z: -0.02, rx: 0, ry: 0, kind: 'plate', on: 1 };
      if (i >= 4 && i <= 6) {
        const h = [0.10, 0.19, 0.14][i - 4];
        return { x: -0.30 + (i - 4) * 0.16, y: 0.10 - 0.15 + h / 2, w: 0.09, h, z: 0.05, rx: 0, ry: 0, kind: i === 5 ? 'accent' : 'ink', on: 1 };
      }
      if (i >= 8 && i <= 10) return { x: (i - 9) * 0.34, y: -0.34, w: 0.30, h: 0.230, z: 0, rx: 0, ry: 0, kind: 'plate', on: 1 };
      if (i === 11) return { x: 0, y: -0.58, w: 0.98, h: 0.014, z: 0, rx: 0, ry: 0, kind: 'rule', on: 1 };
      return { ...HIDDEN };
    }

    /*
      Several projects at once: three stacks, and the two rules between them
      that are the notebook they share. The stacks tilt towards each other,
      which is the only bit of theatre here and the one that says "connected".
    */
    case 'parallel': {
      if (i >= 12) {
        const y = i === 12 ? -0.02 : -0.30;
        return { x: 0, y, w: 1.30, h: 0.012, z: 0.32, rx: 0, ry: 0, kind: i === 12 ? 'accent' : 'rule', on: 1 };
      }
      const stack = Math.floor(i / 4);
      const within = i % 4;
      const x = (stack - 1) * 0.60;
      const shape = [
        { y: 0.44, w: 0.40, h: 0.026, kind: 'rule' as Kind },
        { y: 0.30, w: 0.40, h: 0.060, kind: 'ink' as Kind },
        { y: 0.14, w: 0.40, h: 0.140, kind: stack === 1 ? ('accent' as Kind) : ('plate' as Kind) },
        { y: -0.46, w: 0.40, h: 0.180, kind: 'plate' as Kind },
      ][within];
      return { x, y: shape.y, w: shape.w, h: shape.h, z: (1 - Math.abs(stack - 1)) * 0.18, rx: 0.05, ry: (stack - 1) * -0.34, kind: shape.kind, on: 1 };
    }

    /* Everything lands as one thing, and gets out of the way. */
    case 'rest':
      return { x: 0, y: 0, w: 0.86, h: 0.52, z: -i * 0.012, rx: 0.03, ry: -0.08, kind: i === 3 ? 'accent' : 'plate', on: i < 4 ? 1 : 0.12 };
  }
}

/**
 * Where the whole assembly sits, per chapter, and how big it is.
 *
 * Some chapters are read and some are looked at. The ones with a column of
 * prose in them push the object into the half of the screen the prose is not
 * using and shrink it a little; the ones whose subject *is* the object let it
 * take the middle. Nothing is ever read across moving geometry.
 */
const PLACE: Record<ChapterId, { x: number; scale: number; fade: number }> = {
  explode: { x: 0.34, scale: 0.78, fade: 1 },
  assemble: { x: 0.44, scale: 0.62, fade: 0.5 },
  index: { x: 0.48, scale: 0.58, fade: 0.36 },
  directions: { x: 0, scale: 1, fade: 0.5 },
  dashboard: { x: 0, scale: 1.04, fade: 0.4 },
  parallel: { x: 0, scale: 1, fade: 0.5 },
  rest: { x: 0, scale: 1.1, fade: 0.35 },
};

const EDGE: Record<Kind, string> = { plate: '#3D4757', rule: '#5A6778', ink: '#9AA6B7', accent: '#C8FF3D' };
const EDGE_C = { plate: new THREE.Color('#3D4757'), rule: new THREE.Color('#5A6778'), ink: new THREE.Color('#9AA6B7'), accent: new THREE.Color('#C8FF3D') } as const;

/* Three palettes for the three directions, so that chapter reads as a choice. */
const DIRECTION_EDGE = ['#8AA0BE', '#E4622F', '#7CD9A8'];

function mix(a: Slot, b: Slot, t: number): Slot {
  const l = (x: number, y: number) => x + (y - x) * t;
  return {
    x: l(a.x, b.x), y: l(a.y, b.y), w: l(a.w, b.w), h: l(a.h, b.h),
    z: l(a.z, b.z), rx: l(a.rx, b.rx), ry: l(a.ry, b.ry),
    on: l(a.on, b.on), kind: t < 0.5 ? a.kind : b.kind,
  };
}

/* ---------------------------------------------------------- the scene -- */

interface Drive { from: ChapterId; to: ChapterId; t: number }

function Assembly({ drive, pointer, reduced, fade }: { drive: React.RefObject<Drive>; pointer: React.RefObject<[number, number]>; reduced: boolean; fade: React.RefObject<number> }) {
  const group = useRef<THREE.Group>(null);
  const meshes = useRef<THREE.Mesh[]>([]);
  const edges = useRef<Array<{ material: THREE.LineBasicMaterial }>>([]);
  const box = useRef(3);

  const mats = useMemo(() => ({
    plate: new THREE.MeshStandardMaterial({ color: '#181D25', metalness: 0.3, roughness: 0.72 }),
    ink: new THREE.MeshStandardMaterial({ color: '#333B47', metalness: 0.25, roughness: 0.6 }),
    rule: new THREE.MeshStandardMaterial({ color: '#1B212A', metalness: 0.25, roughness: 0.65 }),
    accent: new THREE.MeshStandardMaterial({ color: '#161C17', metalness: 0.3, roughness: 0.6, emissive: '#C8FF3D', emissiveIntensity: 0.02 }),
  } satisfies Record<Kind, THREE.MeshStandardMaterial>), []);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  useFrame(({ clock, viewport, camera }, delta) => {
    const d = drive.current ?? { from: 'explode', to: 'explode', t: 0 };
    const t = clock.getElapsedTime();
    /*
      Asked for less motion: the object still describes the section you are on,
      but it stops easing towards it and stops leaning towards the pointer. It
      is where the scroll says it is, and nothing moves on its own.
    */
    const [px, py] = reduced ? [0, 0] : (pointer.current ?? [0, 0]);
    const ease = reduced ? 60 : 0;
    // Sized off the shorter axis so the assembly never outgrows the frame.
    box.current = Math.min(viewport.width * 0.62, viewport.height * 0.78);
    const b = box.current;
    const step = delta > 0.12 ? 0.12 : delta; // a backgrounded tab must not jump

    camera.position.x = THREE.MathUtils.damp(camera.position.x, px * 0.5, ease || 2, step);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, py * 0.3, ease || 2, step);
    camera.lookAt(0, 0, 0);

    const place = PLACE[d.from];
    const placeTo = PLACE[d.to];
    const gx = place.x + (placeTo.x - place.x) * d.t;
    const gs = place.scale + (placeTo.scale - place.scale) * d.t;
    fade.current = place.fade + (placeTo.fade - place.fade) * d.t;

    if (group.current) {
      const settle = d.from === 'explode' ? 1 - d.t : 0;
      group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, px * 0.08 - 0.22 * settle, ease || 3, step);
      group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, -py * 0.05 + 0.07 * settle, ease || 3, step);
      group.current.position.x = THREE.MathUtils.damp(group.current.position.x, gx * viewport.width * 0.5, ease || 3, step);
      const sc = THREE.MathUtils.damp(group.current.scale.x, gs, ease || 3, step);
      group.current.scale.setScalar(sc);
    }

    for (let i = 0; i < PLATES; i++) {
      const m = meshes.current[i];
      if (!m) continue;
      const target = mix(layout(d.from, i), layout(d.to, i), d.t);
      // The float only belongs to the exploded chapter; everywhere else the
      // page has been put together and should stay put.
      const loose = d.from === 'explode' ? 1 - d.t : 0;
      const wobble = reduced ? 0 : Math.sin(t * 0.4 + i) * loose * 0.008;

      m.position.x = THREE.MathUtils.damp(m.position.x, target.x * b, ease || 4, step);
      m.position.y = THREE.MathUtils.damp(m.position.y, (target.y * 0.66 + wobble) * b, ease || 4, step);
      m.position.z = THREE.MathUtils.damp(m.position.z, target.z * b * 0.2, ease || 4, step);
      m.rotation.x = THREE.MathUtils.damp(m.rotation.x, target.rx, ease || 4, step);
      m.rotation.y = THREE.MathUtils.damp(m.rotation.y, target.ry, ease || 4, step);
      // Scale rather than rebuilt geometry: one box, resized, sixty times a second.
      m.scale.x = THREE.MathUtils.damp(m.scale.x, Math.max(0.001, target.w * b), ease || 4, step);
      m.scale.y = THREE.MathUtils.damp(m.scale.y, Math.max(0.001, target.h * 0.66 * b), ease || 4, step);
      m.visible = target.on > 0.02;

      const edge = edges.current[i];
      if (edge) {
        // In the directions chapter each column takes its own palette, which
        // is the only place three colours are ever on screen at once.
        const base = d.to === 'directions' || d.from === 'directions'
          ? new THREE.Color(DIRECTION_EDGE[Math.min(2, Math.floor(i / 4))])
          : EDGE_C[target.kind];
        edge.material.color.lerp(base, 0.08);
        edge.material.opacity = THREE.MathUtils.damp(edge.material.opacity, target.on * (fade.current ?? 1), ease || 4, step);
      }
      (m.material as THREE.Material).opacity = target.on;
    }
  });

  return (
    <group ref={group}>
      {Array.from({ length: PLATES }, (_, i) => (
        <mesh key={i} ref={(el) => { if (el) meshes.current[i] = el; }} material={mats[PAGE[i].kind]}>
          <boxGeometry args={[1, 1, 0.02]} />
          <Edges
            ref={(el) => { if (el) edges.current[i] = el as unknown as { material: THREE.LineBasicMaterial }; }}
            lineWidth={PAGE[i].kind === 'accent' ? 1.6 : 1.1}
            threshold={15}
            color={EDGE[PAGE[i].kind]}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}

/* --------------------------------------------------------- the driver -- */

export function Spine({ className }: { className?: string }) {
  const drive = useRef<Drive>({ from: 'explode', to: 'assemble', t: 0 });
  const pointer = useRef<[number, number]>([0, 0]);
  const fade = useRef(1);
  const [reduced, setReduced] = useState(false);
  const [awake, setAwake] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMq = () => setReduced(mq.matches);
    onMq();
    mq.addEventListener('change', onMq);

    let rects: Array<{ id: ChapterId; top: number; bottom: number }> = [];
    let seen = -1;
    const measure = () => {
      seen = version;
      rects = ORDER
        .map((id) => {
          const el = sections.get(id);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { id, top: r.top + window.scrollY, bottom: r.bottom + window.scrollY };
        })
        .filter(Boolean) as typeof rects;
    };

    const read = () => {
      if (seen !== version || !rects.length) measure();
      if (!rects.length) return;
      const eye = window.scrollY + window.innerHeight * 0.5;
      let i = rects.findIndex((r) => eye < r.bottom);
      if (i === -1) i = rects.length - 1;
      const cur = rects[i];
      const nxt = rects[i + 1];
      // The blend happens across the last third of a section, so a chapter is
      // itself for most of the time you spend reading it.
      const span = Math.max(1, cur.bottom - cur.top);
      const into = (eye - cur.top) / span;
      const t = nxt ? THREE.MathUtils.smoothstep(into, 0.66, 1) : 0;
      drive.current = { from: cur.id, to: nxt?.id ?? cur.id, t };
    };

    let queued = false;
    const onScroll = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; read(); }); };
    const onResize = () => { measure(); read(); };
    const onMove = (e: PointerEvent) => { pointer.current = [(e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1)]; };
    const onVis = () => setAwake(document.visibilityState === 'visible');

    // The sections mount after this effect on the first pass.
    const first = setTimeout(onResize, 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('visibilitychange', onVis);
    read();

    return () => {
      clearTimeout(first);
      mq.removeEventListener('change', onMq);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return (
    <div className={className} aria-hidden="true">
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, 6.4], fov: 40 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        frameloop={awake ? 'always' : 'demand'}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 5, 6]} intensity={1.1} />
        <directionalLight position={[-5, -1, 3]} intensity={0.5} color="#7E8DA4" />
        {/* A grazing light off to the side: it draws the accent plate's edge
            rather than flooding its face green. */}
        <pointLight position={[3.1, 1.5, 0.5]} intensity={3} color="#C8FF3D" distance={5} decay={2} />
        <Assembly drive={drive} pointer={pointer} reduced={reduced} fade={fade} />
      </Canvas>
    </div>
  );
}
