/** Primitives. Small on purpose; the screens do the design. */

import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { Icon } from './icons';
import { useStore } from '@/lib/store';

export const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'quiet' | 'danger'; size?: 'sm' | 'md' | 'lg'; icon?: string; busy?: boolean; iconRight?: string };
export function Button({ variant = 'ghost', size = 'md', icon, iconRight, busy, className, children, disabled, ...rest }: BtnProps) {
  return (
    <button className={cx('btn', `btn-${variant}`, size === 'sm' && 'btn-sm', size === 'lg' && 'btn-lg', className)} disabled={disabled || busy} {...rest}>
      {busy ? <Spinner size={14} /> : icon ? <Icon name={icon} size={size === 'sm' ? 14 : 16} /> : null}
      {children}
      {iconRight && !busy ? <Icon name={iconRight} size={size === 'sm' ? 14 : 16} /> : null}
    </button>
  );
}

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return <span className={cx('spin inline-block rounded-full border-2 border-current border-r-transparent', className)} style={{ width: size, height: size }} aria-label="working" />;
}

export function Chip({ children, onClick, icon, className, active }: { children: ReactNode; onClick?: () => void; icon?: string; className?: string; active?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cx('chip', active && 'border-volt bg-volt-2', className)}>
      {icon && <Icon name={icon} size={14} />}{children}
    </button>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) { return <input {...props} className={cx('input', props.className)} />; }
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea {...props} className={cx('input', props.className)} />; }

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="legend block mb-1.5">{label}</span>
      {children}
      {hint && <span className="block mt-1.5 text-[12.5px] text-bone-3">{hint}</span>}
    </label>
  );
}

export function Logo({ size = 22, wordmark = true }: { size?: number; wordmark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <span className="inline-grid place-items-center rounded-[7px] bg-volt text-ink" style={{ width: size + 6, height: size + 6 }}>
        <Icon name="logo" size={size - 2} strokeWidth={2.2} />
      </span>
      {wordmark && <span className="display-sm tracking-[0.12em] text-[13px] uppercase">Super<span className="text-volt">Builds</span></span>}
    </span>
  );
}

export function Dot({ on, className }: { on?: boolean; className?: string }) {
  return <span className={cx('inline-block w-2 h-2 rounded-full', on ? 'bg-volt' : 'bg-bone-4', className)} />;
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 max-w-[380px]">
      {toasts.map((t) => (
        <div key={t.id} className={cx('panel rise px-4 py-3 text-[13.5px] flex items-start gap-3 shadow-2xl', t.kind === 'error' && 'border-danger/50', t.kind === 'ok' && 'border-volt/50')}>
          <Icon name={t.kind === 'error' ? 'alert' : t.kind === 'ok' ? 'check' : 'sparkle'} size={16} className={t.kind === 'error' ? 'text-danger mt-0.5' : 'text-volt mt-0.5'} />
          <span className="flex-1">{t.text}</span>
          <button onClick={() => dismiss(t.id)} className="text-bone-3 hover:text-bone"><Icon name="x" size={14} /></button>
        </div>
      ))}
    </div>
  );
}

/** A number that counts up to its value when it first appears. */
export function Count({ to, suffix = '', duration = 900 }: { to: number; suffix?: string; duration?: number }) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    let raf = 0; let started = false;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || started) return; started = true;
      const t0 = performance.now();
      const tick = (t: number) => { const p = Math.min(1, (t - t0) / duration); setN(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to, duration]);
  return <span ref={ref}>{n}{suffix}</span>;
}

/** Very small markdown: paragraphs, bold, code, lists, links. Enough for chat. */
export function Markdown({ text, className }: { text: string; className?: string }) {
  const html = renderMd(text);
  return <div className={cx('prose-sb', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

function esc(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function inline(s: string) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}
export function renderMd(src: string): string {
  const lines = src.replace(/\r/g, '').split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.startsWith('```')) {
      const buf: string[] = []; i++;
      while (i < lines.length && !lines[i].startsWith('```')) { buf.push(lines[i]); i++; }
      i++; out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`); continue;
    }
    const h = l.match(/^(#{1,3})\s+(.*)/);
    if (h) { out.push(`<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>`); i++; continue; }
    if (/^\s*[-*]\s+/.test(l)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(`<li>${inline(lines[i].replace(/^\s*[-*]\s+/, ''))}</li>`); i++; }
      out.push(`<ul>${items.join('')}</ul>`); continue;
    }
    if (/^\s*\d+[.)]\s+/.test(l)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { items.push(`<li>${inline(lines[i].replace(/^\s*\d+[.)]\s+/, ''))}</li>`); i++; }
      out.push(`<ol>${items.join('')}</ol>`); continue;
    }
    if (!l.trim()) { i++; continue; }
    const para: string[] = [l];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(```|#{1,3}\s|\s*[-*]\s|\s*\d+[.)]\s)/.test(lines[i])) { para.push(lines[i]); i++; }
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('');
}

export function Empty({ icon = 'sparkle', title, body, action }: { icon?: string; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="panel grid-bg relative overflow-hidden px-8 py-14 text-center">
      <div className="mx-auto mb-4 grid place-items-center w-12 h-12 rounded-full border border-line-2 text-volt"><Icon name={icon} size={20} /></div>
      <div className="display-sm text-[22px] mb-2">{title}</div>
      {body && <p className="text-bone-2 max-w-[46ch] mx-auto">{body}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
