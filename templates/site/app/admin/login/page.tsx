import { devLogin } from '@/lib/auth';
import { design } from '@/design.config';
import { LoginForm } from './LoginForm';

/**
 * A server component, so the development login can be read out of the
 * environment and handed down. The form itself is a client component; only the
 * two strings cross the boundary, and only when `devLogin()` allows it.
 */
export default function LoginPage() {
  return <LoginForm name={design.name} demo={devLogin()} />;
}
