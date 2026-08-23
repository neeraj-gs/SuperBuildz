import { Button } from '@/components/ui/Button';
import { Reveal } from '@/components/ui/Reveal';
import { design } from '@/design.config';

/**
 * The first viewport. The scene is not mounted here — it is the page-wide
 * `<SceneLayer />` in the root layout, showing through — so the hero is
 * composition only: floating chrome, type as part of the picture, a scrim
 * that carries it into the section below.
 *
 * Stage 1 rewrites the words and may restructure this. What it must not do is
 * put a canvas back inside the hero: a scene that ends at 100vh is the thing
 * this template exists to avoid.
 */
export function Hero({
  title, line, cta, secondary, frame = 0,
}: {
  title: string; line?: string;
  cta?: { label: string; href: string }; secondary?: { label: string; href: string };
  frame?: number;
}) {
  const wordmarkScene = design.scene.id === 'wordmark';
  return (
    <section
      className="relative flex h-[100svh] min-h-[620px] flex-col justify-end overflow-hidden"
      aria-label="Introduction"
      data-scene-frame={frame}
      data-scene-dim="0"
    >
      <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(to top, var(--bg) 0%, transparent 45%)' }} />
      <div className="container-x relative pb-[8vh]">
        <div className="max-w-[1100px]">
          {wordmarkScene
            ? <h1 className="sr-only">{title}</h1>
            : <Reveal><h1 className="display max-w-[14ch]">{title}</h1></Reveal>}
          {line && <Reveal delay={1}><p className="mt-6 max-w-[40ch] text-[clamp(1.1rem,2vw,1.5rem)] opacity-85">{line}</p></Reveal>}
          {(cta || secondary) && (
            <Reveal delay={2}>
              <div className="pointer-events-auto mt-8 flex flex-wrap gap-3">
                {cta && <Button href={cta.href} data-track="cta_click" data-label={cta.label}>{cta.label}</Button>}
                {secondary && <Button href={secondary.href} variant="ghost">{secondary.label}</Button>}
              </div>
            </Reveal>
          )}
        </div>
        <div className="eyebrow absolute bottom-[8vh] right-[var(--gutter)] hidden md:block">Scroll</div>
      </div>
    </section>
  );
}
