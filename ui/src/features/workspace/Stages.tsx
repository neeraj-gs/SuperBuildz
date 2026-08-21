/** The build, stage by stage, above the conversation it is happening in. */

import { useState } from 'react';
import type { GenerationState } from '@superbuilds/protocol';
import { api } from '@/lib/api';
import { toast } from '@/lib/store';
import { Button, Spinner, cx } from '@/components/ui';
import { Icon } from '@/components/icons';

export function Stages({ state, projectId }: { state: GenerationState; projectId: string }) {
  const [open, setOpen] = useState(state.running);
  const [showLog, setShowLog] = useState(false);
  const done = state.stages.filter((s) => s.status === 'done').length;
  const scaffoldNote = state.stages.find((s) => s.id === 'scaffold')?.note;
  const login = scaffoldNote?.match(/Admin login: (\S+) \/ (\S+)/);
  const mins = state.startedAt ? Math.round(((state.endedAt ?? Date.now()) - state.startedAt) / 60000) : 0;

  return (
    <div className="border-b border-line">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-2.5 text-left">
        <span className="flex items-center gap-2 text-[13.5px]">
          {state.running ? <Spinner size={12} className="text-volt" /> : state.error ? <Icon name="alert" size={14} className="text-danger" /> : <Icon name="check" size={14} className="text-volt" />}
          <span className="font-semibold">{state.running ? 'Building' : state.error ? 'Stopped' : 'Built'}</span>
          <span className="telemetry text-bone-3">{done}/{state.stages.length} stages · {mins} min · ${state.costUsd.toFixed(2)}</span>
        </span>
        <Icon name="chevronDown" size={14} className={cx('text-bone-3 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-4 pb-3">
          <ol className="space-y-1">
            {state.stages.map((s, i) => (
              <li key={s.id} className="flex items-center gap-3 text-[13px]">
                <span className={cx('w-5 h-5 rounded-full grid place-items-center shrink-0 text-[11px] font-semibold', s.status === 'done' ? 'bg-volt text-ink' : s.status === 'running' ? 'border border-volt text-volt' : s.status === 'failed' ? 'bg-danger/20 text-danger' : 'border border-line text-bone-4')}>
                  {s.status === 'done' ? <Icon name="check" size={11} /> : s.status === 'running' ? <Spinner size={9} /> : i}
                </span>
                <span className={cx(s.status === 'pending' && 'text-bone-3')}>{s.label}</span>
                {s.status === 'failed' && s.note && <span className="telemetry text-danger truncate">{s.note.slice(0, 80)}</span>}
              </li>
            ))}
          </ol>
          {login && (
            <div className="mt-3 rounded-lg border border-volt/40 bg-volt-2 p-3 text-[13px]">
              <div className="font-semibold flex items-center gap-2"><Icon name="lock" size={14} className="text-volt" /> Your CRM login — write it down</div>
              <div className="telemetry mt-1">{login[1]} <span className="text-bone-3">/</span> {login[2]}</div>
              <div className="text-bone-3 text-[12px] mt-1">Shown here only. It is hashed in the site's .env.local; nothing else keeps it.</div>
            </div>
          )}
          {state.error && <div className="mt-2 text-[13px] text-danger">{state.error}</div>}
          <div className="flex items-center gap-2 mt-3">
            {state.running && <Button size="sm" variant="danger" icon="stop" onClick={() => api.cancelGenerate(projectId).then(() => toast('Stopping after the current step.')).catch((e) => toast(e.message, 'error'))}>Stop building</Button>}
            {!state.running && state.error && <Button size="sm" variant="primary" icon="refresh" onClick={() => api.generate(projectId).catch((e) => toast(e.message, 'error'))}>Try again</Button>}
            <button onClick={() => setShowLog(!showLog)} className="telemetry text-bone-3 hover:text-bone">{showLog ? 'hide' : 'show'} install log</button>
          </div>
          {showLog && <pre className="mt-2 max-h-40 overflow-auto telemetry text-bone-4 whitespace-pre-wrap bg-ink-3 rounded p-2">{state.log.slice(-4000) || '—'}</pre>}
        </div>
      )}
    </div>
  );
}
