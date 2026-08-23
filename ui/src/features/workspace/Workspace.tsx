/**
 * The project screen: the conversation on the left, the site on the right.
 * Generation stages sit above the chat while it builds; afterwards the same
 * session carries on as a conversation with chips.
 */

import { useEffect, useMemo, useState } from 'react';
import { useStore, navigate, toast } from '@/lib/store';
import { api } from '@/lib/api';
import { Button, Logo, Spinner, cx } from '@/components/ui';
import { Icon } from '@/components/icons';
import { Chat } from './Chat';
import { Stages } from './Stages';
import { DeployPanel } from './DeployPanel';
import { TweakPanel } from './TweakPanel';
import { Directions } from './Directions';

export function Workspace({ id }: { id: string }) {
  const project = useStore((s) => s.projects[id]);
  const generation = useStore((s) => s.generations[id]);
  const preview = useStore((s) => s.previews[id]);
  const sessions = useStore((s) => s.sessions);
  const [sessionId, setSessionId] = useState<string | undefined>(project?.sessionId);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [view, setView] = useState<'site' | 'admin'>('site');
  const [showDeploy, setShowDeploy] = useState(false);
  const [tuning, setTuning] = useState(false);
  const [directions, setDirections] = useState(false);
  const [reload, setReload] = useState(0);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!project) void api.project(id).then((p) => useStore.getState().apply({ type: 'project.upsert', project: p })).catch(() => navigate({ name: 'projects' }));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!project) return;
    void api.generation(id).then((g) => { if (g) useStore.getState().apply({ type: 'generation.update', state: g }); }).catch(() => {});
    void api.preview(id).then((p) => useStore.getState().apply({ type: 'preview.update', state: p })).catch(() => {});
    api.projectSession(id).then((s) => { setSessionId(s.id); useStore.getState().apply({ type: 'session.upsert', session: s }); }).catch((e) => toast(e.message, 'error'));
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (project?.sessionId && project.sessionId !== sessionId) { setSessionId(project.sessionId); void useStore.getState().loadSession(project.sessionId); } }, [project?.sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const session = sessionId ? sessions[sessionId] : undefined;
  const url = preview?.url;
  const frameUrl = useMemo(() => (url ? `${url}${view === 'admin' ? '/admin' : ''}?sb=${reload}` : ''), [url, view, reload]);

  if (!project) return <div className="h-screen grid place-items-center text-bone-2"><Spinner /></div>;

  const startPreview = async () => { setStarting(true); try { await api.startPreview(id); } catch (e) { toast((e as Error).message, 'error'); } finally { setStarting(false); } };
  const build = async () => { try { await api.generate(id); } catch (e) { toast((e as Error).message, 'error'); } };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-line bg-ink-2/70 backdrop-blur">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate({ name: 'projects' })} className="text-bone-3 hover:text-bone" title="Projects"><Icon name="arrowLeft" size={16} /></button>
          <Logo size={18} wordmark={false} />
          <span className="font-semibold truncate">{project.name}</span>
          <span className={cx('telemetry', project.status === 'generating' ? 'text-volt' : project.status === 'failed' ? 'text-danger' : 'text-bone-3')}>{project.status === 'generating' ? 'building' : project.status}</span>
          {project.deploy?.url && <a href={project.deploy.url} target="_blank" rel="noreferrer" className="telemetry text-volt hidden md:inline-flex items-center gap-1">{project.deploy.url.replace(/^https?:\/\//, '')} <Icon name="external" size={11} /></a>}
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="quiet" icon="folder" onClick={() => api.openFolder(id)} title="Open folder" />
          <Button size="sm" variant={project.deploy?.url ? 'ghost' : 'primary'} icon="rocket" onClick={() => setShowDeploy(true)} disabled={project.status === 'draft'}>Publish</Button>
        </div>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(380px,34%)_1fr]">
        {/* Left: stages + chat */}
        <aside className="min-h-0 flex flex-col border-r border-line">
          {project.status === 'draft' && !generation && (
            <div className="p-5 border-b border-line">
              <div className="font-semibold">Not built yet.</div>
              <p className="text-[13px] text-bone-3 mt-1">The specification is saved. Press Build to scaffold the template and start the stages.</p>
              <Button variant="primary" icon="rocket" className="mt-3" onClick={build}>Build it</Button>
            </div>
          )}
          {generation && <Stages state={generation} projectId={id} />}
          {session ? <Chat session={session} projectId={id} busy={!!generation?.running} /> : <div className="flex-1 grid place-items-center text-bone-3"><Spinner /></div>}
        </aside>

        {/* Right: preview, with the tweak rail beside it */}
        <section className="min-h-0 flex flex-col bg-ink-3/40 lg:flex-row">
          <div className="min-h-0 flex-1 flex flex-col">
          <div className="h-11 shrink-0 flex items-center justify-between px-3 border-b border-line gap-2">
            <div className="flex items-center gap-1">
              <Seg on={view === 'site'} onClick={() => setView('site')}>Site</Seg>
              <Seg on={view === 'admin'} onClick={() => setView('admin')}>CRM /admin</Seg>
            </div>
            <div className="flex items-center gap-1">
              <Seg on={device === 'desktop'} onClick={() => setDevice('desktop')} title="Desktop"><Icon name="monitor" size={14} /></Seg>
              <Seg on={device === 'mobile'} onClick={() => setDevice('mobile')} title="Phone"><Icon name="phone" size={14} /></Seg>
              <span className="w-px h-5 bg-line mx-1" />
              <Seg on={directions} onClick={() => setDirections(true)} title="Three directions, side by side"><Icon name="layout" size={14} /> Directions</Seg>
              <Seg on={tuning} onClick={() => setTuning((t) => !t)} title="Tune the design — colour, type, space, motion"><Icon name="sliders" size={14} /> Tune</Seg>
              <span className="w-px h-5 bg-line mx-1" />
              {preview?.running ? (
                <>
                  <Button size="sm" variant="quiet" icon="refresh" onClick={() => setReload((n) => n + 1)} title="Reload" />
                  {url && <a className="btn btn-quiet btn-sm" href={frameUrl} target="_blank" rel="noreferrer" title="Open in a tab"><Icon name="external" size={14} /></a>}
                  <Button size="sm" variant="quiet" icon="stop" onClick={() => api.stopPreview(id)} title="Stop the preview server" />
                </>
              ) : (
                <Button size="sm" icon="play" busy={starting} onClick={startPreview} disabled={project.status === 'draft'}>Start preview</Button>
              )}
            </div>
          </div>
          <div className="flex-1 min-h-0 relative p-3">
            {url ? (
              <div className={cx('mx-auto h-full transition-all duration-500 overflow-hidden rounded-xl border border-line-2 bg-white shadow-2xl', device === 'mobile' ? 'w-[390px]' : 'w-full')}>
                <iframe key={frameUrl} src={frameUrl} title="preview" className="w-full h-full bg-white" />
              </div>
            ) : (
              <div className="h-full grid place-items-center">
                <div className="text-center max-w-[40ch]">
                  {preview?.running ? (
                    <><Spinner className="text-volt mx-auto" /><div className="mt-3 text-bone-2">Starting the site…</div><pre className="telemetry text-bone-4 mt-3 text-left max-h-40 overflow-auto whitespace-pre-wrap">{preview.log.slice(-1200)}</pre></>
                  ) : generation?.running && !generation.stages.find((s) => s.id === 'scaffold' && s.status === 'done') ? (
                    <><Spinner className="text-volt mx-auto" /><div className="mt-3 text-bone-2">Preparing the template. The preview starts as soon as it is installed.</div></>
                  ) : (
                    <><Icon name="monitor" size={32} className="text-bone-4 mx-auto" /><div className="mt-3 text-bone-2">{project.status === 'draft' ? 'Build the site to see it here.' : 'The preview is stopped.'}</div>{preview?.error && <div className="text-danger telemetry mt-2">{preview.error}</div>}</>
                  )}
                </div>
              </div>
            )}
          </div>
          </div>
          {tuning && project.status !== 'draft' && <TweakPanel projectId={id} onClose={() => setTuning(false)} />}
        </section>
      </div>

      {directions && <Directions projectId={id} url={url} onClose={() => setDirections(false)} />}
      {showDeploy && <DeployPanel projectId={id} onClose={() => setShowDeploy(false)} />}
    </div>
  );
}

function Seg({ children, on, onClick, title }: { children: React.ReactNode; on: boolean; onClick: () => void; title?: string }) {
  return <button title={title} onClick={onClick} className={cx('h-8 px-3 rounded-full text-[13px] inline-flex items-center gap-1.5 transition-colors', on ? 'bg-ink-2 text-bone border border-line-2' : 'text-bone-3 hover:text-bone')}>{children}</button>;
}
