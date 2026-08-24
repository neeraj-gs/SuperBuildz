/**
 * "Show me a site you like" — asked first, because it answers everything after it.
 *
 * ── Why this moved to the front ─────────────────────────────────────────────
 *
 * It used to be the fifteenth screen, which is exactly backwards. By then the
 * person had already chosen a palette, a typeface, a layout and a scene by
 * reading blurbs about them, and the one thing that would have made those
 * choices easy — a site they could point at — arrived after the work was done.
 * Now it is the first thing asked, and what it extracts pre-selects the twelve
 * screens that follow. Everything after this starts already answered, which is
 * the same promise "what are you making?" makes about the rest.
 *
 * ── Extract, then choose ────────────────────────────────────────────────────
 *
 * The capture takes screenshots while scrolling, records the scroll, and reads
 * all of it. What comes back is deliberately two things: prose about what the
 * site is doing, which the person reads, and the nearest option in our own
 * catalogue for each choice, which becomes a row of switches. Nothing is
 * adopted until a switch is pressed. That is the difference between "here is a
 * site that looks like theirs" — which is theft and also boring — and "I liked
 * the way that one moved, and nothing else about it".
 */

import { useEffect, useState } from 'react';
import type { Catalogue, DesignDNA, DnaPart, Spec } from '@superbuilds/protocol';
import { api } from '@/lib/api';
import { useStore, toast } from '@/lib/store';
import { Button, Input, Spinner, cx } from '@/components/ui';
import { Icon } from '@/components/icons';

/** What can be taken, what it sets, and how to say it in one line. */
const PARTS: Array<{ id: DnaPart; label: string; icon: string; blurb: string }> = [
  { id: 'palette', label: 'Its colours', icon: 'palette', blurb: 'The five it actually uses, sampled — yours to drag afterwards' },
  { id: 'typography', label: 'Its typography', icon: 'type', blurb: 'The nearest pairing in the catalogue, not the same fonts' },
  { id: 'atmosphere', label: 'How it feels', icon: 'sparkle', blurb: 'The mood, which decides far more than the colours do' },
  { id: 'layout', label: 'How it is organised', icon: 'layout', blurb: 'The grid and the rhythm of the page' },
  { id: 'scene', label: 'Its 3D', icon: 'cube', blurb: 'The kind of scene, adapted to your business' },
  { id: 'motion', label: 'How it moves', icon: 'mouse', blurb: 'Intensity, scroll, hover, cursor and transitions together' },
  { id: 'signature', label: 'Its one memorable move', icon: 'bolt', blurb: 'The thing you would describe to somebody afterwards' },
];

export function ReferenceStep({ spec, setSpec, catalogue }: {
  spec: Partial<Spec>;
  setSpec: React.Dispatch<React.SetStateAction<Partial<Spec> & { name: string; folder: string }>>;
  catalogue: Catalogue;
}) {
  const [url, setUrl] = useState('');
  const [captureIds, setCaptureIds] = useState<string[]>([]);
  const [avail, setAvail] = useState<{ ok: boolean; reason?: string } | null>(null);
  const captures = useStore((s) => s.captures);
  const urls = spec.references ?? [];
  const dnas = spec.dna ?? [];

  useEffect(() => { void api.referenceAvailable().then(setAvail).catch(() => setAvail({ ok: false, reason: 'The daemon did not answer.' })); }, []);

  // A finished capture folds its DNA into the spec. Nothing is *adopted* here —
  // the DNA travels into the brief as context regardless, and the switches
  // below decide what actually pre-selects a screen.
  useEffect(() => {
    const done = captureIds.map((id) => captures[id]).filter((c) => c?.status === 'done' && c.dna);
    const nextDna = done.map((c) => c!.dna!);
    const nextUrls = done.map((c) => c!.url);
    if (nextDna.length !== dnas.length || nextUrls.some((u, i) => urls[i] !== u)) {
      setSpec((s) => ({ ...s, references: nextUrls, dna: nextDna }));
    }
  }, [captures, captureIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    const u = url.trim();
    if (!u) return;
    try {
      const cap = await api.capture(/^https?:\/\//i.test(u) ? u : `https://${u}`);
      setCaptureIds((ids) => [...ids, cap.id].slice(-3));
      setUrl('');
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  const adopted = new Set(spec.adopted ?? []);

  /**
   * Applying a part writes real spec fields, so the screen it belongs to opens
   * with the answer already chosen and a note saying where it came from.
   */
  const toggle = (dna: DesignDNA, part: DnaPart) => {
    const on = adopted.has(part);
    const sug = dna.suggests ?? {};
    setSpec((s) => {
      const next = { ...s };
      const list = new Set(s.adopted ?? []);
      if (on) list.delete(part); else list.add(part);
      next.adopted = [...list];

      if (part === 'palette') {
        if (on) next.customPalette = undefined;
        else { next.customPalette = dna.customPalette; if (sug.palette) next.palette = sug.palette; }
      }
      if (part === 'typography' && sug.typography) next.typography = on ? s.typography : sug.typography;
      if (part === 'atmosphere' && sug.atmosphere) next.atmosphere = on ? s.atmosphere : sug.atmosphere;
      if (part === 'layout' && sug.layout) next.layout = on ? s.layout : sug.layout;
      if (part === 'scene' && sug.scene) next.scene = on ? s.scene : sug.scene;
      if (part === 'motion' && !on) {
        if (sug.motionIntensity) next.motionIntensity = sug.motionIntensity;
        if (sug.scrollStyle) next.scrollStyle = sug.scrollStyle;
        if (sug.hoverStyle) next.hoverStyle = sug.hoverStyle;
        if (sug.cursorStyle) next.cursorStyle = sug.cursorStyle;
        if (sug.transition) next.transition = sug.transition;
      }
      if (part === 'signature') next.signature = on ? undefined : sug.signature;
      return next;
    });
  };

  const takeAll = (dna: DesignDNA) => {
    for (const p of PARTS) if (!adopted.has(p.id) && describes(p.id, dna, catalogue)) toggle(dna, p.id);
  };

  return (
    <div className="space-y-5">
      {avail && !avail.ok && (
        <div className="panel p-4 flex items-start gap-3 border-danger/40">
          <Icon name="alert" size={18} className="text-danger mt-0.5 shrink-0" />
          <div className="text-[13.5px]">
            <div className="font-semibold">Looking at a site is not available yet.</div>
            <div className="text-bone-3">{avail.reason} You can still paste the address; it goes into the brief as a name to look at.</div>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Input placeholder="https://a-site-you-admire.com" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void start(); }} autoFocus />
        <Button variant="primary" icon="video" onClick={start} disabled={!url.trim() || captureIds.length >= 3}>Look at it</Button>
      </div>
      <p className="text-[13px] text-bone-3 measure">
        Up to three. Each is screenshotted while scrolling, recorded, and read for its design DNA —
        colour, type, layout, motion, 3D. Then you choose which parts to carry across, and the rest
        of these questions open already answered.
      </p>

      {captureIds.length === 0 && (
        <div className="panel p-5 grid sm:grid-cols-3 gap-4">
          {[
            ['Screenshots', 'video', 'Five, at successive scroll positions, so scroll-triggered work actually triggers'],
            ['A recording', 'play', 'The same scroll as video, so you can see what it was reading'],
            ['The design DNA', 'sparkle', 'Palette, type, layout, motion and 3D, each mapped to an option here'],
          ].map(([title, icon, blurb]) => (
            <div key={title as string}>
              <Icon name={icon as string} size={16} className="text-volt" />
              <div className="font-semibold text-[13.5px] mt-2">{title}</div>
              <div className="text-[12.5px] text-bone-3 leading-snug mt-0.5">{blurb}</div>
            </div>
          ))}
        </div>
      )}

      {captureIds.map((id) => {
        const c = captures[id];
        if (!c) return <div key={id} className="panel p-4 flex items-center gap-3"><Spinner /> Starting…</div>;
        return (
          <div key={id} className="panel overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-line gap-3">
              <div className="flex items-center gap-2 min-w-0"><Icon name="link" size={14} className="text-bone-3 shrink-0" /><span className="telemetry truncate">{c.url}</span></div>
              <span className={cx('telemetry shrink-0', c.status === 'failed' ? 'text-danger' : c.status === 'done' ? 'text-volt' : 'text-bone-2')}>
                {c.status === 'capturing' && <span className="inline-flex items-center gap-2"><Spinner size={12} /> looking at it…</span>}
                {c.status === 'analysing' && <span className="inline-flex items-center gap-2"><Spinner size={12} /> reading the design…</span>}
                {c.status === 'done' && 'understood'}
                {c.status === 'failed' && 'failed'}
              </span>
            </div>

            {c.shots.length > 0 && (
              <div>
                <div className="legend px-4 pt-3">What it saw</div>
                <div className="grid grid-cols-5 gap-1 p-2">
                  {c.shots.map((s) => (
                    <a key={s} href={s} target="_blank" rel="noreferrer" className="block rounded border border-line overflow-hidden hover:border-volt-3">
                      <img src={s} alt="" className="aspect-[16/10] object-cover object-top w-full" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {c.video && (
              <div className="px-2 pb-2">
                <div className="legend px-2 pb-1.5">The scroll it recorded</div>
                <video src={c.video} controls muted loop playsInline className="w-full max-h-[280px] bg-black rounded-lg border border-line" />
              </div>
            )}

            {c.error && <div className="p-4 text-[13px] text-danger">{c.error}</div>}
            {c.dna && (
              <>
                <DnaCard dna={c.dna} />
                <Take dna={c.dna} catalogue={catalogue} adopted={adopted} onToggle={(p) => toggle(c.dna!, p)} onAll={() => takeAll(c.dna!)} />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** What a part would set, in the catalogue's own words. Absent means nothing to take. */
function describes(part: DnaPart, dna: DesignDNA, catalogue: Catalogue): string | undefined {
  const s = dna.suggests ?? {};
  const name = (list: { id: string; label: string }[], id?: string) => (id ? list.find((c) => c.id === id)?.label : undefined);
  switch (part) {
    case 'palette': return dna.customPalette ? 'its own five colours' : name(catalogue.palettes, s.palette);
    case 'typography': return name(catalogue.typography, s.typography);
    case 'atmosphere': return name(catalogue.atmospheres, s.atmosphere);
    case 'layout': return name(catalogue.layouts, s.layout);
    case 'scene': return name(catalogue.scenes, s.scene);
    case 'motion': {
      const parts = [name(catalogue.motionIntensity, s.motionIntensity), name(catalogue.scrollStyles, s.scrollStyle), name(catalogue.hoverStyles, s.hoverStyle)].filter(Boolean);
      return parts.length ? parts.join(' · ') : undefined;
    }
    case 'signature': return s.signature ? (catalogue.signatures.find((x) => x.id === s.signature)?.label ?? s.signature) : undefined;
  }
}

function Take({ dna, catalogue, adopted, onToggle, onAll }: {
  dna: DesignDNA; catalogue: Catalogue; adopted: Set<string>; onToggle: (p: DnaPart) => void; onAll: () => void;
}) {
  const available = PARTS.map((p) => ({ ...p, sets: describes(p.id, dna, catalogue) })).filter((p) => p.sets);
  if (!available.length) {
    return <p className="px-4 pb-4 text-[13px] text-bone-3">Nothing here maps cleanly onto an option — the notes above still go into the brief.</p>;
  }
  return (
    <div className="px-4 pb-4">
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div>
          <div className="legend">Take from this site</div>
          <p className="text-[12.5px] text-bone-3 mt-0.5">Each one pre-selects a later screen. You can change any of them there.</p>
        </div>
        <Button size="sm" variant="quiet" icon="check" onClick={onAll}>Take all of it</Button>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {available.map((p) => {
          const on = adopted.has(p.id);
          return (
            <button key={p.id} type="button" data-on={on} onClick={() => onToggle(p.id)} className="opt !py-2.5 !px-3.5">
              <div className="flex items-start gap-3">
                <span className={cx('grid place-items-center rounded-lg shrink-0 mt-0.5 w-8 h-8', on ? 'bg-volt text-ink' : 'bg-ink-3 text-bone-2')}><Icon name={p.icon} size={16} /></span>
                <div className="min-w-0 pr-4">
                  <div className="font-semibold text-[14px] leading-tight">{p.label}</div>
                  <div className="text-[12.5px] text-bone-3 leading-snug mt-0.5">{p.blurb}</div>
                  <div className="telemetry text-volt mt-1 truncate">{on ? 'taking' : 'would set'} · {p.sets}</div>
                  {p.id === 'palette' && dna.customPalette && (
                    <span className="flex gap-1 mt-1.5">
                      {Object.values(dna.customPalette).map((hex, i) => <span key={i} className="w-4 h-4 rounded-full border border-line-2" style={{ background: hex }} />)}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DnaCard({ dna }: { dna: DesignDNA }) {
  return (
    <div className="p-4 space-y-3 border-t border-line">
      <div className="flex items-start gap-3">
        <Icon name="sparkle" size={18} className="text-volt mt-0.5 shrink-0" />
        <div>
          <div className="font-semibold">Understood. Something similar — never a copy.</div>
          <p className="text-[13.5px] text-bone-2 mt-1">{dna.summary}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 items-center">
        {dna.palette.slice(0, 6).map((c, i) => {
          const hex = c.match(/#[0-9a-f]{3,8}/i)?.[0];
          return <span key={i} className="inline-flex items-center gap-1.5 telemetry text-bone-2 border border-line rounded-full pl-1 pr-2 py-0.5">{hex && <span className="w-3.5 h-3.5 rounded-full border border-line-2" style={{ background: hex }} />}{c}</span>;
        })}
      </div>
      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
        {[['Type', `${dna.typography.display} over ${dna.typography.body}. ${dna.typography.scale}`], ['Layout', dna.layout], ['Motion', dna.motion], ['3D', dna.threeD], ['Hero', dna.hero]].map(([k, v]) => (
          <div key={k}><dt className="legend !text-[10px]">{k}</dt><dd className="text-bone-2">{v}</dd></div>
        ))}
      </dl>
      <div className="grid sm:grid-cols-2 gap-4 text-[13px]">
        <div><div className="legend !text-[10px] mb-1 text-volt">Keep the spirit of</div><ul className="list-disc pl-4 text-bone-2 space-y-0.5">{dna.keep.map((k) => <li key={k}>{k}</li>)}</ul></div>
        <div><div className="legend !text-[10px] mb-1 text-danger">Will not copy</div><ul className="list-disc pl-4 text-bone-2 space-y-0.5">{dna.avoid.map((k) => <li key={k}>{k}</li>)}</ul></div>
      </div>
    </div>
  );
}
