/**
 * Particles that become things: a point cloud that morphs between target
 * shapes — here a ring, a cube shell, a sphere, and a letterform-like cross —
 * as the page scrolls, with chaos between. The build replaces the targets
 * with the logo, the product silhouette, a key word.
 */

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { rng, useSmoothPointer, type SceneProps } from './_shared';

function targets(count: number): Float32Array[] {
  const r = rng(5);
  const ring = new Float32Array(count * 3), cube = new Float32Array(count * 3), sphere = new Float32Array(count * 3), cross = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2, rad = 1.6 + (r() - 0.5) * 0.25;
    ring.set([Math.cos(a) * rad, Math.sin(a) * rad, (r() - 0.5) * 0.3], i * 3);
    const f = Math.floor(r() * 6), u = r() * 2 - 1, v = r() * 2 - 1, s = 1.25;
    const c = [[s, u * s, v * s], [-s, u * s, v * s], [u * s, s, v * s], [u * s, -s, v * s], [u * s, v * s, s], [u * s, v * s, -s]][f];
    cube.set(c, i * 3);
    const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1), R = 1.5;
    sphere.set([R * Math.sin(ph) * Math.cos(th), R * Math.sin(ph) * Math.sin(th), R * Math.cos(ph)], i * 3);
    const horiz = r() < 0.5;
    cross.set(horiz ? [(r() - 0.5) * 3.6, (r() - 0.5) * 0.5, (r() - 0.5) * 0.4] : [(r() - 0.5) * 0.5, (r() - 0.5) * 3.6, (r() - 0.5) * 0.4], i * 3);
  }
  return [ring, cube, sphere, cross];
}

export function MorphScene({ palette, pointer, progress, quality = 'full' }: SceneProps) {
  const count = quality === 'preview' ? 6000 : 18000;
  const ref = useRef<THREE.Points>(null);
  const p = useSmoothPointer(pointer, 0.06);
  const shapes = useMemo(() => targets(count), [count]);
  const positions = useMemo(() => new Float32Array(shapes[0]), [shapes]);
  const jitter = useMemo(() => { const r = rng(9); return Float32Array.from({ length: count * 3 }, () => (r() - 0.5)); }, [count]);
  const tex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c);
  }, []);

  useFrame(({ clock }) => {
    const pts = ref.current; if (!pts) return;
    const t = clock.getElapsedTime();
    // Which pair of shapes, and how far between them. Time advances slowly; scroll advances faster.
    const phase = (t * 0.08 + progress.current * 2.2) % shapes.length;
    const i0 = Math.floor(phase), i1 = (i0 + 1) % shapes.length;
    const f = phase - i0;
    const ease = f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2;
    const chaos = Math.sin(f * Math.PI) * 0.9;
    const A = shapes[i0], B = shapes[i1];
    const arr = (pts.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    const px = p.current.x * 2.2, py = p.current.y * 1.6;
    for (let i = 0; i < count * 3; i += 3) {
      let x = A[i] + (B[i] - A[i]) * ease + jitter[i] * chaos;
      let y = A[i + 1] + (B[i + 1] - A[i + 1]) * ease + jitter[i + 1] * chaos;
      const z = A[i + 2] + (B[i + 2] - A[i + 2]) * ease + jitter[i + 2] * chaos;
      const dx = x - px, dy = y - py; const d2 = dx * dx + dy * dy + 0.15;
      const push = 0.35 / d2; x += dx * push * 0.2; y += dy * push * 0.2;
      arr[i] = x; arr[i + 1] = y; arr[i + 2] = z;
    }
    (pts.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    pts.rotation.y = t * 0.12 + p.current.x * 0.3;
    pts.rotation.x = p.current.y * -0.15;
  });

  return (
    <>
      <color attach="background" args={[palette.bg]} />
      <points ref={ref}>
        <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
        <pointsMaterial size={quality === 'preview' ? 0.05 : 0.035} map={tex} color={palette.accent} transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
      </points>
    </>
  );
}
