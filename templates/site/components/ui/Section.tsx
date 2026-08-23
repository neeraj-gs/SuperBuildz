import type { ReactNode } from 'react';
import { SectionView } from '@/lib/analytics-client';

/**
 * A section with the house rhythm, a `section_view` event when it is seen, and
 * its instructions to the scene beneath it.
 *
 * `frame` is which chapter the scene should be showing while this section is
 * on screen; `dim` is how much of the scene to cover so the section can be
 * read (0 = the scene shows through completely, 1 = solid ground). Giving
 * every section a frame is what keeps the canvas alive for the whole page
 * instead of dying at the fold.
 */
export function Section({
  id, children, tone = 'bg', className = '', bleed, frame, dim,
}: {
  id?: string; children: ReactNode; tone?: 'bg' | 'surface' | 'clear'; className?: string; bleed?: boolean;
  frame?: number; dim?: number;
}) {
  return (
    <section
      id={id}
      className={`section relative ${tone === 'surface' ? 'bg-surface' : ''} ${className}`}
      data-section={id}
      data-scene-frame={frame}
      data-scene-dim={frame === undefined ? undefined : (dim ?? (tone === 'clear' ? 0 : 0.82))}
    >
      {id && <SectionView id={id} />}
      <div className={bleed ? '' : 'container-x max-w-[1400px] mx-auto'}>{children}</div>
    </section>
  );
}
