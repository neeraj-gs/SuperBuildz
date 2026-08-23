/**
 * A website, specified entirely by pressing things. Fifteen screens, not one
 * with a required text field (the name is the one field, and it can be
 * suggested). Choosing the kind of business answers the next twenty
 * questions; the rest is disagreeing with good defaults. Nothing is created,
 * installed or spent until the last press.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Catalogue, DesignDNA, Plan, Spec } from '@superbuilds/protocol';
import { api, type Question } from '@/lib/api';
import { useStore, navigate, toast } from '@/lib/store';
import { Button, Chip, Index, Input, Spinner, Textarea, cx } from '@/components/ui';
import { Icon } from '@/components/icons';
import { ChipMany, PickMany, PickOne, PickSwatch } from './Pickers';
import { LivePreview } from './LivePreview';
import { ReferenceStep } from './ReferenceStep';

const STEPS = [
  { id: 'what', title: 'What are you making?', lede: 'Pick the closest shape. Everything after this starts already answered.' },
  { id: 'goal', title: 'What should it achieve?', lede: 'The one thing a visitor should end up doing.' },
  { id: 'details', title: 'A few facts', lede: 'All optional. Whatever you give, the site will use; whatever you skip, it will leave honest placeholders for.' },
  { id: 'contents', title: 'What goes in it?', lede: 'Pre-ticked for the kind of business you chose.' },
  { id: 'palette', title: 'Colour', lede: 'Real palettes, checked for contrast. The accent is used as light, not paint.' },
  { id: 'type', title: 'Typography', lede: 'Watch the preview — the hero type changes as you choose.' },
  { id: 'atmosphere', title: 'How should it feel?', lede: 'Not "modern and clean". That is what makes everything look the same.' },
  { id: 'layout', title: 'Layout system', lede: 'How the whole page is organised, not how one section looks.' },
  { id: 'scene', title: 'The 3D scene', lede: 'Real WebGL, previewed on the right. Move your pointer over it. It will be adapted to your business, not used as is.' },
  { id: 'motion', title: 'How it moves', lede: 'Intensity, scroll, hover, cursor, transitions. One recurring gesture.' },
  { id: 'theme', title: 'Dark or light', lede: 'Both is a real answer and costs nothing.' },
  { id: 'reference', title: 'A site you admire', lede: 'Optional. It will be looked at, recorded and understood — and the result will be similar, not a copy.' },
  { id: 'analytics', title: 'Analytics and CRM', lede: 'Where visitors and forms go. The built-in CRM is included and needs no account.' },
  { id: 'deploy', title: 'Where it goes', lede: 'Vercel in one press, or just this machine for now.' },
  { id: 'go', title: 'Here is what will happen', lede: 'Nothing has been created yet. Read it, then press the button.' },
] as const;

type StepId = typeof STEPS[number]['id'];
const DRAFT = 'sb:draft:v1';

type Draft = Partial<Spec> & { name: string; folder: string };

function restore(): { spec: Draft; at: number } | null {
  try { const raw = localStorage.getItem(DRAFT); if (!raw) return null; const d = JSON.parse(raw); return d?.spec ? d : null; } catch { return null; }
}

export function Wizard() {
  const catalogue = useStore((s) => s.catalogue);
  const detection = useStore((s) => s.detection);
  const saved = useRef(restore());
  const [at, setAt] = useState(saved.current?.at ?? 0);
  const [spec, setSpec] = useState<Draft>(() => saved.current?.spec ?? { name: '', folder: '' });
  const [plan, setPlan] = useState<Plan | null>(null);
  const [showBrief, setShowBrief] = useState(false);
  const [building, setBuilding] = useState(false);
  const [names, setNames] = useState<Array<{ name: string; why?: string }> | null>(null);
  const [namesBusy, setNamesBusy] = useState(false);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [qBusy, setQBusy] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [folderNote, setFolderNote] = useState<string>('');

  useEffect(() => { if (!catalogue) void useStore.getState().loadCatalogue(); }, [catalogue]);
  useEffect(() => { localStorage.setItem(DRAFT, JSON.stringify({ spec, at })); }, [spec, at]);

  const set = <K extends keyof Spec>(k: K, v: Spec[K]) => setSpec((s) => ({ ...s, [k]: v }));
  const step = STEPS[at];

  const chooseArchetype = async (id: string) => {
    try {
      const d = await api.defaults(id);
      setSpec((s) => ({ ...d, ...pick(s, ['name', 'folder', 'details', 'references', 'dna', 'notes', 'theme', 'review', 'budgetUsd']), archetype: id, sector: undefined, name: s.name, folder: s.folder } as Draft));
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  // The plan, when the last screen is reached.
  useEffect(() => {
    if (step.id !== 'go') return;
    let alive = true;
    setPlan(null);
    api.plan(spec).then((p) => { if (alive) setPlan(p); }).catch((e) => toast(e.message, 'error'));
    if (!spec.folder && spec.name) api.suggestFolder(spec.name).then((r) => { if (alive) setSpec((s) => ({ ...s, folder: s.folder || r.folder })); }).catch(() => {});
    return () => { alive = false; };
  }, [step.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!spec.folder) { setFolderNote(''); return; }
    const t = setTimeout(() => { api.checkFolder(spec.folder).then((r) => setFolderNote(r.ok ? '' : r.reason ?? '')).catch(() => {}); }, 400);
    return () => clearTimeout(t);
  }, [spec.folder]);

  const suggestNames = async () => {
    setNamesBusy(true);
    try { const r = await api.names(spec); setNames(r.names ?? []); if (r.error) toast(r.error, 'error'); } catch (e) { toast((e as Error).message, 'error'); } finally { setNamesBusy(false); }
  };
  const askQuestions = async () => {
    setQBusy(true);
    try { const r = await api.questions(spec); setQuestions(r.questions ?? []); if (r.error) toast(r.error, 'error'); } catch (e) { toast((e as Error).message, 'error'); } finally { setQBusy(false); }
  };

  const canNext = step.id !== 'what' || !!spec.archetype;
  const next = () => setAt((n) => Math.min(STEPS.length - 1, n + 1));
  const back = () => setAt((n) => Math.max(0, n - 1));

  const build = async () => {
    if (!spec.name.trim()) { toast('Give it a name first — or press Suggest names.', 'error'); setAt(2); return; }
    if (detection && !detection.ok) { toast('Something is missing on this machine. Check the requirements first.', 'error'); navigate({ name: 'setup' }); return; }
    setBuilding(true);
    try {
      const notes = [spec.notes ?? '', ...Object.entries(answers).map(([q, a]) => `${questions?.find((x) => x.id === q)?.question ?? q}: ${a.join(', ')}`)].filter(Boolean).join('\n');
      const project = await api.createProject({ ...spec, notes });
      localStorage.removeItem(DRAFT);
      await api.generate(project.id);
      navigate({ name: 'project', id: project.id });
    } catch (e) { toast((e as Error).message, 'error'); setBuilding(false); }
  };

  if (!catalogue) return <div className="pt-24 flex items-center gap-3 text-bone-2 justify-center"><Spinner /> Loading the catalogue…</div>;
  const arch = catalogue.archetypes.find((a) => a.id === spec.archetype);
  const progressPct = ((at + 1) / STEPS.length) * 100;

  return (
    <div className="shell-wide pt-8">
      {/* Progress */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3 min-w-0">
          <span className="telemetry text-bone-3 shrink-0">{String(at + 1).padStart(2, '0')} / {STEPS.length}</span>
          <div className="hidden md:flex gap-1 flex-wrap">
            {STEPS.map((s, i) => (
              <button key={s.id} onClick={() => i <= at && setAt(i)} className={cx('h-1.5 rounded-full transition-all', i < at ? 'bg-volt w-5' : i === at ? 'bg-bone w-8' : 'bg-line-2 w-3', i <= at ? 'cursor-pointer' : 'cursor-default')} aria-label={s.title} />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saved.current && at > 0 && <span className="telemetry text-bone-3 hidden md:inline">draft restored</span>}
          <Button size="sm" variant="quiet" icon="x" onClick={() => { if (confirm('Throw this draft away?')) { localStorage.removeItem(DRAFT); navigate({ name: 'projects' }); } }}>Discard</Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(380px,44%)] gap-10 items-start">
        <div className="min-w-0">
          <Index n={at + 1} className="mb-4">{step.id === 'go' ? 'Ready to build' : step.id}</Index>
          <h1 className="d3">{step.title}</h1>
          <p className="copy mt-3 mb-8">{step.lede}</p>

          <div key={step.id} className="fade">
            {step.id === 'what' && (
              <div className="space-y-6">
                <PickOne options={catalogue.archetypes} value={spec.archetype} onChange={chooseArchetype} cols={2} />
                {arch && arch.sectors.length > 0 && (
                  <div>
                    <p className="legend mb-2">More precisely</p>
                    <div className="flex flex-wrap gap-2">{arch.sectors.map((s) => <Chip key={s.id} active={spec.sector === s.id} onClick={() => set('sector', spec.sector === s.id ? undefined : s.id)}>{s.label}</Chip>)}</div>
                  </div>
                )}
              </div>
            )}

            {step.id === 'goal' && <PickOne options={catalogue.goals} value={spec.goal} onChange={(v) => set('goal', v)} cols={2} />}

            {step.id === 'details' && (
              <div className="space-y-5">
                <div>
                  <div className="flex items-end justify-between mb-1.5"><span className="legend">Name</span><Button size="sm" variant="quiet" icon="sparkle" busy={namesBusy} onClick={suggestNames}>Suggest names</Button></div>
                  <Input placeholder="The business, as it should appear" value={spec.name} onChange={(e) => set('name', e.target.value)} autoFocus />
                  {names && <div className="flex flex-wrap gap-2 mt-2">{names.map((n) => <Chip key={n.name} active={spec.name === n.name} onClick={() => set('name', n.name)}>{n.name}</Chip>)}</div>}
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Labelled label="Tagline"><Input placeholder="Fire, slowly." value={spec.details?.tagline ?? ''} onChange={(e) => set('details', { ...spec.details, tagline: e.target.value })} /></Labelled>
                  <Labelled label="Where"><Input placeholder="Lisbon" value={spec.details?.location ?? ''} onChange={(e) => set('details', { ...spec.details, location: e.target.value })} /></Labelled>
                  <Labelled label="Phone"><Input placeholder="+351 …" value={spec.details?.phone ?? ''} onChange={(e) => set('details', { ...spec.details, phone: e.target.value })} /></Labelled>
                  <Labelled label="Email (also the admin login)"><Input placeholder="hello@…" value={spec.details?.email ?? ''} onChange={(e) => set('details', { ...spec.details, email: e.target.value })} /></Labelled>
                  <Labelled label="Hours"><Input placeholder="Tue–Sun 12–23" value={spec.details?.hours ?? ''} onChange={(e) => set('details', { ...spec.details, hours: e.target.value })} /></Labelled>
                  <Labelled label="Since"><Input placeholder="2014" value={spec.details?.founded ?? ''} onChange={(e) => set('details', { ...spec.details, founded: e.target.value })} /></Labelled>
                </div>
                <TagInput label="Known for" placeholder="Type a thing and press Enter" values={spec.details?.knownFor ?? []} onChange={(v) => set('details', { ...spec.details, knownFor: v })} />
                <TagInput label="What you offer" placeholder="A service or product, then Enter" values={spec.details?.offerings ?? []} onChange={(v) => set('details', { ...spec.details, offerings: v })} />
                <Labelled label="Anything else, in your own words (optional)"><Textarea rows={3} placeholder="The one thing no form can hold." value={spec.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Labelled>
              </div>
            )}

            {step.id === 'contents' && (
              <div className="space-y-7">
                <div><p className="legend mb-2">Pages</p><ChipMany options={catalogue.pages} value={spec.pages ?? []} onChange={(v) => set('pages', v)} /></div>
                <div><p className="legend mb-2">Things it can do</p><PickMany options={catalogue.features} value={spec.features ?? []} onChange={(v) => set('features', v)} cols={2} compact /></div>
              </div>
            )}

            {step.id === 'palette' && <PickSwatch options={catalogue.palettes} value={spec.palette} onChange={(v) => set('palette', v)} />}
            {step.id === 'type' && <PickOne options={catalogue.typography} value={spec.typography} onChange={(v) => set('typography', v)} cols={2} compact />}
            {step.id === 'atmosphere' && <PickOne options={catalogue.atmospheres} value={spec.atmosphere} onChange={(v) => set('atmosphere', v)} cols={2} compact />}
            {step.id === 'layout' && <PickOne options={catalogue.layouts} value={spec.layout} onChange={(v) => set('layout', v)} cols={2} />}
            {step.id === 'scene' && (
              <PickOne options={orderScenes(catalogue, spec.archetype)} value={spec.scene} onChange={(v) => set('scene', v)} cols={2}
                renderExtra={(c) => <div className="flex gap-2 mt-1.5">{c.weight && <span className={cx('telemetry', c.weight === 'heavy' ? 'text-danger' : 'text-bone-4')}>{c.weight} on phones</span>}{c.suits?.includes(spec.archetype ?? '') && <span className="telemetry text-volt">suits you</span>}</div>} />
            )}

            {step.id === 'motion' && (
              <div className="space-y-7">
                <Group label="Intensity"><PickOne options={catalogue.motionIntensity} value={spec.motionIntensity} onChange={(v) => set('motionIntensity', v)} cols={3} compact /></Group>
                <Group label="Scroll"><PickOne options={catalogue.scrollStyles} value={spec.scrollStyle} onChange={(v) => set('scrollStyle', v)} cols={2} compact /></Group>
                <Group label="Hover"><PickOne options={catalogue.hoverStyles} value={spec.hoverStyle} onChange={(v) => set('hoverStyle', v)} cols={3} compact /></Group>
                <Group label="Cursor"><PickOne options={catalogue.cursorStyles} value={spec.cursorStyle} onChange={(v) => set('cursorStyle', v)} cols={4} compact /></Group>
                <Group label="Page transitions"><PickOne options={catalogue.transitions} value={spec.transition} onChange={(v) => set('transition', v)} cols={4} compact /></Group>
              </div>
            )}

            {step.id === 'theme' && <PickOne options={catalogue.themes} value={spec.theme} onChange={(v) => set('theme', v)} cols={3} compact />}

            {step.id === 'reference' && <ReferenceStep urls={spec.references ?? []} dna={spec.dna ?? []} onChange={(urls, dna: DesignDNA[]) => setSpec((s) => ({ ...s, references: urls, dna }))} />}

            {step.id === 'analytics' && (
              <div className="space-y-7">
                <Group label="Analytics — choose any"><PickMany options={catalogue.analytics} value={spec.analytics ?? []} onChange={(v) => set('analytics', v)} cols={2} compact /></Group>
                <Group label="Where forms go"><PickOne options={catalogue.crm} value={spec.crm} onChange={(v) => set('crm', v)} cols={1} compact /></Group>
              </div>
            )}

            {step.id === 'deploy' && <PickOne options={catalogue.deploy} value={spec.deploy} onChange={(v) => set('deploy', v)} cols={2} />}

            {step.id === 'go' && (
              <GoStep spec={spec} plan={plan} showBrief={showBrief} setShowBrief={setShowBrief} setSpec={setSpec} folderNote={folderNote}
                questions={questions} qBusy={qBusy} askQuestions={askQuestions} answers={answers} setAnswers={setAnswers} build={build} building={building} />
            )}
          </div>

          <div className="flex items-center justify-between mt-10 pt-6 border-t border-line">
            <Button variant="quiet" icon="arrowLeft" onClick={back} disabled={at === 0}>Back</Button>
            <div className="flex items-center gap-2">
              {step.id !== 'go' && step.id !== 'what' && <Button variant="quiet" onClick={next}>Skip</Button>}
              {step.id !== 'go' && <Button variant="primary" iconRight="arrowRight" onClick={next} disabled={!canNext}>{at === STEPS.length - 2 ? 'Review' : 'Next'}</Button>}
            </div>
          </div>
        </div>

        <div className="hidden lg:block">
          <LivePreview spec={spec} catalogue={catalogue} name={spec.name} />
          <div className="mt-4 h-1 rounded bg-ink-3 overflow-hidden"><div className="h-full bg-volt transition-all duration-500" style={{ width: `${progressPct}%` }} /></div>
        </div>
      </div>
    </div>
  );
}

function pick<T extends object, K extends keyof T>(o: T, keys: K[]): Partial<T> { const out: Partial<T> = {}; for (const k of keys) if (k in o) out[k] = o[k]; return out; }

function orderScenes(catalogue: Catalogue, archetype?: string) {
  const fits = catalogue.scenes.filter((s) => s.suits?.includes(archetype ?? ''));
  const rest = catalogue.scenes.filter((s) => !s.suits?.includes(archetype ?? '') && s.id !== 'none');
  return [...fits, ...rest, ...catalogue.scenes.filter((s) => s.id === 'none')];
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="legend block mb-1.5">{label}</span>{children}</label>; }
function Group({ label, children }: { label: string; children: React.ReactNode }) { return <div><p className="legend mb-2">{label}</p>{children}</div>; }

function TagInput({ label, placeholder, values, onChange }: { label: string; placeholder: string; values: string[]; onChange: (v: string[]) => void }) {
  const [v, setV] = useState('');
  const add = () => { const t = v.trim(); if (!t) return; onChange([...values, t].slice(0, 8)); setV(''); };
  return (
    <div>
      <span className="legend block mb-1.5">{label}</span>
      <div className="flex flex-wrap gap-2 mb-2">{values.map((x) => <span key={x} className="chip !cursor-default">{x}<button onClick={() => onChange(values.filter((y) => y !== x))} className="text-bone-3 hover:text-bone"><Icon name="x" size={12} /></button></span>)}</div>
      <Input placeholder={placeholder} value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
    </div>
  );
}

function GoStep({ spec, plan, showBrief, setShowBrief, setSpec, folderNote, questions, qBusy, askQuestions, answers, setAnswers, build, building }: {
  spec: Draft; plan: Plan | null; showBrief: boolean; setShowBrief: (b: boolean) => void; setSpec: React.Dispatch<React.SetStateAction<Draft>>; folderNote: string;
  questions: Question[] | null; qBusy: boolean; askQuestions: () => void; answers: Record<string, string[]>; setAnswers: React.Dispatch<React.SetStateAction<Record<string, string[]>>>; build: () => void; building: boolean;
}) {
  const detection = useStore((s) => s.detection);
  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <Labelled label="Name"><Input value={spec.name} onChange={(e) => setSpec((s) => ({ ...s, name: e.target.value }))} placeholder="Required" /></Labelled>
        <Labelled label="Folder"><Input value={spec.folder} onChange={(e) => setSpec((s) => ({ ...s, folder: e.target.value }))} /></Labelled>
      </div>
      {folderNote && <p className="text-[13px] text-danger -mt-3">{folderNote}</p>}

      {!plan ? <div className="panel p-6 flex items-center gap-3 text-bone-2"><Spinner /> Compiling the brief…</div> : (
        <>
          <div className="panel p-5">
            <div className="flex items-center justify-between mb-3"><span className="legend">Stages</span><span className="telemetry text-bone-3">{plan.estimate.minutes[0]}–{plan.estimate.minutes[1]} min · roughly ${plan.estimate.lowUsd}–{plan.estimate.highUsd} of usage</span></div>
            <ol className="grid sm:grid-cols-2 gap-2">
              {[{ id: 'scaffold', label: 'Template and dependencies', blurb: 'Copy the starter, write your tokens, install' }, ...plan.stages].map((s, i) => (
                <li key={s.id} className="flex gap-3 rounded-lg bg-ink-3 border border-line p-3"><span className="telemetry text-volt w-5">{i}</span><div><div className="font-semibold text-[13.5px]">{s.label}</div><div className="text-[12.5px] text-bone-3 leading-snug mt-0.5">{s.blurb}</div></div></li>
              ))}
            </ol>
            <p className="telemetry text-bone-3 mt-3">{plan.estimate.caveat}</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="opt flex items-start gap-3 cursor-pointer" data-on={spec.review !== false}>
              <input type="checkbox" className="mt-1 accent-[#C8FF3D]" checked={spec.review !== false} onChange={(e) => setSpec((s) => ({ ...s, review: e.target.checked }))} />
              <span><span className="font-semibold block">Run the award-jury pass</span><span className="text-[12.5px] text-bone-3">A final stage that scores the site against the rubric and fixes what fails. Costs a little more; raises the bar a lot.</span></span>
            </label>
            <div className="opt" data-on={!!spec.budgetUsd}>
              <div className="flex items-center justify-between"><span className="font-semibold">Spending ceiling</span><span className="telemetry text-bone-2">{spec.budgetUsd ? `$${spec.budgetUsd}` : 'none'}</span></div>
              <input type="range" min={0} max={60} step={5} value={spec.budgetUsd ?? 0} onChange={(e) => setSpec((s) => ({ ...s, budgetUsd: Number(e.target.value) || undefined }))} className="slider mt-2" />
              <span className="text-[12.5px] text-bone-3">Stops the build if Claude Code reports more than this. Optional; on a subscription it is usage, not dollars.</span>
            </div>
          </div>

          {plan.secrets.length > 0 && (
            <div className="panel p-5">
              <span className="legend block mb-2">Keys you will add later</span>
              <p className="text-[13px] text-bone-2 mb-3">The site reads these from its own <code className="telemetry">.env.local</code>. You add values from the project screen (or before publishing). Nothing is stored by Super Builds.</p>
              <div className="flex flex-wrap gap-2">{plan.secrets.map((s) => <span key={s.key} className="chip !cursor-default telemetry">{s.key}<span className="text-bone-4">· {s.label}</span></span>)}</div>
            </div>
          )}
          {plan.caveats.length > 0 && <ul className="text-[13px] text-bone-3 space-y-1">{plan.caveats.map((c) => <li key={c} className="flex gap-2"><Icon name="alert" size={14} className="text-bone-4 shrink-0 mt-0.5" />{c}</li>)}</ul>}

          <div className="panel p-5">
            <div className="flex items-center justify-between"><span className="legend">A few things only you know</span>{!questions && <Button size="sm" icon="chat" busy={qBusy} onClick={askQuestions}>Ask me</Button>}</div>
            {!questions && <p className="text-[13px] text-bone-3 mt-2">Optional. Claude reads everything above and asks two to five questions with answers to pick from. Skip it and it decides well.</p>}
            {questions && questions.length === 0 && <p className="text-[13px] text-bone-3 mt-2">Nothing to ask — it has what it needs.</p>}
            {questions && questions.length > 0 && (
              <div className="space-y-4 mt-3">
                {questions.map((q) => (
                  <div key={q.id}>
                    <div className="font-semibold text-[14px]">{q.question}</div>
                    {q.why && <div className="text-[12.5px] text-bone-3 mb-2">{q.why}</div>}
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {q.options.map((o) => {
                        const on = (answers[q.id] ?? []).includes(o.label);
                        return <Chip key={o.label} active={on} onClick={() => setAnswers((a) => ({ ...a, [q.id]: q.multi ? (on ? (a[q.id] ?? []).filter((x) => x !== o.label) : [...(a[q.id] ?? []), o.label]) : [o.label] }))}>{o.label}</Chip>;
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <button className="telemetry text-volt inline-flex items-center gap-1" onClick={() => setShowBrief(!showBrief)}><Icon name="doc" size={13} /> {showBrief ? 'Hide' : 'Read'} the full brief ({plan.brief.split('\n').length} lines)</button>
            {showBrief && <pre className="panel p-4 mt-2 text-[12px] leading-relaxed whitespace-pre-wrap max-h-[420px] overflow-auto text-bone-2 font-mono">{plan.brief}</pre>}
          </div>

          {detection && !detection.ok && <div className="panel p-4 border-danger/40 flex items-center justify-between gap-3"><span className="text-[13.5px]">Something is missing on this machine.</span><Button size="sm" onClick={() => navigate({ name: 'setup' })}>Check requirements</Button></div>}

          <div className="flex items-center gap-3 pt-2">
            <Button variant="primary" size="lg" icon="rocket" busy={building} onClick={build} disabled={!spec.name.trim() || !!folderNote}>Build it</Button>
            <span className="text-[13px] text-bone-3">Creates the folder, installs, then builds in stages while you watch. You can stop at any time.</span>
          </div>
        </>
      )}
    </div>
  );
}
