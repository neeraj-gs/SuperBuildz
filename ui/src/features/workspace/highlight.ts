/**
 * Syntax colouring, in about a hundred lines.
 *
 * A real editor grammar is a parse tree and a worker and three hundred
 * kilobytes. What is needed here is different and smaller: somebody opens
 * `.env.local` to paste an API key, or opens `app/page.tsx` to see what Claude
 * actually wrote, and the only job is that strings, comments and keywords stop
 * looking like one grey wall. A regex tokeniser does that, and gets a `<` in a
 * string wrong about once a file — which costs a colour, not a crash.
 *
 * Every rule below is written so that the alternatives are mutually exclusive
 * and consume at least one character, because a zero-width match in a `g` loop
 * is an infinite one.
 */

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
function esc(s: string): string { return s.replace(/[&<>]/g, (c) => ESC[c]); }

/** Wraps in a span whose class the stylesheet colours. */
function tag(kind: string, text: string): string { return `<span class="tk-${kind}">${esc(text)}</span>`; }

const KEYWORDS = new Set([
  'abstract', 'as', 'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'declare', 'default',
  'delete', 'do', 'else', 'enum', 'export', 'extends', 'finally', 'for', 'from', 'function', 'get', 'if', 'implements',
  'import', 'in', 'instanceof', 'interface', 'is', 'keyof', 'let', 'new', 'of', 'private', 'protected', 'public',
  'readonly', 'return', 'satisfies', 'set', 'static', 'super', 'switch', 'this', 'throw', 'try', 'type', 'typeof',
  'var', 'void', 'while', 'yield',
]);
const LITERALS = new Set(['true', 'false', 'null', 'undefined', 'NaN', 'Infinity']);

/**
 * JavaScript and its dialects.
 *
 * Order is the whole design: comments before strings before regex-looking
 * things, or a `//` inside a URL string eats the rest of the line.
 */
const JS_RULE = new RegExp(
  [
    '(\\/\\*[\\s\\S]*?(?:\\*\\/|$))',                              // 1 block comment
    '(\\/\\/[^\\n]*)',                                             // 2 line comment
    '(`(?:[^`\\\\]|\\\\[\\s\\S])*(?:`|$))',                        // 3 template string
    '("(?:[^"\\\\\\n]|\\\\.)*"|\'(?:[^\'\\\\\\n]|\\\\.)*\')',      // 4 string
    '(\\b\\d[\\d_]*(?:\\.\\d+)?(?:[eE][+-]?\\d+)?n?\\b|\\b0[xX][\\da-fA-F_]+\\b)', // 5 number
    '(<\\/?[A-Za-z][\\w.]*)',                                      // 6 JSX open/close tag
    '([A-Za-z_$][\\w$]*)',                                         // 7 word
  ].join('|'),
  'g',
);

function highlightJs(src: string): string {
  let out = '';
  let last = 0;
  for (const m of src.matchAll(JS_RULE)) {
    const i = m.index ?? 0;
    if (i > last) out += esc(src.slice(last, i));
    last = i + m[0].length;
    if (m[1] || m[2]) out += tag('comment', m[0]);
    else if (m[3] || m[4]) out += tag('string', m[0]);
    else if (m[5]) out += tag('number', m[0]);
    else if (m[6]) out += tag('tag', m[0]);
    else {
      const w = m[7];
      if (KEYWORDS.has(w)) out += tag('key', w);
      else if (LITERALS.has(w)) out += tag('lit', w);
      // A capitalised word is a component, a class or a type. Not always, but
      // often enough that colouring it helps far more than it misleads.
      else if (/^[A-Z]/.test(w)) out += tag('type', w);
      else out += esc(w);
    }
  }
  return out + esc(src.slice(last));
}

const JSON_RULE = /("(?:[^"\\]|\\.)*")(\s*:)?|(\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|(\btrue\b|\bfalse\b|\bnull\b)/g;

function highlightJson(src: string): string {
  let out = ''; let last = 0;
  for (const m of src.matchAll(JSON_RULE)) {
    const i = m.index ?? 0;
    if (i > last) out += esc(src.slice(last, i));
    last = i + m[0].length;
    if (m[1]) out += tag(m[2] ? 'key' : 'string', m[1]) + (m[2] ? esc(m[2]) : '');
    else if (m[3]) out += tag('number', m[0]);
    else out += tag('lit', m[0]);
  }
  return out + esc(src.slice(last));
}

const CSS_RULE = /(\/\*[\s\S]*?(?:\*\/|$))|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(@[\w-]+)|(--[\w-]+)|([\w-]+)(?=\s*:)|(#[\da-fA-F]{3,8}\b|\b-?\d*\.?\d+(?:px|rem|em|%|vh|vw|s|ms|deg|fr|ch)?\b)/g;

function highlightCss(src: string): string {
  let out = ''; let last = 0;
  for (const m of src.matchAll(CSS_RULE)) {
    const i = m.index ?? 0;
    if (i > last) out += esc(src.slice(last, i));
    last = i + m[0].length;
    if (m[1]) out += tag('comment', m[0]);
    else if (m[2]) out += tag('string', m[0]);
    else if (m[3]) out += tag('key', m[0]);
    else if (m[4]) out += tag('type', m[0]);
    else if (m[5]) out += tag('prop', m[0]);
    else out += tag('number', m[0]);
  }
  return out + esc(src.slice(last));
}

const MD_RULE = /^(#{1,6} .*)$|(```[\s\S]*?(?:```|$))|(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\[[^\]\n]+\]\([^)\n]+\))|^(\s*[-*+] |\s*\d+[.)] )/gm;

function highlightMd(src: string): string {
  let out = ''; let last = 0;
  for (const m of src.matchAll(MD_RULE)) {
    const i = m.index ?? 0;
    if (i > last) out += esc(src.slice(last, i));
    last = i + m[0].length;
    if (m[1]) out += tag('type', m[0]);
    else if (m[2] || m[3]) out += tag('string', m[0]);
    else if (m[4]) out += tag('key', m[0]);
    else if (m[5]) out += tag('prop', m[0]);
    else out += tag('lit', m[0]);
  }
  return out + esc(src.slice(last));
}

/**
 * `.env` and friends.
 *
 * The value half is coloured as a string even though it has no quotes,
 * because the useful distinction in this file is "name" against "secret", and
 * a person scanning for the line they need is looking at the left column.
 */
const ENV_RULE = /^(#.*)$|^(\s*[A-Za-z_][\w.]*)(=)(.*)$/gm;

function highlightEnv(src: string): string {
  let out = ''; let last = 0;
  for (const m of src.matchAll(ENV_RULE)) {
    const i = m.index ?? 0;
    if (i > last) out += esc(src.slice(last, i));
    last = i + m[0].length;
    if (m[1]) out += tag('comment', m[1]);
    else out += tag('prop', m[2]) + esc(m[3]) + tag('string', m[4]);
  }
  return out + esc(src.slice(last));
}

const HTML_RULE = /(<!--[\s\S]*?(?:-->|$))|(<\/?[A-Za-z][\w:-]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|([\w:-]+)(?==)/g;

function highlightHtml(src: string): string {
  let out = ''; let last = 0;
  for (const m of src.matchAll(HTML_RULE)) {
    const i = m.index ?? 0;
    if (i > last) out += esc(src.slice(last, i));
    last = i + m[0].length;
    if (m[1]) out += tag('comment', m[0]);
    else if (m[2]) out += tag('tag', m[0]);
    else if (m[3]) out += tag('string', m[0]);
    else out += tag('prop', m[0]);
  }
  return out + esc(src.slice(last));
}

export function highlight(src: string, language: string): string {
  switch (language) {
    case 'tsx': case 'ts': case 'js': return highlightJs(src);
    case 'json': return highlightJson(src);
    case 'css': return highlightCss(src);
    case 'md': return highlightMd(src);
    case 'env': case 'yaml': return highlightEnv(src);
    case 'html': return highlightHtml(src);
    default: return esc(src);
  }
}

/** Which glyph to draw beside a filename in the tree. */
export function iconForFile(name: string, dir: boolean): string {
  if (dir) return 'folder';
  if (/\.(tsx|jsx)$/i.test(name)) return 'layout';
  if (/\.(ts|js|mjs|cjs)$/i.test(name)) return 'terminal';
  if (/\.json$/i.test(name)) return 'grid';
  if (/\.(css|scss)$/i.test(name)) return 'palette';
  if (/\.(md|mdx)$/i.test(name)) return 'doc';
  if (/^\.env/i.test(name)) return 'key';
  if (/\.(png|jpe?g|webp|avif|svg|gif)$/i.test(name)) return 'image';
  if (/\.(mp4|webm|mov)$/i.test(name)) return 'video';
  return 'doc';
}
