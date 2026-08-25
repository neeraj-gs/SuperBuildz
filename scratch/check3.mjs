import { chromium } from 'playwright-core';
const base = 'http://127.0.0.1:5180';
const b = await chromium.launch({ headless: true });
const page = await b.newPage({ viewport: { width: 1440, height: 950 } });
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message.split('\n')[0]));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0,160)); });

const dna = {
  summary: 'A green industrial site that leads with one enormous wordmark and lets photography do the rest.',
  palette: ['#00A84F leaf', '#FFFFFF paper', '#0B0B0B ink'],
  typography: { display: 'Grotesque, very tight', body: 'Neutral sans', scale: 'One enormous step, nothing between' },
  layout: 'Full-bleed bands, no gutters',
  motion: 'Everything arrives on scroll, nothing loops',
  threeD: 'A particle field that resolves into the mark',
  hero: 'The wordmark, at the size of the screen',
  keep: ['The confidence of the type', 'One colour and one only'],
  avoid: ['Their exact green', 'The stock photography'],
  customPalette: { bg: '#0b0b0b', fg: '#ffffff', accent: '#00a84f', muted: '#9aa39c', surface: '#141614' },
  suggests: { palette: 'monolith', typography: 'brutal', atmosphere: 'stark', layout: 'bands', scene: 'morph', motionIntensity: 'bold', scrollStyle: 'pinned', hoverStyle: 'magnetic', signature: 'wordmark' },
};
const spec = { name: 'Test', folder: '', archetype: 'restaurant', references: ['https://otsuka-air.jp/'], dna: [dna], captureIds: ['gone-from-the-daemon'], adopted: [] };

await page.goto(base + '/new', { waitUntil: 'networkidle' });
await page.evaluate((d) => localStorage.setItem('sb:draft:v2', JSON.stringify(d)), { spec, at: 0 });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1800);

console.log('remembered card:', await page.locator('text=read earlier').count(), '| take switches:', await page.locator('text=would set').count());
await page.screenshot({ path: 'D:/Developer/SuperBuildz/shots/check-ref-remembered.png' });

// Jump to Colour and check the band is offered there.
await page.locator('button.chip', { hasText: 'Reference' }).first().click();
await page.waitForTimeout(400);
await page.locator('button', { hasText: 'Colour' }).first().click();
await page.waitForTimeout(900);
console.log('band on colour:', await page.locator('text=From the site you pointed at').count());
const label = await page.locator('text=/from otsuka-air.jp/').first().textContent().catch(() => null);
console.log('band label:', label);
await page.locator('span.chip', { hasText: 'Use it' }).first().click();
await page.waitForTimeout(600);
console.log('after pressing:', await page.locator('span.chip', { hasText: 'Using it' }).count());
await page.screenshot({ path: 'D:/Developer/SuperBuildz/shots/check-ref-band.png' });

// And it survives a walk to another screen and back.
await page.locator('button.chip', { hasText: 'Colour' }).first().click();
await page.waitForTimeout(300);
await page.locator('button', { hasText: '3D scene' }).first().click();
await page.waitForTimeout(700);
console.log('band on scene:', await page.locator('text=From the site you pointed at').count());
const spec2 = await page.evaluate(() => JSON.parse(localStorage.getItem('sb:draft:v2')).spec);
console.log('adopted now:', spec2.adopted, '| palette:', spec2.palette, '| customPalette:', !!spec2.customPalette, '| refs kept:', spec2.references);
console.log('errors:', errs.length ? errs : 'none');
await b.close();
