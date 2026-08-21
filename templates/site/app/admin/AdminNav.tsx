'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AdminNav({ items }: { items: Array<[string, string]> }) {
  const path = usePathname();
  return (
    <>
      {items.map(([href, label]) => (
        <Link key={href} href={href} className={`admin-nav ${path === href || (href !== '/admin' && path.startsWith(href)) ? 'is-on' : ''}`}>{label}</Link>
      ))}
    </>
  );
}
