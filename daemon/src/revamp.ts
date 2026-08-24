/**
 * Taking a website somebody already has and making it worth looking at.
 *
 * ── The same product, pointed the other way ─────────────────────────────────
 *
 * A new build starts from a template and adds a business. A revamp starts from
 * a business and replaces the design. Everything in between is identical — the
 * same eighteen questions, the same three directions, the same tune panel, the
 * same chat — which is the point: there is one product here, not two, and the
 * person choosing between them is choosing where the words come from.
 *
 * ── What must survive ───────────────────────────────────────────────────────
 *
 * Their words. Their URLs. Their data. Their keys. This is a live site with
 * customers on it, and a redesign that silently renames /about to /story has
 * broken every link anybody ever shared. So the survey establishes the routes
 * and the copy up front, the brief names them as fixed, and the stages are
 * written to restyle rather than rewrite.
 *
 * ── Git is the safety net and it is not optional ────────────────────────────
 *
 * Nothing starts until the folder is a repository with a clean tree, and the
 * work happens on a branch of its own. A person who does not like the result
 * gets back to exactly what they had with one command, which is a promise this
 * feature cannot ship without. If the folder is not a repository, one is made
 * and everything in it is committed first.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plan, Spec, Understanding } from '@superbuilds/protocol';

export type { Understanding };
import type { SiteSurvey } from './survey.ts';
import {
  ARCHETYPES, ATMOSPHERES, CURSOR_STYLES, FEATURES, GOALS, HOVER_STYLES, LAYOUTS, MOTION_INTENSITY,
  PAGES, PALETTES, SCENES, SCROLL_STYLES, SIGNATURES, THEMES, TRANSITIONS, TYPOGRAPHY,
} from './catalogue/index.ts';
import { designLibraryRoot } from './paths.ts';
import { RUBRIC } from './brief.ts';

const exec = promisify(execFile);

/** The branch a revamp always happens on. Named so it is obvious in a log. */
export const REVAMP_BRANCH = 'superbuilds/revamp';

/* ---------------------------------------------------------------------------
   Understanding: the one question a model has to answer
--------------------------------------------------------------------------- */

const ids = (list: Array<{ id: string }>) => list.map((c) => c.id);

export const UNDERSTAND_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    summary: { type: 'string' },
    archetype: { type: 'string', enum: ids(ARCHETYPES) },
    goal: { type: 'string', enum: ids(GOALS) },
    belief: { type: 'string' },
    pages: { type: 'array', items: { type: 'string', enum: ids(PAGES) } },
    features: { type: 'array', items: { type: 'string', enum: ids(FEATURES) } },
    details: {
      type: 'object',
      properties: {
        tagline: { type: 'string' }, location: { type: 'string' }, phone: { type: 'string' },
        email: { type: 'string' }, hours: { type: 'string' }, founded: { type: 'string' },
        knownFor: { type: 'array', items: { type: 'string' } },
        offerings: { type: 'array', items: { type: 'string' } },
      },
    },
    /** What the current site gets right, and must not lose. */
    keep: { type: 'array', items: { type: 'string' } },
    /** What is holding it back, in a sentence each. */
    problems: { type: 'array', items: { type: 'string' } },
    suggests: {
      type: 'object',
      properties: {
        palette: { type: 'string', enum: ids(PALETTES) },
        typography: { type: 'string', enum: ids(TYPOGRAPHY) },
        atmosphere: { type: 'string', enum: ids(ATMOSPHERES) },
        layout: { type: 'string', enum: ids(LAYOUTS) },
        scene: { type: 'string', enum: ids(SCENES) },
        motionIntensity: { type: 'string', enum: ids(MOTION_INTENSITY) },
        scrollStyle: { type: 'string', enum: ids(SCROLL_STYLES) },
        hoverStyle: { type: 'string', enum: ids(HOVER_STYLES) },
        cursorStyle: { type: 'string', enum: ids(CURSOR_STYLES) },
        transition: { type: 'string', enum: ids(TRANSITIONS) },
        theme: { type: 'string', enum: ids(THEMES) },
        signature: { type: 'string' },
      },
    },
    customPalette: {
      type: 'object',
      properties: {
        bg: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
        fg: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
        accent: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
        muted: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
        surface: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
      },
      required: ['bg', 'fg', 'accent', 'muted', 'surface'],
    },
  },
  required: ['name', 'summary', 'archetype', 'goal', 'keep', 'problems'],
};

function options(label: string, list: Array<{ id: string; label: string; blurb?: string }>): string {
  return `${label}: ${list.map((c) => `${c.id} (${c.label}${c.blurb ? ` — ${c.blurb}` : ''})`).join('; ')}`;
}

/**
 * Read the site, then answer the schema.
 *
 * The survey has already established what can be established mechanically, so
 * this asks for the two things it cannot: what the business actually is, and
 * which of our options its owner would have picked if they had been asked. The
 * Read and Glob tools are allowed because a route list is not the same as
 * reading the pages, and this is the one turn where reading widely is cheap
 * relative to getting the answer wrong.
 */
export function understandPrompt(survey: SiteSurvey, shots: string[] = []): string {
  return [
    'You are looking at a website somebody already runs, because they have asked for it to be redesigned.',
    `It is a ${survey.frameworkLabel} project at ${survey.path}.`,
    '',
    'What is mechanically known already, so you do not need to rediscover it:',
    `- Routes: ${survey.routes.join(', ') || 'one page'}`,
    `- Page sources: ${survey.routeFiles.join(', ') || 'unknown'}`,
    `- ${survey.images} image file${survey.images === 1 ? '' : 's'}, ${survey.fileCount} files in all`,
    `- TypeScript: ${survey.typescript ? 'yes' : 'no'}; Tailwind: ${survey.tailwind ? 'yes' : 'no'}`,
    '',
    'The words the site currently uses, pulled out of its own source:',
    survey.content || '(nothing readable — read the page files yourself)',
    ...(shots.length ? ['', 'Screenshots of it running, at successive scroll positions. Read every one before answering:', ...shots.map((s) => `- ${s}`)] : []),
    '',
    'Read the page files listed above with Read, and any component they lean on. Do not read .env files, and do not read anything under node_modules.',
    '',
    'Then answer the schema.',
    '',
    '`name`, `summary`, `details`: who this is, in their own terms — the actual business, not the technology. Take the phone number, the address and the hours off the page if they are there. Leave anything out that you would be guessing.',
    '`keep`: 3–6 things the current site gets right that must survive a redesign. Its words usually. Sometimes a photograph, a colour that is on their van, a structure their customers already know. Be specific: "the six-seat counter is the whole story and it is buried on the about page" is useful; "good content" is not.',
    '`problems`: 3–6 things holding it back, one sentence each, as a designer would say them. Not a lighthouse audit — the reasons somebody bounces.',
    '',
    'Then `suggests`: the nearest option in each of these lists, chosen for what this business should be, not for what the current site already is. These pre-select the questions its owner is about to be asked, and they will disagree with the ones you get wrong, which is fine and expected. Leave a field out rather than guess.',
    '',
    options('archetype', ARCHETYPES),
    options('goal', GOALS),
    options('pages', PAGES),
    options('features', FEATURES),
    options('palette', PALETTES),
    options('typography', TYPOGRAPHY),
    options('atmosphere', ATMOSPHERES),
    options('layout', LAYOUTS),
    options('scene', SCENES),
    options('motionIntensity', MOTION_INTENSITY),
    options('scrollStyle', SCROLL_STYLES),
    options('hoverStyle', HOVER_STYLES),
    options('cursorStyle', CURSOR_STYLES),
    options('transition', TRANSITIONS),
    options('theme', THEMES),
    `signature: the one move this site should be remembered for, as one sentence or one of: ${ids(SIGNATURES).join(', ')}`,
    '',
    '`customPalette`: their existing brand colours if the site has real ones worth keeping — logo, signage, packaging — as six-digit hex. If the current palette is a default nobody chose, leave it out and let the palette suggestion stand.',
    '`belief`: the one thing a visitor should walk away believing. One sentence.',
  ].join('\n');
}

/* ---------------------------------------------------------------------------
   Preparing the folder
--------------------------------------------------------------------------- */

async function git(path: string, args: string[]): Promise<{ ok: boolean; out: string }> {
  try { const { stdout } = await exec('git', args, { cwd: path, timeout: 60_000, maxBuffer: 20e6, windowsHide: true }); return { ok: true, out: stdout }; }
  catch (err) { return { ok: false, out: (err as { stderr?: string; message: string }).stderr ?? (err as Error).message }; }
}

export interface PrepareResult { ok: boolean; log: string; branch?: string; error?: string }

/**
 * Make the folder safe to work in, and put the scene library where the build
 * can reach it.
 *
 * Order matters and every step is reversible on its own: a repository first
 * (so there is something to go back to), a commit of whatever was lying around
 * (on *their* branch, so it is where they would look for it), then a branch of
 * ours, and only then any file of ours.
 */
export async function prepareRevamp(projectPath: string, survey: SiteSurvey, onLog: (s: string) => void): Promise<PrepareResult> {
  let log = '';
  const say = (line: string) => { log += line + '\n'; onLog(line + '\n'); };

  if (!existsSync(projectPath)) return { ok: false, log, error: 'That folder is gone.' };

  if (!survey.git.repo) {
    say('This is not a git repository yet. Making one, so there is always a way back.');
    const init = await git(projectPath, ['init', '-q', '-b', 'main']);
    if (!init.ok) return { ok: false, log, error: `git init failed: ${init.out.split('\n')[0]}` };
  }

  const status = await git(projectPath, ['status', '--porcelain']);
  if (status.ok && status.out.trim()) {
    const n = status.out.split('\n').filter((l) => l.trim()).length;
    say(`Committing ${n} file${n === 1 ? '' : 's'} that were already changed, on your own branch, before anything of ours moves.`);
    await git(projectPath, ['add', '-A']);
    const commit = await git(projectPath, ['-c', 'user.name=Super Builds', '-c', 'user.email=superbuilds@localhost', 'commit', '-q', '-m', 'Before the Super Builds revamp', '--no-verify']);
    if (!commit.ok && !/nothing to commit/i.test(commit.out)) return { ok: false, log, error: `Could not commit your existing changes: ${commit.out.split('\n')[0]}` };
  }

  say(`Working on a branch of its own: ${REVAMP_BRANCH}`);
  const existing = await git(projectPath, ['rev-parse', '--verify', REVAMP_BRANCH]);
  const checkout = existing.ok
    ? await git(projectPath, ['checkout', REVAMP_BRANCH])
    : await git(projectPath, ['checkout', '-b', REVAMP_BRANCH]);
  if (!checkout.ok) return { ok: false, log, error: `Could not switch branch: ${checkout.out.split('\n')[0]}` };

  // The scene library, so the build starts from working WebGL rather than from
  // a blank file. Only where React is already present: porting them into Vue or
  // Svelte is the build's job, not a copy's.
  if (survey.react) {
    const src = join(designLibraryRoot(), 'scenes');
    const dest = join(projectPath, survey.routeFiles.some((f) => f.startsWith('src/')) ? 'src/components/scenes' : 'components/scenes');
    if (existsSync(src)) {
      mkdirSync(dest, { recursive: true });
      cpSync(src, dest, { recursive: true });
      say(`Copied the scene library into ${dest.replace(projectPath, '').replace(/^[\\/]/, '')} — fifteen working WebGL scenes to start from.`);
    }
  } else {
    say(`${survey.frameworkLabel} is not React, so the scene will be written in this project's own idiom rather than copied in.`);
  }

  return { ok: true, log, branch: REVAMP_BRANCH };
}

/* ---------------------------------------------------------------------------
   The brief and the stages
--------------------------------------------------------------------------- */

/**
 * REVAMP.md: what this is, what must not change, and what good looks like.
 *
 * The equivalent of BRIEF.md for a new build, and deliberately front-loaded
 * with the constraints rather than the ambitions — because on somebody's live
 * site, the constraints are the ambitious part.
 */
export function revampBrief(spec: Spec, survey: SiteSurvey, understanding?: Understanding): string {
  const lines: string[] = [
    `# ${spec.name} — revamp brief`,
    '',
    'This is a website that already exists and already has visitors. You are redesigning it, not replacing it.',
    '',
    '## What must not change',
    '',
    `- **The URLs.** ${survey.routes.length} public route${survey.routes.length === 1 ? '' : 's'}: ${survey.routes.join(', ')}. Every one keeps working at the same address. Somebody has shared these links.`,
    ...(survey.privateRoutes.length ? [
      `- **The pages behind a login** — ${survey.privateRoutes.join(', ')} — are a different job. Give them the new colours, the new type and the new spacing, and leave their layout, their tables and their data exactly as they are. Nobody wants a full-bleed hero on the page where they read their bookings. Do not add a 3D scene there.`,
    ] : []),
    '- **The words**, unless they are obviously placeholder. This is their business and their voice. Re-set them, re-scale them, re-order them on the page — do not rewrite them into marketing copy.',
    '- **The data.** Forms, API routes, database calls, CMS content, environment variables. Never read or edit a `.env` file. If a form posts somewhere, it still posts there afterwards.',
    '- **The dependencies that do work.** Replace what is decorative; keep what is load-bearing.',
    '',
    `## What this is (${survey.frameworkLabel})`,
    '',
  ];

  if (understanding) {
    lines.push(understanding.summary, '');
    if (understanding.keep.length) {
      lines.push('### What the current site gets right — keep all of it', '', ...understanding.keep.map((k) => `- ${k}`), '');
    }
    if (understanding.problems.length) {
      lines.push('### What is holding it back — this is the work', '', ...understanding.problems.map((p) => `- ${p}`), '');
    }
  }

  lines.push(
    '## Where the design comes from',
    '',
    'The owner has answered the same questions a new site is built from. Their answers are in `design.config.ts` and in the sections below; treat that file as the single source of truth for colour, type, spacing and motion, and read every value from it rather than writing a number into a component.',
    '',
    '## The rules this will be judged against',
    '',
    // RUBRIC is already one joined block; the same seventeen lines a new build
    // is scored on, and there is no reason a revamp should be judged softer.
    RUBRIC,
    '',
    '## How to work',
    '',
    '- You are on the `superbuilds/revamp` branch. Commit after each stage with a message that says what changed.',
    '- Run the project\'s own build before you say a stage is done. A revamp that does not compile is worse than the site it replaced.',
    '- Take a screenshot of every route you touch and look at it. The instruction is not "check it renders" — it is "look at it and ask whether it is better than what was there".',
    '- Match the project\'s existing conventions: its module style, its component patterns, its file layout, its formatting. Somebody has to maintain this afterwards and it should not read as two codebases.',
    `- ${survey.react ? 'The scene library has been copied into the project. Start from one of those components rather than a blank file.' : `This is ${survey.frameworkLabel}, not React. Write the 3D layer in this project's own idiom; the scene library is a reference for what the scene should do, not code to paste.`}`,
  );

  return lines.join('\n');
}

export interface RevampStage { id: string; label: string; blurb: string; prompt: (spec: Spec, survey: SiteSurvey) => string }

const routeList = (s: SiteSurvey) => s.routes.map((r) => `\`${r}\``).join(', ');

export const REVAMP_STAGES: RevampStage[] = [
  {
    id: 'foundation',
    label: 'The design system, in their project',
    blurb: 'Tokens, type, and the dependencies the new design needs — in this project\'s own idiom',
    prompt: (spec, survey) => [
      'Read REVAMP.md first. It says what must not change.',
      '',
      `Install the design system into this ${survey.frameworkLabel} project, in the project's own idiom.`,
      '',
      '1. Write `design.config.ts` (or the closest thing this project uses) holding the palette, the type pairing, radius, spacing rhythm and the motion values from the brief. Every component reads from it. If the project already has a tokens or theme file, extend that one rather than adding a rival.',
      `2. Wire the typefaces. ${survey.framework === 'next' ? 'Use `next/font/google` so there is no layout shift.' : 'Self-host or preload them; a font that arrives late is a page that jumps.'}`,
      '3. Publish the tokens as CSS custom properties on the document root, so CSS and components read the same values.',
      `4. Install whatever the new design needs and nothing else. ${survey.react ? 'For the 3D: three, @react-three/fiber, @react-three/drei. Check what is already installed first.' : 'For the 3D: whichever WebGL layer suits this framework.'}`,
      '5. Do not restyle any page yet. This stage ends with the system in place and the site still looking exactly as it did.',
      '',
      'Then run the build. It must pass before you stop.',
    ].join('\n'),
  },
  {
    id: 'identity',
    label: 'The first screen, and the one memorable move',
    blurb: 'The hero rebuilt around the signature — the thing somebody would describe afterwards',
    prompt: (spec, survey) => [
      'Read REVAMP.md.',
      '',
      `Rebuild the first screen of \`/\`. Keep the words that are there — they are the owner's. Change everything about how they are set.`,
      '',
      `The signature move: ${spec.signature || 'choose one and name it in REVAMP.md, then build it'}. Build it now, make it the thing the page is about, and let nothing else on the site compete with it.`,
      '',
      'The 3D scene is part of the page, not a box on it: one fixed canvas behind the document that sections drive as they scroll, so the same scene means something different in each. If a section reads better without it, dim it there.',
      '',
      'Then: take a screenshot at 1440 wide and at 390 wide, read both, and fix what is wrong before you stop. A hero that only works on a desktop is half a hero.',
    ].join('\n'),
  },
  {
    id: 'pages',
    label: 'Every other page',
    blurb: 'The rest of the site brought up to the same standard, with its words and its URLs intact',
    prompt: (spec, survey) => [
      'Read REVAMP.md.',
      '',
      `Now the rest of the public pages: ${routeList(survey)}.`,
      ...(survey.privateRoutes.length ? [`(${survey.privateRoutes.join(', ')} are behind a login. Re-token them only — colours, type, spacing. Their layout stays.)`] : []),
      '',
      'For each one, in order of how much traffic it plausibly gets:',
      '- Keep the URL, keep the words, keep whatever it posts to or reads from.',
      '- Re-set it with the design system: the type scale, the spacing rhythm, the layout system from the brief.',
      '- Give every section a reason to exist visually. Where a photograph would have gone and there is none, design something — a word set enormous, a measured drawing, a field of colour, a real number counting. Never an empty rounded rectangle and never a stock photograph.',
      '- Let the scene reach the section, or deliberately dim it there.',
      '',
      'Screenshot each page after you change it, at both widths, and look at it. Fix what is wrong before moving on.',
    ].join('\n'),
  },
  {
    id: 'motion',
    label: 'How it moves',
    blurb: 'One recurring gesture through the whole site, and nothing that moves without a reason',
    prompt: () => [
      'Read REVAMP.md.',
      '',
      'Make the whole site move as one thing: the same easing, the same rise, the same stagger, one recurring gesture that appears on every page and nowhere twice in the same way.',
      '',
      '- Scroll-driven, not time-driven, wherever the motion is about position on the page.',
      '- Every animation reads a duration and an easing from the tokens. No number written into a component.',
      '- `prefers-reduced-motion` genuinely honoured: not "slower", but the state the animation was heading towards, immediately.',
      '- Nothing animates on load that a person is waiting to read.',
      '',
      'Then run the build, take the screenshots again, and check nothing has shifted.',
    ].join('\n'),
  },
  {
    id: 'review',
    label: 'The jury',
    blurb: 'Score the redesign against the rubric and fix what fails',
    prompt: (spec, survey) => [
      'Read REVAMP.md, then judge what you have made as an awards jury would.',
      '',
      `Screenshot every public route (${routeList(survey)}) at 1440 and 390 and read all of them.`,
      '',
      'Score each line of the rubric in REVAMP.md out of 5, with one sentence of evidence from the screenshots. Then fix everything under 4, hardest first.',
      '',
      'Then the things a jury checks that a screenshot does not show:',
      '- Every route that worked before still works and still lives at the same address.',
      '- Nothing reads a secret in client code.',
      '- The build passes and the console is clean.',
      '- Keyboard focus is visible everywhere and the tab order makes sense.',
      '',
      'Finish by writing what changed, and what you would do next, at the bottom of REVAMP.md.',
    ].join('\n'),
  },
];

export function revampStagesFor(spec: Spec): RevampStage[] {
  return REVAMP_STAGES.filter((s) => s.id !== 'review' || spec.review);
}

/** Write REVAMP.md into the project. */
export function writeRevampBrief(projectPath: string, spec: Spec, survey: SiteSurvey, understanding?: Understanding): void {
  writeFileSync(join(projectPath, 'REVAMP.md'), revampBrief(spec, survey, understanding) + '\n');
}


/**
 * What the last screen shows before a revamp starts.
 *
 * Same shape as `planFor`, different content, and one number that matters more
 * than the rest: the estimate is lower than a new build because the words, the
 * routes and the data already exist — the work is design, not invention.
 */
export function revampPlan(spec: Spec, survey: SiteSurvey, understanding?: Understanding): Plan {
  const stages = revampStagesFor(spec).map((s) => ({ id: s.id, label: s.label, blurb: s.blurb }));
  const pages = survey.routes.length || 1;

  const caveats: string[] = [
    `Everything happens on the \`${REVAMP_BRANCH}\` branch. Your current branch is left exactly as it is, so \`git checkout ${survey.git.branch || 'main'}\` puts everything back.`,
    'Your words, your URLs and your data are not rewritten. If a page says something wrong, that is a conversation afterwards, not a redesign.',
    ...survey.notes,
  ];
  if (!survey.react) caveats.push(`${survey.frameworkLabel} is not React, so the 3D layer is written from scratch in this project's idiom. Expect the longer end of the estimate.`);

  return {
    // The real brief is written into the project at stage zero, once the folder
    // is safe. This is the same text, so what is read here is what is obeyed.
    brief: revampBrief(spec, survey, understanding),
    stages,
    secrets: [],
    files: [...survey.routeFiles].slice(0, 20),
    caveats,
    estimate: {
      // Calibrated against the new-build numbers, scaled by pages and reduced
      // for the half of the work that does not have to happen: no scaffold, no
      // install from nothing, no copy to invent.
      lowUsd: Math.round(6 + pages * 1.5),
      highUsd: Math.round(14 + pages * 4),
      minutes: [Math.round(12 + pages * 3), Math.round(25 + pages * 8)] as [number, number],
      caveat: 'A guess from one calibrated build, scaled by how many pages you have. A site with a lot of bespoke components takes longer than its page count suggests.',
    },
  };
}
