/**
 * Three directions, side by side, scrolling together.
 *
 * The hardest question in the whole flow is "what should it look like?", asked
 * of somebody who has never commissioned design. They cannot answer it,
 * because describing a design is a skill and recognising one is not. So this
 * screen stops asking: three complete directions, rendered from the real
 * site, in three frames that scroll as one. Point at the one you like.
 *
 * Each frame is the actual site at `?direction=<id>`, not a mock — what you
 * see is what picking it gives you, and picking it writes the tokens into the
 * same place the tune panel writes, so it stays adjustable afterwards.
 */

import { useEffect, useRef, useState } from 'react';
import type { Direction } from '@superbuilds/protocol';
import { api } from '@/lib/api';
import { toast } from '@/lib/store';
import { Button, Spinner, cx } from '@/components/ui';
import { Icon } from '@/components/icons';

export function Directions({ projectId, url, onClose }: { projectId: string; url?: string; onClose: () => void }) {
  const [list, setList] = useState<Direction[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [full, setFull] = useState<string | null>(null);
  const [sync, setSync] = useState(true);
  const [chosen, setChosen] = useState<string | null>(null);
  const frames = useRef<Array<HTMLIFrameElement | null>>([]);
  const nudging = useRef(false);

  useEffect(() => { void api.directions(projectId).then((r) => setList(r.directions)).catch(() => setList([])); }, [projectId]);

  // Scroll one, scroll all. Same-origin is not guaranteed across ports, so we
  // ask the frames to scroll and ignore the ones that refuse rather than
  // letting a cross-origin read throw on every wheel event.
  useEffect(() => {
    if (!sync) return;
    const onWheel = (e: WheelEvent) => {
      if (nudging.current) return;
      nudging.current = true;
      requestAnimationFrame(() => { nudging.current = false; });
      for (const f of frames.current) {
        try { f?.contentWindow?.scrollBy({ top: e.deltaY, behavior: 'auto' }); } catch { /* cross-origin */ }
      }
    };
    const host = document.getElementById('sb-directions');
    host?.addEventListener('wheel', onWheel, { passive: true });
    return () => host?.removeEventListener('wheel', onWheel);
  }, [sync, list]);

  const propose = async () => {
    setBusy(true);
    try {
      const r = await api.proposeDirections(projectId);
      setList(r.directions);
      toast('Three directions. Look at them, then pick one.', 'ok');
    } catch (e) { toast((e as Error).message, 'error'); }
    finally { setBusy(false); }
  };

  const choose = async (id: string) => {
    setBusy(true);
    try {
      await api.chooseDirection(projectId, id);
      setChosen(id);
      toast('Applied. You can keep tuning it in the Tune panel.', 'ok');
    } catch (e) { toast((e as Error).message, 'error'); }
    finally { setBusy(false); }
  };

  const src = (d: Direction) => (url ? `${url}${d.path}` : '');

  return (
    <div className="fixed inset-0 z-50 bg-ink flex flex-col">
      <header className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-line gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="legend">Directions</span>
          <span className="telemetry text-bone-4 truncate hidden md:inline">
            {list?.length ? 'the real site, three ways · click a name to see one full size' : 'nothing proposed yet'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {!!list?.length && (
            <label className="telemetry text-bone-3 flex items-center gap-1.5 cursor-pointer select-none mr-1">
              <input type="checkbox" checked={sync} onChange={(e) => setSync(e.target.checked)} className="accent-[#C8FF3D]" />
              sync scroll
            </label>
          )}
          <Button size="sm" variant="ghost" icon="refresh" busy={busy} onClick={propose}>
            {list?.length ? 'Propose again' : 'Propose three'}
          </Button>
          <Button size="sm" variant="quiet" icon="x" onClick={onClose}>Close</Button>
        </div>
      </header>

      {!url ? (
        <Centre>
          <Icon name="monitor" size={26} className="text-bone-4" />
          <p className="copy text-center mt-3">Start the preview first — the directions are the real site, not a drawing.</p>
        </Centre>
      ) : list === null ? (
        <Centre><Spinner className="text-volt" /></Centre>
      ) : !list.length ? (
        <Centre>
          <div className="max-w-[46ch] text-center">
            <div className="d3 mb-3">You cannot describe a design. You <span className="serif">can</span> point at one.</div>
            <p className="copy mx-auto text-center">
              Three complete directions, built from your site and shown side by side. Pick one and it
              becomes the look — still adjustable afterwards in Tune.
            </p>
            <Button variant="primary" className="mt-6" iconRight="arrowRight" busy={busy} onClick={propose}>Propose three</Button>
          </div>
        </Centre>
      ) : full ? (
        <FullOne
          d={list.find((x) => x.id === full)!}
          src={src(list.find((x) => x.id === full)!)}
          chosen={chosen}
          busy={busy}
          onBack={() => setFull(null)}
          onChoose={choose}
        />
      ) : (
        <div id="sb-directions" className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-px bg-line">
          {list.map((d, i) => (
            <article key={d.id} className="bg-ink flex flex-col min-h-0 relative">
              <div className="h-9 shrink-0 flex items-center gap-2 px-2.5 border-b border-line">
                <span className="flex gap-1 shrink-0">
                  {(d.swatch ?? []).map((c, k) => <span key={k} className="w-2.5 h-2.5 rounded-[3px] border border-line-2" style={{ background: c }} />)}
                </span>
                <button onClick={() => setFull(d.id)} className="telemetry text-bone hover:text-volt truncate shrink-0" title="See it full size">{d.name}</button>
                <span className="telemetry text-bone-4 truncate hidden xl:inline">{d.note}</span>
                <Button
                  size="sm"
                  variant={chosen === d.id ? 'ghost' : 'primary'}
                  className="ml-auto shrink-0"
                  busy={busy}
                  icon={chosen === d.id ? 'check' : undefined}
                  onClick={() => choose(d.id)}
                >
                  {chosen === d.id ? 'Using this' : 'Use this'}
                </Button>
              </div>
              <div className="flex-1 min-h-0 bg-white">
                <iframe
                  ref={(el) => { frames.current[i] = el; }}
                  src={src(d)}
                  title={d.name}
                  className="w-full h-full"
                />
              </div>
              {chosen === d.id && <span className="absolute inset-0 ring-1 ring-inset ring-volt pointer-events-none" />}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function FullOne({ d, src, chosen, busy, onBack, onChoose }: {
  d: Direction; src: string; chosen: string | null; busy: boolean; onBack: () => void; onChoose: (id: string) => void;
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="h-9 shrink-0 flex items-center gap-3 px-3 border-b border-line">
        <button onClick={onBack} className="telemetry text-bone-3 hover:text-bone inline-flex items-center gap-1.5">
          <Icon name="arrowLeft" size={12} /> All three
        </button>
        <span className="telemetry text-bone">{d.name}</span>
        <span className="telemetry text-bone-4 truncate">{d.note}</span>
        <Button size="sm" variant={chosen === d.id ? 'ghost' : 'primary'} className="ml-auto" busy={busy} onClick={() => onChoose(d.id)}>
          {chosen === d.id ? 'Using this' : 'Use this'}
        </Button>
      </div>
      <iframe src={src} title={d.name} className="flex-1 min-h-0 w-full bg-white" />
    </div>
  );
}

function Centre({ children }: { children: React.ReactNode }) {
  return <div className={cx('flex-1 min-h-0 grid place-items-center')}><div className="flex flex-col items-center">{children}</div></div>;
}
