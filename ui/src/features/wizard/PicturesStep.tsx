/**
 * Where the pictures come from — or what to do instead.
 *
 * ── Three ways to have photographs ──────────────────────────────────────────
 *
 * This used to accept exactly one: type the path of a folder on this machine.
 * That is right for somebody with a Pictures directory of their own shots and
 * useless for everybody else — the person holding a phone, the person with four
 * images already on their Instagram, the person who was sent a Drive link. So
 * there are three ways in now, and all three land in the same staging folder,
 * which the scaffold copies from exactly as before. One code path afterwards.
 *
 * Nothing is uploaded anywhere: a drop goes to the daemon on loopback, a link
 * is fetched by the daemon, and both are written to this disk.
 *
 * ── "Nothing yet" is still the important answer ─────────────────────────────
 *
 * Most people have no usable photographs and saying so is a design brief, not
 * an apology. A site with no photography is not a site with holes in it — it is
 * a site that has to be built out of type, colour, rule and the 3D scene, and
 * deciding that here is the difference between a considered page and a grid of
 * empty rounded rectangles.
 */

import { useEffect, useRef, useState } from 'react';
import type { Catalogue, Spec } from '@superbuilds/protocol';
import { api } from '@/lib/api';
import { toast } from '@/lib/store';
import { Button, Input, Spinner, cx } from '@/components/ui';
import { Icon } from '@/components/icons';
import { PickMany, PickOne } from './Pickers';

type Draft = Partial<Spec> & { name: string; folder: string };
type Source = 'drop' | 'folder' | 'link';

const SOURCES: Array<{ id: Source; label: string; icon: string; blurb: string }> = [
  { id: 'drop', label: 'Choose them here', icon: 'image', blurb: 'Drag them in, or pick them from your machine' },
  { id: 'folder', label: 'Point at a folder', icon: 'folder', blurb: 'Everything usable in it is copied into the project' },
  { id: 'link', label: 'Give me links', icon: 'link', blurb: 'Direct image addresses — they are fetched and saved' },
];

export function PicturesStep({ spec, setSpec, catalogue }: { spec: Draft; setSpec: React.Dispatch<React.SetStateAction<Draft>>; catalogue: Catalogue }) {
  const im = spec.imagery ?? { kind: 'none' as const, instead: [] };
  const patch = (v: Partial<typeof im>) => setSpec((s) => ({ ...s, imagery: { ...im, ...v } }));

  const [source, setSource] = useState<Source>('drop');
  const [found, setFound] = useState<{ ok: boolean; count: number; sample: string[]; reason?: string } | null>(null);
  const [staged, setStaged] = useState<Array<{ name: string; size: number }>>([]);
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // A staging folder is made the first time it is needed, not on mount: most
  // people answer "none" and should leave no trace on disk at all.
  const stagingFolder = useRef<string | undefined>(im.folder && im.folder.includes('uploads') ? im.folder : undefined);
  const ensureFolder = async (): Promise<string> => {
    if (stagingFolder.current) return stagingFolder.current;
    const { folder } = await api.mediaFolder();
    stagingFolder.current = folder;
    patch({ folder });
    return folder;
  };

  useEffect(() => {
    if (source !== 'folder' || im.kind === 'none' || !im.folder?.trim()) { setFound(null); return; }
    const t = setTimeout(() => { api.checkMedia(im.folder!).then(setFound).catch(() => setFound(null)); }, 450);
    return () => clearTimeout(t);
  }, [im.kind, im.folder, source]);

  const refresh = async (folder: string) => {
    try { const r = await api.mediaList(folder); setStaged(r.files); } catch { /* the list is a convenience */ }
  };

  const addFiles = async (files: FileList | File[]) => {
    setBusy(true);
    try {
      const folder = await ensureFolder();
      for (const file of Array.from(files).slice(0, 60)) {
        const data = await asBase64(file);
        try { await api.mediaUpload(folder, file.name, data); }
        catch (e) { toast(`${file.name}: ${(e as Error).message}`, 'error'); }
      }
      await refresh(folder);
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };

  const addLinks = async () => {
    const urls = links.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    if (!urls.length) return;
    setBusy(true);
    try {
      const folder = await ensureFolder();
      const { results } = await api.mediaFetch(folder, urls);
      const bad = results.filter((r) => r.error);
      if (bad.length) toast(`${bad.length} could not be fetched: ${bad[0].error}`, 'error');
      const good = results.length - bad.length;
      if (good) toast(`${good} picture${good === 1 ? '' : 's'} saved.`, 'ok');
      setLinks('');
      await refresh(folder);
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };

  const drop = async (name: string) => {
    if (!stagingFolder.current) return;
    try { await api.mediaRemove(stagingFolder.current, name); await refresh(stagingFolder.current); }
    catch (e) { toast((e as Error).message, 'error'); }
  };

  return (
    <div className="space-y-7">
      <PickOne options={catalogue.imageryKinds} value={im.kind} onChange={(v) => patch({ kind: v as typeof im.kind })} cols={1} compact />

      {im.kind !== 'none' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {SOURCES.map((s) => (
              <button key={s.id} type="button" onClick={() => setSource(s.id)} className={cx('chip', source === s.id && '!border-volt-3 bg-volt-2')}>
                <Icon name={s.icon} size={13} className={source === s.id ? 'text-volt' : undefined} />{s.label}
              </button>
            ))}
          </div>
          <p className="text-[12.5px] text-bone-3 -mt-2">{SOURCES.find((s) => s.id === source)?.blurb}</p>

          {source === 'drop' && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files); }}
              className={cx('rounded-xl border border-dashed p-8 text-center transition-colors', dragging ? 'border-volt bg-volt-2' : 'border-line-2 bg-ink-2')}
            >
              <Icon name="image" size={22} className={cx('mx-auto', dragging ? 'text-volt' : 'text-bone-4')} />
              <p className="text-[13.5px] text-bone-2 mt-2.5">Drag pictures here, or</p>
              <Button size="sm" className="mt-2" busy={busy} onClick={() => fileInput.current?.click()}>Choose files</Button>
              <input
                ref={fileInput} type="file" multiple hidden
                accept="image/jpeg,image/png,image/webp,image/avif,image/gif,image/svg+xml,video/mp4,video/webm"
                onChange={(e) => { if (e.target.files?.length) void addFiles(e.target.files); e.target.value = ''; }}
              />
              <p className="telemetry text-bone-4 mt-3">JPEG, PNG, WebP, AVIF, SVG, MP4, WebM · up to 20MB each</p>
            </div>
          )}

          {source === 'folder' && (
            <>
              <label className="block">
                <span className="legend block mb-1.5">The folder they are in</span>
                <Input placeholder="C:\Users\you\Pictures\the-restaurant" value={im.folder ?? ''} onChange={(e) => { stagingFolder.current = undefined; patch({ folder: e.target.value }); }} />
              </label>
              {found && !found.ok && <p className="text-[13px] text-danger -mt-2">{found.reason}</p>}
              {found?.ok && (
                <p className="text-[13px] text-bone-2 -mt-2 flex items-center gap-2">
                  <Icon name="check" size={13} className="text-volt shrink-0" />
                  {found.count} file{found.count === 1 ? '' : 's'} — <span className="telemetry text-bone-4 truncate">{found.sample.join(', ')}</span>
                </p>
              )}
              <p className="text-[12.5px] text-bone-4 measure -mt-2">One level deep. Copied into the project when it is built, never uploaded anywhere.</p>
            </>
          )}

          {source === 'link' && (
            <div className="space-y-2">
              <textarea
                className="input"
                rows={3}
                placeholder={'https://example.com/photo.jpg\nhttps://example.com/room.webp'}
                value={links}
                onChange={(e) => setLinks(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <Button size="sm" variant="primary" icon="link" busy={busy} disabled={!links.trim()} onClick={addLinks}>Fetch them</Button>
                <span className="text-[12.5px] text-bone-3">One per line. They must be direct image addresses, not a gallery page.</span>
              </div>
            </div>
          )}

          {staged.length > 0 && (
            <div>
              <div className="legend mb-2">{staged.length} picture{staged.length === 1 ? '' : 's'} ready</div>
              <div className="flex flex-wrap gap-1.5">
                {staged.map((f) => (
                  <span key={f.name} className="chip !cursor-default">
                    <Icon name="image" size={12} className="text-volt" />
                    <span className="truncate max-w-[180px]">{f.name}</span>
                    <span className="telemetry text-bone-4">{Math.max(1, Math.round(f.size / 1024))}KB</span>
                    <button onClick={() => void drop(f.name)} className="text-bone-3 hover:text-danger" title="Remove"><Icon name="x" size={11} /></button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <label className="block">
            <span className="legend block mb-1.5">What are they of?</span>
            <Input placeholder="The counter at service, the oven, the team" value={im.describes ?? ''} onChange={(e) => patch({ describes: e.target.value })} />
          </label>
        </div>
      )}

      {im.kind !== 'have' && (
        <div>
          <p className="legend mb-2">{im.kind === 'none' ? 'What goes where a photograph would have gone' : 'And where one is still missing'}</p>
          <PickMany options={catalogue.imageryDevices} value={im.instead ?? []} onChange={(v) => patch({ instead: v })} cols={2} compact />
          <p className="text-[12.5px] text-bone-4 mt-3 measure">
            Pick none and it will choose per section. What it will never do is leave an empty rounded
            rectangle or reach for a stock photograph — both are refusals to design.
          </p>
        </div>
      )}

      {busy && <div className="flex items-center gap-2 text-[13px] text-bone-2"><Spinner size={13} /> working…</div>}
    </div>
  );
}

/** A File as base64, without the `data:` prefix the daemon does not want. */
function asBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('That file could not be read.'));
    r.readAsDataURL(file);
  });
}
