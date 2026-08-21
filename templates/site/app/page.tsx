import { Hero } from '@/components/Hero';
import { Nav } from '@/components/ui/Nav';
import { Footer } from '@/components/ui/Footer';
import { Section } from '@/components/ui/Section';
import { Reveal } from '@/components/ui/Reveal';
import { Button } from '@/components/ui/Button';
import { Form } from '@/components/ui/Form';
import { design } from '@/design.config';

/**
 * The home page as the template ships it: the hero clears the hero rule, and
 * the sections below are honest placeholders the build replaces in stage 2.
 */
export default function Home() {
  return (
    <>
      <Nav />
      <main id="main">
        <Hero title={design.name} line="Something worth remembering." cta={{ label: 'Get in touch', href: '#contact' }} />

        <Section id="about">
          <Reveal><p className="eyebrow mb-4">About</p></Reveal>
          <Reveal delay={1}><h2 className="display-sm text-[clamp(1.8rem,4vw,3.2rem)] measure">The build replaces this with the organising idea, in the voice of the business.</h2></Reveal>
          <Reveal delay={2}><p className="mt-6 measure opacity-80">Honest placeholder. Stage 2 writes the pages named in BRIEF.md, from the components in <code className="font-mono text-[0.9em]">components/ui</code>, using only the tokens in <code className="font-mono text-[0.9em]">design.config.ts</code>.</p></Reveal>
        </Section>

        <Section id="work" tone="surface">
          <Reveal><p className="eyebrow mb-4">Work</p></Reveal>
          <div className="grid md:grid-cols-3 gap-[var(--gutter)]">
            {[1, 2, 3].map((i) => (
              <Reveal key={i} delay={i}>
                <div className="hover-lift aspect-[4/5] rounded-[var(--radius-lg)] border hairline bg-bg p-6 flex flex-col justify-end">
                  <span className="eyebrow">0{i}</span>
                  <span className="display-sm text-xl mt-2">A real project goes here</span>
                </div>
              </Reveal>
            ))}
          </div>
        </Section>

        <Section id="contact">
          <div className="grid lg:grid-cols-2 gap-[calc(var(--gutter)*2)] items-start">
            <div>
              <Reveal><p className="eyebrow mb-4">Contact</p></Reveal>
              <Reveal delay={1}><h2 className="display-sm text-[clamp(1.8rem,4vw,3.2rem)]">Say hello.</h2></Reveal>
              <Reveal delay={2}><p className="mt-4 opacity-80 measure">Every message lands in the CRM at /admin, as a lead in the first stage.</p></Reveal>
              <Reveal delay={3}><div className="mt-6"><Button href="mailto:hello@example.com" variant="ghost">Or email</Button></div></Reveal>
            </div>
            <Reveal delay={2}>
              <Form name="contact" fields={[
                { name: 'name', label: 'Your name', required: true },
                { name: 'email', label: 'Email', type: 'email', required: true },
                { name: 'message', label: 'What can we do?', type: 'textarea', required: true },
              ]} submitLabel="Send" success="Thank you — we will reply soon." />
            </Reveal>
          </div>
        </Section>
      </main>
      <Footer />
    </>
  );
}
