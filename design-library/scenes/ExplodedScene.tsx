/**
 * Taken apart: an assembly that explodes along one axis as the page scrolls —
 * each part drifting apart, a hairline arriving beside it — and reassembles.
 * Placeholder parts with honest proportions; the build swaps in the product.
 */

import { useFrame } from '@react-three/fiber';
import { Environment, ContactShadows } from '@react-three/drei';
import { useRef } from 'react';
import * as THREE from 'three';
import { useSmoothPointer, type SceneProps } from './_shared';

const PARTS = [
  { y: -0.9, geo: 'disc', r: 1.1, h: 0.18 },
  { y: -0.55, geo: 'ring', r: 0.95, h: 0.22 },
  { y: -0.15, geo: 'cyl', r: 0.75, h: 0.5 },
  { y: 0.35, geo: 'disc', r: 0.9, h: 0.12 },
  { y: 0.75, geo: 'cyl', r: 0.45, h: 0.6 },
  { y: 1.25, geo: 'disc', r: 0.6, h: 0.1 },
] as const;

export function ExplodedScene({ palette, pointer, progress, quality = 'full' }: SceneProps) {
  const group = useRef<THREE.Group>(null);
  const p = useSmoothPointer(pointer, 0.05);
  const low = quality === 'preview';
  useFrame(({ clock }) => {
    const g = group.current; if (!g) return;
    const t = clock.getElapsedTime();
    // Explode with scroll; at rest, breathe slightly.
    const e = THREE.MathUtils.smoothstep(progress.current, 0.05, 0.8) * 1.0 + (Math.sin(t * 0.8) * 0.5 + 0.5) * 0.12;
    g.children.forEach((c, i) => {
      const part = PARTS[i]; if (!part) return;
      c.position.y = part.y + (i - 2.5) * e * 0.9;
      c.rotation.y = t * 0.2 * (i % 2 ? 1 : -1) + p.current.x * 0.3;
    });
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, p.current.x * 0.5 + 0.4, 0.05);
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, 0.25 - p.current.y * 0.2, 0.05);
  });
  return (
    <>
      <color attach="background" args={[palette.bg]} />
      <Environment preset="studio" environmentIntensity={0.7} />
      <directionalLight position={[4, 6, 4]} intensity={2} castShadow />
      <pointLight position={[-4, 1, 3]} intensity={10} color={palette.accent} />
      <group ref={group} position={[0, -0.2, 0]}>
        {PARTS.map((part, i) => (
          <mesh key={i} castShadow receiveShadow>
            {part.geo === 'disc' && <cylinderGeometry args={[part.r, part.r, part.h, low ? 32 : 64]} />}
            {part.geo === 'cyl' && <cylinderGeometry args={[part.r, part.r * 0.92, part.h, low ? 32 : 64]} />}
            {part.geo === 'ring' && <torusGeometry args={[part.r * 0.8, part.h * 0.5, low ? 12 : 24, low ? 40 : 80]} />}
            <meshPhysicalMaterial color={i === 2 || i === 4 ? palette.accent : palette.fg} metalness={i === 2 || i === 4 ? 0.3 : 0.85} roughness={0.3} clearcoat={0.5} />
          </mesh>
        ))}
      </group>
      <ContactShadows position={[0, -1.6, 0]} opacity={0.5} scale={10} blur={2.2} far={4} color={palette.bg} />
    </>
  );
}
