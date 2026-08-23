/**
 * Three directions, side by side.
 *
 * The hardest moment in the whole flow is the one where somebody who has
 * never commissioned design is asked what they want it to look like. They
 * cannot answer, because describing a design is a skill and looking at one is
 * not. So we stop asking: after the identity stage, three complete visual
 * directions are proposed, rendered side by side in three frames scrolling
 * together, and the person points at one.
 *
 * A direction here is a named set of tokens — ground, ink, accent, type
 * scale, rhythm, radius, pace, grain — not a different site. That is a
 * deliberate limit: token-level directions can be proposed in one cheap,
 * bounded ask and previewed instantly from the site that already exists,
 * whereas building three whole sites would cost three builds and take an
 * hour. Palette, weight, density and pace are what most people mean by "a
 * different direction" anyway.
 *
 * They are written to the project's `directions.json`; the site applies one
 * for the length of a page view when `?direction=<id>` is present. Picking
 * one writes its values into `design.tweaks.json`, which is the same thing
 * the tune panel writes, so a direction is a starting point that stays
 * adjustable rather than a decision that has to be undone.
 */

import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Direction, Spec, Tweaks } from '@superbuilds/protocol';
import { askOnce } from './claude.ts';
import { getProject } from './projects.ts';
import { sanitise, setTweaks, designedValues } from './tweaks.ts';
import { PALETTES } from './catalogue/index.ts';

const FILE = 'directions.json';

export const DIRECTIONS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['directions'],
  properties: {
    directions: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'name', 'note', 'tweaks'],
        properties: {
          id: { type: 'string', pattern: '^[a-z][a-z0-9-]{1,20}$' },
          name: { type: 'string', maxLength: 24 },
          note: { type: 'string', maxLength: 90 },
          tweaks: {
            type: 'object',
            additionalProperties: false,
            required: ['bg', 'fg', 'accent', 'surface', 'muted', 'displayScale', 'section', 'radius', 'pace', 'grain'],
            properties: {
              bg: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
              fg: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
              accent: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
              surface: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
              muted: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
              displayScale: { type: 'number', minimum: 0.7, maximum: 1.5 },
              displayTracking: { type: 'number', minimum: -0.07, maximum: 0.02 },
              measure: { type: 'number', minimum: 45, maximum: 90 },
              section: { type: 'number', minimum: 0.6, maximum: 1.7 },
              radius: { type: 'number', minimum: 0, maximum: 28 },
              pace: { type: 'number', minimum: 0.5, maximum: 2 },
              rise: { type: 'number', minimum: 0, maximum: 64 },
              grain: { type: 'number', minimum: 0, maximum: 0.3 },
              sceneBrightness: { type: 'number', minimum: 0.4, maximum: 1.7 },
              sceneDim: { type: 'number', minimum: 0, maximum: 1 },
            },
          },
        },
      },
    },
  },
} as const;

export function directionsPrompt(spec: Spec): string {
  const palette = PALETTES.find((p) => p.id === spec.palette);
  return [
    `Propose three visual directions for "${spec.name}", a ${spec.archetype}${spec.sector ? ` (${spec.sector})` : ''}${spec.details?.location ? ` in ${spec.details.location}` : ''}.`,
    spec.details?.tagline ? `They describe themselves as: "${spec.details.tagline}".` : '',
    `The site was built with the "${spec.atmosphere}" atmosphere and the "${palette?.label ?? spec.palette}" palette${palette?.swatch ? ` (${palette.swatch.join(', ')})` : ''}. That is direction one's starting point, and the other two must be genuinely different from it and from each other — not three shades of the same idea.`,
    '',
    'Each direction is a set of tokens applied over the built site. Give each one a short lowercase id, a one-word name a person would remember, and a note of at most ninety characters describing its feeling in concrete terms ("near-black, marble, condensed" — not "modern and clean").',
    '',
    'Rules that make the result usable rather than merely different:',
    '- Ground and ink must be a real contrast pair: at least 7:1. One of the three may be a light ground if that suits the business.',
    '- The accent must be legible on the ground and must be an accent, not a second ground.',
    '- Vary more than colour. Change the display scale, the section rhythm, the radius, the pace and the grain, so the three feel like different studios rather than different filters.',
    '- Every direction has to suit this business. A funeral home does not get a neon direction to make the set look varied.',
    '',
    'Answer with the JSON schema only.',
  ].filter(Boolean).join('\n');
}

/** What was proposed last, if anything. */
export function readDirections(projectPath: string): Direction[] {
  const file = join(projectPath, FILE);
  if (!existsSync(file)) return [];
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    return Array.isArray(raw) ? (raw as Direction[]) : [];
  } catch { return []; }
}

export interface StoredDirection extends Direction { tweaks: Tweaks }

export async function proposeDirections(projectId: string): Promise<StoredDirection[]> {
  const project = getProject(projectId);
  if (!project) throw new Error('no such project');
  if (!project.spec) throw new Error('this project has no specification');

  const out = await askOnce<{ directions: Array<{ id: string; name: string; note: string; tweaks: Record<string, unknown> }> }>({
    cwd: project.path,
    prompt: directionsPrompt(project.spec),
    schema: DIRECTIONS_SCHEMA,
    model: 'sonnet',
    maxBudgetUsd: 0.6,
    allowedTools: [],
    timeoutMs: 150_000,
  });

  const designed = designedValues(project.path);
  const seen = new Set<string>();
  const directions: StoredDirection[] = (out.directions ?? [])
    .map((d, i) => {
      let id = String(d.id ?? `direction-${i + 1}`).toLowerCase().replace(/[^a-z0-9-]/g, '') || `direction-${i + 1}`;
      while (seen.has(id)) id = `${id}-${i}`;
      seen.add(id);
      const tweaks = { ...sanitise(d.tweaks) };
      return {
        id,
        name: String(d.name ?? id).slice(0, 24),
        note: String(d.note ?? '').slice(0, 90),
        path: `/?direction=${encodeURIComponent(id)}`,
        swatch: [tweaks.bg ?? designed.bg ?? '#000000', tweaks.fg ?? designed.fg ?? '#ffffff', tweaks.accent ?? designed.accent ?? '#888888'],
        tweaks,
      };
    })
    .slice(0, 3);

  if (!directions.length) throw new Error('No usable directions came back. Try again, or tune it by hand.');
  writeFileSync(join(project.path, FILE), `${JSON.stringify(directions, null, 2)}\n`, 'utf8');
  return directions;
}

/** Make one of them the site's actual look, by writing it into the tweaks. */
export function chooseDirection(projectId: string, id: string) {
  const project = getProject(projectId);
  if (!project) throw new Error('no such project');
  const found = readDirections(project.path).find((d) => d.id === id) as StoredDirection | undefined;
  if (!found) throw new Error('no such direction');
  return setTweaks(projectId, found.tweaks as Record<string, unknown>, true);
}
