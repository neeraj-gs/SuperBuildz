/**
 * No WebGL objects to speak of: a dark ground with a slow accent light sweep
 * and a faint grid, so the typography in the DOM is the scene. The light
 * follows the pointer; scroll dims it. The hero rule is cleared by the type,
 * which the host renders at viewport scale over this.
 */

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { useSmoothPointer, type SceneProps } from './_shared';

export function TypeScene({ palette, pointer, progress }: SceneProps) {
  const light = useRef<THREE.PointLight>(null);
  const p = useSmoothPointer(pointer, 0.05);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (light.current) {
      light.current.position.x = p.current.x * 4 + Math.sin(t * 0.3) * 0.6;
      light.current.position.y = p.current.y * 2.5 + Math.cos(t * 0.23) * 0.4;
      light.current.intensity = 26 * (1 - progress.current * 0.7);
    }
  });
  return (
    <>
      <color attach="background" args={[palette.bg]} />
      <ambientLight intensity={0.2} />
      <pointLight ref={light} position={[0, 0, 2.2]} color={palette.accent} distance={12} decay={2} />
      <mesh position={[0, 0, -1]}>
        <planeGeometry args={[40, 24, 1, 1]} />
        <meshStandardMaterial color={palette.surface} roughness={0.95} metalness={0} />
      </mesh>
      <gridHelper args={[40, 40, palette.muted, palette.surface]} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.95]} />
    </>
  );
}
