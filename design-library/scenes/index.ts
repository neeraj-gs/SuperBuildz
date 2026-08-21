/**
 * Every scene, by id. The wizard previews these; the scaffold copies this
 * folder into `components/scenes/` of every generated site, where
 * `SceneCanvas` renders the chosen one and the build adapts it.
 */

import type { ComponentType } from 'react';
import type { SceneProps } from './_shared';
import { TypeScene } from './TypeScene';
import { FieldScene } from './FieldScene';
import { ReliefScene } from './ReliefScene';
import { WordmarkScene } from './WordmarkScene';
import { ObjectScene } from './ObjectScene';
import { LiquidScene } from './LiquidScene';
import { DioramaScene } from './DioramaScene';
import { ClothScene } from './ClothScene';
import { TerrainScene } from './TerrainScene';
import { MorphScene } from './MorphScene';
import { GlassScene } from './GlassScene';
import { ExplodedScene } from './ExplodedScene';
import { RibbonsScene } from './RibbonsScene';

export type { SceneProps, ScenePalette } from './_shared';

export const SCENE_COMPONENTS: Record<string, ComponentType<SceneProps>> = {
  none: TypeScene,
  field: FieldScene,
  relief: ReliefScene,
  wordmark: WordmarkScene,
  object: ObjectScene,
  liquid: LiquidScene,
  diorama: DioramaScene,
  cloth: ClothScene,
  terrain: TerrainScene,
  morph: MorphScene,
  glass: GlassScene,
  exploded: ExplodedScene,
  ribbons: RibbonsScene,
};

export function sceneComponentFor(id: string): ComponentType<SceneProps> {
  return SCENE_COMPONENTS[id] ?? FieldScene;
}

export {
  TypeScene, FieldScene, ReliefScene, WordmarkScene, ObjectScene, LiquidScene, DioramaScene, ClothScene, TerrainScene,
  MorphScene, GlassScene, ExplodedScene, RibbonsScene,
};
