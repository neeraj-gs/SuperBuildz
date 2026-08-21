/**
 * Something that flows: a fragment-shader surface — ink in water, liquid
 * metal — that never repeats, never sits still, and is disturbed locally by
 * the pointer. Two palette colours only.
 */

import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GLSL_NOISE, useSmoothPointer, type SceneProps } from './_shared';

const frag = `
${GLSL_NOISE}
uniform float uTime; uniform vec2 uPointer; uniform float uProgress; uniform vec3 uA; uniform vec3 uB; uniform vec2 uRes;
varying vec2 vUv;
void main(){
  vec2 uv = vUv; vec2 p = (uv-0.5)*vec2(uRes.x/uRes.y,1.0);
  float t = uTime*0.12;
  // Domain warping: flow without repetition.
  vec2 q = vec2(fbm(p*1.6 + t), fbm(p*1.6 + vec2(5.2,1.3) - t*0.7));
  vec2 r = vec2(fbm(p*1.6 + 2.5*q + vec2(1.7,9.2) + t*0.4), fbm(p*1.6 + 2.5*q + vec2(8.3,2.8) - t*0.3));
  float f = fbm(p*1.6 + 2.2*r);
  // The pointer pushes the field locally.
  vec2 d = p - uPointer*vec2(uRes.x/uRes.y,1.0)*0.5;
  float ripple = exp(-dot(d,d)*6.0) * sin(length(d)*22.0 - uTime*5.0)*0.25;
  f += ripple;
  float m = smoothstep(-0.35, 0.55, f + uProgress*0.25);
  vec3 col = mix(uA, uB, m);
  // A specular-ish sheen along the contours, like liquid catching light.
  float sheen = pow(1.0-abs(fract(f*3.0)-0.5)*2.0, 8.0)*0.35;
  col += uB*sheen*(1.0-m);
  gl_FragColor = vec4(col,1.0);
}`;
const vert = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;

export function LiquidScene({ palette, pointer, progress }: SceneProps) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const p = useSmoothPointer(pointer, 0.1);
  const { size, viewport } = useThree();
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uPointer: { value: new THREE.Vector2() }, uProgress: { value: 0 },
    uA: { value: new THREE.Color(palette.bg) }, uB: { value: new THREE.Color(palette.accent) }, uRes: { value: new THREE.Vector2(1, 1) },
  }), [palette.bg, palette.accent]);
  useFrame(({ clock }) => {
    if (!mat.current) return;
    mat.current.uniforms.uTime.value = clock.getElapsedTime();
    mat.current.uniforms.uPointer.value.set(p.current.x, p.current.y);
    mat.current.uniforms.uProgress.value = progress.current;
    mat.current.uniforms.uRes.value.set(size.width, size.height);
  });
  return (
    <mesh>
      <planeGeometry args={[viewport.width, viewport.height]} />
      <shaderMaterial ref={mat} vertexShader={vert} fragmentShader={frag} uniforms={uniforms} />
    </mesh>
  );
}
