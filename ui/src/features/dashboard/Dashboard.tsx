/** Every site this machine has made, and the button for the next one. */

import { useEffect, useMemo, useState } from 'react';
import { useStore, navigate, toast } from '@/lib/store';
import { api } from '@/lib/api';
import { Button, Empty, Index, cx } from '@/components/ui';
import { Icon } from '@/components/icons';
import type { Project } from '@superbuilds/protocol';

const STATUS: Record<Project['status'], [string, string]> = {
  draft: ['Not built yet', 'text-bone-3'],
  scaffolding: ['Preparing', 'text-volt'],
  generating: ['Building', 'text-volt'],
  ready: ['Ready', 'text-bone-2'],
  failed: ['Needs attention', 'text-danger'],
};

export function Dashboard() {
  // Select the raw record and derive here. Sorting inside the selector returns
  // a fresh array on every store read, which React 19's useSyncExternalStore
  // treats as an endless stream of changes — that is what blanked this screen.
  const byId = useStore((s) => s.projects);
  const generations = useStore((s) => s.generations);
  const projects = useMemo(() => Object.values(byId).sort((a, b) => b.updatedAt - a.updatedAt), [byId]);
  const [view, setView] = useState<'grid' | 'list'>('grid');

  useEffect(() => { void useStore.getState().loadProjects(); }, []);

  return (
    <div className="shell-wide pt-12">
      <Index n={1} className="mb-8">Projects</Index>

      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="d2">Your sites.</h1>
          <p className="copy mt-2.5">
            {projects.length
              ? `${projects.length} on this machine. Each one is an ordinary Next.js project in a folder you own.`
              : 'Nothing here yet.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {projects.length > 1 && (
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-ink-2 border border-line">
              <Seg on={view === 'grid'} onClick={() => setView('grid')} title="Grid"><Icon name="grid" size={14} /></Seg>
              <Seg on={view === 'list'} onClick={() => setView('list')} title="List"><Icon name="list" size={14} /></Seg>
            </div>
          )}
          <Button icon="refresh" onClick={() => navigate({ name: 'revamp' })}>Revamp a site I have</Button>
          <Button variant="primary" icon="plus" onClick={() => navigate({ name: 'new' })}>New site</Button>
        </div>
      </div>

      {!projects.length ? (
        <div className="mt-10">
          <Empty
            icon="cube"
            title="Nothing here yet."
            body="Start something from nothing, or point at a site you already have and change how it looks. Either way the first one takes about fifteen minutes and you can watch the whole thing happen."
            action={(
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button variant="primary" iconRight="arrowRight" onClick={() => navigate({ name: 'new' })}>Build something new</Button>
                <Button icon="refresh" onClick={() => navigate({ name: 'revamp' })}>Revamp a site I have</Button>
              </div>
            )}
          />
        </div>
      ) : view === 'list' ? (
        <div className="mt-10 panel divide-y divide-line overflow-hidden">
          {projects.map((p) => <Row key={p.id} p={p} gen={generations[p.id]} />)}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 mt-10">
          {projects.map((p) => <Card key={p.id} p={p} gen={generations[p.id]} />)}
        </div>
      )}
    </div>
  );
}

function progress(gen?: { stages: Array<{ status: string }> }) {
  if (!gen) return null;
  const done = gen.stages.filter((s) => s.status === 'done').length;
  return gen.stages.length ? { done, total: gen.stages.length, pct: (done / gen.stages.length) * 100 } : null;
}

function Card({ p, gen }: { p: Project; gen?: { stages: Array<{ status: string }> } }) {
  const [label, tone] = STATUS[p.status];
  const prog = progress(gen);
  return (
    <article className="panel overflow-hidden group flex flex-col hover:border-line-2 transition-colors">
      <button onClick={() => navigate({ name: 'project', id: p.id })} className="relative aspect-[16/10] bg-ink overflow-hidden text-left border-b border-line">
        {p.thumbnail ? (
          <img src={p.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-[900ms] ease-[var(--sb-ease)] group-hover:scale-[1.025]" />
        ) : (
          <div className="absolute inset-0 grid-bg grid place-items-center">
            <div className="text-center">
              <Icon name={p.spec?.scene ?? 'cube'} size={30} className="text-bone-4 group-hover:text-volt transition-colors mx-auto" />
              <div className="telemetry text-bone-4 mt-2">{p.spec?.scene ?? 'scene'} · {p.spec?.palette ?? 'palette'}</div>
            </div>
          </div>
        )}
        {p.status === 'generating' && prog && (
          <div className="absolute left-0 right-0 bottom-0">
            <div className="h-[3px] bg-ink-4"><div className="h-full bg-volt transition-all duration-500" style={{ width: `${prog.pct}%` }} /></div>
          </div>
        )}
      </button>

      <div className="p-3.5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold text-[14px] truncate">{p.name}</div>
            <div className="telemetry text-bone-4 truncate mt-0.5">{p.path}</div>
          </div>
          <span className={cx('telemetry shrink-0 flex items-center gap-1.5', tone)}>
            {p.status === 'generating' && <span className="w-1.5 h-1.5 rounded-full bg-volt pulse-dot" />}
            {label}
          </span>
        </div>
        {p.deploy?.url && (
          <a href={p.deploy.url} target="_blank" rel="noreferrer" className="telemetry text-volt inline-flex items-center gap-1 mt-2 truncate hover:underline">
            {p.deploy.url.replace(/^https?:\/\//, '')} <Icon name="external" size={11} />
          </a>
        )}
        <div className="mt-4 flex items-center gap-1.5">
          <Button size="sm" variant="primary" iconRight="arrowRight" onClick={() => navigate({ name: 'project', id: p.id })}>
            {p.status === 'draft' ? 'Build' : 'Open'}
          </Button>
          <Button size="sm" variant="quiet" icon="folder" onClick={() => api.openFolder(p.id).catch((e) => toast(e.message, 'error'))} title="Open folder" />
          <Button size="sm" variant="quiet" icon="trash" className="ml-auto hover:text-danger" onClick={() => forget(p)} title="Forget this project" />
        </div>
      </div>
    </article>
  );
}

function Row({ p, gen }: { p: Project; gen?: { stages: Array<{ status: string }> } }) {
  const [label, tone] = STATUS[p.status];
  const prog = progress(gen);
  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-ink-3 transition-colors group">
      <button onClick={() => navigate({ name: 'project', id: p.id })} className="w-16 h-10 rounded bg-ink border border-line overflow-hidden shrink-0 grid place-items-center">
        {p.thumbnail
          ? <img src={p.thumbnail} alt="" className="w-full h-full object-cover object-top" />
          : <Icon name={p.spec?.scene ?? 'cube'} size={15} className="text-bone-4" />}
      </button>
      <button onClick={() => navigate({ name: 'project', id: p.id })} className="flex-1 min-w-0 text-left">
        <div className="font-semibold text-[13.5px] truncate">{p.name}</div>
        <div className="telemetry text-bone-4 truncate">{p.path}</div>
      </button>
      <span className={cx('telemetry shrink-0 hidden md:inline', tone)}>
        {label}{prog && p.status === 'generating' ? ` ${prog.done}/${prog.total}` : ''}
      </span>
      {p.deploy?.url && (
        <a href={p.deploy.url} target="_blank" rel="noreferrer" className="telemetry text-volt hidden lg:inline-flex items-center gap-1 hover:underline max-w-[220px] truncate">
          {p.deploy.url.replace(/^https?:\/\//, '')} <Icon name="external" size={11} />
        </a>
      )}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <Button size="sm" variant="quiet" icon="folder" onClick={() => api.openFolder(p.id).catch((e) => toast(e.message, 'error'))} title="Open folder" />
        <Button size="sm" variant="quiet" icon="trash" className="hover:text-danger" onClick={() => forget(p)} title="Forget this project" />
      </div>
      <Button size="sm" iconRight="arrowRight" onClick={() => navigate({ name: 'project', id: p.id })}>Open</Button>
    </div>
  );
}

async function forget(p: Project) {
  if (!confirm(`Forget "${p.name}"? The folder stays on disk.`)) return;
  try { await api.deleteProject(p.id); toast('Forgotten. The folder is still there.', 'ok'); }
  catch (e) { toast((e as Error).message, 'error'); }
}

function Seg({ children, on, onClick, title }: { children: React.ReactNode; on: boolean; onClick: () => void; title?: string }) {
  return (
    <button title={title} onClick={onClick} className={cx('h-7 w-7 grid place-items-center rounded-md transition-colors', on ? 'bg-ink-4 text-bone' : 'text-bone-4 hover:text-bone')}>
      {children}
    </button>
  );
}
