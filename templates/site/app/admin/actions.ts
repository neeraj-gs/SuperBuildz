'use server';

/** Server actions for the CRM. Each checks the session and same-origin first. */

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { currentAdmin, sameOrigin, setSessionCookie, clearSessionCookie, verifyPassword } from '@/lib/auth';
import { repo } from '@/db/repo';
import { rateLimit } from '@/lib/rate-limit';

async function guard() {
  if (!(await currentAdmin()) || !(await sameOrigin())) throw new Error('Not allowed.');
}

export async function login(_prev: { error?: string } | undefined, form: FormData): Promise<{ error?: string }> {
  const h = await headers();
  const ip = (h.get('x-forwarded-for')?.split(',')[0] ?? 'local').trim();
  const rl = await rateLimit(`login:${ip}`, 8, 15 * 60 * 1000);
  if (!rl.ok) return { error: 'Too many attempts. Wait fifteen minutes.' };
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  const ok = email === (process.env.ADMIN_EMAIL ?? '').toLowerCase() && verifyPassword(password);
  // A small fixed delay on failure, so guessing is slow.
  if (!ok) { await new Promise((r) => setTimeout(r, 600)); return { error: 'That email and password do not match.' }; }
  await setSessionCookie(email);
  redirect('/admin');
}

export async function logout() {
  await clearSessionCookie();
  redirect('/admin/login');
}

export async function moveStage(id: string, stage: string) {
  await guard();
  await repo.moveStage(id, stage);
  revalidatePath('/admin'); revalidatePath('/admin/leads'); revalidatePath(`/admin/leads/${id}`);
}

export async function addNote(id: string, form: FormData) {
  await guard();
  const text = String(form.get('text') ?? '').trim().slice(0, 2000);
  if (!text) return;
  await repo.addActivity(id, 'note', text, 'owner');
  revalidatePath(`/admin/leads/${id}`);
}

export async function logTouch(id: string, kind: 'email' | 'call') {
  await guard();
  await repo.addActivity(id, kind, kind === 'email' ? 'Emailed' : 'Called', 'owner');
  revalidatePath(`/admin/leads/${id}`);
}

export async function updateLead(id: string, form: FormData) {
  await guard();
  const value = Number(form.get('value') ?? 0);
  await repo.updateLead(id, {
    name: String(form.get('name') ?? '').slice(0, 120), email: String(form.get('email') ?? '').slice(0, 200), phone: String(form.get('phone') ?? '').slice(0, 40),
    company: String(form.get('company') ?? '').slice(0, 120), value: Number.isFinite(value) ? value : 0, tags: String(form.get('tags') ?? '').slice(0, 200),
  });
  revalidatePath(`/admin/leads/${id}`); revalidatePath('/admin/leads');
}

export async function archiveLead(id: string, archived: boolean) {
  await guard();
  await repo.updateLead(id, { archived: archived ? 1 : 0 });
  revalidatePath('/admin/leads'); revalidatePath(`/admin/leads/${id}`);
}

export async function saveSetting(key: string, form: FormData) {
  await guard();
  await repo.setSetting(key, String(form.get('value') ?? '').slice(0, 4000));
  revalidatePath('/admin'); revalidatePath('/admin/settings');
}
