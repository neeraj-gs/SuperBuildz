/**
 * The ground beneath it: a wireframe landscape the camera flies over as the
 * page scrolls, lit low from one side; a marker rises where the business is.
 */

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GLSL_NOISE, useSmoothPointer, type SceneProps } from './_shared';

const vert = `
${GLSL_NOISE}
uniform float uTime; uniform float uScroll;
varying float vH; varying vec2 vUv;
void main(){
  vUv=uv; vec3 p=position;
  vec2 q = uv*6.0 + vec2(0.0, uScroll*3.0);
  float h = fbm(q)*1.1 + snoise(q*3.0)*0.12;
  // Flatten a valley along the middle, where the road and the marker are.
  h *= smoothstep(0.0,0.25,abs(uv.x-0.5))*0.9+0.1;
  p.z += h; vH=h;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
}`;
const frag = `
uniform vec3 uLine; uniform vec3 uAccent; uniform vec3 uBg;
varying float vH; varying vec2 vUv;
void main(){
  float fade = smoothstep(1.0,0.55,vUv.y);
  // Contour lines from height.
  float c = abs(fract(vH*5.0)-0.5);
  float line = smoothstep(0.08,0.0,c)*0.5;
  vec3 col = mix(uLine, uAccent, smoothstep(0.3,1.2,vH));
  col = col*(0.35+line);
  gl_FragColor = vec4(mix(uBg,col,fade),1.0);
}`;

export function TerrainScene({ palette, pointer, progress, quality = 'full' }: SceneProps) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const group = useRef<THREE.Group>(null);
  const marker = useRef<THREE.Mesh>(null);
  const p = useSmoothPointer(pointer, 0.05);
  const seg = quality === 'preview' ? 90 : 180;
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uScroll: { value: 0 },
    uLine: { value: new THREE.Color(palette.muted) }, uAccent: { value: new THREE.Color(palette.accent) }, uBg: { value: new THREE.Color(palette.bg) },
  }), [palette.muted, palette.accent, palette.bg]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (mat.current) { mat.current.uniforms.uTime.value = t; mat.current.uniforms.uScroll.value = progress.current + t * 0.015; }
    if (group.current) { group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, p.current.x * 0.08, 0.05); group.current.rotation.x = -1.15 + p.current.y * 0.05; }
    if (marker.current) { marker.current.position.y = 0.9 + Math.sin(t * 2) * 0.08; marker.current.rotation.y = t; }
  });
  return (
    <>
      <color attach="background" args={[palette.bg]} />
      <fog attach="fog" args={[palette.bg, 4, 13]} />
      <group ref={group} position={[0, -1.6, -2]}>
        <mesh>
          <planeGeometry args={[18, 18, seg, seg]} />
          <shaderMaterial ref={mat} vertexShader={vert} fragmentShader={frag} uniforms={uniforms} wireframe />
        </mesh>
      </group>
      <mesh ref={marker} position={[0, 0.9, -1]}>
        <octahedronGeometry args={[0.22, 0]} />
        <meshStandardMaterial color={palette.accent} emissive={palette.accent} emissiveIntensity={0.8} />
      </mesh>
      <mesh position={[0, 0.4, -1]}><cylinderGeometry args={[0.01, 0.01, 1.0, 6]} /><meshBasicMaterial color={palette.accent} /></mesh>
      <ambientLight intensity={0.6} />
    </>
  );
}
