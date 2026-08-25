/**
 * How you get it, and how you reach me.
 *
 * ── Why the two halves are one section ──────────────────────────────────────
 *
 * Because they are the same question. There is no download page, no account
 * and no billing screen, so "how do I get this" and "who do I ask" have the
 * same answer, and splitting them into a Download section and a Contact
 * section would put a wall between a question and the person who can settle
 * it.
 *
 * ── Why the delivery is a choice rather than a paragraph ────────────────────
 *
 * The rest of this page had one note against it: every section has to *be* the
 * thing it claims rather than describe it. This product's whole argument is
 * that you press things instead of typing them, so a section about how to run
 * it that reads as two paragraphs of prose would be arguing against the page
 * it is on. Press one of the two and it tells you exactly what to type, what
 * happens, and what it needs.
 *
 * ── Why it says the download is not ready ───────────────────────────────────
 *
 * Because it is not, and a contact section that implies otherwise turns the
 * first email into a complaint. The honest version — ask and I will send you a
 * build — is also the one that gets somebody to write.
 */

import { useState } from 'react';
import { Button, Reveal, cx } from '@/components/ui';
import { Icon } from '@/components/icons';

const EMAIL = 'gsneeraj2002@gmail.com';
const MAILTO = `mailto:${EMAIL}?subject=${encodeURIComponent('Super Builds')}`;

/**
 * Every one of these is on powerhouz.org, which is the other half of the same
 * work. The email is first because it is the one that gets answered, and it is
 * in the list rather than only on the button so it can be copied by somebody
 * whose machine has no mail client wired up — which is most machines.
 */
const ELSEWHERE: Array<{ label: string; shown: string; href: string; copy?: string }> = [
  { label: 'Email', shown: EMAIL, href: MAILTO, copy: EMAIL },
  { label: 'Portfolio', shown: 'neerajgs.dev', href: 'https://www.neerajgs.dev/' },
  { label: 'LinkedIn', shown: 'linkedin.com/in/neeraj-gs', href: 'https://www.linkedin.com/in/neeraj-gs' },
  { label: 'X', shown: 'x.com/neeraj_gs_05', href: 'https://x.com/neeraj_gs_05' },
  { label: 'GitHub', shown: 'github.com/neeraj-gs', href: 'https://github.com/neeraj-gs' },
];

const WAYS = [
  {
    id: 'app',
    name: 'As an app',
    blurb: 'a window of its own',
    run: 'npm start',
    what: 'Builds the interface, starts the daemon, and opens its own window — no address bar, no tab, nothing to type again. The window is the Chrome already on the machine, in app mode, because a local tool has no business downloading a second browser to draw itself.',
    needs: ['Node 22 or newer', 'Claude Code, signed in', 'about 15 minutes for the first site'],
  },
  {
    id: 'daemon',
    name: 'As a node daemon',
    blurb: 'no interface at all',
    run: 'node daemon/src/index.ts',
    what: 'Fastify and a websocket on 127.0.0.1:7747. Every screen in the app is that HTTP API and nothing else, so anything the interface can do your own code can do — specify a site, run the build, drive a conversation, read the board. Events stream over the socket as they happen.',
    needs: ['Node 22 or newer', 'a per-boot token, handed over the socket', 'loopback only — it never binds an interface'],
  },
] as const;

export function Contact() {
  const [way, setWay] = useState<(typeof WAYS)[number]['id']>('app');
  const chosen = WAYS.find((w) => w.id === way)!;

  return (
    <section id="contact" className="py-20 md:py-24 border-t border-line scroll-mt-16">
      <div className="shell-wide">
        <div className="max-w-[52ch]">
          <h2 className="d2 text-balance">
            Take it, and <span className="serif">tell me what is missing.</span>
          </h2>
          <p className="copy mt-4">
            It runs on your machine either way — as an app that opens its own window, or as the
            daemon underneath it, which you can drive from your own code. There is no public
            download yet, so the way to get a build is to ask, and I would rather you asked.
          </p>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-10 lg:gap-16 mt-12">
          {/* ------------------------------------------------------ how ---- */}
          <div>
            <h3 className="legend mb-3">How you run it</h3>

            <div className="grid sm:grid-cols-2 gap-2">
              {WAYS.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setWay(w.id)}
                  data-on={way === w.id ? 'true' : undefined}
                  className="opt"
                >
                  <span className="block font-semibold text-[13.5px] pr-5">{w.name}</span>
                  <span className="block telemetry text-bone-4 mt-1">{w.blurb}</span>
                </button>
              ))}
            </div>

            {/*
              Keyed on the choice so the panel re-enters rather than swapping
              its text under you — the same fade every other chooser on this
              page uses when its answer changes.
            */}
            <div key={chosen.id} className="panel bg-ink-2/80 backdrop-blur-sm mt-3 overflow-hidden fade">
              <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-line">
                <Icon name="terminal" size={14} className="text-volt shrink-0" />
                <code className="font-[family-name:var(--font-mono)] text-[12.5px] text-bone truncate">{chosen.run}</code>
                <span className="flex-1" />
                <Copy text={chosen.run} />
              </div>

              <p className="text-[13.5px] leading-relaxed text-bone-2 px-4 py-4">{chosen.what}</p>

              <ul className="px-4 pb-4 grid gap-1.5">
                {chosen.needs.map((n) => (
                  <li key={n} className="telemetry text-bone-4 flex items-start gap-2">
                    <span className="w-[5px] h-[5px] rounded-full bg-bone-4 shrink-0 mt-[6px]" />
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-[13px] leading-relaxed text-bone-3 mt-4 measure">
              Either way it is the same program in a folder you own, and every site it makes is an
              ordinary Next.js project you could have written yourself. Nothing here is a service,
              so there is nothing to cancel and nothing that can be taken away.
            </p>
          </div>

          {/* ------------------------------------------------------- me ---- */}
          <Reveal>
            <div className="panel bg-ink-2/80 backdrop-blur-sm p-6 md:p-7">
              <h3 className="legend">Who made it</h3>
              <p className="d3 mt-2.5">Neeraj GS</p>
              <p className="text-[13.5px] leading-relaxed text-bone-2 mt-3">
                I build this and{' '}
                <a href="https://www.powerhouz.org/" target="_blank" rel="noreferrer noopener" className="text-bone underline decoration-line-3 underline-offset-[3px] hover:decoration-volt">
                  PowerHouz
                </a>
                , an IDE for running several agents on one codebase at once. Both are local-first,
                both drive the command line tools already on your machine, and neither one holds a
                key for anybody.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <Button variant="primary" icon="mail" onClick={() => { window.location.href = MAILTO; }}>
                  Email me
                </Button>
                <Button variant="ghost" iconRight="external" onClick={() => window.open('https://www.powerhouz.org/', '_blank', 'noopener')}>
                  powerhouz.org
                </Button>
              </div>

              {/*
                Rows rather than a row of icons: there is no recognisable glyph
                for a portfolio, and five unlabelled marks make somebody guess
                where each one goes. The address is the useful part, so the
                address is what is shown — and the email row carries a copy,
                because a mailto on a machine with no mail client set up opens
                nothing at all and looks broken.
              */}
              <ul className="mt-5 border-t border-line">
                {ELSEWHERE.map((l) => (
                  <li key={l.label} className="flex items-center gap-2 border-b border-line">
                    <a
                      href={l.href}
                      {...(l.copy ? {} : { target: '_blank', rel: 'noreferrer noopener' })}
                      className="group flex-1 min-w-0 flex items-baseline gap-3 py-2.5 text-bone-2 hover:text-bone transition-colors"
                    >
                      <span className="legend w-[74px] shrink-0">{l.label}</span>
                      <span className="text-[13px] truncate">{l.shown}</span>
                      <span className="flex-1" />
                      {!l.copy && <Icon name="external" size={12} className="shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity" />}
                    </a>
                    {l.copy && <Copy text={l.copy} />}
                  </li>
                ))}
              </ul>

              <p className="text-[12.5px] leading-relaxed text-bone-4 mt-5">
                Ask for a build, ask a question, or tell me what is missing. If something in here
                is wrong or slow or ugly, that is the email I most want.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/**
 * Copy the command.
 *
 * `navigator.clipboard` is unavailable on an insecure origin that is not
 * loopback, and this page is served from one that is — but a browser can still
 * refuse, so the failure is silent and the command stays selectable either way.
 */
function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1600); } catch { /* the text is right there */ }
      }}
      title="Copy"
      className={cx('shrink-0 transition-colors', done ? 'text-volt' : 'text-bone-4 hover:text-bone')}
      aria-label={done ? 'Copied' : `Copy ${text}`}
    >
      <Icon name={done ? 'check' : 'copy'} size={13} />
    </button>
  );
}
