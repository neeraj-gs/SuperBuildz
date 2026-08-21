import Link from 'next/link';
import { design } from '@/design.config';

export function Footer({ links = [{ href: '/#about', label: 'About' }, { href: '/#work', label: 'Work' }, { href: '/#contact', label: 'Contact' }], note }: { links?: Array<{ href: string; label: string }>; note?: string }) {
  return (
    <footer className="container-x py-14 border-t hairline" role="contentinfo">
      <div className="flex flex-wrap items-end justify-between gap-8">
        <div>
          <div className="display-sm text-2xl">{design.name}</div>
          {note && <p className="mt-2 opacity-70 max-w-[40ch]">{note}</p>}
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          {links.map((l) => <Link key={l.href} href={l.href} className="link-underline opacity-80 hover:opacity-100">{l.label}</Link>)}
        </nav>
      </div>
      <div className="mt-10 flex flex-wrap justify-between gap-4 eyebrow">
        <span>© {new Date().getFullYear()} {design.name}</span>
        <span><Link href="/legal" className="link-underline">Privacy</Link></span>
      </div>
    </footer>
  );
}
