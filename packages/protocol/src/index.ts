/**
 * The contract between the daemon and the interface.
 *
 * This file is the only seam. The UI imports nothing from `daemon/src` — it
 * compiles in development and breaks the browser build the moment `node:fs`
 * comes along — and the daemon imports nothing from `ui/src`. Prefer adding an
 * optional field over changing a signature: the dependent count is always
 * larger than it looks.
 */

/* ---------------------------------------------------------------------------
   Claude Code
--------------------------------------------------------------------------- */

export type PermissionMode = 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions';
export type Effort = 'low' | 'medium' | 'high' | 'xhigh';

export interface RateLimitInfo {
  status?: string;
  resetsAt?: number;
  rateLimitType?: string;
  utilization?: number;
  [k: string]: unknown;
}

/* ---------------------------------------------------------------------------
   Requirements
--------------------------------------------------------------------------- */

export interface DetectionCheck {
  /** Matches an install recipe id where one exists. */
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  /** Why a person should care, in one line. */
  why: string;
  /** Not a prerequisite for Super Builds, only for a feature. Reported, never counted. */
  optional?: boolean;
  /** What the optional thing unlocks. */
  unlocks?: string;
  fixLabel?: string;
  fixUrl?: string;
  /** The daemon can run the fix itself: `auth` opens `claude auth login`, otherwise an install id. */
  fixAction?: 'auth' | 'install';
}

export interface Detection {
  ok: boolean;
  checks: DetectionCheck[];
  claudeVersion?: string;
  claudeBin?: string;
  checkedAt: number;
  account?: { email?: string; plan?: string };
  platform: 'windows' | 'mac' | 'linux';
}

export interface InstallStep { text?: string; command?: string }

export interface InstallRecipeView {
  id: string;
  label: string;
  why: string;
  docs?: string;
  steps: Record<'windows' | 'mac' | 'linux', InstallStep[]>;
  /** What this machine would run. Read-only for the browser. */
  run: string[];
  attended?: boolean;
}

/* ---------------------------------------------------------------------------
   The catalogue: everything a person can choose
--------------------------------------------------------------------------- */

export interface Choice {
  id: string;
  label: string;
  /** One line under the label. Says what picking this actually means. */
  blurb?: string;
  /** A glyph, where a glyph reads faster than a word. */
  icon?: string;
  /** Colours, for choices that are about colour: [background, foreground, accent, ...]. */
  swatch?: string[];
  /** Said plainly when an option costs money, needs an account, or phones out. */
  caveat?: string;
  /** Environment variable names this choice needs filled in. Never values. */
  needs?: string[];
  /** Which archetypes it flatters. Empty or absent means any. */
  suits?: string[];
  /** How heavy it is on a phone. */
  weight?: 'light' | 'medium' | 'heavy';
  /** Which live preview the UI renders for it. */
  preview?: string;
  /** Free-text tags the UI can search. */
  tags?: string[];
}

export interface Archetype extends Choice {
  audience: string;
  sectors: Choice[];
  defaults: {
    goal: string;
    pages: string[];
    features: string[];
    palette: string;
    typography: string;
    atmosphere: string;
    layout: string;
    scene: string;
  };
}

export interface Catalogue {
  archetypes: Archetype[];
  goals: Choice[];
  pages: Choice[];
  features: Choice[];
  palettes: Choice[];
  typography: Choice[];
  atmospheres: Choice[];
  layouts: Choice[];
  scenes: Choice[];
  motionIntensity: Choice[];
  scrollStyles: Choice[];
  hoverStyles: Choice[];
  cursorStyles: Choice[];
  transitions: Choice[];
  themes: Choice[];
  analytics: Choice[];
  crm: Choice[];
  deploy: Choice[];

  /** The four questions that decide whether a site is memorable, as choices. */
  signatures: Choice[];
  rhythms: Choice[];
  imageryKinds: Choice[];
  imageryDevices: Choice[];
  /** Keyed by goal: what a visitor must believe by the end. */
  beliefs: Record<string, Choice[]>;
}

/** What was extracted from a reference website. */
export interface DesignDNA {
  summary: string;
  palette: string[];
  typography: { display: string; body: string; scale: string };
  layout: string;
  motion: string;
  threeD: string;
  hero: string;
  keep: string[];
  avoid: string[];
}

export interface ReferenceCapture {
  id: string;
  url: string;
  status: 'capturing' | 'analysing' | 'done' | 'failed';
  /** Served paths, e.g. /captures/<id>/shot-0.png */
  shots: string[];
  video?: string;
  dna?: DesignDNA;
  error?: string;
  at: number;
}

/** Facts about the business the person chose to give. All optional. */
export interface BusinessDetails {
  tagline?: string;
  location?: string;
  phone?: string;
  email?: string;
  hours?: string;
  founded?: string;
  instagram?: string;
  website?: string;
  /** Short lines chosen from suggestions or typed: what they are known for. */
  knownFor?: string[];
  /** Services or products, as short labels. */
  offerings?: string[];
}

/** Everything the person chose. The whole input to the compiler. */
export interface Spec {
  kind: 'website';
  name: string;
  folder: string;

  archetype: string;
  sector?: string;
  goal: string;
  pages: string[];
  features: string[];
  details: BusinessDetails;

  palette: string;
  typography: string;
  atmosphere: string;
  layout: string;
  scene: string;
  motionIntensity: string;
  scrollStyle: string;
  hoverStyle: string;
  cursorStyle: string;
  transition: string;
  theme: string;

  analytics: string[];
  crm: string;
  deploy: string;

  references: string[];
  dna?: DesignDNA[];
  assets: string[];
  notes?: string;

  /**
   * What imagery exists. Everything a site shows has to come from somewhere,
   * and the honest answer is usually "nothing yet" — which is a design brief,
   * not an excuse for a grid of empty rounded rectangles.
   */
  imagery?: Imagery;
  /**
   * The one thing this site does that the person has not seen another site do.
   * It becomes the signature move: one memorable interaction, named in the
   * README, that nothing else on the site competes with.
   */
  signature?: string;
  /** What a visitor must believe by the end. One sentence, not a feature list. */
  belief?: string;
  /** Where the page should feel calm and where it should feel intense. */
  rhythm?: string;
  /**
   * Build three complete visual directions after the identity stage and let
   * the person pick one before the rest is built. You cannot describe a
   * design; you can point at one.
   */
  directions?: boolean;

  /** Run the award-jury review stage after building. */
  review: boolean;
  /** Dollar ceiling passed to Claude Code, when the person set one. */
  budgetUsd?: number;
}

/** Where the pictures come from — or what to do instead. */
export interface Imagery {
  kind: 'have' | 'some' | 'none';
  /** A folder on this machine whose contents are copied into `public/media`. */
  folder?: string;
  /** What the photographs are of, in the person's words. */
  describes?: string;
  /** Design devices to use where a photograph would have gone. */
  instead: string[];
}

/**
 * The live tweak panel.
 *
 * Everything a person can change by dragging rather than describing. The
 * values land in the project's `design.tweaks.json`, which `lib/tokens.ts`
 * merges over `design.config.ts` — so a slider and an edit by the build never
 * fight over the same file, and clearing the object is a complete undo.
 */
export interface Tweaks {
  bg?: string; fg?: string; accent?: string; surface?: string; muted?: string;
  displayScale?: number; displayTracking?: number; bodyScale?: number; measure?: number;
  radius?: number; section?: number; gutter?: number;
  pace?: number; rise?: number; stagger?: number;
  grain?: number; sceneDim?: number; sceneBrightness?: number;
}

export type TweakKind = 'colour' | 'range';

/** One control in the panel. The daemon owns this list so the UI cannot drift. */
export interface TweakControl {
  key: keyof Tweaks;
  label: string;
  group: string;
  kind: TweakKind;
  /** ranges only */
  min?: number; max?: number; step?: number;
  /** How to render the current value beside the slider. */
  unit?: string;
  /** What it is for, in one line, for the person who has never seen a design system. */
  hint?: string;
}

/** A named set of tweaks, so one press can change the whole feel. */
export interface TweakPreset { id: string; label: string; blurb: string; values: Tweaks }

export interface TweakState {
  projectId: string;
  /** What is set right now. Absent keys use the designed value. */
  values: Tweaks;
  /** The designed values, so the panel can show what "back to normal" is. */
  designed: Tweaks;
  controls: TweakControl[];
  presets: TweakPreset[];
}

/** One of the visual directions built for the person to choose between. */
export interface Direction {
  id: string;
  name: string;
  /** The one-line design DNA, shown above the column. */
  note: string;
  /** Route the preview serves this direction from. */
  path: string;
  swatch?: string[];
}

/** What the builder will do, shown before it does any of it. */
export interface Plan {
  brief: string;
  stages: Array<{ id: string; label: string; blurb: string }>;
  secrets: Array<{ key: string; label: string; where: string }>;
  files: string[];
  caveats: string[];
  estimate: { lowUsd: number; highUsd: number; minutes: [number, number]; caveat: string };
}

/* ---------------------------------------------------------------------------
   Projects, sessions, turns
--------------------------------------------------------------------------- */

export type ProjectStatus = 'draft' | 'scaffolding' | 'generating' | 'ready' | 'failed';

export interface Project {
  id: string;
  name: string;
  slug: string;
  path: string;
  createdAt: number;
  updatedAt: number;
  status: ProjectStatus;
  spec?: Spec;
  /** Served path of the latest thumbnail. */
  thumbnail?: string;
  deploy?: { url: string; at: number; target: string };
  sessionId?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: unknown;
  result?: string;
  isError?: boolean;
  at: number;
}

export interface Turn {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  at: number;
  /** The stage this turn belongs to, when generation drove it. */
  stage?: string;
  tools?: ToolCall[];
  /** Next-step chips Claude offered. */
  options?: string[];
  /** The checkpoint taken before this turn ran, so it can be undone. */
  checkpointId?: string;
  costUsd?: number;
  durationMs?: number;
  error?: string;
  /** Still streaming. */
  partial?: boolean;
}

export type SessionStatus = 'idle' | 'running' | 'error';

export interface Session {
  id: string;
  projectId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  status: SessionStatus;
  claudeSessionId?: string;
  model?: string;
  turns: Turn[];
  costUsd: number;
  /** Context window used, as reported by the last result. */
  contextUsed?: number;
  contextLimit?: number;
}

export interface Checkpoint {
  id: string;
  sessionId: string;
  turnId: string;
  at: number;
  fileCount: number;
  label: string;
}

/* ---------------------------------------------------------------------------
   Generation, preview, deploy
--------------------------------------------------------------------------- */

export type StageStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

export interface GenerationState {
  projectId: string;
  running: boolean;
  stages: Array<{ id: string; label: string; status: StageStatus; startedAt?: number; endedAt?: number; note?: string }>;
  /** The scaffold/install log. Claude's own output lives on the session. */
  log: string;
  error?: string;
  startedAt?: number;
  endedAt?: number;
  costUsd: number;
}

export interface PreviewState {
  projectId: string;
  running: boolean;
  url?: string;
  port?: number;
  log: string;
  exitCode?: number;
  error?: string;
  startedAt?: number;
}

export interface DeployState {
  projectId: string;
  /** Whether the Vercel CLI is installed. */
  cli: boolean;
  /** Whether `vercel whoami` answered with an account. */
  connected: boolean;
  account?: string;
  running: boolean;
  log: string;
  url?: string;
  error?: string;
  /** Keys in .env.local that will be pushed. Names only. */
  envKeys: string[];
}

/* ---------------------------------------------------------------------------
   Events the daemon pushes over the socket
--------------------------------------------------------------------------- */

export type ServerEvent =
  | { type: 'hello'; token: string }
  | { type: 'detection'; detection: Detection }
  | { type: 'project.upsert'; project: Project }
  | { type: 'project.remove'; projectId: string }
  | { type: 'session.upsert'; session: Session }
  | { type: 'session.delta'; sessionId: string; turnId: string; text: string }
  | { type: 'session.thinking'; sessionId: string; turnId: string; text: string }
  | { type: 'session.tool'; sessionId: string; turnId: string; tool: ToolCall }
  | { type: 'session.turn'; sessionId: string; turn: Turn }
  | { type: 'generation.update'; state: GenerationState }
  | { type: 'preview.update'; state: PreviewState }
  | { type: 'deploy.update'; state: DeployState }
  | { type: 'reference.update'; capture: ReferenceCapture }
  | { type: 'tweaks.update'; state: TweakState }
  | { type: 'install.update'; message: string };

/* ---------------------------------------------------------------------------
   Small helpers both sides use
--------------------------------------------------------------------------- */

/** A folder-safe name from a business name. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'site';
}

/** Options Claude was asked to append, pulled out of its reply. */
export const OPTIONS_FENCE = 'sb-options';

export function splitOptions(text: string): { text: string; options: string[] } {
  const rx = new RegExp('```' + OPTIONS_FENCE + '\\s*([\\s\\S]*?)```\\s*$', 'm');
  const m = text.match(rx);
  if (!m) return { text: text.trimEnd(), options: [] };
  let options: string[] = [];
  try {
    const parsed = JSON.parse(m[1].trim());
    if (Array.isArray(parsed)) {
      options = parsed.map((o) => (typeof o === 'string' ? o : String((o as { label?: string })?.label ?? ''))).filter(Boolean).slice(0, 6);
    }
  } catch {
    // Lines, then. A model that wrote a list rather than JSON still meant options.
    options = m[1].split('\n').map((l) => l.replace(/^[-*\d.)\s"']+|["']+$/g, '').trim()).filter(Boolean).slice(0, 6);
  }
  return { text: text.replace(rx, '').trimEnd(), options };
}
