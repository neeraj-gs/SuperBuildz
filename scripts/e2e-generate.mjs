// Drives a real generation through the daemon: token over the socket, create a project, generate, watch.
import WebSocket from 'ws';
const base = 'http://127.0.0.1:7747';
const ws = new WebSocket('ws://127.0.0.1:7747/ws', { origin: 'http://127.0.0.1:5180' });
const token = await new Promise((res) => ws.on('message', (m) => { const ev = JSON.parse(m.toString()); if (ev.type === 'hello') res(ev.token); }));
const H = { 'content-type': 'application/json', 'x-superbuilds-token': token };
const post = async (p, b) => { const r = await fetch(base + p, { method: 'POST', headers: H, body: JSON.stringify(b ?? {}) }); const t = await r.text(); if (!r.ok) throw new Error(p + ' ' + r.status + ' ' + t); return JSON.parse(t); };
const get = async (p) => (await fetch(base + p)).json();

const mode = process.argv[2] ?? 'create';
if (mode === 'create') {
  const defaults = await get('/api/spec/defaults?archetype=restaurant');
  const spec = { ...defaults, name: 'Ember and Oak', sector: 'fine-dining', scene: 'diorama', palette: 'ember', typography: 'display-serif', layout: 'stacked-cards',
    details: { tagline: 'Fire, slowly.', location: 'Lisbon', hours: 'Tue–Sun 18–23', knownFor: ['wood-fired everything', 'a six-seat counter'], offerings: ['tasting menu', 'the counter', 'private dining'] },
    pages: ['home', 'menu', 'about', 'contact'], features: ['booking', 'gallery', 'map', 'hours'], analytics: ['custom', 'vercel'], crm: 'custom', deploy: 'vercel', review: false,
    notes: 'Keep the build small for a test run: do not spend long on copy; the point is that every stage completes.' };
  const project = await post('/api/projects', spec);
  console.log('project', project.id, project.path);
  const gen = await post(`/api/projects/${project.id}/generate`);
  console.log('generation started', gen.stages.map((s) => s.id).join(' → '));
  ws.close(); process.exit(0);
}
if (mode === 'capture') {
  const cap = await post('/api/reference', { url: process.argv[3] });
  console.log('capture', cap.id, cap.status);
  ws.close(); process.exit(0);
}
if (mode === 'capture-state') {
  const c = await get(`/api/reference/${process.argv[3]}`);
  console.log(JSON.stringify({ status: c.status, shots: c.shots.length, video: c.video, error: c.error, dna: c.dna }, null, 2));
  ws.close(); process.exit(0);
}
if (mode === 'rewind') {
  const p = await get(`/api/projects/${process.argv[3]}`);
  const s = await get(`/api/sessions/${p.sessionId}`);
  const lastUser = [...s.turns].reverse().find((t) => t.role === 'user' && t.checkpointId);
  console.log('rewinding to before:', lastUser?.text.slice(0, 80));
  console.log(await post(`/api/sessions/${s.id}/rewind`, { turnId: lastUser.id }));
  ws.close(); process.exit(0);
}
if (mode === 'watch') {
  const id = process.argv[3];
  const g = await get(`/api/projects/${id}/generation`);
  const p = await get(`/api/projects/${id}`);
  const pv = await get(`/api/projects/${id}/preview`);
  console.log(JSON.stringify({ status: p.status, running: g?.running, error: g?.error, cost: g?.costUsd, stages: g?.stages.map((s) => `${s.id}:${s.status}`), preview: pv.url, logTail: g?.log.slice(-300) }, null, 2));
  if (p.sessionId) { const s = await get(`/api/sessions/${p.sessionId}`); const last = s.turns.at(-1); console.log('turns', s.turns.length, 'last', last?.role, (last?.text ?? '').slice(0, 600), 'tools', last?.tools?.length, 'options', last?.options); }
  ws.close(); process.exit(0);
}
