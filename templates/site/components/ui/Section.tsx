import type { ReactNode } from 'react';
import { SectionView } from '@/lib/analytics-client';

/** A section with the house rhythm, and a `section_view` event when it is seen. */
export function Section({ id, children, tone = 'bg', className = '', bleed }: { id?: string; children: ReactNode; tone?: 'bg' | 'surface'; className?: string; bleed?: boolean }) {
  return (
    <section id={id} className={`section relative ${tone === 'surface' ? 'bg-surface' : ''} ${className}`} data-section={id}>
      {id && <SectionView id={id} />}
      <div className={bleed ? '' : 'container-x max-w-[1400px] mx-auto'}>{children}</div>
    </section>
  );
}
