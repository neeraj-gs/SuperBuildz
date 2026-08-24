'use client';

import Link from 'next/link';
import { useOptimistic, useState, useTransition } from 'react';
import type { Lead } from '@/db/schema';
import type { Stage } from '@/db/pipeline';
import { moveStage } from './actions';

/** The pipeline as columns. Drag a card to move it; the move is optimistic and a server action makes it true. */
export function Kanban({ leads, stages }: { leads: Lead[]; stages: Stage[] }) {
  const [items, setItems] = useOptimistic(leads, (state: Lead[], patch: { id: string; stage: string }) => state.map((l) => (l.id === patch.id ? { ...l, stage: patch.stage } : l)));
  const [over, setOver] = useState<string | null>(null);
  const [, start] = useTransition();
  const drop = (stage: string, id: string) => {
    if (!id) return;
    start(async () => { setItems({ id, stage }); try { await moveStage(id, stage); } catch { /* the page revalidates to the truth */ } });
  };
  const fmt = (n: number) => (n ? n.toLocaleString() : '');
  return (
    <div className="admin-board">
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(230px, 1fr))` }}>
      {stages.map((s) => {
        const col = items.filter((l) => l.stage === s.id);
        const total = col.reduce((n, l) => n + (l.value || 0), 0);
        return (
          <div key={s.id} className={`admin-col ${over === s.id ? 'is-over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(s.id); }} onDragLeave={() => setOver(null)} onDrop={(e) => { e.preventDefault(); setOver(null); drop(s.id, e.dataTransfer.getData('text/lead')); }}>
            <div className="flex items-center justify-between px-1 mb-3">
              <span className="text-xs uppercase tracking-wider opacity-70">{s.label}</span>
              <span className="font-mono text-xs opacity-70">{col.length}{total ? ` · ${fmt(total)}` : ''}</span>
            </div>
            {col.map((l) => (
              <div key={l.id} draggable className="admin-lead-card" onDragStart={(e) => { e.dataTransfer.setData('text/lead', l.id); e.dataTransfer.effectAllowed = 'move'; }}>
                <Link href={`/admin/leads/${l.id}`} className="font-medium block hover:underline">{l.name || l.email || 'Lead'}</Link>
                <div className="text-xs opacity-60 mt-0.5 truncate">{l.email || l.phone}{l.company ? ` · ${l.company}` : ''}</div>
                {l.message && <div className="text-xs opacity-75 mt-1.5 line-clamp-2">{l.message}</div>}
                <div className="flex items-center justify-between mt-2 text-[11px] font-mono opacity-60"><span>{l.source}</span><span>{l.value ? fmt(l.value) : ''}</span></div>
              </div>
            ))}
            {!col.length && <div className="text-xs opacity-40 text-center py-6">Drop here</div>}
          </div>
        );
      })}
    </div>
    </div>
  );
}
