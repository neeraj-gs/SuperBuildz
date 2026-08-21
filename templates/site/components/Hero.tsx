import { SceneCanvas } from '@/components/SceneCanvas';
import { Button } from '@/components/ui/Button';
import { Reveal } from '@/components/ui/Reveal';
import { design } from '@/design.config';

/**
 * The first viewport: the scene fills it, the chrome floats, the type is
 * part of the composition. Stage 1 rewrites the words and may restructure
 * this; the SceneCanvas contract stays.
 */
export function Hero({ title, line, cta, secondary }: { title: string; line?: string; cta?: { label: string; href: string }; secondary?: { label: string; href: string } }) {
  const wordmarkScene = design.scene.id === 'wordmark';
  return (
    <section className="relative h-[100svh] min-h-[620px] overflow-hidden" aria-label="Introduction">
      <SceneCanvas />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to top, var(--bg) 0%, transparent 45%)' }} />
      <div className="relative h-full flex flex-col justify-end container-x pb-[8vh]">
        <div className="max-w-[1100px]">
          {!wordmarkScene && (
            <Reveal><h1 className="display max-w-[14ch]">{title}</h1></Reveal>
          )}
          {wordmarkScene && <h1 className="sr-only">{title}</h1>}
          {line && <Reveal delay={1}><p className="mt-6 text-[clamp(1.1rem,2vw,1.5rem)] max-w-[40ch] opacity-85">{line}</p></Reveal>}
          {(cta || secondary) && (
            <Reveal delay={2}>
              <div className="mt-8 flex flex-wrap gap-3 pointer-events-auto">
                {cta && <Button href={cta.href} data-track="cta_click" data-label={cta.label}>{cta.label}</Button>}
                {secondary && <Button href={secondary.href} variant="ghost">{secondary.label}</Button>}
              </div>
            </Reveal>
          )}
        </div>
        <div className="absolute right-[var(--gutter)] bottom-[8vh] eyebrow hidden md:block">Scroll</div>
      </div>
    </section>
  );
}
