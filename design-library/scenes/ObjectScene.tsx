/**
 * One thing, turning. A studio-lit object the page orbits: here a placeholder
 * with honest proportions — a lathe-turned vessel — which the build replaces
 * with the real product (a GLB, or procedural geometry of the actual thing).
 * Key, rim, fill; a reflective floor; the rotation is tied to scroll.
 */

import { useFrame } from '@react-three/fiber';
import { Environment, ContactShadows, Lathe } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSmoothPointer, type SceneProps } from './_shared';

export function ObjectScene({ palette, pointer, progress, quality = 'full' }: SceneProps) {
  const group = useRef<THREE.Group>(null);
  const p = useSmoothPointer(pointer, 0.06);
  const points = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    const profile = [[0, -1.4], [0.55, -1.4], [0.75, -1.2], [0.85, -0.6], [0.7, 0.1], [0.45, 0.6], [0.4, 0.9], [0.55, 1.15], [0.5, 1.3], [0.3, 1.32], [0.28, 1.0], [0.38, 0.65], [0.6, 0.1], [0.72, -0.55], [0.62, -1.1], [0.45, -1.25], [0, -1.25]];
    for (const [x, y] of profile) pts.push(new THREE.Vector2(x, y));
    return pts;
  }, []);
  useFrame(({ clock }) => {
    const g = group.current; if (!g) return;
    const t = clock.getElapsedTime();
    g.rotation.y = t * 0.25 + progress.current * Math.PI * 1.5 + p.current.x * 0.4;
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, -p.current.y * 0.15 + 0.08, 0.05);
    g.position.y = Math.sin(t * 0.8) * 0.04;
  });
  return (
    <>
      <color attach="background" args={[palette.bg]} />
      <Environment preset="studio" environmentIntensity={0.6} />
      <spotLight position={[4, 6, 4]} intensity={40} angle={0.5} penumbra={1} color="#ffffff" castShadow />
      <spotLight position={[-5, 3, -3]} intensity={26} angle={0.6} penumbra={1} color={palette.accent} />
      <pointLight position={[0, -2, 4]} intensity={6} color={palette.fg} />
      <group ref={group}>
        <Lathe args={[points, quality === 'preview' ? 40 : 96]} castShadow>
          <meshPhysicalMaterial color={palette.fg} metalness={0.85} roughness={0.22} clearcoat={1} clearcoatRoughness={0.15} />
        </Lathe>
      </group>
      <ContactShadows position={[0, -1.45, 0]} opacity={0.55} scale={10} blur={2.4} far={3} color={palette.bg} />
    </>
  );
}
