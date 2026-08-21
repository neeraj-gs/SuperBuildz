/**
 * Light through glass: a few thick refractive shards drifting over a lit
 * ground, bending what is behind them. The type the host renders behind this
 * canvas (or the surface here) is the content; the glass is the experience.
 */

import { useFrame } from '@react-three/fiber';
import { Environment, MeshTransmissionMaterial } from '@react-three/drei';
import { useRef } from 'react';
import * as THREE from 'three';
import { useSmoothPointer, type SceneProps } from './_shared';

const SHARDS = [
  { pos: [-1.6, 0.4, 0.6], rot: [0.3, 0.4, 0.2], scale: 1.2, geo: 'prism' },
  { pos: [1.4, -0.3, 0.2], rot: [-0.2, 0.8, 0.5], scale: 1.0, geo: 'lens' },
  { pos: [0.2, 1.1, -0.2], rot: [0.6, -0.3, 0.1], scale: 0.8, geo: 'prism' },
] as const;

export function GlassScene({ palette, pointer, progress, quality = 'full' }: SceneProps) {
  const group = useRef<THREE.Group>(null);
  const p = useSmoothPointer(pointer, 0.05);
  const low = quality === 'preview';
  useFrame(({ clock }) => {
    const g = group.current; if (!g) return;
    const t = clock.getElapsedTime();
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, p.current.x * 0.35, 0.05);
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, -p.current.y * 0.2, 0.05);
    g.children.forEach((c, i) => {
      c.position.y = SHARDS[i].pos[1] + Math.sin(t * 0.5 + i * 1.7) * 0.12 - progress.current * 0.8 * (i + 1) * 0.3;
      c.rotation.z = SHARDS[i].rot[2] + t * 0.08 * (i % 2 ? 1 : -1);
    });
  });
  return (
    <>
      <color attach="background" args={[palette.bg]} />
      <Environment preset="city" environmentIntensity={0.5} />
      <ambientLight intensity={0.3} />
      <spotLight position={[3, 5, 5]} intensity={30} angle={0.6} penumbra={1} color="#ffffff" />
      <pointLight position={[-4, -2, 3]} intensity={16} color={palette.accent} />
      {/* The ground: a plane with a big ring of accent, to have something to refract. */}
      <mesh position={[0, 0, -1.4]}>
        <planeGeometry args={[14, 9]} />
        <meshStandardMaterial color={palette.surface} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0, -1.35]}><ringGeometry args={[1.3, 1.7, 64]} /><meshBasicMaterial color={palette.accent} /></mesh>
      <mesh position={[0, 0, -1.35]}><planeGeometry args={[6, 0.12]} /><meshBasicMaterial color={palette.fg} /></mesh>
      <group ref={group}>
        {SHARDS.map((s, i) => (
          <mesh key={i} position={s.pos as unknown as THREE.Vector3} rotation={s.rot as unknown as THREE.Euler} scale={s.scale}>
            {s.geo === 'prism' ? <cylinderGeometry args={[0.6, 0.6, 1.6, 3]} /> : <sphereGeometry args={[0.7, low ? 24 : 48, low ? 24 : 48]} />}
            <MeshTransmissionMaterial thickness={0.8} roughness={0.08} transmission={1} ior={1.45} chromaticAberration={low ? 0.02 : 0.05} anisotropy={0.1} distortion={0.1} distortionScale={0.3} temporalDistortion={0.05} samples={low ? 4 : 8} resolution={low ? 256 : 512} color="#ffffff" />
          </mesh>
        ))}
      </group>
    </>
  );
}
