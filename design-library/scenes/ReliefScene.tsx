/**
 * A surface with something pressed into it. One plane, displaced by noise and
 * a pressed mark, read entirely through shadow from one light the pointer
 * moves. Works on a light ground, which is rare in 3D.
 */

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GLSL_NOISE, useSmoothPointer, type SceneProps } from './_shared';

const vert = `
${GLSL_NOISE}
uniform float uTime; uniform float uPress;
varying vec3 vNormalW; varying vec3 vPosW; varying vec2 vUv;
float height(vec2 uv){
  float n = fbm(uv*3.0 + uTime*0.03)*0.08;
  // A pressed mark: a soft ring, like a monogram stamped into plaster.
  vec2 c = uv-0.5; float r = length(c*vec2(1.2,1.0));
  float ring = smoothstep(0.30,0.27,r) - smoothstep(0.22,0.19,r);
  float bar = smoothstep(0.02,0.0,abs(c.x)) * smoothstep(0.22,0.18,abs(c.y));
  return n - (ring+bar)*0.09*uPress;
}
void main(){
  vUv = uv;
  vec3 p = position;
  float h = height(uv);
  p.z += h;
  // Normal from neighbours.
  float e = 0.004;
  float hx = height(uv+vec2(e,0.0)); float hy = height(uv+vec2(0.0,e));
  vec3 n = normalize(vec3(-(hx-h)/e*0.08, -(hy-h)/e*0.08, 1.0));
  vNormalW = normalize(normalMatrix * n);
  vec4 wp = modelMatrix * vec4(p,1.0); vPosW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const frag = `
uniform vec3 uColor; uniform vec3 uAccent; uniform vec3 uLight;
varying vec3 vNormalW; varying vec3 vPosW; varying vec2 vUv;
void main(){
  vec3 L = normalize(uLight - vPosW);
  float diff = max(dot(vNormalW, L), 0.0);
  vec3 V = normalize(cameraPosition - vPosW);
  vec3 H = normalize(L+V);
  float spec = pow(max(dot(vNormalW,H),0.0), 40.0)*0.25;
  float amb = 0.42;
  vec3 col = uColor * (amb + diff*0.75) + uAccent*spec*0.6;
  // Vignette so the edges fall away.
  float v = smoothstep(0.95, 0.35, length(vUv-0.5)*1.3);
  col = mix(uColor*0.55, col, v);
  gl_FragColor = vec4(col, 1.0);
}`;

export function ReliefScene({ palette, pointer, progress, quality = 'full' }: SceneProps) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const p = useSmoothPointer(pointer, 0.08);
  const seg = quality === 'preview' ? 140 : 260;
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uPress: { value: 1 },
    uColor: { value: new THREE.Color(palette.surface) }, uAccent: { value: new THREE.Color(palette.accent) },
    uLight: { value: new THREE.Vector3(2, 2, 2) },
  }), [palette.surface, palette.accent]);
  useFrame(({ clock }) => {
    if (!mat.current) return;
    mat.current.uniforms.uTime.value = clock.getElapsedTime();
    mat.current.uniforms.uLight.value.set(p.current.x * 5, p.current.y * 3.5 + 0.5, 1.6 + progress.current * 2);
    mat.current.uniforms.uPress.value = 1 - progress.current * 0.6;
  });
  return (
    <>
      <color attach="background" args={[palette.bg]} />
      <mesh rotation={[-0.12, 0, 0]}>
        <planeGeometry args={[10, 6.2, seg, Math.round(seg * 0.62)]} />
        <shaderMaterial ref={mat} vertexShader={vert} fragmentShader={frag} uniforms={uniforms} />
      </mesh>
    </>
  );
}
