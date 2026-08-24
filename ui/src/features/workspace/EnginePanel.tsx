/**
 * Under the hood.
 *
 * Three tabs, answering three questions a person is entitled to ask about a
 * tool that spends their Claude usage: what did it ask for, what is it allowed
 * to do, and what has it been given to work with.
 *
 * The brief is editable here rather than read-only, because the alternative is
 * asking a chat to change a document you are not allowed to see. Saving it
 * changes what the next stage — and every later conversation — is working from.
 */

import { useEffect, useState } from 'react';
import type { EngineExtra, EngineInfo } from '@superbuilds/protocol';
import { api } from '@/lib/api';
import { toast } from '@/lib/store';
import { Button, Spinner, cx } from '@/components/ui';
import { Icon } from '@/components/icons';

type Tab = 'brief' | 'stages' | 'engine';

const KIND_ICON: Record<string, string> = { plugin: 'cube', skill: 'sparkle', agent: 'user', command: 'terminal', mcp: 'link' };

export function EnginePanel({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [info, setInfo] = useState<EngineInfo | null>(null);
  const [tab, setTab] = useState<Tab>('brief');
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [openStage, setOpenStage] = useState<string>('');

  useEffect(() => {
    api.engine(projectId).then((i) => { setInfo(i); setDraft(i.brief.text); }).catch((e) => toast(e.message, 'error'));
  }, [projectId]);

  // Escape closes it. An overlay with only a backdrop to press is a trap for
  // anybody working from the keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const dirty = !!info && draft !== info.brief.text;

  const save = async () => {
    setSaving(true);
    try {
      await api.saveBrief(projectId, draft);
      setInfo((i) => (i ? { ...i, brief: { ...i.brief, text: draft, exists: true } } : i));
      toast('Brief saved. Every stage and every chat message reads it from now on.', 'ok');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink/85 backdrop-blur-sm grid place-items-center p-4 fade" onClick={onClose}>
      <div className="panel w-[min(1000px,100%)] h-[min(88vh,900px)] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between gap-4 px-5 py-3 border-b border-line">
          <div className="flex items-center gap-1.5">
            <Icon name="cube" size={15} className="text-volt mr-1.5" />
            {(['brief', 'stages', 'engine'] as Tab[]).map((t) => (
              <button
                key={t} onClick={() => setTab(t)}
                className={cx('h-8 px-3 rounded-full text-[13px] transition-colors', tab === t ? 'bg-ink-3 text-bone border border-line-2' : 'text-bone-3 hover:text-bone')}
              >
                {t === 'brief' ? 'The prompt' : t === 'stages' ? 'What it was asked, stage by stage' : 'What it is allowed to do'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {tab === 'brief' && info && <Button size="sm" variant={dirty ? 'primary' : 'quiet'} icon="check" busy={saving} disabled={!dirty} onClick={save}>{dirty ? 'Save the brief' : 'Saved'}</Button>}
            <Button size="sm" variant="quiet" icon="x" onClick={onClose} />
          </div>
        </header>

        {!info ? (
          <div className="flex-1 grid place-items-center"><Spinner /></div>
        ) : tab === 'brief' ? (
          <div className="flex-1 min-h-0 flex flex-col">
            <p className="px-5 py-3 text-[13px] text-bone-2 border-b border-line measure">
              This is <code className="telemetry">BRIEF.md</code> in your project folder. Every build stage is told to obey it,
              and so is every message you send afterwards. Change a line here and the next thing it
              builds follows the new line.
            </p>
            {!info.brief.exists && (
              <p className="px-5 py-2 text-[13px] text-warn">There is no brief yet — it is written when the template is scaffolded.</p>
            )}
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              className="flex-1 min-h-0 w-full bg-ink text-bone-2 resize-none outline-none px-5 py-4 font-[family-name:var(--font-mono)] text-[12.5px] leading-[1.62]"
            />
          </div>
        ) : tab === 'stages' ? (
          <div className="flex-1 min-h-0 overflow-auto p-4 grid gap-2">
            <p className="text-[13px] text-bone-2 measure px-1 pb-1">
              The build is a sequence of turns in one Claude Code session. This is the literal text of
              each one — nothing is hidden, and nothing else is sent except the brief above and the
              system prompt on the next tab.
            </p>
            {info.stages.map((s, i) => (
              <div key={s.id} className="rounded-xl border border-line bg-ink-2 overflow-hidden">
                <button onClick={() => setOpenStage((o) => (o === s.id ? '' : s.id))} className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-ink-3">
                  <span className="telemetry text-volt w-6 shrink-0 mt-0.5">{String(i + 1).padStart(2, '0')}</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-[14px] block">{s.label}</span>
                    <span className="text-[12.5px] text-bone-3 block leading-snug mt-0.5">{s.blurb}</span>
                  </span>
                  <Icon name="chevronDown" size={14} className={cx('text-bone-4 shrink-0 mt-1 transition-transform', openStage !== s.id && '-rotate-90')} />
                </button>
                {openStage === s.id && (
                  <pre className="px-4 pb-4 text-[12px] leading-relaxed whitespace-pre-wrap text-bone-2 font-[family-name:var(--font-mono)] max-h-[420px] overflow-auto border-t border-line pt-3">{s.prompt}</pre>
                )}
              </div>
            ))}
            {!info.stages.length && <p className="text-[13px] text-bone-3">This project has no specification, so there are no stages to show.</p>}
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto p-5 grid gap-5 content-start">
            <Section title="Claude Code" icon="terminal">
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
                <Row k="Binary" v={info.claude.bin} />
                <Row k="Model" v={info.claude.model || 'whatever your Claude Code is set to'} />
                <Row k="Permission mode" v={info.claude.permissionMode} />
              </dl>
              <pre className="telemetry text-bone-3 mt-3 p-3 rounded-lg bg-ink border border-line overflow-x-auto">{info.argv.join(' ')}</pre>
              <p className="text-[12.5px] text-bone-4 mt-2 measure">
                It runs unattended because you cannot be asked to approve <code className="telemetry">npm install</code> forty
                times. The hooks below are what make that safe.
              </p>
            </Section>

            <Section title="Hooks Super Builds installs" icon="shield">
              <ul className="grid gap-2">
                {info.hooks.map((h) => (
                  <li key={h.event} className="flex gap-3 text-[13px]">
                    <span className="telemetry text-volt shrink-0 w-[110px]">{h.event}</span>
                    <span className="text-bone-2">{h.does}</span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="What it will refuse to do" icon="lock">
              <ul className="grid gap-1.5 text-[13px] text-bone-2">
                {info.refuses.map((r) => <li key={r} className="flex gap-2"><Icon name="x" size={13} className="text-danger shrink-0 mt-1" />{r}</li>)}
              </ul>
            </Section>

            <Section title="Plugins, skills and servers it has been given" icon="cube">
              {info.extras.length === 0 ? (
                <p className="text-[13px] text-bone-3">Nothing extra — plain Claude Code. Anything you install into <code className="telemetry">~/.claude</code> shows up here.</p>
              ) : (
                <Extras extras={info.extras} />
              )}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * A hundred and twenty skills is a wall, not a list.
 *
 * Grouped by what a thing is, counted, and collapsed until asked — because the
 * question this answers is usually "is X loaded?", which a count and a search
 * of the eye answers faster than a paragraph of chips does.
 */
function Extras({ extras }: { extras: EngineExtra[] }) {
  const [openKind, setOpenKind] = useState<string>('');
  const kinds = ['plugin', 'mcp', 'agent', 'command', 'skill'] as const;
  const label: Record<string, [string, string]> = {
    plugin: ['plugin', 'plugins'], mcp: ['MCP server', 'MCP servers'], agent: ['agent', 'agents'],
    command: ['slash command', 'slash commands'], skill: ['skill', 'skills'],
  };
  return (
    <div className="grid gap-2">
      {kinds.map((k) => {
        const of = extras.filter((e) => e.kind === k);
        if (!of.length) return null;
        const open = openKind === k;
        return (
          <div key={k} className="rounded-lg border border-line bg-ink-2">
            <button onClick={() => setOpenKind(open ? '' : k)} className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-ink-3 rounded-lg">
              <Icon name={KIND_ICON[k]} size={13} className="text-volt shrink-0" />
              <span className="text-[13.5px] font-semibold">{of.length} {label[k][of.length === 1 ? 0 : 1]}</span>
              <span className="telemetry text-bone-4">{of.some((e) => e.where === 'this project') ? 'some from this project' : 'from this machine'}</span>
              <span className="flex-1" />
              <Icon name="chevronDown" size={13} className={cx('text-bone-4 transition-transform', !open && '-rotate-90')} />
            </button>
            {open && (
              <div className="flex flex-wrap gap-1.5 px-3 pb-3">
                {of.map((e) => (
                  <span key={`${e.name}-${e.where}`} className="chip !cursor-default" title={`from ${e.where}${e.detail ? ` · ${e.detail}` : ''}`}>
                    <span className={cx(e.detail && 'text-bone-4 line-through')}>{e.name}</span>
                    {e.where === 'this project' && <span className="telemetry text-volt">project</span>}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="index legend mb-2.5"><Icon name={icon} size={13} className="text-volt" /><span>{title}</span></div>
      {children}
    </section>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="min-w-0"><dt className="legend !text-[10px]">{k}</dt><dd className="text-bone-2 truncate font-[family-name:var(--font-mono)] text-[12.5px]">{v}</dd></div>;
}
