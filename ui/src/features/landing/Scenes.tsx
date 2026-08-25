/**
 * Thirteen scenes, as an index rather than thirteen boxes.
 *
 * They were a grid of identical cards: icon, name, one line, repeated until
 * the eye stopped. Thirteen of anything in equal boxes is a way of saying "we
 * have thirteen" and nothing else, and the point of these is not the count —
 * it is that each one is a different physical idea about what a hero can be.
 *
 * So: a list you run your eye down, and one specimen beside it that changes as
 * you go. It moves on its own until you touch it, then it does what you say.
 * That is also the shape of the product.
 */

import { useEffect, useRef, useState } from 'react';
import { cx } from '@/components/ui';
import { Icon } from '@/components/icons';

const SCENES: Array<{ id: string; name: string; what: string; weight: 'light' | 'medium' | 'heavy'; suits: string }> = [
  { id: 'field', name: 'A field you move through', what: 'Thousands of points and light streaks receding into depth, parting around the pointer and accelerating as the page scrolls.', weight: 'medium', suits: 'agencies · software · anything with no product to photograph' },
  { id: 'relief', name: 'A surface with something pressed into it', what: 'Your mark, embossed into material and lit by one moving light. The pointer moves the light, not the camera — so it reads as a real object under a lamp.', weight: 'medium', suits: 'studios · makers · stationery' },
  { id: 'wordmark', name: 'The name, as an object', what: 'The business name built as real geometry: extruded, bevelled, lit, and settling as though it has weight.', weight: 'medium', suits: 'bars · labels · anything whose name is the brand' },
  { id: 'object', name: 'One thing, turning', what: 'A single product or material, studio-lit, that the page orbits as it scrolls.', weight: 'medium', suits: 'shops · furniture · instruments' },
  { id: 'liquid', name: 'Something that flows', what: 'A liquid or smoke surface driven by a shader, disturbed locally by the pointer and never repeating.', weight: 'heavy', suits: 'restaurants · spirits · wellness' },
  { id: 'diorama', name: 'A small world', what: 'An isometric low-poly model of the place, rotating slightly, revealing detail as you scroll into it.', weight: 'heavy', suits: 'hotels · clinics · anywhere you can visit' },
  { id: 'cloth', name: 'Cloth in the wind', what: 'A simulated fabric — a flag, a drape, a banner — that ripples and reacts to the pointer.', weight: 'medium', suits: 'fashion · sport · events' },
  { id: 'terrain', name: 'The ground beneath it', what: 'A topographic landscape or stylised map, lit low, that the camera flies over.', weight: 'medium', suits: 'travel · outdoors · property' },
  { id: 'morph', name: 'Particles that become things', what: 'A cloud that resolves into the logo, then the product, then a word, then back.', weight: 'heavy', suits: 'technology · science · anything abstract' },
  { id: 'glass', name: 'Light through glass', what: 'Refraction bending the type behind it, so the headline is read through the object.', weight: 'heavy', suits: 'optics · jewellery · finance' },
  { id: 'exploded', name: 'Taken apart', what: 'Components drift apart as you scroll and label themselves, then draw back together.', weight: 'medium', suits: 'hardware · workshops · anything with parts' },
  { id: 'ribbons', name: 'Ribbons that follow you', what: 'Glossy tubes weaving through the type, trailing the pointer with a lag you can feel.', weight: 'medium', suits: 'music · festivals · agencies' },
  { id: 'none', name: 'None of it', what: 'No canvas at all. Typography, photography and motion carry the whole page — which for some businesses is the right answer and always the fastest one.', weight: 'light', suits: 'anywhere the words are the product' },
];

export function Scenes({ onPick }: { onPick: () => void }) {
  const [at, setAt] = useState(0);
  const [held, setHeld] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (held) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setAt((n) => (n + 1) % SCENES.length), 3200);
    return () => clearInterval(id);
  }, [held]);

  const scene = SCENES[at];

  return (
    <div
      className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-8 lg:gap-14 items-start"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
    >
      <ul ref={listRef} className="grid">
        {SCENES.map((s, i) => (
          <li key={s.id}>
            <button
              onMouseEnter={() => setAt(i)}
              onFocus={() => { setHeld(true); setAt(i); }}
              onBlur={() => setHeld(false)}
              onClick={onPick}
              className={cx(
                'group w-full text-left py-2.5 border-t border-line flex items-baseline gap-3 transition-colors',
                i === at ? 'text-bone' : 'text-bone-3 hover:text-bone-2',
              )}
            >
              <span className={cx('telemetry shrink-0 transition-colors', i === at ? 'text-volt' : 'text-bone-4')}>{String(i + 1).padStart(2, '0')}</span>
              <span className="font-[family-name:var(--font-display)] font-bold tracking-[-0.03em] text-[clamp(1.05rem,2vw,1.6rem)] leading-[1.15]">{s.name}</span>
              <span className={cx('ml-auto shrink-0 transition-opacity', i === at ? 'opacity-100' : 'opacity-0')}>
                <Icon name="arrowRight" size={14} className="text-volt" />
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="lg:sticky lg:top-24">
        <div className="panel overflow-hidden noise relative bg-ink-2/80 backdrop-blur-sm">
          <div className="aspect-[16/10] relative grid place-items-center border-b border-line overflow-hidden">
            {/* The icon at specimen size: the drawing of the idea, not a
                screenshot of one instance of it. */}
            <Icon key={scene.id} name={scene.id} size={132} strokeWidth={0.7} className="text-volt fade" />
            <span className="absolute inset-0 dot-bg opacity-[0.35] pointer-events-none" />
          </div>
          <div key={scene.id} className="p-5 fade">
            <div className="flex items-start justify-between gap-4">
              <h3 className="d4 leading-snug">{scene.name}</h3>
              <span className={cx('telemetry shrink-0 mt-1', scene.weight === 'heavy' ? 'text-warn' : 'text-bone-4')}>{scene.weight} on phones</span>
            </div>
            <p className="text-[13.5px] leading-relaxed text-bone-2 mt-2">{scene.what}</p>
            <p className="telemetry text-bone-4 mt-3">{scene.suits}</p>
          </div>
        </div>
        <p className="text-[13px] text-bone-3 mt-4 measure">
          Every one is real WebGL that already exists, previewed live while you choose and then
          adapted to your business — not generated from scratch and hoped for.
        </p>
      </div>
    </div>
  );
}
