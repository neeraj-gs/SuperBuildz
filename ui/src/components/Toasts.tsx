/**
 * The transient messages, in a file of their own.
 *
 * They used to live in `ui.tsx` beside the buttons, which was tidy right up
 * until the landing page had to build without a daemon behind it: `Toasts` is
 * the one thing in that module that reads the store, and one import of
 * `Button` therefore dragged the store, the API client and the websocket into
 * the public bundle. Forty-eight references to `/api/projects` on a marketing
 * page, none of which could ever answer.
 *
 * So the rule that keeps this honest: `components/ui.tsx` is presentational
 * and imports nothing from `lib/`. Anything that needs to know what the daemon
 * is doing lives beside this instead.
 */

import { useStore } from '@/lib/store';
import { Icon } from './icons';
import { cx } from './ui';

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 w-[min(380px,calc(100vw-40px))]">
      {toasts.map((t) => (
        <div key={t.id} className={cx('panel rise px-3.5 py-3 text-[13px] flex items-start gap-2.5 shadow-2xl shadow-black/60', t.kind === 'error' && 'border-danger/40', t.kind === 'ok' && 'border-volt-3')}>
          <Icon name={t.kind === 'error' ? 'alert' : t.kind === 'ok' ? 'check' : 'sparkle'} size={15} className={cx('mt-px shrink-0', t.kind === 'error' ? 'text-danger' : 'text-volt')} />
          <span className="flex-1 text-bone-2 leading-relaxed">{t.text}</span>
          <button onClick={() => dismiss(t.id)} className="text-bone-4 hover:text-bone shrink-0"><Icon name="x" size={13} /></button>
        </div>
      ))}
    </div>
  );
}
