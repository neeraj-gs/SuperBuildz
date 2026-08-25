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
 *
 * ── Why the captures are not this component's state any more ────────────────
 *
 * They used to be, and so pressing Next and then Back threw the whole reading
 * away: the component unmounted, its list of capture ids went with it, and the
 * effect that syncs finished captures into the draft then dutifully wrote back
 * "no references, no DNA". Losing a two-minute reading by looking at the next
 * screen is the kind of bug that makes somebody stop trusting the tool. The
 * ids now live in the draft beside everything else that survives, and are
 * re-fetched on mount; when even the daemon has forgotten a capture — a
 * restart, days later — what was extracted is still in the draft, and that is
 * what gets shown.
 */

import { useEffect, useState } from 'react';
import type { Catalogue, DesignDNA, DnaPart, ReferenceCapture, Spec } from '@superbuilds/protocol';
import { api } from '@/lib/api';
import { useStore, toast } from '@/lib/store';
import { Button, Input, Spinner, cx } from '@/components/ui';
import { Icon } from '@/components/icons';
import { PARTS, describes, hostOf, togglePart } from './dna';

/** A reference as the screen needs it: live if the daemon still has it, remembered if not. */
interface Ref { url: string; dna?: DesignDNA; capture?: ReferenceCapture }

export function ReferenceStep({ spec, setSpec, catalogue, captureIds, setCaptureIds }: {
  spec: Partial<Spec>;
  setSpec: React.Dispatch<React.SetStateAction<Partial<Spec> & { name: string; folder: string }>>;
  catalogue: Catalogue;
  captureIds: string[];
  setCaptureIds: (ids: string[]) => void;
}) {
  const [url, setUrl] = useState('');
  const [avail, setAvail] = useState<{ ok: boolean; reason?: string } | null>(null);
  const captures = useStore((s) => s.captures);

  useEffect(() => { void api.referenceAvailable().then(setAvail).catch(() => setAvail({ ok: false, reason: 'The daemon did not answer.' })); }, []);

  // Coming back to this screen: ask the daemon for each capture again, so the
  // pictures and the video are there rather than a blank card. A capture it no
  // longer has is not an error — the draft still holds what was extracted.
  useEffect(() => {
    for (const id of captureIds) {
      if (captures[id]) continue;
      api.captureState(id).then((c) => useStore.getState().apply({ type: 'reference.update', capture: c })).catch(() => {});
    }
  }, [captureIds]); // eslint-disable-line react-hooks/exhaustive-deps

  /*
    Finished captures fold their DNA into the draft.

    Only ever additive while a capture is missing: the previous version
    recomputed the whole list from whatever was in memory, which is how
    pressing Next and Back erased a reading the daemon had already done.
  */
  useEffect(() => {
    const done = captureIds.map((id) => captures[id]).filter((c): c is ReferenceCapture => c?.status === 'done' && !!c.dna);
    if (!done.length) return;
    const urls = done.map((c) => c.url);
    const dnas = done.map((c) => c.dna!);
    const same = urls.length === (spec.references?.length ?? 0) && urls.every((u, i) => spec.references?.[i] === u);
    if (!same) setSpec((s) => ({ ...s, references: urls, dna: dnas }));
  }, [captures, captureIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    const u = url.trim();
    if (!u) return;
    try {
      const cap = await api.capture(/^https?:\/\//i.test(u) ? u : `https://${u}`);
      setCaptureIds([...captureIds, cap.id].slice(-3));
      setUrl('');
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  const forget = (r: Ref, id?: string) => {
    if (id) setCaptureIds(captureIds.filter((x) => x !== id));
    setSpec((s) => {
      const keep = (s.references ?? []).map((u, i) => ({ u, d: s.dna?.[i] })).filter((x) => x.u !== r.url);
      return { ...s, references: keep.map((x) => x.u), dna: keep.map((x) => x.d).filter(Boolean) as DesignDNA[] };
    });
  };

  // Live captures first, then anything the draft remembers that they do not cover.
  const live: Array<Ref & { id: string }> = captureIds.map((id) => ({ id, url: captures[id]?.url ?? '', dna: captures[id]?.dna, capture: captures[id] }));
  const remembered: Ref[] = (spec.references ?? [])
    .map((u, i) => ({ url: u, dna: spec.dna?.[i] }))
    .filter((r) => !live.some((l) => l.url === r.url));

  const adopted = new Set(spec.adopted ?? []);
  const toggle = (dna: DesignDNA, part: DnaPart) => setSpec((s) => togglePart(s, dna, part));
  const takeAll = (dna: DesignDNA) => {
    for (const p of PARTS) if (!adopted.has(p.id) && describes(p.id, dna, catalogue)) toggle(dna, p.id);
  };

  const count = live.length + remembered.length;

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
        <Button variant="primary" icon="video" onClick={start} disabled={!url.trim() || count >= 3}>Look at it</Button>
      </div>
      <p className="text-[13px] text-bone-3 measure">
        Up to three. Each is screenshotted while scrolling, recorded, and read for its design DNA —
        colour, type, layout, motion, 3D. Then you choose which parts to carry across, and the rest
        of these questions open already answered.
      </p>

      {count === 0 && (
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

      {live.map(({ id, capture: c }) => {
        if (!c) return <div key={id} className="panel p-4 flex items-center gap-3"><Spinner /> Starting…</div>;
        const busy = c.status === 'capturing' || c.status === 'analysing';
        return (
          <div key={id} className="panel overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-line gap-3">
              <div className="flex items-center gap-2 min-w-0"><Icon name="link" size={14} className="text-bone-3 shrink-0" /><span className="telemetry truncate">{c.url}</span></div>
              <span className="flex items-center gap-2 shrink-0">
                <span className={cx('telemetry', c.status === 'failed' ? 'text-danger' : c.status === 'done' ? 'text-volt' : 'text-bone-2')}>
                  {c.status === 'capturing' && <span className="inline-flex items-center gap-2"><Spinner size={12} /> looking at it…</span>}
                  {c.status === 'analysing' && <span className="inline-flex items-center gap-2"><Spinner size={12} /> reading the design…</span>}
                  {c.status === 'done' && 'understood'}
                  {c.status === 'failed' && 'failed'}
                </span>
                {!busy && <button onClick={() => forget({ url: c.url }, id)} className="text-bone-4 hover:text-danger" title="Forget this reference"><Icon name="x" size={13} /></button>}
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

            {busy && (
              <p className="px-4 pb-4 text-[13px] text-bone-3 measure">
                Stay here until this finishes — what it finds fills in the twelve screens after this
                one, and moving on now would answer them from the defaults instead.
              </p>
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

      {remembered.map((r) => (
        <div key={r.url} className="panel overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line gap-3">
            <div className="flex items-center gap-2 min-w-0"><Icon name="link" size={14} className="text-bone-3 shrink-0" /><span className="telemetry truncate">{r.url}</span></div>
            <span className="flex items-center gap-2 shrink-0">
              <span className="telemetry text-bone-3">read earlier</span>
              <button onClick={() => forget(r)} className="text-bone-4 hover:text-danger" title="Forget this reference"><Icon name="x" size={13} /></button>
            </span>
          </div>
          {r.dna ? (
            <>
              <DnaCard dna={r.dna} />
              <Take dna={r.dna} catalogue={catalogue} adopted={adopted} onToggle={(p) => toggle(r.dna!, p)} onAll={() => takeAll(r.dna!)} />
            </>
          ) : (
            <p className="p-4 text-[13px] text-bone-3">The address is in the brief. Press “Look at it” again to re-read the design.</p>
          )}
        </div>
      ))}
    </div>
  );
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

/**
 * "The one your reference used", on the screen where it is the answer.
 *
 * Every design screen after the reference offers this band above its own
 * options: what that site did for *this* question, with its own picture beside
 * it, as a switch. It is the same `togglePart` the reference screen runs, so
 * pressing it here and pressing it there are the same act — and un-pressing it
 * hands the screen back to the catalogue.
 */
export function ReferenceBand({ spec, setSpec, catalogue, part, captureIds }: {
  spec: Partial<Spec>;
  setSpec: React.Dispatch<React.SetStateAction<Partial<Spec> & { name: string; folder: string }>>;
  catalogue: Catalogue;
  part: DnaPart;
  captureIds: string[];
}) {
  const captures = useStore((s) => s.captures);
  const dnas = spec.dna ?? [];
  if (!dnas.length) return null;

  const meta = PARTS.find((p) => p.id === part)!;
  const adopted = new Set(spec.adopted ?? []);
  const on = adopted.has(part);

  const cards = dnas
    .map((dna, i) => ({ dna, url: spec.references?.[i] ?? '', sets: describes(part, dna, catalogue) }))
    .filter((c) => c.sets);
  if (!cards.length) return null;

  // Whichever capture matches by address still has the pictures.
  const shotFor = (url: string) => Object.values(captures).find((c) => c.url === url)?.shots?.[1];

  return (
    <div className="panel overflow-hidden mb-6 border-volt-3/40">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-line bg-volt-2/40">
        <span className="legend text-volt">From the site you pointed at</span>
        <span className="telemetry text-bone-3 hidden sm:inline">{on ? 'in use — the options below are ignored' : 'off — the options below decide'}</span>
      </div>
      <div className="p-3 grid gap-2">
        {cards.map((c) => (
          <button
            key={c.url + part}
            type="button"
            data-on={on}
            onClick={() => setSpec((s) => togglePart(s, c.dna, part))}
            className="opt !p-3 flex items-center gap-3.5 text-left"
          >
            {shotFor(c.url) ? (
              <img src={shotFor(c.url)} alt="" className="w-[92px] h-[58px] object-cover object-top rounded-md border border-line shrink-0" />
            ) : (
              <span className="w-[92px] h-[58px] rounded-md border border-line bg-ink grid place-items-center shrink-0 text-bone-4"><Icon name={meta.icon} size={18} /></span>
            )}
            <span className="min-w-0 flex-1 pr-5">
              <span className="block font-semibold text-[14px] leading-tight">{meta.label.replace(/^Its /, 'The ')} from {hostOf(c.url)}</span>
              <span className="block telemetry text-volt mt-1 truncate">{on ? 'using' : 'would set'} · {c.sets}</span>
              {part === 'palette' && c.dna.customPalette && (
                <span className="flex gap-1 mt-1.5">
                  {Object.values(c.dna.customPalette).map((hex, i) => <span key={i} className="w-4 h-4 rounded-full border border-line-2" style={{ background: hex }} />)}
                </span>
              )}
            </span>
            <span className={cx('chip shrink-0 !cursor-pointer', on && '!border-volt-3 !bg-volt-2')}>{on ? 'Using it' : 'Use it'}</span>
          </button>
        ))}
        {captureIds.length === 0 && (
          <p className="telemetry text-bone-4 px-1">Read earlier — the pictures are gone, the reading is not.</p>
        )}
      </div>
    </div>
  );
}
