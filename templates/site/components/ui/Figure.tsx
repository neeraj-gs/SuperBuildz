/**
 * What goes where a photograph would have gone.
 *
 * Most people commissioning a site have no photography yet. The wrong answer
 * is a grid of empty rounded rectangles with a number in the corner — honest,
 * but it reads as unfinished, and it is the single thing that most often
 * stops a generated site from looking finished. The other wrong answer is
 * stock photography, which reads as generated.
 *
 * The right answer is to design the absence: a plate that is *composed* —
 * type at scale, a colour field, a drawn mark, a rule and a caption — so the
 * section still has a picture in it, just not a photographic one. When a real
 * image arrives later, pass `src` and the same component becomes the frame
 * for it without the layout moving.
 */

import Image from 'next/image';
import type { ReactNode } from 'react';

export type FigureTreatment =
  /** Huge type inside the plate, cropped by the frame. The safest and often the best. */
  | 'type'
  /** A flat field of one token colour with a single drawn mark. */
  | 'field'
  /** Hairline rules on the section grid — a technical drawing of the thing. */
  | 'draft'
  /** Two-tone diagonal bands in the palette; good in a run of three. */
  | 'band';

export interface FigureProps {
  /** A real photograph, once there is one. Everything else is ignored. */
  src?: string;
  alt?: string;
  /** 'video' | '4/5' | '1/1' | '16/9' | any CSS aspect-ratio value. */
  ratio?: string;
  /** The word or short phrase the plate is built from, when treatment is 'type'. */
  word?: string;
  treatment?: FigureTreatment;
  /** Sits under the plate in small caps. Say what it is, not that it is a placeholder. */
  caption?: ReactNode;
  /** Index in a run — varies the treatment so three in a row are not identical. */
  seed?: number;
  priority?: boolean;
  className?: string;
}

const RATIOS: Record<string, string> = { video: '16 / 9', square: '1 / 1', portrait: '4 / 5', wide: '21 / 9' };

export function Figure({
  src, alt = '', ratio = 'video', word, treatment = 'type', caption, seed = 0, priority, className = '',
}: FigureProps) {
  const aspect = RATIOS[ratio] ?? ratio;

  return (
    <figure className={className}>
      <div
        className="relative overflow-hidden rounded-[var(--radius-lg)] border hairline"
        // `container-type` so the plate's type scales to the plate, not the
        // viewport: the same Figure has to read in a 420px track cell and in
        // a full-bleed section.
        style={{ aspectRatio: aspect, background: 'var(--surface)', containerType: 'inline-size' }}
      >
        {src ? (
          <Image src={src} alt={alt} fill sizes="(max-width: 720px) 100vw, 50vw" priority={priority} className="object-cover" />
        ) : (
          <Plate treatment={treatment} word={word} seed={seed} />
        )}
      </div>
      {caption && <figcaption className="eyebrow mt-3 opacity-70">{caption}</figcaption>}
    </figure>
  );
}

function Plate({ treatment, word, seed }: { treatment: FigureTreatment; word?: string; seed: number }) {
  const shift = ((seed % 3) - 1) * 8;

  if (treatment === 'field') {
    return (
      <div className="absolute inset-0" style={{ background: 'color-mix(in oklab, var(--accent) 12%, var(--surface))' }}>
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
          <circle cx={100 + shift * 2} cy="100" r="46" fill="none" stroke="var(--accent)" strokeWidth="0.75" opacity="0.6" />
          <circle cx={100 + shift * 2} cy="100" r="70" fill="none" stroke="var(--fg)" strokeWidth="0.4" opacity="0.22" />
          <line x1="0" y1="100" x2="200" y2="100" stroke="var(--fg)" strokeWidth="0.4" opacity="0.14" />
        </svg>
      </div>
    );
  }

  if (treatment === 'draft') {
    return (
      <div className="absolute inset-0">
        <svg viewBox="0 0 200 120" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
          {Array.from({ length: 7 }).map((_, i) => (
            <line key={i} x1="0" y1={(i + 1) * 15} x2="200" y2={(i + 1) * 15} stroke="var(--fg)" strokeWidth="0.3" opacity="0.12" />
          ))}
          {Array.from({ length: 9 }).map((_, i) => (
            <line key={i} x1={(i + 1) * 20} y1="0" x2={(i + 1) * 20} y2="120" stroke="var(--fg)" strokeWidth="0.3" opacity="0.08" />
          ))}
          <rect x={40 + shift} y="28" width="120" height="64" fill="none" stroke="var(--accent)" strokeWidth="0.8" />
          <line x1={40 + shift} y1="28" x2={160 + shift} y2="92" stroke="var(--accent)" strokeWidth="0.4" opacity="0.5" />
        </svg>
      </div>
    );
  }

  if (treatment === 'band') {
    return (
      <div className="absolute inset-0 overflow-hidden" style={{ background: 'var(--surface)' }}>
        <div
          className="absolute -inset-x-[30%] -inset-y-[40%]"
          style={{
            background: `repeating-linear-gradient(${58 + shift}deg, var(--surface) 0 26px, color-mix(in oklab, var(--fg) 6%, var(--surface)) 26px 52px)`,
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: 'var(--accent)' }} />
      </div>
    );
  }

  // 'type' — the default. One word, set enormous, cropped by the frame.
  return (
    <div className="absolute inset-0 grid place-items-center overflow-hidden" style={{ background: 'var(--surface)' }}>
      <span
        className="display select-none whitespace-nowrap"
        style={{
          fontSize: 'clamp(2.5rem, 26cqw, 14rem)',
          lineHeight: 0.8,
          color: 'transparent',
          WebkitTextStroke: '1.5px color-mix(in oklab, var(--fg) 44%, transparent)',
          transform: `translateX(${shift}%)`,
        }}
      >
        {word ?? '—'}
      </span>
      <span className="absolute bottom-3 left-3 h-[3px] w-10" style={{ background: 'var(--accent)' }} />
    </div>
  );
}
