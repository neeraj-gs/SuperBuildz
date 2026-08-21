/**
 * Cloth in the wind: a plane driven in a vertex shader as a flag or drape,
 * catching light in its folds; the pointer is wind.
 */

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GLSL_NOISE, useSmoothPointer, type SceneProps } from './_shared';

const vert = `
${GLSL_NOISE}
uniform float uTime; uniform vec2 uWind; uniform float uProgress;
varying vec3 vN; varying vec3 vP; varying vec2 vUv;
float h(vec2 uv){
  float pin = uv.x; // fixed along the left edge, free on the right
  float w = snoise(vec2(uv.x*2.0 - uTime*1.1, uv.y*1.6 + uTime*0.4))*0.35
          + snoise(vec2(uv.x*5.0 - uTime*2.0, uv.y*4.0))*0.08;
  w += uWind.x*0.35*pin + sin(uv.y*3.0 + uTime*2.0)*uWind.y*0.15*pin;
  return w*pin*(1.0+uProgress*0.8);
}
void main(){
  vUv=uv; vec3 p=position; p.z += h(uv);
  float e=0.005;
  float hx=h(uv+vec2(e,0.0)); float hy=h(uv+vec2(0.0,e)); float h0=h(uv);
  vec3 n=normalize(vec3(-(hx-h0)/e*0.25,-(hy-h0)/e*0.25,1.0));
  vN=normalize(normalMatrix*n); vec4 wp=modelMatrix*vec4(p,1.0); vP=wp.xyz;
  gl_Position=projectionMatrix*viewMatrix*wp;
}`;
const frag = `
uniform vec3 uA; uniform vec3 uB; uniform vec3 uLight;
varying vec3 vN; varying vec3 vP; varying vec2 vUv;
void main(){
  vec3 L=normalize(uLight-vP); float d=max(dot(vN,L),0.0);
  vec3 V=normalize(cameraPosition-vP); vec3 H=normalize(L+V); float s=pow(max(dot(vN,H),0.0),60.0);
  // A printed stripe: the brand on the cloth.
  float stripe = smoothstep(0.46,0.47,vUv.y)-smoothstep(0.55,0.56,vUv.y);
  vec3 base = mix(uA, uB, stripe*0.9);
  vec3 col = base*(0.35+d*0.8) + vec3(s)*0.35;
  gl_FragColor=vec4(col,1.0);
}`;

export function ClothScene({ palette, pointer, progress, quality = 'full' }: SceneProps) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const p = useSmoothPointer(pointer, 0.06);
  const seg = quality === 'preview' ? 80 : 160;
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uWind: { value: new THREE.Vector2() }, uProgress: { value: 0 },
    uA: { value: new THREE.Color(palette.fg) }, uB: { value: new THREE.Color(palette.accent) }, uLight: { value: new THREE.Vector3(2, 3, 4) },
  }), [palette.fg, palette.accent]);
  useFrame(({ clock }) => {
    if (!mat.current) return;
    mat.current.uniforms.uTime.value = clock.getElapsedTime();
    mat.current.uniforms.uWind.value.set(p.current.x, p.current.y);
    mat.current.uniforms.uProgress.value = progress.current;
    mat.current.uniforms.uLight.value.set(2 + p.current.x * 2, 3 + p.current.y, 4);
  });
  return (
    <>
      <color attach="background" args={[palette.bg]} />
      <mesh position={[0.6, 0, 0]} rotation={[0, -0.25, 0.06]}>
        <planeGeometry args={[7.5, 4.6, seg, Math.round(seg * 0.6)]} />
        <shaderMaterial ref={mat} vertexShader={vert} fragmentShader={frag} uniforms={uniforms} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-3.2, 0, 0.05]}><cylinderGeometry args={[0.04, 0.04, 5.4, 12]} /><meshStandardMaterial color={palette.muted} metalness={0.8} roughness={0.3} /></mesh>
      <ambientLight intensity={0.4} />
    </>
  );
}
