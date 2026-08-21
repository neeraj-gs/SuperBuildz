/**
 * A field you move through: points receding into depth, drifting, parting
 * around the pointer, accelerating with scroll. Instanced points, additive.
 */

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { rng, useSmoothPointer, type SceneProps } from './_shared';

export function FieldScene({ palette, pointer, progress, quality = 'full' }: SceneProps) {
  const count = quality === 'preview' ? 2200 : 7000;
  const ref = useRef<THREE.Points>(null);
  const p = useSmoothPointer(pointer, 0.05);
  const depth = 40;

  const { positions, speeds } = useMemo(() => {
    const r = rng(11);
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (r() - 0.5) * 26;
      positions[i * 3 + 1] = (r() - 0.5) * 16;
      positions[i * 3 + 2] = -r() * depth;
      speeds[i] = 0.4 + r() * 1.2;
    }
    return { positions, speeds };
  }, [count]);

  const tex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d')!; const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.4, 'rgba(255,255,255,.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 32, 32);
    const t = new THREE.CanvasTexture(c); return t;
  }, []);

  useFrame((_, dt) => {
    const pts = ref.current; if (!pts) return;
    const pos = pts.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const speed = 2.2 + progress.current * 14;
    const px = p.current.x * 8, py = p.current.y * 5;
    for (let i = 0; i < count; i++) {
      let z = arr[i * 3 + 2] + dt * speed * speeds[i];
      if (z > 2) { z -= depth; }
      arr[i * 3 + 2] = z;
      // Part around the pointer near the camera.
      const x = arr[i * 3], y = arr[i * 3 + 1];
      const near = Math.max(0, 1 + z / 10);
      const dx = x - px, dy = y - py; const d2 = dx * dx + dy * dy + 0.5;
      const push = (near * 1.6) / d2;
      arr[i * 3] += dx * push * dt * 4;
      arr[i * 3 + 1] += dy * push * dt * 4;
      // Drift back toward their lane.
      arr[i * 3] += (-x * 0.02) * dt;
      arr[i * 3 + 1] += (-y * 0.02) * dt;
    }
    pos.needsUpdate = true;
    pts.rotation.z = p.current.x * 0.05;
  });

  return (
    <>
      <color attach="background" args={[palette.bg]} />
      <fog attach="fog" args={[palette.bg, 6, depth * 0.9]} />
      <points ref={ref}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={quality === 'preview' ? 0.22 : 0.16} map={tex} color={palette.accent} transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
    </>
  );
}
