/**
 * Design by dragging.
 *
 * The product's promise is that somebody who does not write code can change
 * how their site looks. Chat can do anything, but a turn costs thirty seconds
 * and some usage, and "a bit more space between the sections" is not a
 * sentence most people enjoy composing. A slider is instant, free, reversible
 * — and, the part that actually matters, it lets you *find* what you wanted by
 * moving it, which is how people choose when they lack the vocabulary.
 *
 * Every control writes into the project's `design.tweaks.json`; Next hot-
 * reloads and the preview beside this panel changes under the person's hand.
 */

import { useEffect, useRef, useState } from 'react';
import type { TweakControl, TweakState, Tweaks } from '@superbuilds/protocol';
import { api } from '@/lib/api';
import { useStore, toast } from '@/lib/store';
import { Button, cx } from '@/components/ui';
import { Icon } from '@/components/icons';

const GROUPS = ['Colour', 'Type', 'Space', 'Motion', 'Texture'] as const;

export function TweakPanel({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const pushed = useStore((s) => s.tweaks[projectId]);
  const [state, setState] = useState<TweakState | undefined>(pushed);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  // Drags fire continuously; the file write is debounced so a slider does not
  // rewrite the project sixty times a second.
  const pending = useRef<Record<string, unknown>>({});
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => { void api.tweaks(projectId).then(setState).catch((e) => toast(e.message, 'error')); }, [projectId]);
  useEffect(() => { if (pushed) setState((s) => (s ? { ...s, values: pushed.values } : pushed)); }, [pushed]);

  if (!state) {
    return (
      <aside className="w-[290px] xl:w-[320px] shrink-0 border-l border-line bg-ink-2 grid place-items-center text-bone-3">
        <span className="telemetry">reading the tokens…</span>
      </aside>
    );
  }

  const value = (k: keyof Tweaks) => state.values[k] ?? state.designed[k];
  const isSet = (k: keyof Tweaks) => state.values[k] !== undefined;

  const flush = async () => {
    const values = pending.current;
    pending.current = {};
    if (!Object.keys(values).length) return;
    try { setState(await api.setTweaks(projectId, values)); }
    catch (e) { toast((e as Error).message, 'error'); }
  };

  const change = (k: keyof Tweaks, v: number | string | null) => {
    // Show it immediately; write it shortly.
    setState((s) => {
      if (!s) return s;
      const values = { ...s.values };
      if (v === null) delete values[k]; else (values as Record<string, unknown>)[k] = v;
      return { ...s, values };
    });
    pending.current[k] = v;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), 220);
  };

  const applyPreset = async (id: string) => {
    const preset = state.presets.find((p) => p.id === id);
    if (!preset) return;
    setBusy(true);
    try { setState(await api.setTweaks(projectId, preset.values, true)); toast(`${preset.label} — ${preset.blurb}`, 'ok'); }
    catch (e) { toast((e as Error).message, 'error'); }
    finally { setBusy(false); }
  };

  const shuffle = async () => {
    setBusy(true);
    try { setState(await api.shuffleTweaks(projectId)); }
    catch (e) { toast((e as Error).message, 'error'); }
    finally { setBusy(false); }
  };

  const q = filter.trim().toLowerCase();
  const shown = (c: TweakControl) => !q || c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q);
  const changed = Object.keys(state.values).length;

  return (
    <aside className="w-[290px] xl:w-[320px] shrink-0 border-l border-line bg-ink-2 flex flex-col min-h-0 overflow-x-hidden">
      <header className="h-11 shrink-0 flex items-center justify-between px-3 border-b border-line">
        <span className="legend">Tune</span>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="quiet" icon="x" onClick={onClose} title="Close the panel" />
        </div>
      </header>

      <div className="px-3 py-2.5 border-b border-line space-y-2">
        <input
          className="input !h-8 !text-[13px]"
          placeholder="Find a control…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="flex flex-wrap gap-1.5">
          {state.presets.map((p) => (
            <button
              key={p.id}
              title={p.blurb}
              disabled={busy}
              onClick={() => applyPreset(p.id)}
              className="chip !h-7 !px-2.5 !text-[12px]"
            >
              {p.label}
            </button>
          ))}
          <button title="A different palette, still a palette" disabled={busy} onClick={shuffle} className="chip !h-7 !px-2.5 !text-[12px]">
            <Icon name="refresh" size={12} /> Shuffle
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {GROUPS.map((group) => {
          const controls = state.controls.filter((c) => c.group === group && shown(c));
          if (!controls.length) return null;
          const open = !collapsed[group];
          return (
            <section key={group} className="border-b border-line">
              <button
                onClick={() => setCollapsed((c) => ({ ...c, [group]: open }))}
                className="w-full flex items-center justify-between px-3 h-8 hover:bg-ink-3 transition-colors"
              >
                <span className="legend">{group}</span>
                <Icon name="chevronDown" size={13} className={cx('text-bone-4 transition-transform', !open && '-rotate-90')} />
              </button>
              {open && (
                <div className="px-3 pb-3 space-y-2.5">
                  {controls.map((c) =>
                    c.kind === 'colour' ? (
                      <Swatch key={c.key} c={c} value={String(value(c.key) ?? '#000000')} on={isSet(c.key)} onChange={(v) => change(c.key, v)} onReset={() => change(c.key, null)} />
                    ) : (
                      <Slider key={c.key} c={c} value={Number(value(c.key) ?? 0)} on={isSet(c.key)} onChange={(v) => change(c.key, v)} onReset={() => change(c.key, null)} />
                    ),
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <footer className="shrink-0 border-t border-line px-3 py-2.5 flex items-center justify-between gap-2">
        <span className="telemetry text-bone-4">{changed ? `${changed} changed` : 'as designed'}</span>
        <Button
          size="sm"
          variant="quiet"
          icon="undo"
          disabled={!changed || busy}
          onClick={() => applyPreset('designed')}
        >
          Reset all
        </Button>
      </footer>
    </aside>
  );
}

function Row({ c, on, onReset, children, readout }: {
  c: TweakControl; on: boolean; onReset: () => void; children: React.ReactNode; readout: string;
}) {
  return (
    <div title={c.hint}>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-[12.5px] text-bone-2 truncate flex items-center gap-1.5">
          {on && <span className="w-1 h-1 rounded-full bg-volt shrink-0" />}
          {c.label}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          <span className="telemetry text-bone-4 !text-[11px]">{readout}</span>
          {on && (
            <button onClick={onReset} title="Back to the designed value" className="text-bone-4 hover:text-bone">
              <Icon name="undo" size={11} />
            </button>
          )}
        </span>
      </div>
      {children}
    </div>
  );
}

function Slider({ c, value, on, onChange, onReset }: {
  c: TweakControl; value: number; on: boolean; onChange: (v: number) => void; onReset: () => void;
}) {
  const decimals = (c.step ?? 1) < 0.01 ? 3 : (c.step ?? 1) < 1 ? 2 : 0;
  return (
    <Row c={c} on={on} onReset={onReset} readout={`${value.toFixed(decimals)}${c.unit ?? ''}`}>
      <input
        type="range"
        className="slider"
        min={c.min}
        max={c.max}
        step={c.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Row>
  );
}

function Swatch({ c, value, on, onChange, onReset }: {
  c: TweakControl; value: string; on: boolean; onChange: (v: string) => void; onReset: () => void;
}) {
  return (
    <Row c={c} on={on} onReset={onReset} readout={value.toUpperCase()}>
      <label className="flex items-center gap-2 cursor-pointer">
        <span className="h-6 flex-1 rounded-md border border-line-2" style={{ background: value }} />
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-6 h-6 rounded-md bg-transparent border border-line-2 cursor-pointer p-0" />
      </label>
    </Row>
  );
}
