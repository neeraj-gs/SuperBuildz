/**
 * Watching somebody use it, which is the only honest argument for a tool.
 *
 * ── Where the video goes ────────────────────────────────────────────────────
 *
 * One constant, `DEMO.url`, immediately below. Paste a Loom share link, a
 * Google Drive share link, a YouTube link or a direct `.mp4` and the section
 * plays it — `embedFor` works out which and rewrites it to whatever that host
 * calls its embed. Nothing else needs touching.
 *
 * ── Why there is a designed state for having no video ───────────────────────
 *
 * Because the alternatives are worse. A section that is not there until the
 * recording exists means the nav item beside Contact points at nothing, and a
 * broken `<iframe src="">` is a grey box that reads as a bug in the product
 * being demonstrated. So the empty state is a real state: it says the
 * walkthrough is being recorded, in as many words, and offers the two things
 * that *are* available now — start a build, or ask for one. The page above it
 * has already made the argument; this is not carrying it alone.
 *
 * ── Why the nav item is not a route ─────────────────────────────────────────
 *
 * "Demo" in the header does what it says: it goes to the demo and starts it.
 * On the landing page that is a scroll and a play. Anywhere else it is a
 * navigation, then a scroll and a play — which is why the request outlives the
 * navigation in `wanted` below, and is read by the section when it mounts
 * rather than fired at a component that is not on screen yet.
 */

import { useEffect, useRef, useState } from 'react';
import { useHost } from './host';
import { Button, cx } from '@/components/ui';
import { Icon } from '@/components/icons';
import { embedFor } from './embed';

/**
 * The walkthrough. This is the only place the video is named.
 *
 * Two ways to set it, and the second is the one to reach for when deploying:
 *
 *   `VITE_DEMO_URL`   an environment variable read at build time. Set it once
 *                     in the host's settings and the deployed page has the
 *                     video without anybody editing a file or making a commit.
 *   `url` below       the fallback, for a link that should live in the repo.
 *
 * A Loom share link, a Google Drive share link, a YouTube link or a direct
 * `.mp4` all work — `embedFor` recognises which and rewrites it to whatever
 * that host calls its embed. Empty means the section shows its "being
 * recorded" state, which is a real state rather than a hole.
 *
 * `length` is what the row on the download block says, so it should be the
 * real running time or nothing. Chapters are optional and drawn only when
 * there are some; they are times a person can press, not decoration, so an
 * invented one would be worse than none.
 */
const WALKTHROUGH = 'https://drive.google.com/file/d/19JmMsx61VwqMgxWgLjmtnaHWVY-a7rHd/view?usp=sharing';

export const DEMO: { url: string; length?: string; chapters: Array<{ at: string; label: string }> } = {
  // `||` rather than `??`, and the difference is load-bearing: an environment
  // variable that is present but empty — which is what a host gives you for a
  // field somebody cleared — would otherwise win over the real link and blank
  // the section.
  url: import.meta.env.VITE_DEMO_URL || WALKTHROUGH,
  length: import.meta.env.VITE_DEMO_LENGTH || undefined,
  chapters: [],
};

/* ---------------------------------------------------- the header's press -- */

let wanted = false;
const listeners = new Set<() => void>();

/**
 * Goes to the demo and starts it.
 *
 * `wanted` is set before the listeners are called and cleared by whoever takes
 * it, so a press that arrives before the section is mounted — the public page
 * still hydrating, the app's landing route still switching — is answered when
 * it mounts rather than dropped.
 */
export function playDemo() {
  wanted = true;
  for (const fn of listeners) fn();
}

function takeRequest(): boolean {
  const had = wanted;
  wanted = false;
  return had;
}

/* -------------------------------------------------------------- section -- */

export function Demo() {
  const host = useHost();
  const go = host.start;

  const [playing, setPlaying] = useState(false);
  const section = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);

  const start = () => {
    setPlaying(true);
    // `block: 'start'` and not `center`: the player is tall, and centring a
    // 16:9 panel in a viewport puts its top edge under the header.
    section.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => { void video.current?.play().catch(() => { /* a browser may refuse; the control is right there */ }); }, 400);
  };

  useEffect(() => {
    // Both paths: arriving with a request already made, and one made while here.
    if (takeRequest()) start();
    const fn = () => { if (takeRequest()) start(); };
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const embed = embedFor(DEMO.url, playing);

  return (
    <section ref={section} id="demo" className="py-20 md:py-24 border-t border-line scroll-mt-[52px]">
      <div className="shell-wide">
        <div className="grid lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] gap-8 lg:gap-14 items-start">
          <div className="lg:sticky lg:top-[76px]">
            <h2 className="d2 text-balance">Or just <span className="serif">watch it happen.</span></h2>
            <p className="copy mt-4">
              One site, start to finish, unedited: the questions it asks, the three directions it
              comes back with, the sliders, and the site at the end of it. Nothing here is a mockup —
              it is the same window you get.
            </p>
            {DEMO.length && <p className="telemetry text-bone-4 mt-4">{DEMO.length}</p>}

            {DEMO.chapters.length > 0 && (
              <ul className="mt-6 border-t border-line">
                {DEMO.chapters.map((c) => (
                  <li key={c.at} className="border-b border-line">
                    <button onClick={start} className="w-full text-left py-2.5 flex items-baseline gap-4 text-bone-2 hover:text-bone transition-colors">
                      <span className="telemetry text-volt w-[46px] shrink-0">{c.at}</span>
                      <span className="text-[13.5px]">{c.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap gap-3 mt-7">
              <Button variant="primary" iconRight="arrowRight" onClick={go}>{host.mode === 'app' ? 'Build one yourself' : host.startLabel}</Button>
              <a className="btn btn-ghost" href="#contact">Ask for a build</a>
            </div>
          </div>

          <div className="panel noise overflow-hidden bg-ink-2/80 backdrop-blur-sm">
            <div className="flex items-center gap-2.5 px-3 h-9 border-b border-line">
              {/*
                Three dots and an address, because what is being shown is a
                window, and saying so is cheaper than a caption explaining it.
              */}
              <span className="flex gap-1.5" aria-hidden>
                {['bg-danger/50', 'bg-warn/50', 'bg-volt/50'].map((c) => <span key={c} className={cx('w-2 h-2 rounded-full', c)} />)}
              </span>
              <span className="telemetry text-bone-4 truncate">super builds · a full run</span>
            </div>

            {/*
              16:9 is the video's shape, not the panel's. Locking the empty
              state to it too put four lines of prose and two buttons into a
              192px-tall box on a phone, and cut the buttons off — so the
              aspect ratio arrives with the thing that needs it.
            */}
            <div className={cx('relative bg-ink', embed && 'aspect-video')}>
              {!embed ? (
                <Placeholder onGo={go} />
              ) : embed.kind === 'video' ? (
                <video
                  ref={video}
                  src={embed.src}
                  controls
                  playsInline
                  preload="metadata"
                  className="absolute inset-0 w-full h-full"
                  title={embed.title}
                />
              ) : (
                <iframe
                  key={embed.src}
                  src={embed.src}
                  title={embed.title}
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full border-0"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * No video yet, said plainly.
 *
 * A grey rectangle with a play button that does nothing is a bug report. This
 * is the same panel with the truth in it, and the two presses that are worth
 * more than a video anyway.
 */
function Placeholder({ onGo }: { onGo: () => void }) {
  return (
    <div className="relative grid place-items-center px-5 py-12 sm:px-8 sm:py-16 md:min-h-[380px] text-center">
      {/*
        A faint suggestion of the interface behind the words, so the panel reads
        as a screen rather than an empty box. Hidden on a narrow one: there is
        no room for it to be behind the words rather than under them.
      */}
      <div className="absolute inset-0 opacity-[0.12] pointer-events-none p-5 hidden sm:flex gap-3" aria-hidden>
        <div className="w-[28%] space-y-2">
          {[1, 0.8, 0.9, 0.55, 0.75].map((w, i) => <div key={i} className="h-2 rounded-full bg-bone" style={{ width: `${w * 100}%` }} />)}
        </div>
        <div className="flex-1 rounded-lg border border-bone/40" />
      </div>

      <div className="relative">
        <Icon name="video" size={26} className="text-bone-4 mx-auto" />
        <p className="d4 mt-3">The walkthrough is being recorded.</p>
        <p className="text-[13px] leading-relaxed text-bone-3 mt-2 max-w-[42ch] mx-auto">
          It will sit here, in full, the moment it is done. Until then the fastest way to see what it
          does is to run one — it asks four questions before it spends anything.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5">
          <Button size="sm" variant="primary" iconRight="arrowRight" onClick={onGo}>See how to get it</Button>
          <a className="btn btn-quiet btn-sm" href="#contact">Tell me when it is up</a>
        </div>
      </div>
    </div>
  );
}
