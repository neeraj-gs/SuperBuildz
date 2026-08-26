/**
 * The project screen: the conversation on the left, the site on the right.
 *
 * ── Why there is a menu now ─────────────────────────────────────────────────
 *
 * The toolbar used to hold five controls and everything else was unreachable —
 * the folder, the files, the CRM login, the analytics keys, the prompt. Adding
 * them all as buttons would have produced a row of nineteen glyphs, which is
 * not more capable, only less legible. So the six things you press while
 * looking at a site stay on the bar (what you are looking at, on what size of
 * screen, and the four preview verbs) and everything you press once an hour
 * lives behind one menu, grouped and named in words.
 *
 * ── The device frame is a real frame ────────────────────────────────────────
 *
 * Widths are the ones that matter — the phone that breaks a hero, the laptop
 * most people actually own — and the zoom is a CSS transform on the frame
 * rather than a browser zoom, so what the site sees is a real 390px viewport
 * and not a 390px-shaped lie. That distinction is the whole reason to have the
 * control: a media query that fires at the wrong moment on a phone is exactly
 * the bug this is meant to catch.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, navigate, toast, ask, askText } from '@/lib/store';
import { api } from '@/lib/api';
import { Button, Logo, Spinner, cx } from '@/components/ui';
import { Icon } from '@/components/icons';
import { Chat } from './Chat';
import { Stages } from './Stages';
import { DeployPanel } from './DeployPanel';
import { TweakPanel } from './TweakPanel';
import { Directions } from './Directions';
import { Files } from './Files';
import { AdminBar } from './AdminBar';
import { AnalyticsPanel } from './AnalyticsPanel';
import { EnginePanel } from './EnginePanel';
import { NotesPanel, SessionTabs } from './Sessions';
import { AccessPanel } from './Approvals';

/** The screens worth checking, and the width each one really is. */
const DEVICES = [
  { id: 'fit', label: 'Fit the panel', width: 0, icon: 'monitor' },
  { id: 'desktop', label: 'Desktop · 1440', width: 1440, icon: 'monitor' },
  { id: 'laptop', label: 'Laptop · 1280', width: 1280, icon: 'monitor' },
  { id: 'tablet', label: 'Tablet · 834', width: 834, icon: 'table' },
  { id: 'phone', label: 'Phone · 390', width: 390, icon: 'phone' },
] as const;
type DeviceId = typeof DEVICES[number]['id'];

type View = 'site' | 'admin' | 'files';

export function Workspace({ id, session: wanted }: { id: string; session?: string }) {
  const project = useStore((s) => s.projects[id]);
  const generation = useStore((s) => s.generations[id]);
  const preview = useStore((s) => s.previews[id]);
  const sessions = useStore((s) => s.sessions);
  // `wanted` is in the path when the board opened a particular conversation, so
  // landing on the project's default one instead would silently ignore the card
  // that was pressed.
  const [sessionId, setSessionId] = useState<string | undefined>(wanted ?? project?.sessionId);

  const [view, setView] = useState<View>('site');
  const [device, setDevice] = useState<DeviceId>('fit');
  const [zoom, setZoom] = useState(1);
  const [grid, setGrid] = useState(false);
  const [full, setFull] = useState(false);

  const [showDeploy, setShowDeploy] = useState(false);
  const [tuning, setTuning] = useState(false);
  const [directions, setDirections] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [engine, setEngine] = useState(false);
  const [openFile, setOpenFile] = useState<string | undefined>();
  const [notes, setNotes] = useState(false);
  // Held as the conversation's id rather than a boolean: what may be done to
  // the machine is granted per conversation, so the panel has to name which.
  const [accessFor, setAccessFor] = useState<string | undefined>();

  const [reload, setReload] = useState(0);
  const [starting, setStarting] = useState(false);
  const [shooting, setShooting] = useState(false);

  useEffect(() => {
    if (!project) void api.project(id).then((p) => useStore.getState().apply({ type: 'project.upsert', project: p })).catch(() => navigate({ name: 'projects' }));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!project) return;
    void api.generation(id).then((g) => { if (g) useStore.getState().apply({ type: 'generation.update', state: g }); }).catch(() => {});
    void api.preview(id).then((p) => useStore.getState().apply({ type: 'preview.update', state: p })).catch(() => {});
    api.projectSession(id).then((s) => { setSessionId(s.id); useStore.getState().apply({ type: 'session.upsert', session: s }); }).catch((e) => toast(e.message, 'error'));
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (project?.sessionId && !sessionId) { setSessionId(project.sessionId); } }, [project?.sessionId]); // eslint-disable-line react-hooks/exhaustive-deps
  // Pressing another card while a project is already open changes the path but
  // not the component, so the choice has to be watched as well as seeded.
  useEffect(() => { if (wanted && wanted !== sessionId) setSessionId(wanted); }, [wanted]); // eslint-disable-line react-hooks/exhaustive-deps

  // Only the conversation in front of you is fetched in full; the tabs carry
  // the rest as summaries until one is picked.
  useEffect(() => { if (sessionId && !sessions[sessionId]?.turns) void useStore.getState().loadSession(sessionId).catch(() => {}); }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape leaves full screen, because a screen with no visible way out is a trap.
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [full]);

  const session = sessionId ? sessions[sessionId] : undefined;
  const url = preview?.url;
  const frameUrl = useMemo(() => (url ? `${url}${view === 'admin' ? '/admin' : ''}?sb=${reload}` : ''), [url, view, reload]);

  if (!project) return <div className="h-screen grid place-items-center text-bone-2"><Spinner /></div>;

  const startPreview = async () => { setStarting(true); try { await api.startPreview(id); } catch (e) { toast((e as Error).message, 'error'); } finally { setStarting(false); } };
  const restart = async () => { try { await api.stopPreview(id); } catch { /* it may already be down */ } await startPreview(); };
  const build = async () => { try { await api.generate(id); } catch (e) { toast((e as Error).message, 'error'); } };
  const shoot = async () => {
    setShooting(true);
    try { const r = await api.thumbnail(id); toast(r.thumbnail ? 'Screenshot taken — it is on the project card.' : 'No browser to take one with. Install the Playwright browser from the requirements screen.', r.thumbnail ? 'ok' : 'error'); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setShooting(false); }
  };
  const rename = async () => {
    const name = (await askText({
      title: 'Call it what?',
      body: 'The name in Super Builds. The folder on disk and the site itself keep their own names.',
      input: { label: 'Name', value: project.name },
      confirmLabel: 'Rename',
    }))?.trim();
    if (!name || name === project.name) return;
    try { const p = await api.patchProject(id, { name }); useStore.getState().apply({ type: 'project.upsert', project: p }); }
    catch (e) { toast((e as Error).message, 'error'); }
  };
  const remove = async () => {
    const yes = await ask({
      title: `Remove ${project.name} from Super Builds?`,
      body: 'It disappears from the projects list, and nothing else happens.',
      points: [project.path, 'the folder, the git history and any deployment all stay', 'you can add it back by pointing Revamp at the same folder'],
      confirmLabel: 'Remove it',
      icon: 'trash',
      danger: true,
    });
    if (!yes) return;
    try { await api.deleteProject(id); navigate({ name: 'projects' }); } catch (e) { toast((e as Error).message, 'error'); }
  };

  const width = DEVICES.find((d) => d.id === device)?.width ?? 0;

  return (
    <div className="h-screen flex flex-col">
      {!full && (
        <header className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-line bg-ink-2/70 backdrop-blur">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate({ name: 'projects' })} className="text-bone-3 hover:text-bone" title="Projects"><Icon name="arrowLeft" size={16} /></button>
            <Logo size={18} wordmark={false} />
            <span className="font-semibold truncate">{project.name}</span>
            <span className={cx('telemetry', project.status === 'generating' ? 'text-volt' : project.status === 'failed' ? 'text-danger' : 'text-bone-3')}>{project.status === 'generating' ? 'building' : project.status}</span>
            {project.deploy?.url && <a href={project.deploy.url} target="_blank" rel="noreferrer" className="telemetry text-volt hidden md:inline-flex items-center gap-1">{project.deploy.url.replace(/^https?:\/\//, '')} <Icon name="external" size={11} /></a>}
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="quiet" icon="folder" onClick={() => api.openFolder(id)} title="Open the folder on your machine" />
            <Button size="sm" variant={project.deploy?.url ? 'ghost' : 'primary'} icon="rocket" onClick={() => setShowDeploy(true)} disabled={project.status === 'draft'}>Publish</Button>
          </div>
        </header>
      )}

      <div className={cx('flex-1 min-h-0 grid grid-cols-1', full ? '' : 'lg:grid-cols-[minmax(380px,34%)_1fr]')}>
        {!full && (
          <aside className="min-h-0 flex flex-col border-r border-line">
            {project.status === 'draft' && !generation && (
              <div className="p-5 border-b border-line">
                <div className="font-semibold">Not built yet.</div>
                <p className="text-[13px] text-bone-3 mt-1">The specification is saved. Press Build to scaffold the template and start the stages.</p>
                <Button variant="primary" icon="rocket" className="mt-3" onClick={build}>Build it</Button>
              </div>
            )}
            <SessionTabs projectId={id} activeId={sessionId} onPick={setSessionId} onNotes={() => setNotes(true)} />
            {generation && <Stages state={generation} projectId={id} />}
            {session ? <Chat session={session} projectId={id} busy={!!generation?.running} /> : <div className="flex-1 grid place-items-center text-bone-3"><Spinner /></div>}
          </aside>
        )}

        <section className="min-h-0 min-w-0 flex flex-col bg-ink-3/40 lg:flex-row">
          {/*
            `min-w-0` on both of these, and it is load-bearing. A grid track and
            a flex child are both `min-width: auto` by default, which means they
            refuse to shrink below the intrinsic width of their contents — and
            the contents here is a preview frame that can be 1440px wide. The
            Tune panel was being pushed off the right edge of the window, half
            of every label cut off, with no scrollbar to explain it.
          */}
          <div className="@container/pane min-h-0 min-w-0 flex-1 flex flex-col">
            {/*
              The bar has to survive the Tune panel taking 320px out of this
              pane. Container queries rather than screen ones: what decides
              whether "Directions" fits is the width of *this* column, not the
              width of the window — a 1600px screen with the panel open and a
              1280px one without it are the same problem.
            */}
            <div className="h-11 shrink-0 flex items-center justify-between px-3 border-b border-line gap-2">
              <div className="flex items-center gap-1 shrink-0">
                <Seg on={view === 'site'} onClick={() => setView('site')}>Site</Seg>
                <Seg on={view === 'admin'} onClick={() => setView('admin')} title="The CRM at /admin">CRM<span className="hidden @[720px]/pane:inline">&nbsp;/admin</span></Seg>
                <Seg on={view === 'files'} onClick={() => setView('files')} title="Browse and edit the project's files"><Icon name="doc" size={13} /><span className="hidden @[560px]/pane:inline">Files</span></Seg>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {view !== 'files' && (
                  <>
                    <DeviceMenu device={device} setDevice={setDevice} zoom={zoom} setZoom={setZoom} />
                    <span className="w-px h-5 bg-line mx-1" />
                    <Seg on={directions} onClick={() => setDirections(true)} title="Three directions, side by side"><Icon name="layout" size={14} /><span className="hidden @[880px]/pane:inline">Directions</span></Seg>
                    <Seg on={tuning} onClick={() => setTuning((t) => !t)} title="Tune the design — colour, type, space, motion"><Icon name="sliders" size={14} /><span className="hidden @[640px]/pane:inline">Tune</span></Seg>
                    <span className="w-px h-5 bg-line mx-1" />
                  </>
                )}

                <MoreMenu
                  items={[
                    { group: 'This project' },
                    { label: 'Analytics and where to read it', icon: 'chart', onClick: () => setAnalytics(true) },
                    { label: 'Under the hood — the prompt and the rules', icon: 'cube', onClick: () => setEngine(true) },
                    { label: 'Shared notes every conversation reads', icon: 'book', onClick: () => setNotes(true) },
                    { label: 'What it may do to the machine', icon: 'shield', onClick: () => setAccessFor(sessionId), disabled: !sessionId },
                    { label: 'Edit .env.local', icon: 'key', onClick: () => { setOpenFile('.env.local'); setView('files'); } },
                    { label: 'Rename', icon: 'edit', onClick: rename },

                    { group: 'The preview' },
                    { label: 'Reload', icon: 'refresh', onClick: () => setReload((n) => n + 1), disabled: !url },
                    { label: 'Restart the server', icon: 'play', onClick: restart, disabled: project.status === 'draft' },
                    { label: preview?.running ? 'Stop the server' : 'Start the server', icon: preview?.running ? 'stop' : 'play', onClick: () => (preview?.running ? api.stopPreview(id) : startPreview()), disabled: project.status === 'draft' },
                    { label: 'Copy the address', icon: 'copy', onClick: () => { void navigator.clipboard.writeText(url ?? '').then(() => toast('Copied.', 'ok')); }, disabled: !url },
                    { label: grid ? 'Hide the layout grid' : 'Show a layout grid', icon: 'grid', onClick: () => setGrid((g) => !g) },
                    { label: 'Take a screenshot for the card', icon: 'image', onClick: shoot, busy: shooting, disabled: !url },

                    { group: 'On your machine' },
                    { label: 'Open the folder', icon: 'folder', onClick: () => api.openFolder(id) },
                    { label: 'Open in VS Code', icon: 'terminal', onClick: async () => { const r = await api.openEditor(id); if (!r.ok) toast(r.message ?? 'It did not open.', 'error'); } },
                    { label: 'Remove from Super Builds', icon: 'trash', onClick: remove, danger: true },
                  ]}
                />

                <Button size="sm" variant="quiet" icon={full ? 'x' : 'maximize'} onClick={() => setFull((f) => !f)} title={full ? 'Leave full screen (esc)' : 'Full screen'} />

                {view !== 'files' && (preview?.running ? (
                  <>
                    <Button size="sm" variant="quiet" icon="refresh" onClick={() => setReload((n) => n + 1)} title="Reload" />
                    {url && <a className="btn btn-quiet btn-sm" href={frameUrl} target="_blank" rel="noreferrer" title="Open in a tab"><Icon name="external" size={14} /></a>}
                  </>
                ) : (
                  <Button size="sm" icon="play" busy={starting} onClick={startPreview} disabled={project.status === 'draft'} title="Start the site">
                    <span className="hidden @[820px]/pane:inline">Start preview</span>
                  </Button>
                ))}
              </div>
            </div>

            {view === 'admin' && <AdminBar projectId={id} url={url} />}

            {view === 'files' ? (
              <div className="flex-1 min-h-0">
                <Files projectId={id} startAt={openFile} onClose={() => { setOpenFile(undefined); setView('site'); }} />
              </div>
            ) : (
              <div className="flex-1 min-h-0 relative p-3">
                {url ? (
                  <div className="h-full overflow-auto grid place-items-start justify-center">
                    <div
                      className="relative transition-[width] duration-500 overflow-hidden rounded-xl border border-line-2 bg-white shadow-2xl origin-top"
                      style={{
                        width: width ? width : '100%',
                        height: width ? `${100 / zoom}%` : '100%',
                        minHeight: width ? `${100 / zoom}%` : undefined,
                        transform: zoom === 1 ? undefined : `scale(${zoom})`,
                      }}
                    >
                      <iframe key={frameUrl} src={frameUrl} title="preview" className="w-full h-full bg-white block" />
                      {grid && <GridOverlay />}
                    </div>
                  </div>
                ) : (
                  <div className="h-full grid place-items-center">
                    <div className="text-center max-w-[52ch]">
                      {preview?.running ? (
                        <><Spinner className="text-volt mx-auto" /><div className="mt-3 text-bone-2">Starting the site…</div><pre className="telemetry text-bone-4 mt-3 text-left max-h-40 overflow-auto whitespace-pre-wrap">{preview.log.slice(-1200)}</pre></>
                      ) : generation?.running && !generation.stages.find((s) => s.id === 'scaffold' && s.status === 'done') ? (
                        <><Spinner className="text-volt mx-auto" /><div className="mt-3 text-bone-2">Preparing the template. The preview starts as soon as it is installed.</div></>
                      ) : preview?.error ? (
                        <PreviewFailed error={preview.error} log={preview.log} onRetry={startPreview} busy={starting} />
                      ) : (
                        <>
                          <Icon name="monitor" size={30} className="text-bone-4 mx-auto" />
                          <div className="mt-3 text-bone-2">{project.status === 'draft' ? 'Build the site to see it here.' : 'The preview is stopped.'}</div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          {tuning && view !== 'files' && project.status !== 'draft' && <TweakPanel projectId={id} onClose={() => setTuning(false)} />}
        </section>
      </div>

      {directions && <Directions projectId={id} url={url} onClose={() => setDirections(false)} />}
      {showDeploy && <DeployPanel projectId={id} onClose={() => setShowDeploy(false)} />}
      {analytics && <AnalyticsPanel projectId={id} onClose={() => setAnalytics(false)} />}
      {engine && <EnginePanel projectId={id} onClose={() => setEngine(false)} />}
      {notes && <NotesPanel projectId={id} onClose={() => setNotes(false)} />}
      {accessFor && <AccessPanel sessionId={accessFor} onClose={() => setAccessFor(undefined)} />}
    </div>
  );
}

/**
 * A 12-column grid over the preview.
 *
 * Drawn on top rather than injected, because the preview is served from a
 * different port and so is a different origin — nothing of ours can reach
 * inside it. Which is fine: alignment is the thing being checked, and
 * alignment is visible from out here.
 */
function GridOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      <div className="h-full mx-auto max-w-[1140px] px-6 grid grid-cols-12 gap-6">
        {Array.from({ length: 12 }, (_, i) => <div key={i} className="h-full bg-volt/[0.07] border-x border-volt/20" />)}
      </div>
    </div>
  );
}

function DeviceMenu({ device, setDevice, zoom, setZoom }: { device: DeviceId; setDevice: (d: DeviceId) => void; zoom: number; setZoom: (z: number) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useOutside(() => setOpen(false));
  const current = DEVICES.find((d) => d.id === device)!;
  return (
    <div className="relative" ref={ref}>
      <Seg on={open || device !== 'fit'} onClick={() => setOpen((o) => !o)} title="Screen size">
        <Icon name={current.icon} size={14} />
        <span className="telemetry hidden @[600px]/pane:inline">{current.width ? current.width : 'fit'}{zoom !== 1 ? ` · ${Math.round(zoom * 100)}%` : ''}</span>
      </Seg>
      {open && (
        <div className="absolute right-0 top-10 z-40 panel w-[240px] p-1.5 shadow-2xl shadow-black/60">
          {DEVICES.map((d) => (
            <button key={d.id} onClick={() => { setDevice(d.id); setOpen(false); }} className={cx('w-full text-left px-2.5 py-2 rounded-md text-[13px] flex items-center gap-2.5', device === d.id ? 'bg-volt-2 text-bone' : 'text-bone-2 hover:bg-ink-3')}>
              <Icon name={d.icon} size={14} className={device === d.id ? 'text-volt' : 'text-bone-4'} />
              {d.label}
            </button>
          ))}
          <div className="px-2.5 pt-3 pb-1.5 border-t border-line mt-1.5">
            <div className="flex items-center justify-between"><span className="legend">Zoom</span><span className="telemetry text-bone-2">{Math.round(zoom * 100)}%</span></div>
            <input type="range" min={0.4} max={1} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="slider mt-1" />
            <p className="text-[11.5px] text-bone-4 leading-snug mt-1">Scales the frame, not the page — the site still sees the real width.</p>
          </div>
        </div>
      )}
    </div>
  );
}

interface MenuItem { label?: string; group?: string; icon?: string; onClick?: () => void; disabled?: boolean; danger?: boolean; busy?: boolean }

function MoreMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useOutside(() => setOpen(false));
  return (
    <div className="relative" ref={ref}>
      <Seg on={open} onClick={() => setOpen((o) => !o)} title="Everything else"><Icon name="gear" size={14} /></Seg>
      {open && (
        <div className="absolute right-0 top-10 z-40 panel w-[300px] p-1.5 shadow-2xl shadow-black/60 max-h-[70vh] overflow-auto">
          {items.map((it, i) =>
            it.group ? (
              <div key={`g${i}`} className="legend px-2.5 pt-3 pb-1.5 first:pt-1.5">{it.group}</div>
            ) : (
              <button
                key={it.label}
                disabled={it.disabled}
                onClick={() => { setOpen(false); it.onClick?.(); }}
                className={cx('w-full text-left px-2.5 py-2 rounded-md text-[13px] flex items-center gap-2.5 disabled:opacity-35 disabled:cursor-default', it.danger ? 'text-danger hover:bg-danger/10' : 'text-bone-2 hover:bg-ink-3 hover:text-bone')}
              >
                {it.busy ? <Spinner size={13} /> : <Icon name={it.icon ?? 'dots'} size={14} className={cx('shrink-0', !it.danger && 'text-bone-4')} />}
                {it.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

/** Closes a menu when the next press lands anywhere else. */
function useOutside(close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [close]);
  return ref;
}

/**
 * A preview that would not start. The person pressed a button and nothing
 * happened, so this owes them three things: what went wrong in one sentence,
 * the output if they want it, and a way to try again without hunting for the
 * control they already pressed.
 */
function PreviewFailed({ error, log, onRetry, busy }: { error: string; log: string; onRetry: () => void; busy: boolean }) {
  const [showLog, setShowLog] = useState(false);
  const trimmed = log.replace(/\u001b\[[0-9;]*m/g, '').trimEnd();
  return (
    <div className="text-left">
      <div className="flex items-start gap-2.5">
        <Icon name="alert" size={17} className="text-danger shrink-0 mt-0.5" />
        <div className="min-w-0">
          <div className="font-semibold text-[14px]">The preview did not start.</div>
          <p className="text-[13px] text-bone-2 mt-1 leading-relaxed">{error}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-4">
        <Button size="sm" variant="primary" icon="play" busy={busy} onClick={onRetry}>Try again</Button>
        {trimmed && (
          <Button size="sm" variant="quiet" onClick={() => setShowLog((v) => !v)}>
            {showLog ? 'Hide output' : 'Show output'}
          </Button>
        )}
      </div>
      {showLog && trimmed && (
        <pre className="telemetry text-bone-4 mt-3 p-3 rounded-lg bg-ink border border-line max-h-56 overflow-auto whitespace-pre-wrap">{trimmed.slice(-2000)}</pre>
      )}
    </div>
  );
}

function Seg({ children, on, onClick, title }: { children: React.ReactNode; on: boolean; onClick: () => void; title?: string }) {
  return <button title={title} onClick={onClick} className={cx('h-8 px-3 rounded-full text-[13px] inline-flex items-center gap-1.5 transition-colors shrink-0', on ? 'bg-ink-2 text-bone border border-line-2' : 'text-bone-3 hover:text-bone')}>{children}</button>;
}
