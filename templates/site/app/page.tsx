import { Hero } from '@/components/Hero';
import { Nav } from '@/components/ui/Nav';
import { Footer } from '@/components/ui/Footer';
import { Section } from '@/components/ui/Section';
import { Reveal } from '@/components/ui/Reveal';
import { Button } from '@/components/ui/Button';
import { Form } from '@/components/ui/Form';
import { Figure } from '@/components/ui/Figure';
import { HorizontalTrack } from '@/components/ui/Scroll';
import { design } from '@/design.config';

/**
 * The home page as the template ships it.
 *
 * It is a skeleton, but it is a skeleton with the right bones: every section
 * declares a scene frame so the canvas stays alive down the page, the work
 * section is a horizontal track rather than a row of cards, and the places a
 * photograph would go hold composed `<Figure>` plates rather than empty
 * rounded rectangles. Stage 2 replaces the words and the structure — what it
 * must not do is regress to a stack of equal bands full of grey boxes.
 */
export default function Home() {
  const words = ['Craft', 'Care', 'Time'];

  return (
    <>
      <Nav />
      <main id="main">
        <Hero
          title={design.name}
          line="Something worth remembering."
          cta={{ label: 'Get in touch', href: '#contact' }}
          frame={0}
        />

        <Section id="about" frame={1} dim={0.82}>
          <Reveal><p className="eyebrow mb-4">About</p></Reveal>
          <Reveal delay={1}>
            <h2 className="display-sm measure text-[clamp(1.8rem,4vw,3.2rem)]">
              The build replaces this with the organising idea, in the voice of the business.
            </h2>
          </Reveal>
          <Reveal delay={2}>
            <p className="measure mt-6 opacity-80">
              Honest placeholder. Stage 2 writes the pages named in BRIEF.md from the components in{' '}
              <code className="font-mono text-[0.9em]">components/ui</code>, using only the tokens in{' '}
              <code className="font-mono text-[0.9em]">design.config.ts</code>.
            </p>
          </Reveal>
        </Section>

        {/* A run the reader moves through sideways, not three cards in a row. */}
        <Section id="work" frame={2} dim={0.72} bleed>
          <div className="container-x mx-auto max-w-[1400px]">
            <Reveal><p className="eyebrow mb-4">Work</p></Reveal>
          </div>
          <HorizontalTrack className="mt-8">
            {words.map((w, i) => (
              <div key={w} className="w-[min(78vw,420px)] shrink-0 snap-center">
                <Figure ratio="portrait" treatment="type" word={w} seed={i} caption={`0${i + 1} — a real project goes here`} />
              </div>
            ))}
          </HorizontalTrack>
        </Section>

        <Section id="contact" frame={3} dim={0.9}>
          <div className="grid items-start gap-[calc(var(--gutter)*2)] lg:grid-cols-2">
            <div>
              <Reveal><p className="eyebrow mb-4">Contact</p></Reveal>
              <Reveal delay={1}><h2 className="display-sm text-[clamp(1.8rem,4vw,3.2rem)]">Say hello.</h2></Reveal>
              <Reveal delay={2}><p className="measure mt-4 opacity-80">Every message lands in the CRM at /admin, as a lead in the first stage.</p></Reveal>
              <Reveal delay={3}><div className="mt-6"><Button href="mailto:hello@example.com" variant="ghost">Or email</Button></div></Reveal>
            </div>
            <Reveal delay={2}>
              <Form
                name="contact"
                fields={[
                  { name: 'name', label: 'Your name', required: true },
                  { name: 'email', label: 'Email', type: 'email', required: true },
                  { name: 'message', label: 'What can we do?', type: 'textarea', required: true },
                ]}
                submitLabel="Send"
                success="Thank you — we will reply soon."
              />
            </Reveal>
          </div>
        </Section>
      </main>
      <Footer />
    </>
  );
}
