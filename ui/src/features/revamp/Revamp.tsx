/**
 * Revamping a site somebody already has.
 *
 * ── Three presses, and the third one is the wizard ──────────────────────────
 *
 * Point at it, let it be read, then answer the same eighteen questions a new
 * site is built from — except every one of them opens with an answer already
 * in it, taken from what the site is. That is the whole design: this is not a
 * second product, it is the same product with the words already written.
 *
 * ── Why the reading is shown before anything is changed ─────────────────────
 *
 * Handing somebody's live website to an agent is a large thing to ask, and the
 * only honest way to ask it is to show your working first: this is what I think
 * you do, this is what your site gets right, this is what is holding it back,
 * and here is exactly what I will and will not touch. If the reading is wrong
 * the person finds out here, for the price of two minutes, rather than after a
 * redesign built on it.
 */

import { useEffect, useRef, useState } from 'react';
import type { SiteSurvey, Spec, Understanding } from '@superbuilds/protocol';
import { api } from '@/lib/api';
import { useStore, navigate, toast } from '@/lib/store';
import { Button, Index, Input, Spinner, cx } from '@/components/ui';
import { FolderField } from '@/components/FolderPicker';
import { Icon } from '@/components/icons';

/** The wizard reads this on mount; writing it is the hand-off. */
const DRAFT = 'sb:draft:v2';

export function Revamp() {
  const [path, setPath] = useState('');
  const [url, setUrl] = useState('');
  const [survey, setSurvey] = useState<SiteSurvey | null>(null);
  const [understanding, setUnderstanding] = useState<Understanding | null>(null);
  const [surveying, setSurveying] = useState(false);
  const [reading, setReading] = useState(false);
  const [captureId, setCaptureId] = useState<string | null>(null);
  const captures = useStore((s) => s.captures);
  const capture = captureId ? captures[captureId] : undefined;
  const readingRef = useRef(false);

  const look = async (which?: string) => {
    const p = (which ?? path).trim();
    if (!p) return;
    if (which && which !== path) setPath(which);
    setSurveying(true); setUnderstanding(null); setSurvey(null);
    try {
      const s = await api.survey(p);
      setSurvey(s);
      if (!s.ok) toast(s.reason ?? 'That folder could not be read.', 'error');
      // A live address is optional and worth a lot: reading the source tells
      // you what the site says, and a screenshot tells you what it looks like.
      const u = url.trim();
      if (s.ok && u) {
        try { const cap = await api.capture(/^https?:\/\//i.test(u) ? u : `https://${u}`); setCaptureId(cap.id); }
        catch (e) { toast(`Could not photograph the live site: ${(e as Error).message}`, 'error'); }
      }
    } catch (e) { toast((e as Error).message, 'error'); } finally { setSurveying(false); }
  };

  const read = async () => {
    if (!survey?.ok || readingRef.current) return;
    readingRef.current = true;
    setReading(true);
    try {
      const r = await api.understand(survey.path, capture?.shots ?? []);
      setSurvey(r.survey);
      if (r.understanding) setUnderstanding(r.understanding);
      if (r.error) toast(`It could not finish reading the site: ${r.error}. You can still answer the questions yourself.`, 'error');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setReading(false); readingRef.current = false; }
  };

  // The capture and the reading are independent, but the reading is better with
  // pictures — so wait for the shots if any were asked for.
  useEffect(() => {
    if (!survey?.ok || understanding || reading) return;
    if (captureId && capture?.status !== 'done' && capture?.status !== 'failed') return;
    void read();
  }, [survey?.ok, capture?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Hand off to the wizard with everything already answered.
   *
   * A draft in localStorage rather than a route parameter, because that is the
   * shape the wizard already restores from — so a person who closes the tab
   * halfway through picking a palette comes back to exactly where they were,
   * revamp or not.
   */
  const choose = () => {
    if (!survey?.ok) return;
    const u = understanding;
    const spec: Partial<Spec> & { name: string; folder: string } = {
      mode: 'revamp',
      name: u?.name || survey.packageName || 'This site',
      folder: survey.path,
      ...(u?.archetype ? { archetype: u.archetype } : {}),
      ...(u?.goal ? { goal: u.goal } : {}),
      ...(u?.belief ? { belief: u.belief } : {}),
      ...(u?.pages?.length ? { pages: u.pages } : {}),
      ...(u?.features?.length ? { features: u.features } : {}),
      ...(u?.details ? { details: u.details } : {}),
      ...(u?.customPalette ? { customPalette: u.customPalette } : {}),
      ...(u?.suggests?.palette ? { palette: u.suggests.palette } : {}),
      ...(u?.suggests?.typography ? { typography: u.suggests.typography } : {}),
      ...(u?.suggests?.atmosphere ? { atmosphere: u.suggests.atmosphere } : {}),
      ...(u?.suggests?.layout ? { layout: u.suggests.layout } : {}),
      ...(u?.suggests?.scene ? { scene: u.suggests.scene } : {}),
      ...(u?.suggests?.motionIntensity ? { motionIntensity: u.suggests.motionIntensity } : {}),
      ...(u?.suggests?.scrollStyle ? { scrollStyle: u.suggests.scrollStyle } : {}),
      ...(u?.suggests?.hoverStyle ? { hoverStyle: u.suggests.hoverStyle } : {}),
      ...(u?.suggests?.cursorStyle ? { cursorStyle: u.suggests.cursorStyle } : {}),
      ...(u?.suggests?.transition ? { transition: u.suggests.transition } : {}),
      ...(u?.suggests?.theme ? { theme: u.suggests.theme } : {}),
      ...(u?.suggests?.signature ? { signature: u.suggests.signature } : {}),
      // What the reading found goes into the brief as prose, so the build knows
      // what to protect even where no option captures it.
      notes: [
        u?.summary && `What this is: ${u.summary}`,
        u?.keep?.length && `Keep, whatever else changes:\n${u.keep.map((k) => `- ${k}`).join('\n')}`,
        u?.problems?.length && `What is holding it back:\n${u.problems.map((k) => `- ${k}`).join('\n')}`,
      ].filter(Boolean).join('\n\n'),
    };
    // Skip the reference screen: the site itself is the reference here.
    localStorage.setItem(DRAFT, JSON.stringify({ spec, at: 1 }));
    navigate({ name: 'new' });
  };

  return (
    <div className="shell pt-10 pb-24">
      <Index n={1} className="mb-4">Revamp</Index>
      <h1 className="d2">A site you already have.</h1>
      <p className="copy mt-3">
        Point at the folder it lives in. It gets read — the framework, the pages, the words, what it
        is trying to do — and then you answer the same questions a new site is built from, with every
        one of them already filled in. Your URLs, your words and your data stay exactly as they are.
      </p>

      <div className="panel p-5 mt-8 grid gap-4">
        <FolderField
          label="The folder the site lives in"
          value={path}
          onChange={setPath}
          onCommit={(p) => { if (p.trim()) void look(p); }}
          autoFocus
        />
        <label className="block">
          <span className="legend block mb-1.5">Its live address (optional)</span>
          <Input placeholder="https://the-restaurant.com" value={url} onChange={(e) => setUrl(e.target.value)} />
          <span className="block telemetry text-bone-4 mt-1.5">If you give it, the site is photographed while scrolling and the pictures are read too.</span>
        </label>
        <div className="flex items-center gap-3">
          <Button variant="primary" icon="search" busy={surveying} disabled={!path.trim()} onClick={() => void look()}>Look at it</Button>
          <span className="text-[13px] text-bone-3">Nothing is changed. This only reads.</span>
        </div>
      </div>

      {survey && !survey.ok && (
        <div className="panel p-5 mt-4 border-danger/40 flex items-start gap-3">
          <Icon name="alert" size={18} className="text-danger mt-0.5 shrink-0" />
          <div><div className="font-semibold">That is not a website I can read.</div><p className="text-[13.5px] text-bone-2 mt-1">{survey.reason}</p></div>
        </div>
      )}

      {survey?.ok && (
        <>
          <SurveyCard survey={survey} />

          {capture && (
            <div className="panel mt-4 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-line">
                <span className="legend">The live site</span>
                <span className={cx('telemetry', capture.status === 'failed' ? 'text-danger' : capture.status === 'done' ? 'text-volt' : 'text-bone-2')}>
                  {capture.status === 'done' ? 'photographed' : capture.status === 'failed' ? 'could not reach it' : <span className="inline-flex items-center gap-2"><Spinner size={12} /> {capture.status}…</span>}
                </span>
              </div>
              {capture.shots.length > 0 && (
                <div className="grid grid-cols-5 gap-1 p-2">
                  {capture.shots.map((s) => <img key={s} src={s} alt="" className="aspect-[16/10] object-cover object-top rounded border border-line" />)}
                </div>
              )}
            </div>
          )}

          {reading && (
            <div className="panel p-5 mt-4 flex items-center gap-3 text-bone-2">
              <Spinner className="text-volt" />
              <div>
                <div className="font-semibold text-[14px]">Reading the site.</div>
                <div className="text-[13px] text-bone-3">Its pages, its words, and what it is for. A minute or two.</div>
              </div>
            </div>
          )}

          {understanding && <UnderstandingCard u={understanding} />}

          {!reading && (
            <div className="flex flex-wrap items-center gap-3 mt-6">
              <Button variant="primary" size="lg" icon="sparkle" onClick={choose}>
                {understanding ? 'Choose how it should look' : 'Answer the questions myself'}
              </Button>
              {!understanding && <Button variant="quiet" icon="refresh" onClick={read}>Try reading it again</Button>}
              <span className="text-[13px] text-bone-3">Still nothing changed. The next screens are all choices.</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SurveyCard({ survey }: { survey: SiteSurvey }) {
  return (
    <div className="panel p-5 mt-4">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Icon name="check" size={16} className="text-volt" />
          <span className="font-semibold">{survey.frameworkLabel}</span>
          {survey.typescript && <span className="telemetry text-bone-3">TypeScript</span>}
          {survey.tailwind && <span className="telemetry text-bone-3">Tailwind</span>}
        </div>
        <span className="telemetry text-bone-4 truncate max-w-[40%]">{survey.path}</span>
      </div>

      <div className="grid sm:grid-cols-4 gap-3 mb-4">
        <Stat n={survey.routes.length} label={survey.routes.length === 1 ? 'public page' : 'public pages'} />
        <Stat n={survey.images} label="images" />
        <Stat n={survey.fileCount} label="files" />
        <Stat
          n={survey.git.repo ? (survey.git.clean ? '✓' : survey.git.dirty) : '—'}
          label={survey.git.repo ? (survey.git.clean ? 'git, clean' : 'uncommitted') : 'no git yet'}
        />
      </div>

      {survey.routes.length > 0 && (
        <div>
          <div className="legend mb-2">These addresses keep working, unchanged</div>
          <div className="flex flex-wrap gap-1.5">
            {survey.routes.map((r) => <span key={r} className="chip !cursor-default telemetry">{r}</span>)}
          </div>
        </div>
      )}

      {survey.privateRoutes.length > 0 && (
        <div className="mt-4">
          <div className="legend mb-2">Behind a login — new colours, same layout</div>
          <div className="flex flex-wrap gap-1.5">
            {survey.privateRoutes.map((r) => (
              <span key={r} className="chip !cursor-default telemetry text-bone-3"><Icon name="lock" size={11} />{r}</span>
            ))}
          </div>
          <p className="text-[12.5px] text-bone-4 mt-2 measure">
            A table of your customers is not a marketing page. These get the new palette and type and
            keep everything else — no hero, no 3D, no rearranging.
          </p>
        </div>
      )}

      {survey.notes.length > 0 && (
        <ul className="mt-4 grid gap-2">
          {survey.notes.map((n) => (
            <li key={n} className="flex gap-2.5 text-[13px] text-bone-2">
              <Icon name="alert" size={14} className="text-warn shrink-0 mt-0.5" />{n}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="rounded-lg bg-ink-3 border border-line px-3 py-2.5">
      <div className="text-[22px] font-semibold leading-none num">{n}</div>
      <div className="telemetry text-bone-4 mt-1.5">{label}</div>
    </div>
  );
}

function UnderstandingCard({ u }: { u: Understanding }) {
  return (
    <div className="panel p-5 mt-4 space-y-5">
      <div className="flex items-start gap-3">
        <Icon name="sparkle" size={18} className="text-volt mt-0.5 shrink-0" />
        <div>
          <div className="font-semibold text-[15px]">{u.name}</div>
          <p className="text-[13.5px] text-bone-2 mt-1 measure">{u.summary}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <div className="legend mb-2 text-volt">What it gets right — all of this survives</div>
          <ul className="grid gap-1.5 text-[13px] text-bone-2">
            {u.keep.map((k) => <li key={k} className="flex gap-2"><Icon name="check" size={13} className="text-volt shrink-0 mt-1" />{k}</li>)}
          </ul>
        </div>
        <div>
          <div className="legend mb-2 text-warn">What is holding it back — this is the work</div>
          <ul className="grid gap-1.5 text-[13px] text-bone-2">
            {u.problems.map((k) => <li key={k} className="flex gap-2"><Icon name="arrowRight" size={13} className="text-warn shrink-0 mt-1" />{k}</li>)}
          </ul>
        </div>
      </div>

      <p className="text-[12.5px] text-bone-4 measure">
        Disagree with any of it on the next screens — every one of these is a question with your
        answer already filled in, not a decision that has been made.
      </p>
    </div>
  );
}
