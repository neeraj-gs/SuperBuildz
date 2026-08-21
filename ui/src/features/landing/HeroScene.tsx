/**
 * The landing hero: a website assembling itself.
 *
 * A stack of thin slabs — the sections of a site — float exploded in depth,
 * breathe, and drift toward the pointer; as the page scrolls they dock into a
 * single plane, which is the thing this product does. One accent light, one
 * rim light, no fog-of-particles. The type sits in the DOM over it.
 */

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

const SLABS = 9;

function Slabs({ scroll, pointer }: { scroll: React.MutableRefObject<number>; pointer: React.MutableRefObject<[number, number]> }) {
  const group = useRef<THREE.Group>(null);
  const refs = useRef<THREE.Mesh[]>([]);
  const { viewport } = useThree();
  const w = Math.min(viewport.width * 0.38, 5.2);

  const slabs = useMemo(() => Array.from({ length: SLABS }, (_, i) => {
    const t = i / (SLABS - 1);
    return {
      // The docked position: a stacked page, slightly offset so edges read.
      docked: new THREE.Vector3((t - 0.5) * 0.18, (0.5 - t) * 1.05 * w * 0.42, -t * 0.25),
      // The exploded position: scattered in depth, rotated.
      loose: new THREE.Vector3((Math.sin(i * 2.3) * 0.9) * w * 0.35, (Math.cos(i * 1.7) * 0.8) * w * 0.35, -1.2 - (i % 3) * 1.6 - Math.abs(Math.sin(i)) * 2.2),
      rot: new THREE.Euler(Math.sin(i * 1.3) * 0.55, Math.cos(i * 0.9) * 0.7, Math.sin(i * 0.6) * 0.25),
      height: 0.16 + (i % 4 === 0 ? 0.5 : i % 3 === 0 ? 0.3 : 0) * w * 0.2,
      accent: i === 0 || i === 4,
      phase: i * 0.9,
    };
  }), [w]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const p = THREE.MathUtils.smoothstep(scroll.current, 0.02, 0.62);
    const [px, py] = pointer.current;
    if (group.current) {
      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, px * 0.22 - 0.35 * (1 - p), 0.04);
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -py * 0.14 + 0.12 * (1 - p), 0.04);
      group.current.position.z = THREE.MathUtils.lerp(group.current.position.z, p * 1.2, 0.05);
    }
    slabs.forEach((s, i) => {
      const m = refs.current[i]; if (!m) return;
      const breathe = Math.sin(t * 0.6 + s.phase) * 0.06 * (1 - p);
      m.position.lerpVectors(s.loose, s.docked, p);
      m.position.y += breathe;
      m.rotation.x = s.rot.x * (1 - p) + Math.sin(t * 0.4 + s.phase) * 0.03 * (1 - p);
      m.rotation.y = s.rot.y * (1 - p) + Math.cos(t * 0.3 + s.phase) * 0.04 * (1 - p);
      m.rotation.z = s.rot.z * (1 - p);
    });
  });

  return (
    <group ref={group}>
      {slabs.map((s, i) => (
        <mesh key={i} ref={(el) => { if (el) refs.current[i] = el; }} castShadow receiveShadow>
          <boxGeometry args={[w, s.height, 0.06]} />
          <meshStandardMaterial color={s.accent ? '#C8FF3D' : '#1A1D24'} metalness={s.accent ? 0.1 : 0.55} roughness={s.accent ? 0.35 : 0.42} emissive={s.accent ? '#9FD61D' : '#000000'} emissiveIntensity={s.accent ? 0.25 : 0} />
        </mesh>
      ))}
    </group>
  );
}

function Rig({ pointer }: { pointer: React.MutableRefObject<[number, number]> }) {
  useFrame(({ camera }) => {
    const [px, py] = pointer.current;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, px * 0.35, 0.04);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, py * 0.22, 0.04);
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
    const onScroll = () => { scroll.current = Math.min(1, window.scrollY / Math.max(1, window.innerHeight * 1.1)); };
    const onMove = (e: PointerEvent) => { pointer.current = [(e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1)]; };
    const onVis = () => setVisible(document.visibilityState === 'visible');
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('visibilitychange', onVis);
    onScroll();
    return () => { mq.removeEventListener('change', onMq); window.removeEventListener('scroll', onScroll); window.removeEventListener('pointermove', onMove); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  return (
    <div className={className} aria-hidden="true">
      <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0, 7.5], fov: 38 }} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} frameloop={visible && !reduced ? 'always' : 'demand'} shadows>
        <color attach="background" args={['#0A0B0D']} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[4, 6, 6]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
        <pointLight position={[-5, -2, 3]} intensity={18} color="#C8FF3D" distance={14} decay={2} />
        <spotLight position={[0, 8, -4]} intensity={22} angle={0.6} penumbra={1} color="#EDE9E0" />
        <Slabs scroll={scroll} pointer={pointer} />
        <Rig pointer={pointer} />
      </Canvas>
    </div>
  );
}
