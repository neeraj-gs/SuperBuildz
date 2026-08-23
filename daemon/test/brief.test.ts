import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completeSpec, CATALOGUE, defaultsFor, ARCHETYPES, SCENES, PALETTES } from '../src/catalogue/index.ts';
import * as CATALOGUE_INTENT from '../src/catalogue/intent.ts';
import { masterBrief, planFor, stagesFor, systemPromptFor, changeBrief, sceneComponent, TYPE_DIRECTION, CHANGES } from '../src/brief.ts';
import { designConfigSource, fontsSource, hashPassword, localeFor } from '../src/scaffold.ts';

test('every archetype default points at real catalogue entries', () => {
  for (const a of ARCHETYPES) {
    const d = a.defaults;
    assert.ok(CATALOGUE.goals.some((g) => g.id === d.goal), `${a.id} goal ${d.goal}`);
    assert.ok(CATALOGUE.palettes.some((p) => p.id === d.palette), `${a.id} palette ${d.palette}`);
    assert.ok(CATALOGUE.typography.some((t) => t.id === d.typography), `${a.id} type ${d.typography}`);
    assert.ok(CATALOGUE.atmospheres.some((m) => m.id === d.atmosphere), `${a.id} atmosphere ${d.atmosphere}`);
    assert.ok(CATALOGUE.layouts.some((l) => l.id === d.layout), `${a.id} layout ${d.layout}`);
    assert.ok(CATALOGUE.scenes.some((s) => s.id === d.scene), `${a.id} scene ${d.scene}`);
    for (const p of d.pages) assert.ok(CATALOGUE.pages.some((x) => x.id === p), `${a.id} page ${p}`);
    for (const f of d.features) assert.ok(CATALOGUE.features.some((x) => x.id === f), `${a.id} feature ${f}`);
  }
});

test('every scene has a component name and every typography a font', () => {
  for (const s of SCENES) assert.ok(sceneComponent(s.id).endsWith('Scene'), s.id);
  for (const t of CATALOGUE.typography) assert.ok(TYPE_DIRECTION[t.id], t.id);
  for (const p of PALETTES) assert.equal(p.swatch?.length, 5, p.id);
});

test('the brief carries every choice it was given', () => {
  const spec = completeSpec({ ...defaultsFor('restaurant'), name: 'Ember & Oak', folder: '', sector: 'fine-dining', scene: 'diorama', details: { location: 'Lisbon', tagline: 'Fire, slowly.' } });
  const brief = masterBrief(spec);
  assert.match(brief, /Ember & Oak/);
  assert.match(brief, /Fine dining/);
  assert.match(brief, /Lisbon/);
  assert.match(brief, /small world/i);
  assert.match(brief, /hero is an experience/i);
  assert.match(brief, /land → view_service → open_booking → confirm_booking/);
  assert.match(brief, /design\.config\.ts/);
  assert.match(brief, /\/admin/);
});

test('a review-less spec has four stages; with review, five', () => {
  const a = completeSpec({ ...defaultsFor('saas'), name: 'X', folder: '', review: false });
  const b = completeSpec({ ...defaultsFor('saas'), name: 'X', folder: '', review: true });
  assert.equal(stagesFor(a).length, 4);
  assert.equal(stagesFor(b).length, 5);
  assert.match(stagesFor(b)[0].prompt(b), /Stage 1 of 5/);
  assert.match(stagesFor(a)[0].prompt(a), /Stage 1 of 4/);
});

test('the plan lists secrets for what was chosen and nothing else', () => {
  const spec = completeSpec({ ...defaultsFor('saas'), name: 'X', folder: '', analytics: ['custom', 'posthog'], crm: 'custom', features: ['payments'] });
  const plan = planFor(spec);
  const keys = plan.secrets.map((s) => s.key);
  assert.ok(keys.includes('NEXT_PUBLIC_POSTHOG_KEY'));
  assert.ok(keys.includes('STRIPE_SECRET_KEY'));
  assert.ok(!keys.includes('NEXT_PUBLIC_GA_ID'));
  assert.ok(plan.estimate.lowUsd < plan.estimate.highUsd);
});

test('the system prompt demands the options block and names the house rules', () => {
  const p = systemPromptFor('Acme');
  assert.match(p, /sb-options/);
  assert.match(p, /design\.config\.ts/);
  assert.match(p, /taskkill/);
});

test('change briefs fence the change', () => {
  for (const c of CHANGES) {
    const b = changeBrief(c.id, ['the contact page'], undefined, 'Acme');
    assert.match(b, /The fence/);
    assert.match(b, new RegExp(c.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('design.config.ts and fonts.ts are valid-looking TypeScript for every palette and type', () => {
  for (const p of PALETTES) {
    for (const t of CATALOGUE.typography) {
      const spec = completeSpec({ ...defaultsFor('agency'), name: 'Acme', folder: '', palette: p.id, typography: t.id });
      const src = designConfigSource(spec);
      assert.match(src, /export const design = \{/);
      assert.match(src, new RegExp(p.swatch![0]));
      const fonts = fontsSource(spec);
      assert.match(fonts, /from 'next\/font\/google'/);
      assert.match(fonts, /export const fontVariables/);
      // Static Google faces must carry weights or next/font fails the build.
      if (t.id === 'display-serif') assert.match(fonts, /Instrument_Serif\(\{[^}]*weight: \["400"\]/);
      if (t.id === 'condensed') assert.match(fonts, /Barlow_Condensed\(\{[^}]*weight: \[/);
    }
  }
});

test('password hashes carry their parameters', () => {
  const h = hashPassword('correct horse');
  assert.match(h, /^scrypt:32768:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
  assert.ok(!h.includes('$'), 'no $ — Next expands it in .env files');
  assert.notEqual(hashPassword('correct horse'), h);
});

/* ---------------------------------------------------------------------------
   The five things a generated site got wrong last time. Each of them is now a
   line in the brief, and a line in the brief that quietly stops being emitted
   is the kind of regression nobody notices until a build ships without it.
--------------------------------------------------------------------------- */

test('the brief demands a signature move, a scroll journey and a page-wide scene', () => {
  const spec = completeSpec({ ...defaultsFor('restaurant'), name: 'Ember & Oak', folder: '' });
  const brief = masterBrief(spec);
  assert.match(brief, /## The signature move/);
  assert.match(brief, /## The scroll journey/);
  assert.match(brief, /SceneLayer/, 'the scene must be mounted page-wide, not inside the hero');
  assert.match(brief, /data-scene-frame/);
  assert.match(brief, /portrait/i, 'portrait is a different composition, not a narrower one');
  assert.match(brief, /earned its scroll/);
});

test('the brief answers the imagery question, and forbids the empty rectangle', () => {
  const none = masterBrief(completeSpec({ ...defaultsFor('portfolio'), name: 'Studio', folder: '' }));
  assert.match(none, /## The pictures/);
  assert.match(none, /never render an empty rounded rectangle/i);
  assert.match(none, /Unsplash/, 'stock photography has to be named to be refused');
  assert.match(none, /<Figure>/);

  const have = masterBrief(completeSpec({
    ...defaultsFor('restaurant'), name: 'Ember', folder: '',
    imagery: { kind: 'have', folder: 'C:/photos', describes: 'the counter at service', instead: [] },
  }));
  assert.match(have, /public\/media/);
  assert.match(have, /the counter at service/);
  assert.doesNotMatch(have, /There are no photographs/);
});

test('the rubric covers what the last build missed', () => {
  const brief = masterBrief(completeSpec({ ...defaultsFor('other'), name: 'X', folder: '' }));
  for (const line of [/alive for the whole page/, /earns its scroll/, /signature move/, /No empty rectangles/, /native select or date input/]) {
    assert.match(brief, line, String(line));
  }
});

test('a location becomes a locale, and an unknown one is not American', () => {
  assert.equal(localeFor('Lisbon, Portugal'), 'pt-PT');
  assert.equal(localeFor('Brooklyn, New York'), 'en-US');
  assert.equal(localeFor('Manchester'), 'en-GB');
  assert.equal(localeFor(undefined), 'en-GB');
  assert.equal(localeFor('somewhere nobody listed'), 'en-GB');
  // It has to reach design.config.ts, or the date picker cannot use it.
  const src = designConfigSource(completeSpec({ ...defaultsFor('restaurant'), name: 'E', folder: '', details: { location: 'Lisbon' }, signature: 'the fire answers the pointer' }));
  assert.match(src, /locale: "pt-PT"/);
  assert.match(src, /signature: "the fire answers the pointer"/);
});

test('the review stage is on by default and knows what to look for', () => {
  assert.equal(completeSpec({ name: 'A', folder: '' }).review, true);
  const review = stagesFor(completeSpec({ name: 'A', folder: '' })).find((s) => s.id === 'review');
  assert.ok(review, 'the jury stage must exist by default');
  const prompt = review!.prompt(completeSpec({ name: 'A', folder: '' }));
  assert.match(prompt, /dies after the first viewport/);
  assert.match(prompt, /empty rounded rectangles/);
  assert.match(prompt, /mm\/dd\/yyyy/);
  assert.match(prompt, /cropped out of frame at 390px/);
});

test('a direction only ever names tokens, and the schema keeps it that way', async () => {
  const { DIRECTIONS_SCHEMA, directionsPrompt } = await import('../src/directions.ts');
  const props = DIRECTIONS_SCHEMA.properties.directions.items.properties.tweaks.properties as Record<string, unknown>;
  const { TWEAK_CONTROLS } = await import('../src/tweaks.ts');
  const known = new Set(TWEAK_CONTROLS.map((c) => c.key as string));
  for (const key of Object.keys(props)) {
    assert.ok(known.has(key), `${key} is not a control the tune panel or lib/tokens.ts knows about`);
  }
  // Three, and genuinely three: a schema that allowed one would let a model
  // answer with one and call the feature done.
  assert.equal(DIRECTIONS_SCHEMA.properties.directions.minItems, 3);
  assert.equal(DIRECTIONS_SCHEMA.properties.directions.maxItems, 3);

  const prompt = directionsPrompt(completeSpec({ ...defaultsFor('restaurant'), name: 'Ember', folder: '', details: { location: 'Lisbon' } }));
  assert.match(prompt, /Ember/);
  assert.match(prompt, /Lisbon/);
  assert.match(prompt, /7:1/, 'contrast has to be required or a direction can be unreadable');
  assert.match(prompt, /Vary more than colour/);
});

test('tweaks are sanitised before they are written into somebody\'s project', async () => {
  const { sanitise } = await import('../src/tweaks.ts');
  assert.deepEqual(sanitise({ bg: '#ABCDEF' }), { bg: '#abcdef' });
  assert.deepEqual(sanitise({ bg: 'red' }), {}, 'only hex, so nothing can be smuggled into the file');
  assert.deepEqual(sanitise({ bg: '#fff' }), {}, 'short hex is rejected rather than guessed at');
  assert.deepEqual(sanitise({ nonsense: 1, __proto__: {} }), {}, 'unknown keys never reach the file');
  assert.deepEqual(sanitise({ grain: 99 }), { grain: 0.3 }, 'out of range is clamped, not refused');
  assert.deepEqual(sanitise({ pace: -5 }), { pace: 0.4 });
  assert.deepEqual(sanitise({ radius: Number.NaN }), {});
});

test('intent answers reach the brief as prose, whether pressed or typed', () => {
  const pressed = masterBrief(completeSpec({
    ...defaultsFor('restaurant'), name: 'Ember', folder: '', goal: 'bookings',
    signature: 'subject-responds', belief: 'worth-the-trip', rhythm: 'slow-build',
    imagery: { kind: 'none', instead: ['type', 'draft'] },
  }));
  // Ids must never survive into the brief: "subject-responds" is not an instruction.
  assert.doesNotMatch(pressed, /subject-responds|worth-the-trip|slow-build/);
  assert.match(pressed, /The subject answers the pointer/);
  assert.match(pressed, /worth going out of my way for/);
  assert.match(pressed, /most intense at the end/);
  assert.match(pressed, /One word, enormous/);
  assert.match(pressed, /measured drawing/i);

  const typed = masterBrief(completeSpec({
    ...defaultsFor('restaurant'), name: 'Ember', folder: '',
    signature: 'the fire should react to the pointer', belief: 'that we take fire seriously',
  }));
  assert.match(typed, /the fire should react to the pointer/);
  assert.match(typed, /that we take fire seriously/);
});

test('every intent choice is answerable and nothing is a dangling id', () => {
  const { SIGNATURES, RHYTHMS, IMAGERY_KINDS, IMAGERY_DEVICES, beliefsFor } = CATALOGUE_INTENT;
  for (const list of [SIGNATURES, RHYTHMS, IMAGERY_KINDS, IMAGERY_DEVICES]) {
    assert.ok(list.length >= 3, 'a choice of two is barely a choice');
    for (const c of list) {
      assert.match(c.id, /^[a-z][a-z0-9-]*$/, c.id);
      assert.ok(c.label.length > 3, c.id);
    }
  }
  for (const g of CATALOGUE.goals) {
    assert.ok(beliefsFor(g.id).length >= 4, `${g.id} needs beliefs to offer`);
  }
  // The wizard's imagery kinds have to match the three the Spec allows.
  assert.deepEqual(IMAGERY_KINDS.map((k) => k.id).sort(), ['have', 'none', 'some']);
});
