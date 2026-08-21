/**
 * The name, as an object: extruded, bevelled, lit from one side, settling
 * as though it has weight. Geometry from a font shipped with three, so
 * nothing loads at runtime.
 */

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import fontData from 'three/examples/fonts/helvetiker_bold.typeface.json';
import { useSmoothPointer, type SceneProps } from './_shared';

export function WordmarkScene({ palette, pointer, progress, name = 'STUDIO', quality = 'full' }: SceneProps) {
  const group = useRef<THREE.Group>(null);
  const p = useSmoothPointer(pointer, 0.06);
  const text = (name || 'STUDIO').trim().toUpperCase().slice(0, 14);

  const geometry = useMemo(() => {
    const font = new FontLoader().parse(fontData as unknown as Parameters<FontLoader['parse']>[0]);
    const size = Math.min(1.0, 5.6 / Math.max(4, text.length));
    const g = new TextGeometry(text, { font, size, depth: size * 0.45, curveSegments: quality === 'preview' ? 6 : 10, bevelEnabled: true, bevelThickness: size * 0.05, bevelSize: size * 0.03, bevelSegments: quality === 'preview' ? 2 : 4 });
    g.center();
    return g;
  }, [text, quality]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const g = group.current; if (!g) return;
    const settle = Math.exp(-t * 0.8);
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, p.current.x * 0.45 + Math.sin(t * 0.35) * 0.08, 0.05);
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, -p.current.y * 0.25 + Math.sin(t * 0.5) * 0.03 + settle * 0.6, 0.05);
    g.position.y = Math.sin(t * 0.7) * 0.06 + settle * 0.8 - progress.current * 1.6;
    g.position.z = -progress.current * 2.5;
  });

  return (
    <>
      <color attach="background" args={[palette.bg]} />
      <ambientLight intensity={0.25} />
      <directionalLight position={[4, 5, 5]} intensity={2.4} color="#ffffff" castShadow />
      <directionalLight position={[-5, -2, 2]} intensity={0.9} color={palette.accent} />
      <spotLight position={[0, -4, 4]} intensity={8} angle={0.8} penumbra={1} color={palette.accent} />
      <group ref={group}>
        <mesh geometry={geometry} castShadow receiveShadow>
          <meshPhysicalMaterial color={palette.fg} metalness={0.75} roughness={0.28} clearcoat={0.6} clearcoatRoughness={0.3} envMapIntensity={1} />
        </mesh>
      </group>
      <mesh position={[0, -1.9, -0.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <shadowMaterial opacity={0.35} />
      </mesh>
    </>
  );
}
