/**
 * Five colours, mixed rather than picked.
 *
 * The palette list is twelve good answers and there will always be a
 * thirteenth: a brand colour that exists already, on a van, on a sign, on a
 * business card. Refusing it because it is not on the list is the difference
 * between a tool and a template.
 *
 * ── The contrast check is not advice ────────────────────────────────────────
 *
 * It reports a real number — the WCAG contrast ratio between the ink and the
 * ground, and between the accent and the ground — because a non-designer
 * choosing two colours they like will, roughly half the time, produce a page
 * that cannot be read outdoors. It says so plainly and does not block: it is
 * their brand, and a warning they understand is worth more than a rule they
 * cannot override.
 */

import { useMemo } from 'react';
import type { CustomPalette as Palette } from '@superbuilds/protocol';
import { cx } from '@/components/ui';
import { Icon } from '@/components/icons';

const SLOTS: Array<{ key: keyof Palette; label: string; hint: string }> = [
  { key: 'bg', label: 'Page', hint: 'The ground everything sits on' },
  { key: 'fg', label: 'Ink', hint: 'Body text and headlines' },
  { key: 'accent', label: 'Accent', hint: 'Used as light, not paint — one thing at a time' },
  { key: 'surface', label: 'Surface', hint: 'Cards and raised panels' },
  { key: 'muted', label: 'Quiet', hint: 'Captions, labels, the small print' },
];

const FALLBACK: Palette = { bg: '#0A0B0D', fg: '#EDE9E0', accent: '#C8FF3D', muted: '#6C6F78', surface: '#15171B' };

/** sRGB relative luminance, per WCAG 2.1. */
function luminance(hex: string): number {
  const m = hex.replace('#', '').match(/.{2}/g);
  if (!m || m.length < 3) return 0;
  const [r, g, b] = m.slice(0, 3).map((h) => {
    const v = parseInt(h, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

export function CustomPaletteEditor({ value, onChange, onClear }: {
  value: Palette | undefined; onChange: (p: Palette) => void; onClear: () => void;
}) {
  const p = value ?? FALLBACK;
  const set = (k: keyof Palette, v: string) => onChange({ ...p, [k]: v });

  const checks = useMemo(() => ([
    { label: 'Ink on page', ratio: contrast(p.fg, p.bg), need: 4.5 },
    { label: 'Accent on page', ratio: contrast(p.accent, p.bg), need: 3 },
    { label: 'Quiet on page', ratio: contrast(p.muted, p.bg), need: 3 },
  ]), [p]);

  return (
    <div className="panel p-4 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="legend">Your own five</div>
          <p className="text-[12.5px] text-bone-3 mt-0.5 measure">
            These replace the palette above everywhere — the site, the CRM and the 3D scene all read
            the same five.
          </p>
        </div>
        {value && <button onClick={onClear} className="telemetry text-bone-3 hover:text-bone shrink-0">back to the palette</button>}
      </div>

      <div className="grid gap-2.5">
        {SLOTS.map((s) => (
          <label key={s.key} className="flex items-center gap-3">
            <span className="relative w-10 h-10 rounded-lg border border-line-2 overflow-hidden shrink-0" style={{ background: p[s.key] }}>
              <input
                type="color"
                value={p[s.key]}
                onChange={(e) => set(s.key, e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                aria-label={s.label}
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="font-semibold text-[13.5px] block">{s.label}</span>
              <span className="text-[12px] text-bone-3 block leading-snug">{s.hint}</span>
            </span>
            <input
              value={p[s.key]}
              onChange={(e) => { const v = e.target.value.trim(); if (/^#[0-9a-fA-F]{0,6}$/.test(v)) set(s.key, v.length === 7 ? v : p[s.key]); }}
              className="input !w-[104px] !h-8 font-[family-name:var(--font-mono)] !text-[12.5px] shrink-0"
              spellCheck={false}
            />
          </label>
        ))}
      </div>

      <div className="rounded-lg border border-line bg-ink p-3">
        <div className="legend mb-2">Readable?</div>
        <ul className="grid gap-1.5">
          {checks.map((c) => {
            const ok = c.ratio >= c.need;
            return (
              <li key={c.label} className="flex items-center gap-2 text-[12.5px]">
                <Icon name={ok ? 'check' : 'alert'} size={13} className={cx('shrink-0', ok ? 'text-volt' : 'text-warn')} />
                <span className="text-bone-2 flex-1">{c.label}</span>
                <span className={cx('telemetry', ok ? 'text-bone-3' : 'text-warn')}>{c.ratio.toFixed(1)}:1 · needs {c.need}</span>
              </li>
            );
          })}
        </ul>
        {checks.some((c) => c.ratio < c.need) && (
          <p className="text-[12px] text-warn mt-2 leading-snug">
            Below the line means some people cannot read it — in sunlight, on a cheap screen, or with
            ordinary middle-aged eyes. It is your brand, so nothing here is blocked; it is worth
            moving the ink a shade before it goes out.
          </p>
        )}
      </div>

      {/* What the five actually look like together, at the size they will be used. */}
      <div className="rounded-lg overflow-hidden border border-line-2" style={{ background: p.bg, color: p.fg }}>
        <div className="p-5">
          <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: p.muted }}>Preview</div>
          <div className="text-[26px] font-semibold leading-tight mt-1">Your name here</div>
          <p className="text-[13px] mt-1.5 max-w-[42ch]" style={{ color: p.muted }}>
            One sentence of body copy, set in the quiet colour, at the size it will actually be read at.
          </p>
          <div className="flex items-center gap-2 mt-3.5">
            <span className="px-3.5 py-1.5 rounded-full text-[13px] font-semibold" style={{ background: p.accent, color: p.bg }}>The button</span>
            <span className="px-3.5 py-1.5 rounded-full text-[13px] border" style={{ borderColor: p.muted }}>The other one</span>
          </div>
        </div>
        <div className="px-5 py-3 flex items-center justify-between" style={{ background: p.surface }}>
          <span className="text-[12px]" style={{ color: p.muted }}>A raised panel, on the surface colour</span>
          <span className="w-2 h-2 rounded-full" style={{ background: p.accent }} />
        </div>
      </div>
    </div>
  );
}
