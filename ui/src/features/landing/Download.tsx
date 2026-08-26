/**
 * Getting the app, and the honest reason there is no link yet.
 *
 * ── Why three buttons that do not download anything ─────────────────────────
 *
 * Because the alternative is worse in both directions. A page with no download
 * row reads as a project that is not finished, and a download row with a dead
 * link reads as one that is broken — and the second is the one people tell
 * other people about. What is true is narrower and more interesting than
 * either: the builds exist and work; what does not exist is a *signed,
 * publicly downloadable installer*, which is a certificate and a release
 * pipeline rather than a program.
 *
 * So the row is real, it names what each build actually is, and pressing one
 * says the true thing in the first sentence rather than after a paragraph of
 * apology. There are two ways out of that sentence and both are real: ask and
 * get a build today, or leave an address and hear when the public one lands.
 *
 * ── Why it guesses your platform ────────────────────────────────────────────
 *
 * Three identical cards make everybody read all three, and the answer is on the
 * machine already. It is marked rather than filtered: all three stay pressable,
 * so a wrong guess costs a highlight in the wrong place and never a build
 * somebody cannot reach.
 *
 * ── Why the demo is a row here rather than a video to hunt for ──────────────
 *
 * Somebody who has just been told they cannot download it yet has exactly one
 * next question, which is what it actually does. The answer belongs on the
 * same block, at the same size, not four sections further down.
 */

import { useEffect, useRef, useState } from 'react';
import { Button, cx } from '@/components/ui';
import { Icon } from '@/components/icons';
import { ContactCard } from './Contact';
import { PLATFORMS, currentPlatform, type Platform, type PlatformId } from './platform';
import { playDemo, DEMO } from './Demo';

const EMAIL = 'gsneeraj2002@gmail.com';

/** The two real ways out of "there is no link". Both are a message to a person. */
function mailto(subject: string, body: string): string {
  return `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const askFor = (p: Platform) => mailto(
  `Super Builds — a build for ${p.name}`,
  `Hello,\n\nCould you send me a Super Builds build for ${p.name}?\n\nWhat I would use it for:\n\n\nThank you,\n`,
);

const WAITLIST = mailto(
  'Super Builds — waitlist',
  'Hello,\n\nPlease let me know when the public download is out.\n\nThank you,\n',
);

export function Download() {
  const [asking, setAsking] = useState<Platform | null>(null);
  const mine = useMyPlatform();

  return (
    <section id="get" className="py-16 md:py-20 border-t border-line scroll-mt-[52px]">
      <div className="shell-wide">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-6">
          <h2 className="legend">Get the app</h2>
          <p className="text-[13.5px] text-bone-2">
            Every build works. What is not ready is a signed installer you can download without
            asking — so there is no link here rather than a link that fails.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-2.5">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setAsking(p)}
              className={cx(
                'group text-left rounded-xl border p-4 transition-colors min-w-0',
                mine === p.id ? 'border-volt-3 bg-volt-2/60' : 'border-line bg-ink-2/70 hover:border-line-2 hover:bg-ink-2',
              )}
            >
              <span className="flex items-center gap-3">
                <span className={cx('shrink-0 w-9 h-9 rounded-lg grid place-items-center border', mine === p.id ? 'border-volt/40 text-volt' : 'border-line text-bone-3')}>
                  <Icon name={p.icon} size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cx('block font-semibold text-[14px]', mine === p.id && 'text-volt')}>{p.name}</span>
                  <span className="block telemetry text-bone-4 truncate mt-0.5">{p.formats}</span>
                </span>
                <Icon name="arrowRight" size={14} className="shrink-0 text-bone-4 group-hover:text-bone transition-colors" />
              </span>
              {mine === p.id && <span className="block telemetry text-volt-3 mt-2.5">this looks like your machine</span>}
            </button>
          ))}
        </div>

        {/* The next question, at the same size as the thing that provoked it. */}
        <button
          type="button"
          onClick={playDemo}
          className="group w-full text-left rounded-xl border border-line bg-ink-2/70 hover:border-line-2 hover:bg-ink-2 transition-colors p-4 mt-2.5 flex items-center gap-3"
        >
          <span className="shrink-0 w-9 h-9 rounded-lg grid place-items-center border border-line text-bone-3 group-hover:text-volt group-hover:border-volt/40 transition-colors">
            <Icon name="play" size={15} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-[14px]">See it happen instead</span>
            <span className="block telemetry text-bone-4 mt-0.5">{DEMO.length ? `${DEMO.length}. ` : ''}One site, start to finish, unedited</span>
          </span>
          <Icon name="arrowRight" size={14} className="shrink-0 text-bone-4 group-hover:text-bone transition-colors" />
        </button>
      </div>

      {asking && <AskPanel platform={asking} onClose={() => setAsking(null)} />}
    </section>
  );
}

/**
 * What pressing a platform says.
 *
 * The true sentence is first and it is one sentence. Everything after it is
 * either a way out or an answer to the question the sentence provokes, and the
 * addresses are `ContactCard` rather than a fourth copy of them.
 */
function AskPanel({ platform, onClose }: { platform: Platform; onClose: () => void }) {
  const [reach, setReach] = useState(false);
  const [why, setWhy] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => panel.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey, true); before?.focus?.(); };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center p-4 fade bg-ink/75 backdrop-blur-[3px]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={`${platform.name}: how to get a build`}
    >
      <div ref={panel} tabIndex={-1} className="panel noise relative w-[min(520px,100%)] max-h-[min(88svh,800px)] overflow-y-auto p-6 shadow-2xl shadow-black/70 rise outline-none">
        <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 text-bone-4 hover:text-bone transition-colors">
          <Icon name="x" size={14} />
        </button>

        <h3 className="legend">{platform.name}</h3>
        <p className="d3 mt-2 pr-6">Built and working. Not downloadable yet.</p>

        <p className="text-[13.5px] leading-relaxed text-bone-2 mt-4">
          The {platform.name} build is the one I use — it is finished software, not a preview. What
          does not exist is the signed installer anybody can fetch without asking, which is a
          certificate and a release pipeline rather than a program. Rather than give you a link that
          fails, here are the two things that actually work.
        </p>

        <div className="flex flex-wrap gap-2 mt-5">
          <Button variant="primary" icon="mail" onClick={() => setReach((v) => !v)}>
            {reach ? 'Hide the addresses' : 'Ask me for a build'}
          </Button>
          <a className="btn btn-ghost" href={WAITLIST}>Tell me when it is public</a>
        </div>
        <p className="text-[12px] leading-relaxed text-bone-4 mt-2.5">
          Both open your mail app. There is no form here because there is no server here — which is
          also the reason the tool itself never holds a key for anybody.
        </p>

        {/* The question the offer provokes, answered where it is asked. */}
        <button
          onClick={() => setWhy((v) => !v)}
          aria-expanded={why}
          className="mt-5 flex items-center gap-1.5 text-[13px] text-bone-2 hover:text-bone transition-colors"
        >
          <Icon name="chevronDown" size={13} className={cx('transition-transform', why && 'rotate-180')} />
          What is a private build?
        </button>
        {why && (
          <p className="text-[13px] leading-relaxed text-bone-3 mt-2 measure fade">
            The same application, sent to you directly, unsigned. {platform.name} will warn you once
            when you first open it, because nobody has paid a certificate authority yet — that
            warning is the entire difference. It updates the way any folder does: you replace it.
          </p>
        )}

        {reach && (
          <div className="mt-5 pt-5 border-t border-line fade">
            <ContactCard compact subject={`Super Builds — a build for ${platform.name}`} />
            <div className="mt-4">
              <a className="btn btn-quiet btn-sm" href={askFor(platform)}>Open a message with the details filled in</a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Read once, on the client, because the answer cannot exist during a build. */
function useMyPlatform(): PlatformId | undefined {
  const [id, setId] = useState<PlatformId | undefined>();
  useEffect(() => { setId(currentPlatform()); }, []);
  return id;
}
