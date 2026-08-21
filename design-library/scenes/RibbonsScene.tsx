/**
 * Ribbons that follow you: three glossy tubes along animated curves, weaving
 * in front of and behind the type, bending toward the pointer. Scroll changes
 * their tension.
 */

import { useFrame } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSmoothPointer, type SceneProps } from './_shared';

const N = 3;
const SEGS = 120;

export function RibbonsScene({ palette, pointer, progress, quality = 'full' }: SceneProps) {
  const meshes = useRef<THREE.Mesh[]>([]);
  const p = useSmoothPointer(pointer, 0.05);
  const radial = quality === 'preview' ? 6 : 10;
  const tubular = quality === 'preview' ? 90 : SEGS;
  const curves = useMemo(() => Array.from({ length: N }, () => new THREE.CatmullRomCurve3(Array.from({ length: 8 }, () => new THREE.Vector3()), false, 'catmullrom', 0.5)), []);
  const colors = [palette.accent, palette.fg, palette.muted];

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const tension = 1 + progress.current * 1.8;
    for (let k = 0; k < N; k++) {
      const curve = curves[k];
      for (let i = 0; i < curve.points.length; i++) {
        const u = i / (curve.points.length - 1);
        const x = (u - 0.5) * 9;
        const y = Math.sin(u * Math.PI * 2 * tension + t * (0.6 + k * 0.15) + k * 2) * (1.1 - k * 0.2) + (k - 1) * 0.5;
        const z = Math.cos(u * Math.PI * 1.5 + t * 0.4 + k) * 0.9 - 0.3;
        // Bend toward the pointer near its x.
        const dx = x - p.current.x * 4.5; const pull = Math.exp(-dx * dx * 0.25);
        curve.points[i].set(x, y + (p.current.y * 1.8 - y) * pull * 0.5, z + pull * 0.8);
      }
      const m = meshes.current[k]; if (!m) continue;
      const g = new THREE.TubeGeometry(curve, tubular, 0.16 - k * 0.03, radial, false);
      m.geometry.dispose(); m.geometry = g;
    }
  });

  return (
    <>
      <color attach="background" args={[palette.bg]} />
      <Environment preset="city" environmentIntensity={0.6} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[3, 5, 4]} intensity={2} />
      <pointLight position={[-3, -2, 3]} intensity={12} color={palette.accent} />
      {Array.from({ length: N }, (_, k) => (
        <mesh key={k} ref={(el) => { if (el) meshes.current[k] = el; }}>
          <tubeGeometry args={[curves[k], tubular, 0.16, radial, false]} />
          <meshPhysicalMaterial color={colors[k]} metalness={0.7} roughness={0.2} clearcoat={1} clearcoatRoughness={0.1} iridescence={k === 0 ? 0.6 : 0} iridescenceIOR={1.3} />
        </mesh>
      ))}
    </>
  );
}
