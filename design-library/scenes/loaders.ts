/**
 * One place that knows how to lazy-load a scene, shared by SceneLayer (the
 * page-wide canvas) and SceneCanvas (a single framed one). Adding a scene
 * means adding a line here and nowhere else.
 */

import type { ComponentType } from 'react';
import type { SceneProps } from '@/components/scenes/_shared';

type Loader = () => Promise<{ default: ComponentType<SceneProps> }>;

export const SCENE_LOADERS: Record<string, Loader> = {
  TypeScene: () => import('@/components/scenes/TypeScene').then((m) => ({ default: m.TypeScene })),
  FieldScene: () => import('@/components/scenes/FieldScene').then((m) => ({ default: m.FieldScene })),
  ReliefScene: () => import('@/components/scenes/ReliefScene').then((m) => ({ default: m.ReliefScene })),
  WordmarkScene: () => import('@/components/scenes/WordmarkScene').then((m) => ({ default: m.WordmarkScene })),
  ObjectScene: () => import('@/components/scenes/ObjectScene').then((m) => ({ default: m.ObjectScene })),
  LiquidScene: () => import('@/components/scenes/LiquidScene').then((m) => ({ default: m.LiquidScene })),
  DioramaScene: () => import('@/components/scenes/DioramaScene').then((m) => ({ default: m.DioramaScene })),
  ClothScene: () => import('@/components/scenes/ClothScene').then((m) => ({ default: m.ClothScene })),
  TerrainScene: () => import('@/components/scenes/TerrainScene').then((m) => ({ default: m.TerrainScene })),
  MorphScene: () => import('@/components/scenes/MorphScene').then((m) => ({ default: m.MorphScene })),
  GlassScene: () => import('@/components/scenes/GlassScene').then((m) => ({ default: m.GlassScene })),
  ExplodedScene: () => import('@/components/scenes/ExplodedScene').then((m) => ({ default: m.ExplodedScene })),
  RibbonsScene: () => import('@/components/scenes/RibbonsScene').then((m) => ({ default: m.RibbonsScene })),
};
