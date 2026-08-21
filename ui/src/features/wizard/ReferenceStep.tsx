/**
 * "Show me a site you like." Paste a URL, watch it being captured, scrub the
 * recording, read what was understood — and the card says what it will do:
 * something similar, not a copy.
 */

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useStore, toast } from '@/lib/store';
import { Button, Input, Spinner, cx } from '@/components/ui';
import { Icon } from '@/components/icons';
import type { DesignDNA } from '@superbuilds/protocol';

export function ReferenceStep({ urls, dna, onChange }: { urls: string[]; dna: DesignDNA[]; onChange: (urls: string[], dna: DesignDNA[]) => void }) {
  const [url, setUrl] = useState('');
  const [captureIds, setCaptureIds] = useState<string[]>([]);
  const [avail, setAvail] = useState<{ ok: boolean; reason?: string } | null>(null);
  const captures = useStore((s) => s.captures);
  useEffect(() => { void api.referenceAvailable().then(setAvail).catch(() => setAvail({ ok: false, reason: 'The daemon did not answer.' })); }, []);

  // When a capture finishes, fold its DNA into the spec.
  useEffect(() => {
    const done = captureIds.map((id) => captures[id]).filter((c) => c?.status === 'done' && c.dna);
    const nextDna = done.map((c) => c!.dna!);
    const nextUrls = done.map((c) => c!.url);
    if (nextDna.length !== dna.length || nextUrls.some((u, i) => urls[i] !== u)) onChange(nextUrls, nextDna);
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

  return (
    <div className="space-y-5">
      {avail && !avail.ok && (
        <div className="panel p-4 flex items-start gap-3 border-danger/40"><Icon name="alert" size={18} className="text-danger mt-0.5" /><div className="text-[13.5px]"><div className="font-semibold">Capture is not available yet.</div><div className="text-bone-3">{avail.reason} You can still paste the address; it goes into the brief as a name to look at.</div></div></div>
      )}
      <div className="flex gap-2">
        <Input placeholder="https://a-site-you-admire.com" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void start(); }} />
        <Button variant="primary" icon="video" onClick={start} disabled={!url.trim() || captureIds.length >= 3}>Look at it</Button>
      </div>
      <p className="text-[13px] text-bone-3">Up to three. It will be screenshotted while scrolling, recorded, and read by Claude for its design DNA — palette, type, layout, motion, 3D. The brief then says: build something that shares these qualities, not a recognisable copy.</p>

      {captureIds.map((id) => {
        const c = captures[id];
        if (!c) return <div key={id} className="panel p-4 flex items-center gap-3"><Spinner /> Starting…</div>;
        return (
          <div key={id} className="panel overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-line">
              <div className="flex items-center gap-2 min-w-0"><Icon name="link" size={14} className="text-bone-3" /><span className="telemetry truncate">{c.url}</span></div>
              <span className={cx('telemetry', c.status === 'failed' ? 'text-danger' : c.status === 'done' ? 'text-volt' : 'text-bone-2')}>
                {c.status === 'capturing' && <span className="inline-flex items-center gap-2"><Spinner size={12} /> capturing…</span>}
                {c.status === 'analysing' && <span className="inline-flex items-center gap-2"><Spinner size={12} /> reading the design…</span>}
                {c.status === 'done' && 'understood'}
                {c.status === 'failed' && 'failed'}
              </span>
            </div>
            {c.shots.length > 0 && (
              <div className="grid grid-cols-5 gap-1 p-2 bg-ink-3">
                {c.shots.map((s) => <img key={s} src={s} alt="" className="aspect-[16/10] object-cover object-top rounded border border-line" />)}
              </div>
            )}
            {c.video && <video src={c.video} controls muted className="w-full max-h-[260px] bg-black" />}
            {c.error && <div className="p-4 text-[13px] text-danger">{c.error}</div>}
            {c.dna && <DnaCard dna={c.dna} />}
          </div>
        );
      })}
    </div>
  );
}

function DnaCard({ dna }: { dna: DesignDNA }) {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-start gap-3"><Icon name="sparkle" size={18} className="text-volt mt-0.5 shrink-0" /><div><div className="font-semibold">Understood. I'll build something similar — not a copy.</div><p className="text-[13.5px] text-bone-2 mt-1">{dna.summary}</p></div></div>
      <div className="flex flex-wrap gap-1.5 items-center">{dna.palette.slice(0, 6).map((c, i) => { const hex = c.match(/#[0-9a-f]{3,8}/i)?.[0]; return <span key={i} className="inline-flex items-center gap-1.5 telemetry text-bone-2 border border-line rounded-full pl-1 pr-2 py-0.5">{hex && <span className="w-3.5 h-3.5 rounded-full border border-line-2" style={{ background: hex }} />}{c}</span>; })}</div>
      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
        {[['Type', `${dna.typography.display} over ${dna.typography.body}. ${dna.typography.scale}`], ['Layout', dna.layout], ['Motion', dna.motion], ['3D', dna.threeD], ['Hero', dna.hero]].map(([k, v]) => <div key={k}><dt className="legend !text-[10px]">{k}</dt><dd className="text-bone-2">{v}</dd></div>)}
      </dl>
      <div className="grid sm:grid-cols-2 gap-4 text-[13px]">
        <div><div className="legend !text-[10px] mb-1 text-volt">Keep the spirit of</div><ul className="list-disc pl-4 text-bone-2 space-y-0.5">{dna.keep.map((k) => <li key={k}>{k}</li>)}</ul></div>
        <div><div className="legend !text-[10px] mb-1 text-danger">Will not copy</div><ul className="list-disc pl-4 text-bone-2 space-y-0.5">{dna.avoid.map((k) => <li key={k}>{k}</li>)}</ul></div>
      </div>
    </div>
  );
}
