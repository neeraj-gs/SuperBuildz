'use client';

import { useActionState } from 'react';
import { login } from '../actions';
import { design } from '@/design.config';

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <form action={action} className="w-full max-w-[380px] admin-card p-7">
        <div className="font-display font-semibold text-xl mb-1">{design.name}</div>
        <div className="text-sm opacity-70 mb-6">Sign in to the CRM.</div>
        <label className="admin-label">Email<input name="email" type="email" required autoComplete="username" className="admin-input" /></label>
        <label className="admin-label mt-3">Password<input name="password" type="password" required autoComplete="current-password" className="admin-input" /></label>
        {state?.error && <p role="alert" className="text-sm mt-3" style={{ color: 'var(--accent)' }}>{state.error}</p>}
        <button disabled={pending} className="admin-btn-primary w-full mt-5">{pending ? 'Checking…' : 'Sign in'}</button>
        <p className="text-xs opacity-60 mt-4">The login was shown once in Super Builds when this site was built.</p>
      </form>
    </div>
  );
}
