'use client';

import { useActionState, useState } from 'react';
import { login } from '../actions';

/**
 * The owner's way in.
 *
 * `demo` is filled in only while the site runs on the machine that built it —
 * see `devLogin()`. It is prefilled rather than merely displayed because the
 * moment somebody has to copy two fields across from another window, they will
 * mistype one and blame the login. On a deployed site `demo` is null and this
 * is an ordinary empty form.
 */
export function LoginForm({ name, demo }: { name: string; demo: { email: string; password: string } | null }) {
  const [state, action, pending] = useActionState(login, undefined);
  const [email, setEmail] = useState(demo?.email ?? '');
  const [password, setPassword] = useState(demo?.password ?? '');
  const [show, setShow] = useState(false);

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <form action={action} className="w-full max-w-[400px] admin-card p-7">
        <div className="font-display font-semibold text-xl mb-1">{name}</div>
        <div className="text-sm opacity-70 mb-6">Sign in to the CRM.</div>

        <label className="admin-label">Email
          <input name="email" type="email" required autoComplete="username" className="admin-input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>

        <label className="admin-label mt-3">Password
          <span className="relative block">
            <input
              name="password" type={show ? 'text' : 'password'} required autoComplete="current-password"
              className="admin-input" style={{ paddingRight: 62 }}
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button" onClick={() => setShow((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs opacity-70 hover:opacity-100 px-2 py-1"
            >
              {show ? 'Hide' : 'Show'}
            </button>
          </span>
        </label>

        {state?.error && <p role="alert" className="text-sm mt-3" style={{ color: 'var(--accent)' }}>{state.error}</p>}

        <button disabled={pending} className="admin-btn-primary w-full mt-5">{pending ? 'Checking…' : 'Sign in'}</button>

        {demo ? (
          <p className="text-xs opacity-60 mt-4">
            Filled in for you because this site is running on the machine that built it. On a published
            site these fields are empty, and this password is never sent to the host.
          </p>
        ) : (
          <p className="text-xs opacity-60 mt-4">
            The login is in Super Builds, under the CRM tab. It can set you a new one if you have lost it.
          </p>
        )}
      </form>
    </div>
  );
}
