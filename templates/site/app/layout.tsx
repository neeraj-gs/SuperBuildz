import type { Metadata } from 'next';
import './globals.css';
import { fontVariables } from './fonts';
import { design } from '@/design.config';
import { cssVariables, defaultTheme } from '@/lib/tokens';
import { AnalyticsProviders } from '@/lib/analytics-client';
import { SmoothScroll } from '@/components/ui/SmoothScroll';
import { Cursor } from '@/components/ui/Cursor';
import { PageTransition } from '@/components/ui/PageTransition';
import { ThemeScript } from '@/components/ui/ThemeToggle';

export const metadata: Metadata = {
  title: { default: design.name, template: `%s — ${design.name}` },
  description: `${design.name}`,
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = defaultTheme();
  const vars = cssVariables(theme);
  return (
    <html lang="en" className={fontVariables} data-theme={theme} data-hover={design.motion.hover} data-cursor={design.motion.cursor} data-transition={design.motion.transition} style={vars as React.CSSProperties} suppressHydrationWarning>
      <head><ThemeScript /></head>
      <body>
        <SmoothScroll />
        <PageTransition>{children}</PageTransition>
        <Cursor />
        <AnalyticsProviders />
      </body>
    </html>
  );
}
