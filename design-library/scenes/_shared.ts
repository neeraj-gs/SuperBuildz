/**
 * What every scene receives, and the helpers they share.
 *
 * The same components render in two places: the wizard's live preview (Vite,
 * inside Super Builds) and the generated site's hero (Next.js, via
 * SceneCanvas). So they import only three, @react-three/fiber and drei, take
 * their colours as props rather than reading a theme, and get scroll and
 * pointer as refs the host updates — no window listeners of their own.
 */

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';

export interface ScenePalette { bg: string; fg: string; accent: string; muted: string; surface: string }

export interface SceneProps {
  palette: ScenePalette;
  /** 0..1 page progress, written by the host. */
  progress: MutableRefObject<number>;
  /** Pointer in NDC (-1..1), written by the host. */
  pointer: MutableRefObject<[number, number]>;
  /** The business name, for scenes that build it. */
  name?: string;
  /** `preview` keeps counts low for a small canvas; `full` is the hero. */
  quality?: 'preview' | 'full';
  reduced?: boolean;
}

export const colorOf = (hex: string) => new THREE.Color(hex);

/** A smoothed copy of the pointer, so scenes never snap. */
export function useSmoothPointer(pointer: MutableRefObject<[number, number]>, ease = 0.06) {
  const smooth = useRef(new THREE.Vector2(0, 0));
  useFrame(() => {
    const [x, y] = pointer.current;
    smooth.current.x += (x - smooth.current.x) * ease;
    smooth.current.y += (y - smooth.current.y) * ease;
  });
  return smooth;
}

/** Deterministic pseudo-random, so a scene looks the same every load. */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function useRandoms(n: number, seed = 7) {
  return useMemo(() => { const r = rng(seed); return Array.from({ length: n }, () => r()); }, [n, seed]);
}

export const isLight = (hex: string) => {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b > 0.5;
};

/** Simple simplex-ish noise for shaders (GLSL string). */
export const GLSL_NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec2 mod289(vec2 x){return x-floor(x*(1.0/289.0))*289.0;}
vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}
float snoise(vec2 v){
  const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i=floor(v+dot(v,C.yy)); vec2 x0=v-i+dot(i,C.xx);
  vec2 i1; i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);
  vec4 x12=x0.xyxy+C.xxzz; x12.xy-=i1; i=mod289(i);
  vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
  vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0); m=m*m; m=m*m;
  vec3 x=2.0*fract(p*C.www)-1.0; vec3 h=abs(x)-0.5; vec3 ox=floor(x+0.5); vec3 a0=x-ox;
  m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
  vec3 g; g.x=a0.x*x0.x+h.x*x0.y; g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.0*dot(m,g);
}
float fbm(vec2 p){ float v=0.0; float a=0.5; for(int i=0;i<5;i++){ v+=a*snoise(p); p*=2.02; a*=0.5; } return v; }
`;
