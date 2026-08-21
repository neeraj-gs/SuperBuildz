/** Every site this machine has made, and the button for the next one. */

import { useEffect } from 'react';
import { useStore, navigate, toast } from '@/lib/store';
import { api } from '@/lib/api';
import { Button, Empty, cx } from '@/components/ui';
import { Icon } from '@/components/icons';
import type { Project } from '@superbuilds/protocol';

const STATUS: Record<Project['status'], [string, string]> = {
  draft: ['Not built yet', 'text-bone-3'],
  scaffolding: ['Preparing…', 'text-volt'],
  generating: ['Building…', 'text-volt'],
  ready: ['Ready', 'text-volt'],
  failed: ['Needs attention', 'text-danger'],
};

export function Dashboard() {
  const projects = useStore((s) => Object.values(s.projects).sort((a, b) => b.updatedAt - a.updatedAt));
  const generations = useStore((s) => s.generations);
  useEffect(() => { void useStore.getState().loadProjects(); }, []);

  return (
    <div className="max-w-[1400px] mx-auto pt-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="legend mb-3">Projects</p>
          <h1 className="display text-[clamp(2.2rem,5vw,4.4rem)]">Your sites.</h1>
        </div>
        <Button variant="primary" icon="plus" onClick={() => navigate({ name: 'new' })}>New site</Button>
      </div>

      {!projects.length ? (
        <div className="mt-12">
          <Empty icon="cube" title="Nothing built yet." body="Press New site. The first one takes about fifteen minutes and you can watch the whole thing." action={<Button variant="primary" iconRight="arrowRight" onClick={() => navigate({ name: 'new' })}>Start</Button>} />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 mt-12">
          {projects.map((p) => {
            const g = generations[p.id];
            const done = g ? g.stages.filter((s) => s.status === 'done').length : 0;
            const total = g?.stages.length ?? 0;
            const [label, tone] = STATUS[p.status];
            return (
              <article key={p.id} className="panel overflow-hidden group flex flex-col">
                <button onClick={() => navigate({ name: 'project', id: p.id })} className="relative aspect-[16/10] bg-ink-3 overflow-hidden text-left">
                  {p.thumbnail ? (
                    <img src={p.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.03]" />
                  ) : (
                    <div className="absolute inset-0 grid-bg grid place-items-center">
                      <div className="text-center"><Icon name={p.spec?.scene ?? 'cube'} size={34} className="text-volt mx-auto" /><div className="telemetry text-bone-3 mt-2">{p.spec?.scene ?? 'scene'} · {p.spec?.palette ?? 'palette'}</div></div>
                    </div>
                  )}
                  {p.status === 'generating' && total > 0 && (
                    <div className="absolute left-0 right-0 bottom-0 h-1 bg-ink-2"><div className="h-full bg-volt transition-all" style={{ width: `${(done / total) * 100}%` }} /></div>
                  )}
                </button>
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-[15px] truncate">{p.name}</div>
                      <div className="telemetry text-bone-3 truncate">{p.path}</div>
                    </div>
                    <span className={cx('telemetry shrink-0', tone)}>{label}</span>
                  </div>
                  {p.deploy?.url && <a href={p.deploy.url} target="_blank" rel="noreferrer" className="telemetry text-volt inline-flex items-center gap-1 mt-2 truncate">{p.deploy.url.replace(/^https?:\/\//, '')} <Icon name="external" size={12} /></a>}
                  <div className="mt-4 flex items-center gap-2">
                    <Button size="sm" variant="primary" iconRight="arrowRight" onClick={() => navigate({ name: 'project', id: p.id })}>{p.status === 'draft' ? 'Build' : 'Open'}</Button>
                    <Button size="sm" icon="folder" onClick={() => api.openFolder(p.id).catch((e) => toast(e.message, 'error'))} title="Open folder" />
                    <Button size="sm" icon="trash" className="ml-auto" onClick={async () => { if (!confirm(`Forget "${p.name}"? The folder stays on disk.`)) return; try { await api.deleteProject(p.id); toast('Forgotten. The folder is still there.', 'ok'); } catch (e) { toast((e as Error).message, 'error'); } }} title="Forget this project" />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
