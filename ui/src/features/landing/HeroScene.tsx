/**
 * The landing hero: a website, exploded, assembling itself.
 *
 * Drawn the way an assembly diagram is drawn — solid dark plates with a
 * hairline on every edge — because that is the same line the whole interface
 * is built from, and because dark matte panels on a dark ground are invisible
 * without one. A page's parts (masthead, headline block, one lit image plate,
 * body rules, a strip, three cards, a footer) float apart in Z, drift, and
 * draw together as you scroll.
 *
 * It has to be legible at rest: the first frame is the argument.
 */

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Edges } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

type Kind = 'plate' | 'rule' | 'accent' | 'ink';
type Plate = {
  /** Position in the assembled page, as fractions of the page box. */
  x: number; y: number; w: number; h: number;
  /** How far forward it floats while exploded, and its resting tilt. */
  z: number; tilt: [number, number]; kind: Kind; phase: number;
};

const PAGE: Plate[] = [
  { x: 0.00, y: 0.90, w: 0.98, h: 0.030, z: 1.5, tilt: [0.16, -0.26], kind: 'rule', phase: 0.0 },
  { x: -0.24, y: 0.64, w: 0.48, h: 0.070, z: 0.7, tilt: [-0.09, 0.20], kind: 'ink', phase: 0.6 },
  { x: -0.31, y: 0.52, w: 0.34, h: 0.070, z: 0.9, tilt: [-0.07, 0.22], kind: 'ink', phase: 1.0 },
  { x: 0.26, y: 0.30, w: 0.44, h: 0.400, z: 2.1, tilt: [0.19, -0.34], kind: 'accent', phase: 1.5 },
  { x: -0.30, y: 0.27, w: 0.36, h: 0.014, z: 1.2, tilt: [-0.05, 0.13], kind: 'rule', phase: 2.0 },
  { x: -0.33, y: 0.20, w: 0.30, h: 0.014, z: 1.4, tilt: [-0.04, 0.17], kind: 'rule', phase: 2.4 },
  { x: -0.36, y: 0.13, w: 0.24, h: 0.014, z: 1.6, tilt: [-0.03, 0.20], kind: 'rule', phase: 2.7 },
  { x: 0.00, y: -0.11, w: 0.98, h: 0.150, z: 2.7, tilt: [0.26, -0.15], kind: 'plate', phase: 3.1 },
  { x: -0.33, y: -0.42, w: 0.30, h: 0.160, z: 1.2, tilt: [-0.14, 0.26], kind: 'plate', phase: 3.6 },
  { x: 0.00, y: -0.42, w: 0.30, h: 0.160, z: 1.8, tilt: [0.04, -0.10], kind: 'plate', phase: 3.9 },
  { x: 0.33, y: -0.42, w: 0.30, h: 0.160, z: 2.4, tilt: [0.13, -0.24], kind: 'plate', phase: 4.2 },
  { x: 0.00, y: -0.66, w: 0.80, h: 0.020, z: 0.9, tilt: [0.06, 0.08], kind: 'rule', phase: 4.7 },
];

// The accent plate is the one the light is on: a dark panel with a volt
// hairline, not a slab of lime. Accent as light, not paint.
const EDGE: Record<Kind, string> = { plate: '#3D4757', rule: '#5A6778', ink: '#9AA6B7', accent: '#C8FF3D' };

function Page({ scroll, pointer }: { scroll: React.RefObject<number>; pointer: React.RefObject<[number, number]> }) {
  const group = useRef<THREE.Group>(null);
  const refs = useRef<THREE.Group[]>([]);
  const { viewport } = useThree();
  // A portrait sheet, sized off the shorter axis so it never outgrows the frame.
  const box = Math.min(viewport.width * 0.66, viewport.height * 0.66);

  const mats = useMemo(() => ({
    plate: new THREE.MeshStandardMaterial({ color: '#181D25', metalness: 0.3, roughness: 0.72 }),
    ink: new THREE.MeshStandardMaterial({ color: '#333B47', metalness: 0.25, roughness: 0.6 }),
    rule: new THREE.MeshStandardMaterial({ color: '#1B212A', metalness: 0.25, roughness: 0.65 }),
    accent: new THREE.MeshStandardMaterial({ color: '#161C17', metalness: 0.3, roughness: 0.6, emissive: '#C8FF3D', emissiveIntensity: 0.018 }),
  } satisfies Record<Kind, THREE.MeshStandardMaterial>), []);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    // 0 = exploded (top of page), 1 = assembled (scrolled past the hero).
    const p = THREE.MathUtils.smoothstep(scroll.current, 0.05, 0.8);
    const [px, py] = pointer.current;

    if (group.current) {
      group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, px * 0.10 - 0.24 * (1 - p), 3, delta);
      group.current.rotation.x = THREE.MathUtils.damp(group.current.rotation.x, -py * 0.07 + 0.08 * (1 - p), 3, delta);
    }

    PAGE.forEach((s, i) => {
      const m = refs.current[i]; if (!m) return;
      const drift = Math.sin(t * 0.4 + s.phase) * (1 - p);
      m.position.x = s.x * box;
      m.position.y = s.y * box * 0.66 + drift * box * 0.008;
      m.position.z = THREE.MathUtils.lerp(s.z * box * 0.20, -i * 0.008, p);
      m.rotation.x = THREE.MathUtils.lerp(s.tilt[0], 0, p) + Math.sin(t * 0.28 + s.phase) * 0.014 * (1 - p);
      m.rotation.y = THREE.MathUtils.lerp(s.tilt[1], 0, p) + Math.cos(t * 0.23 + s.phase) * 0.018 * (1 - p);
    });
  });

  return (
    <group ref={group}>
      {PAGE.map((s, i) => {
        const w = s.w * box;
        const h = Math.max(s.h * box * 0.66, box * 0.012);
        const d = Math.max(0.02, box * 0.014);
        return (
          <group key={i} ref={(el) => { if (el) refs.current[i] = el; }}>
            <mesh material={mats[s.kind]} castShadow receiveShadow>
              <boxGeometry args={[w, h, d]} />
              <Edges lineWidth={s.kind === 'accent' ? 1.6 : 1.1} threshold={15} color={EDGE[s.kind]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Rig({ pointer }: { pointer: React.RefObject<[number, number]> }) {
  useFrame(({ camera }, delta) => {
    const [px, py] = pointer.current;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, px * 0.45, 2.2, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, py * 0.28, 2.2, delta);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export function HeroScene({ className }: { className?: string }) {
  const scroll = useRef(0);
  const pointer = useRef<[number, number]>([0, 0]);
  const [reduced, setReduced] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onMq = () => setReduced(mq.matches);
    mq.addEventListener('change', onMq);
    const onScroll = () => { scroll.current = Math.min(1, window.scrollY / Math.max(1, window.innerHeight)); };
    const onMove = (e: PointerEvent) => { pointer.current = [(e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1)]; };
    const onVis = () => setVisible(document.visibilityState === 'visible');
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('visibilitychange', onVis);
    onScroll();
    return () => {
      mq.removeEventListener('change', onMq);
      window.removeEventListener('scroll', onScroll);
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
        frameloop={visible && !reduced ? 'always' : 'demand'}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 5, 6]} intensity={1.1} />
        <directionalLight position={[-5, -1, 3]} intensity={0.5} color="#7E8DA4" />
        {/* A grazing light, off to the side — it draws the accent plate's edge
            rather than flooding its face green. */}
        <pointLight position={[3.1, 1.5, 0.5]} intensity={3} color="#C8FF3D" distance={5} decay={2} />
        <Page scroll={scroll} pointer={pointer} />
        <Rig pointer={pointer} />
      </Canvas>
    </div>
  );
}
