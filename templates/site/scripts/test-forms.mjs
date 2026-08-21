/** Posts a test lead through the real contact route, so "forms work end to end" is observed, not assumed. */
const port = process.env.PORT ?? process.env.SUPERBUILDS_PREVIEW_PORT ?? '3000';
const base = process.env.SHOT_BASE ?? `http://127.0.0.1:${port}`;
const form = process.argv[2] ?? 'contact';
const res = await fetch(`${base}/api/forms/${form}`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ name: 'Test Person', email: 'test@example.com', message: 'A test submission from npm run test:forms — safe to archive.', _t: 4000, _page: '/test' }),
});
const body = await res.text();
console.log(res.status, body);
if (!res.ok) process.exit(1);
console.log(`Check ${base}/admin/leads — the lead should be there.`);
