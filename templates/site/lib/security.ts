/** Small helpers the intake routes share. */

export function csvCell(v: unknown): string {
  let s = v == null ? '' : String(v);
  // Formula injection: a cell that starts with = + - @ is executed by spreadsheets.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function clean(s: unknown, max = 2000): string {
  return String(s ?? '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim().slice(0, max);
}

export function json(data: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra } });
}
