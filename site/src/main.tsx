/**
 * The whole of the public site.
 *
 * One page, one component, and a host that supplies no doors — every control
 * that would take somebody into the tool is simply not passed, so it is not
 * rendered, not in the bundle and not reachable by Tab. See
 * `ui/src/features/landing/host.tsx` for why that is the shape rather than a
 * `disabled` attribute.
 *
 * Nothing here imports the store, the API client or the socket. That is the
 * test: if this file ever needs one of them, something on the landing page has
 * quietly started depending on there being a daemon behind it.
 */

import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/syne/700.css';
import '@fontsource/syne/800.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '@/styles/global.css';

import { Landing } from '@/features/landing/Landing';
import { LandingHostProvider, type LandingHost } from '@/features/landing/host';
import { ContactModal } from '@/features/landing/Contact';
import { Logo, Button } from '@/components/ui';
import { Icon } from '@/components/icons';

/** Down to the download block, which is the only thing this page can offer. */
const toDownloads = () => document.getElementById('get')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

const HOST: LandingHost = {
  mode: 'public',
  startLabel: 'Get the app',
  start: toDownloads,
  // `revamp`, `requirements` and every door are deliberately absent.
  doors: [],
};

function Site() {
  const [contact, setContact] = useState(false);

  return (
    <div className="min-h-full flex flex-col">
      {/*
        Two controls, and neither is navigation: one scrolls this page, the
        other opens a panel on it. There is nowhere else to go — that is the
        difference between this header and the app's.
      */}
      <header className="sticky top-0 z-50 h-[52px] shrink-0 bg-ink/85 backdrop-blur-xl border-b border-line">
        <div className="h-full bleed flex items-center justify-between gap-3">
          <a href="/" className="flex items-center shrink-0" aria-label="Super Builds">
            <Logo from="sm" />
          </a>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setContact(true)}
              className="inline-flex items-center gap-2 h-8 px-2 sm:px-3 rounded-lg text-[13px] text-bone-3 hover:text-bone hover:bg-ink-2 transition-colors"
              title="Who made this, and how to reach them"
            >
              <span className="hidden sm:inline">Contact</span>
              <span className="sm:hidden"><Icon name="mail" size={14} /></span>
            </button>
            <Button variant="primary" size="sm" iconRight="arrowRight" onClick={toDownloads}>
              Get the app
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <LandingHostProvider host={HOST}>
          <Landing />
        </LandingHostProvider>
      </main>

      <ContactModal open={contact} onClose={() => setContact(false)} />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Site />
  </StrictMode>,
);
