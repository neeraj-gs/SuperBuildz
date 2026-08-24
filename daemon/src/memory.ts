/**
 * What every conversation about a project knows about the others.
 *
 * ── The problem parallelism creates ─────────────────────────────────────────
 *
 * The moment a project can have more than one conversation, they stop being one
 * assistant and start being several with amnesia. One is rewriting the menu
 * page while another is told the menu page is fine. One renames a component the
 * other is halfway through editing. Neither is wrong; neither can see the other.
 *
 * The usual answer is to make them talk to each other, which is a distributed
 * systems problem nobody asked for. The cheap answer that actually works is a
 * shared notebook: one file in the project, read into every conversation's
 * system prompt, appended to when a turn finishes.
 *
 * ── What goes in it ─────────────────────────────────────────────────────────
 *
 * Two halves. The top is the person's, typed once and always in force — "we are
 * a wine bar, not a restaurant", "never use the word artisanal". The bottom is
 * a log the daemon writes: one line per finished turn, which conversation, what
 * it did. Twenty of those are enough to stop two sessions colliding and short
 * enough not to crowd out the brief.
 *
 * ── Why the daemon writes it and not the model ──────────────────────────────
 *
 * Because a model asked to maintain a shared file will do it beautifully for
 * three turns and then stop, and nothing will notice. The daemon already sees
 * every finished turn; taking its first sentence is free, is never skipped, and
 * cannot be argued with.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = '.superbuilds';
const FILE = 'memory.md';

/** The heading that separates what the person wrote from what the daemon logs. */
const LOG_HEADING = '## What the conversations have been doing';

const TEMPLATE = `# Shared notes for this project

Anything written above the line below is read by every conversation about this
project, every time. Put the things you would otherwise have to keep repeating:
what the business is really like, words to use, words never to use, a decision
already made that you do not want revisited.

${LOG_HEADING}

`;

const MAX_ENTRIES = 20;

function pathFor(projectPath: string): string {
  return join(projectPath, DIR, FILE);
}

function read(projectPath: string): string {
  const file = pathFor(projectPath);
  try { return existsSync(file) ? readFileSync(file, 'utf8') : TEMPLATE; } catch { return TEMPLATE; }
}

function write(projectPath: string, text: string): void {
  const dir = join(projectPath, DIR);
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(pathFor(projectPath), text.replace(/\r\n/g, '\n').replace(/\n*$/, '\n'));
  } catch { /* a project folder that has gone is not worth an exception here */ }
}

export interface Memory {
  /** The whole file, for editing. */
  text: string;
  /** Just the person's half, for the system prompt. */
  notes: string;
  /** The log, newest first. */
  entries: string[];
}

export function memory(projectPath: string): Memory {
  const text = read(projectPath);
  const i = text.indexOf(LOG_HEADING);
  const notes = (i === -1 ? text : text.slice(0, i)).trim();
  const log = i === -1 ? '' : text.slice(i + LOG_HEADING.length);
  const entries = log.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('- '));
  return { text, notes, entries };
}

/** Replace the whole file. What the person types is theirs; the log is rewritten around it. */
export function setMemory(projectPath: string, text: string): Memory {
  if (typeof text !== 'string' || text.length > 200_000) throw new Error('That is longer than a set of notes needs to be.');
  write(projectPath, text);
  return memory(projectPath);
}

/**
 * Record what a conversation just did.
 *
 * One line, first sentence, no more than what fits on a line — this is a
 * changelog for other conversations, not a transcript. Anything longer stops
 * being read, by them and by anybody.
 */
export function noteTurn(projectPath: string, sessionTitle: string, reply: string): void {
  const summary = firstSentence(reply);
  if (!summary) return;
  const when = new Date().toISOString().slice(11, 16);
  const line = `- ${when} · **${sessionTitle}** — ${summary}`;

  const m = memory(projectPath);
  const kept = [line, ...m.entries].slice(0, MAX_ENTRIES);
  write(projectPath, `${m.notes}\n\n${LOG_HEADING}\n\n${kept.join('\n')}\n`);
}

function firstSentence(text: string): string {
  const clean = text
    // Strip the options block, code fences and headings: none of it is the point.
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#{1,6}\s.*$/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return '';
  const stop = clean.search(/[.!?](\s|$)/);
  const sentence = stop === -1 ? clean : clean.slice(0, stop + 1);
  return sentence.length > 180 ? sentence.slice(0, 177).trimEnd() + '…' : sentence;
}

/**
 * The block that goes into a system prompt.
 *
 * Absent entirely when there is nothing to say, because an empty "shared notes"
 * section in every prompt teaches the model to skip that part of the prompt.
 */
export function memoryPrompt(projectPath: string, others: Array<{ title: string; doing: string }> = []): string {
  const m = memory(projectPath);
  const parts: string[] = [];

  const notes = m.notes.replace(/^#.*$/gm, '').replace(/Anything written above[\s\S]*?revisited\./, '').trim();
  if (notes) parts.push('Shared notes for this project, written by the person who owns it. These are standing instructions and outrank your own judgement:', '', notes);

  if (others.length) {
    parts.push(
      '',
      'Other conversations are working on this same project right now. Do not undo or duplicate what they are doing; if your task overlaps with theirs, say so and do the part that is yours:',
      ...others.map((o) => `- **${o.title}** is ${o.doing}`),
    );
  }

  if (m.entries.length) {
    parts.push('', 'Recently, in other conversations about this project:', ...m.entries.slice(0, 8));
  }

  return parts.join('\n');
}
