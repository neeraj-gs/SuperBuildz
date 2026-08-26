/**
 * The one thing in a reply that must not be missed.
 *
 * ── Why a transcript is not enough ──────────────────────────────────────────
 *
 * Nobody reads all of it. A build produces forty minutes of prose, and the
 * sentence that actually needed a person — "those two pages read patient names
 * and phone numbers, so I put them behind the login; tell me if you wanted them
 * public" — arrives in the middle of a paragraph, in the same weight as
 * everything around it, and scrolls away. It was flagged rather than buried,
 * and it was still buried, because being in the transcript and being seen are
 * different things.
 *
 * So a reply can carry a notice: a short fenced block, pulled out of the text
 * before anybody sees it, that becomes a card on the shelf above the composer
 * and stays there until it is answered or acknowledged. The transcript keeps
 * its copy, in place, so scrolling back still shows where it happened.
 *
 * ── Why it is a block Claude writes rather than something we detect ─────────
 *
 * Because guessing is worse in both directions. Regexes for "you will need"
 * and "I did not" would raise a card on half the paragraphs in a build and
 * miss the one that mattered — and a card that fires often is a card people
 * learn to dismiss without reading, which is the exact failure being fixed.
 * The model knows which of its sentences needed a person. It is asked to say
 * so, sparingly, in the same way it is already asked for the options block.
 *
 * ── Why the parsing is forgiving ────────────────────────────────────────────
 *
 * Same reason `splitOptions` is: a model that wrote one object instead of an
 * array, or left a trailing comma, still meant a notice, and dropping it
 * silently would lose exactly the sentence this file exists to keep.
 */

import { randomUUID } from 'node:crypto';
import type { Notice, NoticeKind } from '@superbuilds/protocol';

export const NOTICE_FENCE = 'sb-notice';

const KINDS: NoticeKind[] = ['key', 'decision', 'blocked', 'note'];

function asKind(value: unknown): NoticeKind {
  const s = String(value ?? '').toLowerCase().trim();
  return (KINDS as string[]).includes(s) ? (s as NoticeKind) : 'note';
}

function asStrings(value: unknown, max: number, cap: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === 'string' ? v : String((v as { label?: string })?.label ?? '')))
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((s) => s.slice(0, cap))
    .slice(0, max);
}

function one(raw: unknown): Notice | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const title = String(o.title ?? '').replace(/\s+/g, ' ').trim();
  if (!title) return null;

  const kind = asKind(o.kind);
  // Names only. If a model ever puts a value here it is a variable name we
  // refuse to recognise rather than a secret we quietly carry into the store.
  const keys = asStrings(o.keys, 6, 64).filter((k) => /^[A-Z][A-Z0-9_]{1,63}$/.test(k));

  return {
    id: randomUUID().slice(0, 8),
    // A notice claiming to be about a key, with no key named, is a note.
    kind: kind === 'key' && keys.length === 0 ? 'note' : kind,
    title: title.slice(0, 140),
    body: String(o.body ?? '').replace(/\s+/g, ' ').trim().slice(0, 600) || undefined,
    keys: keys.length ? keys : undefined,
    choices: asStrings(o.choices, 4, 80).length ? asStrings(o.choices, 4, 80) : undefined,
  };
}

/**
 * Pull every notice out of a reply, and give back the reply without them.
 *
 * Run before `splitOptions`, because a model that puts the options block last
 * as instructed will have put any notice above it, and running the other way
 * round leaves the fence sitting in the visible text.
 */
export function splitNotices(text: string): { text: string; notices: Notice[] } {
  const rx = new RegExp('```' + NOTICE_FENCE + '\\s*([\\s\\S]*?)```', 'g');
  const notices: Notice[] = [];

  const stripped = text.replace(rx, (_all, body: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body.trim());
    } catch {
      // A trailing comma is the commonest way this arrives broken, and the
      // notice inside it is still the sentence somebody has to see.
      try { parsed = JSON.parse(body.trim().replace(/,(\s*[}\]])/g, '$1')); } catch { return ''; }
    }
    for (const item of Array.isArray(parsed) ? parsed : [parsed]) {
      const notice = one(item);
      if (notice) notices.push(notice);
      if (notices.length >= 4) break;
    }
    return '';
  });

  // Two blank lines where a block was is a hole in the prose.
  return { text: stripped.replace(/\n{3,}/g, '\n\n').trim(), notices };
}

/** What the system prompt tells Claude about all this. Kept beside the parser. */
export const NOTICE_INSTRUCTIONS = [
  `- Rarely — and only when a reply contains something the person must act on or decide — put a fenced block tagged \`${NOTICE_FENCE}\` just before the options block, containing one JSON object: {"kind":…,"title":…,"body":…}. It becomes a card pinned above their message box, where the rest of your reply is not. Most turns must not have one: a card that appears every time is a card nobody reads.`,
  '  `kind` is one of:',
  '  · `"key"` — the site needs an environment variable it has not got. Add `"keys":["NEXT_PUBLIC_EXAMPLE_KEY"]` naming the variables, never a value, and never ask for the value in your prose; they are asked for in a proper field.',
  '  · `"decision"` — you made a judgement call they may want to overrule, or you are choosing between two defensible things. Add `"choices":["…","…"]`: two to four short first-person replies, exactly as they would say them.',
  '  · `"blocked"` — you cannot continue until they do something.',
  '  · `"note"` — important and nothing to press. Use this one least.',
  '  `title` is one plain sentence, under 100 characters, that survives being read on its own. `body` is at most three sentences of why.',
].join('\n');
