import Link from 'next/link';
import { currentAdmin } from '@/lib/auth';
import { design } from '@/design.config';
import { logout } from './actions';
import { AdminNav } from './AdminNav';
import './admin.css';

export const metadata = { title: 'Admin', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * The CRM's frame. Auth happens here: no session, and every /admin route
 * renders the login instead. It wears the site's tokens — the same CSS
 * variables — with a denser rhythm suited to a tool.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await currentAdmin();
  if (!admin) return <div className="admin min-h-screen">{children}</div>;
  const nav: Array<[string, string]> = [['/admin', 'Overview'], ['/admin/leads', 'Leads'], ['/admin/analytics', 'Analytics'], ['/admin/settings', 'Settings']];
  return (
    <div className="admin min-h-screen grid grid-cols-1 md:grid-cols-[220px_1fr]">
      <aside className="border-r hairline p-4 flex md:flex-col gap-2 md:gap-1 md:sticky md:top-0 md:h-screen">
        <Link href="/" className="font-display font-semibold tracking-tight text-[15px] mb-2 px-2 py-1">{design.name}</Link>
        <AdminNav items={nav} />
        <div className="md:mt-auto flex items-center justify-between px-2 pt-2 text-xs opacity-70">
          <span className="truncate">{admin.email}</span>
          <form action={logout}><button className="underline">Sign out</button></form>
        </div>
      </aside>
      <main className="p-5 md:p-8 max-w-[1400px] w-full">{children}</main>
    </div>
  );
}
