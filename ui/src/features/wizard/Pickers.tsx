/** The three ways of choosing: one of, many of, a swatch. Every option is a card. */

import type { Choice } from '@superbuilds/protocol';
import { Icon } from '@/components/icons';
import { cx } from '@/components/ui';

export function PickOne({ options, value, onChange, cols = 2, compact, renderExtra }: {
  options: Choice[]; value?: string; onChange: (id: string) => void; cols?: 1 | 2 | 3 | 4; compact?: boolean; renderExtra?: (c: Choice) => React.ReactNode;
}) {
  return (
    <div className={cx('grid gap-2.5', cols === 1 && 'grid-cols-1', cols === 2 && 'grid-cols-1 sm:grid-cols-2', cols === 3 && 'grid-cols-2 lg:grid-cols-3', cols === 4 && 'grid-cols-2 lg:grid-cols-4')}>
      {options.map((c) => (
        <button key={c.id} type="button" data-on={value === c.id} onClick={() => onChange(c.id)} className={cx('opt', compact && '!py-2.5 !px-3.5')}>
          <div className="flex items-start gap-3">
            {c.icon && <span className={cx('grid place-items-center rounded-lg shrink-0 mt-0.5', value === c.id ? 'bg-volt text-ink' : 'bg-ink-3 text-bone-2', compact ? 'w-8 h-8' : 'w-10 h-10')}><Icon name={c.icon} size={compact ? 16 : 20} /></span>}
            <div className="min-w-0 pr-4">
              <div className={cx('font-semibold leading-tight', compact ? 'text-[14px]' : 'text-[15px]')}>{c.label}</div>
              {c.blurb && <div className="text-[12.5px] text-bone-3 mt-1 leading-snug">{c.blurb}</div>}
              {c.caveat && <div className="text-[11.5px] text-bone-4 mt-1.5 leading-snug">{c.caveat}</div>}
              {renderExtra?.(c)}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

export function PickMany({ options, value, onChange, cols = 2, compact }: { options: Choice[]; value: string[]; onChange: (ids: string[]) => void; cols?: 2 | 3 | 4; compact?: boolean }) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className={cx('grid gap-2.5', cols === 2 && 'grid-cols-1 sm:grid-cols-2', cols === 3 && 'grid-cols-2 lg:grid-cols-3', cols === 4 && 'grid-cols-2 lg:grid-cols-4')}>
      {options.map((c) => {
        const on = value.includes(c.id);
        return (
          <button key={c.id} type="button" data-on={on} onClick={() => toggle(c.id)} className={cx('opt', compact && '!py-2.5 !px-3.5')}>
            <div className="flex items-start gap-3">
              {c.icon && <span className={cx('grid place-items-center rounded-lg shrink-0 mt-0.5', on ? 'bg-volt text-ink' : 'bg-ink-3 text-bone-2', compact ? 'w-8 h-8' : 'w-10 h-10')}><Icon name={c.icon} size={compact ? 16 : 20} /></span>}
              <div className="min-w-0 pr-4">
                <div className={cx('font-semibold leading-tight', compact ? 'text-[14px]' : 'text-[15px]')}>{c.label}</div>
                {c.blurb && <div className="text-[12.5px] text-bone-3 mt-1 leading-snug">{c.blurb}</div>}
                {c.caveat && <div className="text-[11.5px] text-bone-4 mt-1.5 leading-snug">{c.caveat}</div>}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function ChipMany({ options, value, onChange }: { options: Choice[]; value: string[]; onChange: (ids: string[]) => void }) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((c) => {
        const on = value.includes(c.id);
        return <button key={c.id} type="button" onClick={() => toggle(c.id)} className={cx('chip', on && '!border-volt bg-volt-2')}>{on && <Icon name="check" size={12} className="text-volt" />}{c.label}</button>;
      })}
    </div>
  );
}

export function PickSwatch({ options, value, onChange }: { options: Choice[]; value?: string; onChange: (id: string) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
      {options.map((c) => {
        const [bg, fg, accent, muted, surface] = c.swatch ?? [];
        const on = value === c.id;
        return (
          <button key={c.id} type="button" data-on={on} onClick={() => onChange(c.id)} className="opt !p-0 overflow-hidden">
            <div className="h-[78px] relative" style={{ background: bg }}>
              <div className="absolute left-3 top-3 right-3 h-2 rounded" style={{ background: fg, opacity: 0.9, width: '55%' }} />
              <div className="absolute left-3 top-7 h-1.5 rounded" style={{ background: muted, width: '38%' }} />
              <div className="absolute left-3 bottom-3 h-6 w-16 rounded-full" style={{ background: accent }} />
              <div className="absolute right-3 bottom-3 h-10 w-14 rounded" style={{ background: surface, border: `1px solid ${muted}40` }} />
            </div>
            <div className="px-3.5 py-2.5 flex items-center justify-between">
              <span><span className="font-semibold text-[14px]">{c.label}</span>{c.blurb && <span className="block text-[12px] text-bone-3">{c.blurb}</span>}</span>
              <span className="flex gap-1">{(c.swatch ?? []).slice(0, 3).map((s, i) => <span key={i} className="w-3 h-3 rounded-full border border-line-2" style={{ background: s }} />)}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
