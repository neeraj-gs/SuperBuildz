import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completeSpec, CATALOGUE, defaultsFor, ARCHETYPES, SCENES, PALETTES } from '../src/catalogue/index.ts';
import { masterBrief, planFor, stagesFor, systemPromptFor, changeBrief, sceneComponent, TYPE_DIRECTION, CHANGES } from '../src/brief.ts';
import { designConfigSource, fontsSource, hashPassword } from '../src/scaffold.ts';

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
    }
  }
});

test('password hashes carry their parameters', () => {
  const h = hashPassword('correct horse');
  assert.match(h, /^scrypt\$32768\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
  assert.notEqual(hashPassword('correct horse'), h);
});
