/**
 * The questions somebody actually has before they will try this.
 *
 * ── Why an FAQ at all, on a page that argues against filler ─────────────────
 *
 * Because everything above it is the argument and none of it is the answer to
 * "yes but will it work on my laptop", "yes but do I own the site", "yes but
 * what does it cost me". Those get asked in an email or they get asked by
 * closing the tab, and only one of those two is recoverable. The rule the rest
 * of the page follows still applies: a section has to *be* the thing it claims,
 * and an FAQ where you press a question and get an answer is exactly the
 * product's own thesis — nothing is typed that can be chosen.
 *
 * ── Why the answers are long ────────────────────────────────────────────────
 *
 * A one-line answer to "is my data safe" is not an answer, it is a slogan. The
 * questions here are the ones where the honest answer has a *because* in it,
 * and the ones where it does not are not questions worth a row.
 *
 * ── Why nothing here promises anything the tool does not do ─────────────────
 *
 * There is no public download, sites take the better part of an hour, and a
 * revamp costs real usage on somebody's own plan. All three are said here in
 * the plainest available words, because the first email after a surprise is a
 * complaint and the first email after a warning is a question.
 */

import { useState } from 'react';
import { Reveal, cx } from '@/components/ui';
import { Icon } from '@/components/icons';

type Group = 'start' | 'design' | 'yours';

const GROUPS: Array<{ id: Group; label: string }> = [
  { id: 'start', label: 'Getting started' },
  { id: 'design', label: 'The design and the 3D' },
  { id: 'yours', label: 'Your machine, your site' },
];

interface Q { group: Group; q: string; a: React.ReactNode }

const QUESTIONS: Q[] = [
  {
    group: 'start',
    q: 'What is Super Builds, in one paragraph?',
    a: (
      <>
        A program that runs on your laptop and builds websites by driving the Claude Code you already
        have installed. You choose a kind of business, a colour, a 3D scene and a few other things
        from lists — you do not describe anything — and it writes a complete Next.js site with a
        working admin dashboard behind it, shows you three different designs to pick from, and
        publishes it. The site is an ordinary folder of code on your disk that you own outright.
      </>
    ),
  },
  {
    group: 'start',
    q: 'Do I need to know how to code?',
    a: (
      <>
        No, and the interface is built on that assumption: until the first version of your site
        exists, there is nothing to type anywhere. Every step is a set of options you press. After
        it is built there is a chat, and even there every reply comes back with buttons for the
        obvious next moves, so you can keep going without composing a sentence if you would rather
        not.
      </>
    ),
  },
  {
    group: 'start',
    q: 'What do I need before I start?',
    a: (
      <>
        Node 22 or newer, and Claude Code signed in to a plan you already pay for. The Requirements
        screen checks for both, tells you which is missing, and installs what it can. Publishing
        needs the Vercel CLI, which it will also install, and which signs you in through your own
        browser. There is no Super Builds account, because there is no Super Builds server.
      </>
    ),
  },
  {
    group: 'start',
    q: 'How long does a site take, and what does it cost?',
    a: (
      <>
        Roughly forty-five minutes to an hour and a quarter for a full build, in six stages you can
        watch. The cost is usage on your own Claude plan and nothing else — the number shown in the
        corner is what the same work would cost on the API, so on a subscription it is a measure of
        how much of your allowance a build takes rather than a bill. Nothing is created, installed
        or spent until the last press of the four.
      </>
    ),
  },
  {
    group: 'start',
    q: 'How do I get a copy?',
    a: (
      <>
        Ask, for now. There is no public download yet, and a page implying otherwise would turn the
        first email into a complaint. Email me and I will send you a build — as an app that opens
        its own window, or as the daemon underneath it if you would rather drive it from your own
        code. Both are in <a href="#contact" className="text-volt hover:underline">the contact section</a>.
      </>
    ),
  },

  {
    group: 'design',
    q: 'What does "3D" actually mean here — is it a video of something 3D?',
    a: (
      <>
        No. It is real WebGL, running in the visitor's browser, drawn with React Three Fiber. That
        means it responds to the pointer, it reacts to scroll, and it is a different thing on every
        load rather than a loop. Thirteen scenes ship with it and not one of them is a floating
        sphere: type that behaves like a solid, cloth, a terrain, a liquid, an exploded object, a
        diorama, ribbons. You watch each one move before you choose it.
      </>
    ),
  },
  {
    group: 'design',
    q: 'How do I get a landing page rather than a whole site?',
    a: (
      <>
        Choose fewer pages. The page count is one of the things you pick, and one page is a valid
        answer — you get the same hero scene, the same design system and the same form handling,
        with everything on a single scroll. The sections still have to earn it: a pinned sequence, a
        counter that scrubs with the scroll, a gallery that moves sideways. A landing page that is
        four stacked card grids is the thing the rubric is written to stop.
      </>
    ),
  },
  {
    group: 'design',
    q: 'What if I do not like what it built?',
    a: (
      <>
        Three things, in increasing size. There is a panel of sliders — spacing, display scale,
        grain, contrast, how far things travel when they appear, the overall pace — and the site
        changes under you as you drag them, with no prompt to write. There are the three directions,
        built from your answers and shown side by side scrolling in sync, and picking one continues
        the build in it. And there is undo: every message takes a snapshot of the folder first, so
        any change can be put back, including the undo.
      </>
    ),
  },
  {
    group: 'design',
    q: 'Can I use my own colours, fonts and photographs?',
    a: (
      <>
        Yes. There is a palette editor that shows you the contrast ratio as you mix, so you cannot
        accidentally ship text nobody can read. You can point at a folder of your own images and
        they are copied into the project. And you can point at a website you like and have it read
        the design out of that instead — the colours it samples get repaired to a legible contrast
        before you are offered them, because "its colours" should never produce a page you cannot
        read.
      </>
    ),
  },
  {
    group: 'design',
    q: 'Will a 3D hero make the site slow, or break on a phone?',
    a: (
      <>
        The scenes step down on smaller screens and respect a visitor's reduced-motion setting, and
        every generated site is checked against a rubric that is in the repository and that the
        final stage reads and fixes against. Sideways scroll on a phone is a defect the jury stage
        looks for by name. It is not magic — a 3D hero costs more than no hero — but it is measured
        rather than hoped for.
      </>
    ),
  },

  {
    group: 'yours',
    q: 'Where do the forms on my site go?',
    a: (
      <>
        Into a CRM at <code className="telemetry text-volt">/admin</code> on your own site, behind a
        login, in the site's own colours: a pipeline with money on it, targets rather than totals, a
        funnel built from real events, who has gone cold, CSV export. SQLite while it is on your
        machine, Postgres when it is on Vercel, and no third-party account either way. If you would
        rather read your numbers somewhere else, it can send them to any of twelve places instead.
      </>
    ),
  },
  {
    group: 'yours',
    q: 'Does anything leave my machine?',
    a: (
      <>
        Only what you deliberately publish. The daemon binds to <code className="telemetry text-volt">127.0.0.1</code> and
        refuses any request that did not arrive on a loopback address, so nothing else on your wifi
        can reach it. Super Builds never calls a model provider — your Claude Code does that, on
        your plan — and it never reads a credential file, never holds a token, and never sets an
        auth variable on anything it starts. It is all written down, decision by decision, in
        <code className="telemetry text-volt"> docs/SECURITY.md</code>.
      </>
    ),
  },
  {
    group: 'yours',
    q: 'What can it do to the rest of my computer?',
    a: (
      <>
        Inside your project folder, anything a developer would. Outside it, nothing without you
        saying so: it stops, shows you the exact command and what it would do, and waits for you to
        answer once, always in this conversation, or no. Two things can never be allowed at all —
        formatting a disk, and killing every Node process, which would end Super Builds mid-build.
        Everything allowed or refused is written into the conversation so you can go back and check.
      </>
    ),
  },
  {
    group: 'yours',
    q: 'Do I own the site? Can I edit the code?',
    a: (
      <>
        It is yours completely. Every site is an ordinary Next.js project in a folder you chose,
        with its own git history, that you could have written yourself and can open in VS Code from
        the project screen. There is no runtime to keep paying for, no service to cancel and nothing
        that can be taken away — if Super Builds vanished tomorrow your site would carry on exactly
        as it is.
      </>
    ),
  },
  {
    group: 'yours',
    q: 'Can it redesign a site I already have?',
    a: (
      <>
        Yes, and it is careful about it, because that is somebody's live website. It refuses to
        start until the folder is a git repository with everything committed — making one and
        committing your work on your own branch if there is not — and then does all of its work on a
        branch of its own. Switching back to your branch is a complete undo. It reads your pages to
        learn what the site is for and what it says, and it never reads your <code className="telemetry text-volt">.env</code> files.
      </>
    ),
  },
  {
    group: 'yours',
    q: 'Can I build more than one at a time?',
    a: (
      <>
        Yes. Open as many projects as you like and as many conversations inside each one as the work
        needs; they run at the same time, on the same laptop. Your machine runs as many at once as
        it comfortably can — about half its cores, so it stays usable — and anything over that waits
        and starts on its own. Every conversation about a project reads the same shared notebook, so
        they are not two assistants with amnesia undoing each other.
      </>
    ),
  },
];

export function Faq() {
  const [group, setGroup] = useState<Group | 'all'>('all');
  const [open, setOpen] = useState<string | null>(QUESTIONS[0].q);

  const shown = group === 'all' ? QUESTIONS : QUESTIONS.filter((q) => q.group === group);

  return (
    <section id="faq" className="py-20 md:py-24 border-t border-line scroll-mt-[52px]">
      <div className="shell-wide">
        <div className="grid lg:grid-cols-[minmax(0,0.74fr)_minmax(0,1.26fr)] gap-8 lg:gap-14 items-start">
          <div className="lg:sticky lg:top-[76px]">
            <h2 className="d2 text-balance">The questions <span className="serif">before the first press.</span></h2>
            <p className="copy mt-4">
              What it is, what it needs, what it costs, and what it can and cannot do to the machine
              it is running on. If yours is not here, it is the email I most want.
            </p>

            <div className="flex flex-wrap gap-1.5 mt-6">
              <button onClick={() => setGroup('all')} data-on={group === 'all' ? 'true' : undefined} className="chip">Everything</button>
              {GROUPS.map((g) => (
                <button key={g.id} onClick={() => setGroup(g.id)} data-on={group === g.id ? 'true' : undefined} className="chip">{g.label}</button>
              ))}
            </div>
          </div>

          {/*
            One column, not two: an accordion in two columns reflows the
            opposite column every time a row opens, which moves the answer you
            were reading out from under you.

            And it sits on its own ground. The object behind this page is only
            hidden under the left-hand reading column — everything right of 62%
            is transparent by design — and this list is in that half. Fifteen
            questions read against moving geometry is the one thing the rest of
            the page is careful never to do.
          */}
          <div className="panel bg-ink-2/80 backdrop-blur-sm overflow-hidden">
            <ul key={group} className="px-5 sm:px-6 fade">
              {shown.map((item, i) => {
                const on = open === item.q;
                return (
                  <Reveal key={item.q} delay={Math.min(i, 6) * 40}>
                    <li className="border-b border-line last:border-b-0">
                      <button
                        onClick={() => setOpen(on ? null : item.q)}
                        aria-expanded={on}
                        className="w-full text-left py-4 flex items-start gap-4 group"
                      >
                        <span className={cx('flex-1 text-[15px] leading-snug font-semibold transition-colors', on ? 'text-bone' : 'text-bone-2 group-hover:text-bone')}>
                          {item.q}
                        </span>
                        <Icon name="chevronDown" size={15} className={cx('shrink-0 mt-0.5 transition-transform', on ? 'rotate-180 text-volt' : 'text-bone-4')} />
                      </button>
                      {on && (
                        <div className="pb-5 -mt-1 pr-8 text-[13.5px] leading-[1.7] text-bone-3 measure fade">
                          {item.a}
                        </div>
                      )}
                    </li>
                  </Reveal>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
