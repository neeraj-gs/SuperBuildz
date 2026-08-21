/**
 * A small world: a low-poly isometric room — floor, two walls, a counter, a
 * few props — that rotates slightly to the pointer and reveals as the page
 * scrolls. Stylised on purpose; the build replaces the props with the actual
 * place.
 */

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { useSmoothPointer, useRandoms, type SceneProps } from './_shared';

function Box({ pos, size, color, rot = 0 }: { pos: [number, number, number]; size: [number, number, number]; color: string; rot?: number }) {
  return (
    <mesh position={pos} rotation={[0, rot, 0]} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.85} metalness={0.05} />
    </mesh>
  );
}

export function DioramaScene({ palette, pointer, progress }: SceneProps) {
  const group = useRef<THREE.Group>(null);
  const p = useSmoothPointer(pointer, 0.05);
  const rs = useRandoms(12, 3);
  useFrame(({ clock }) => {
    const g = group.current; if (!g) return;
    const t = clock.getElapsedTime();
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, -Math.PI / 4 + p.current.x * 0.35 + progress.current * 0.9, 0.05);
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, 0.0 + -p.current.y * 0.12, 0.05);
    g.position.y = -1.1 + Math.sin(t * 0.6) * 0.02 - progress.current * 0.5;
    g.scale.setScalar(0.72 + progress.current * 0.25);
  });
  const wall = palette.surface, floor = palette.muted, prop = palette.fg, accent = palette.accent;
  return (
    <>
      <color attach="background" args={[palette.bg]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 8, 4]} intensity={2.2} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-2, 2, 2]} intensity={6} color={accent} />
      <group ref={group}>
        {/* floor and walls */}
        <Box pos={[0, -0.1, 0]} size={[4.2, 0.2, 4.2]} color={floor} />
        <Box pos={[0, 1.2, -2.0]} size={[4.2, 2.6, 0.2]} color={wall} />
        <Box pos={[-2.0, 1.2, 0]} size={[0.2, 2.6, 4.2]} color={wall} />
        {/* a window */}
        <Box pos={[0.6, 1.5, -1.88]} size={[1.2, 1.0, 0.05]} color={accent} />
        {/* counter */}
        <Box pos={[0.4, 0.45, 0.4]} size={[2.2, 0.9, 0.7]} color={prop} />
        <Box pos={[0.4, 0.93, 0.4]} size={[2.3, 0.06, 0.8]} color={accent} />
        {/* tables and stools */}
        {[[-1.2, -1.1], [1.3, -1.2], [-1.1, 1.3]].map(([x, z], i) => (
          <group key={i}>
            <Box pos={[x, 0.5, z]} size={[0.55, 0.06, 0.55]} color={prop} rot={rs[i] * 0.5} />
            <Box pos={[x, 0.25, z]} size={[0.08, 0.5, 0.08]} color={prop} />
            <Box pos={[x + 0.45, 0.18, z]} size={[0.22, 0.36, 0.22]} color={floor} />
            <Box pos={[x - 0.45, 0.18, z]} size={[0.22, 0.36, 0.22]} color={floor} />
          </group>
        ))}
        {/* shelves with things */}
        {[0.9, 1.5, 2.1].map((y, i) => <Box key={i} pos={[-1.85, y, 0.6]} size={[0.12, 0.04, 1.6]} color={prop} />)}
        {rs.slice(0, 9).map((r, i) => <Box key={i} pos={[-1.82, 0.95 + Math.floor(i / 3) * 0.6, 0.0 + (i % 3) * 0.55]} size={[0.1, 0.12 + r * 0.16, 0.16]} color={i % 4 === 0 ? accent : floor} />)}
        {/* a hanging lamp */}
        <Box pos={[0.4, 2.2, 0.4]} size={[0.02, 0.9, 0.02]} color={prop} />
        <mesh position={[0.4, 1.72, 0.4]}><coneGeometry args={[0.22, 0.25, 16, 1, true]} /><meshStandardMaterial color={accent} side={THREE.DoubleSide} emissive={accent} emissiveIntensity={0.4} /></mesh>
      </group>
    </>
  );
}
