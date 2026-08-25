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
  /**
   * The nearest catalogue entry for each choice the wizard is about to ask.
   *
   * Prose about a reference site is interesting and unusable: it cannot
   * pre-select anything. Asking the same bounded turn that reads the
   * screenshots to also name the closest option costs nothing extra and turns
   * "here is what I saw" into "here is your site, already answered" — which
   * the person then disagrees with, piece by piece, which is the whole design
   * of this product.
   */
  suggests?: DnaSuggestion;
  /** The site's own colours, sampled, offered as a custom palette. */
  customPalette?: CustomPalette;
}

/** Catalogue ids the extraction thinks this reference is closest to. */
export interface DnaSuggestion {
  palette?: string;
  typography?: string;
  atmosphere?: string;
  layout?: string;
  scene?: string;
  motionIntensity?: string;
  scrollStyle?: string;
  hoverStyle?: string;
  cursorStyle?: string;
  transition?: string;
  theme?: string;
  /** The one memorable move, as a signature id or a sentence. */
  signature?: string;
}

/** Five colours, chosen rather than picked from a list. */
export interface CustomPalette {
  bg: string;
  fg: string;
  accent: string;
  muted: string;
  surface: string;
}

/** Which parts of a reference the person chose to carry across. */
export type DnaPart = 'palette' | 'typography' | 'atmosphere' | 'layout' | 'scene' | 'motion' | 'signature';

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
  /**
   * Where the words come from.
   *
   * `new` scaffolds the template into an empty folder and invents everything.
   * `revamp` is pointed at a website that already exists: the routes, the copy
   * and the data are already there and stay there, and only the design is
   * replaced. Everything between those two ends — the questions, the
   * directions, the tune panel, the chat — is the same, which is the point.
   */
  mode?: 'new' | 'revamp';
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
   * Colours chosen rather than picked. Overrides `palette` when present.
   * Kept beside the palette id rather than replacing it so that clearing the
   * custom colours falls back to a real, contrast-checked palette instead of
   * to nothing.
   */
  customPalette?: CustomPalette;

  /**
   * What the person typed beside the options, per step.
   *
   * Every screen is answerable by pressing, and every screen now also has one
   * line to say the thing no list contains. Keyed by step id so the brief can
   * attribute it — "on colour, they said..." carries more than the same
   * sentence in a general notes field.
   */
  stepNotes?: Record<string, string>;

  /** Which parts of the reference site were adopted, per reference index. */
  adopted?: string[];

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
  /** A site that existed before Super Builds saw it. */
  mode?: 'new' | 'revamp';
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
   Several conversations at once
--------------------------------------------------------------------------- */

/**
 * What this machine is carrying.
 *
 * `running` is turns in flight across every project, `ceiling` is what the
 * machine will carry at once, and `waiting` is what is in line. A queued turn is
 * not a failure and the interface must not draw it as one.
 */
export interface Capacity {
  running: number;
  ceiling: number;
  waiting: Array<{ sessionId: string; projectId: string; title: string; position: number }>;
}

/**
 * Where a conversation sits on the board.
 *
 * Four lanes, and each one is a fact rather than a mood: something is running,
 * something is in line behind the machine's ceiling, something is waiting on a
 * person, something has not been touched today. Nothing here is a status a
 * person sets — a board you have to keep tidy by hand is a second job.
 */
export type Lane = 'running' | 'queued' | 'you' | 'resting';

/**
 * One conversation, small enough to hold hundreds of.
 *
 * Deliberately not a `Session`: a session carries every turn it has ever had,
 * with tool calls, and a board asking for forty of those would move megabytes
 * to draw forty cards. This is what a card shows and nothing else.
 */
export interface SessionCard {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  lane: Lane;
  status: SessionStatus;
  createdAt: number;
  updatedAt: number;
  /** A turn is in flight in this one right now. */
  busy: boolean;
  /** Its place in line, when the machine is at its ceiling. */
  place?: number;
  turns: number;
  costUsd: number;
  model?: string;
  /** The last thing said, trimmed to a line, so a card is recognisable. */
  last?: { role: 'user' | 'assistant' | 'system'; text: string; at: number };
  /** The last turn ended in an error. */
  failed?: boolean;
}

/** Every conversation on this machine, and what the machine is carrying. */
export interface SessionBoard {
  cards: SessionCard[];
  capacity: Capacity;
}

/** The notebook every conversation about a project reads. */
export interface ProjectMemory {
  projectId: string;
  /** The whole file, for editing. */
  text: string;
  /** The person's standing instructions, without the log. */
  notes: string;
  /** One line per finished turn, newest first. */
  entries: string[];
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
   The project's own files
--------------------------------------------------------------------------- */

export interface FileEntry {
  /** Relative to the project root, forward slashes. */
  path: string;
  name: string;
  dir: boolean;
  size: number;
  at: number;
  /** Different from the last commit. */
  changed?: boolean;
  /** A .env file: shown with values masked until asked for. */
  secret?: boolean;
}

export interface FileBody {
  path: string;
  text: string;
  size: number;
  at: number;
  /** Which highlighter to use: tsx, ts, json, css, md, env, … */
  language: string;
  readOnly: boolean;
  reason?: string;
  secret?: boolean;
}

/** The owner login for the generated CRM at /admin. */
export interface AdminLogin {
  email: string;
  /** Only while the plaintext is still kept on this machine. */
  password?: string;
  configured: boolean;
  path: string;
}

/* ---------------------------------------------------------------------------
   Revamping a site that already exists
--------------------------------------------------------------------------- */

export type Framework = 'next' | 'vite' | 'cra' | 'astro' | 'remix' | 'sveltekit' | 'nuxt' | 'static' | 'unknown';

/** What can be known about somebody's existing website without asking a model. */
export interface SiteSurvey {
  path: string;
  ok: boolean;
  reason?: string;
  framework: Framework;
  frameworkLabel: string;
  /** Whether the pre-built scene components can be dropped in as they are. */
  react: boolean;
  packageName?: string;
  devScript?: string;
  buildScript?: string;
  typescript: boolean;
  tailwind: boolean;
  /** Public routes, as a visitor sees them. */
  routes: string[];
  /**
   * Routes behind a login — an admin, a dashboard, an account area.
   *
   * Kept apart from the public ones because they are a different job. A
   * marketing page wants a redesign; a table of somebody's customers wants the
   * new colours and its layout left alone, and conflating the two is how a
   * revamp turns a working CRM into a hero section.
   */
  privateRoutes: string[];
  routeFiles: string[];
  images: number;
  fileCount: number;
  git: { repo: boolean; clean: boolean; branch?: string; dirty: number };
  /** The site's own words, for the model to read. Not shown in full. */
  content: string;
  /** Things to say before anything is changed. */
  notes: string[];
}

/** What a model made of it: the business, and the answers it would have given. */
export interface Understanding {
  name: string;
  summary: string;
  archetype: string;
  goal: string;
  belief?: string;
  pages?: string[];
  features?: string[];
  details?: BusinessDetails;
  /** What the current site gets right and must not lose. */
  keep: string[];
  /** What is holding it back. */
  problems: string[];
  suggests?: DnaSuggestion;
  customPalette?: CustomPalette;
}

/* ---------------------------------------------------------------------------
   Under the hood: what is driving the build
--------------------------------------------------------------------------- */

/** A plugin, skill, agent, slash command or MCP server Claude Code has been given. */
export interface EngineExtra { name: string; kind: 'plugin' | 'skill' | 'agent' | 'command' | 'mcp'; where: string; detail?: string }

export interface EngineStage { id: string; label: string; blurb: string; prompt: string }

export interface EngineInfo {
  projectId: string;
  claude: { bin: string; model?: string; permissionMode: string; effort?: string };
  /** The command-line shape a build turn is spawned with. Values are elided. */
  argv: string[];
  hooks: Array<{ event: string; does: string }>;
  /** What the policy refuses, in the person's language. */
  refuses: string[];
  extras: EngineExtra[];
  brief: { text: string; exists: boolean; path: string };
  stages: EngineStage[];
}

/* ---------------------------------------------------------------------------
   Analytics
--------------------------------------------------------------------------- */

/**
 * One analytics destination the site can be wired to.
 *
 * The catalogue entry says what it is; this says what connecting it involves —
 * which keys, where to get them, and where the person goes to look at the
 * numbers afterwards. That last one matters more than it sounds: a site wired
 * to PostHog shows nothing useful inside Super Builds, and a dashboard that
 * says nothing is worse than a link that says "your numbers are over here".
 */
export interface AnalyticsProviderInfo {
  id: string;
  label: string;
  icon?: string;
  blurb: string;
  /** Environment variables it needs, in the order they should be asked for. */
  fields: Array<{ key: string; label: string; hint?: string; optional?: boolean; placeholder?: string }>;
  /** Where the person reads their numbers. `{host}` is replaced with the site's domain. */
  dashboard?: string;
  /** Where the keys come from. */
  keysUrl?: string;
  /** True when the numbers are shown inside the site's own /admin. */
  builtin?: boolean;
  /** Free, paid, needs an account — said plainly. */
  caveat?: string;
}

export interface AnalyticsState {
  projectId: string;
  /** Provider ids currently switched on, as written into NEXT_PUBLIC_ANALYTICS. */
  enabled: string[];
  providers: AnalyticsProviderInfo[];
  /** Which required keys are filled in, by provider id. Names and status only, never values. */
  filled: Record<string, string[]>;
  /** The deployed host, when there is one, so dashboard links can point at the real site. */
  host?: string;
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
  | { type: 'session.remove'; sessionId: string }
  | { type: 'session.delta'; sessionId: string; turnId: string; text: string }
  | { type: 'session.thinking'; sessionId: string; turnId: string; text: string }
  | { type: 'session.tool'; sessionId: string; turnId: string; tool: ToolCall }
  | { type: 'session.turn'; sessionId: string; turn: Turn }
  | { type: 'generation.update'; state: GenerationState }
  | { type: 'preview.update'; state: PreviewState }
  | { type: 'deploy.update'; state: DeployState }
  | { type: 'reference.update'; capture: ReferenceCapture }
  | { type: 'tweaks.update'; state: TweakState }
  | { type: 'analytics.update'; state: AnalyticsState }
  | { type: 'capacity.update'; capacity: Capacity }
  | { type: 'memory.update'; memory: ProjectMemory }
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
