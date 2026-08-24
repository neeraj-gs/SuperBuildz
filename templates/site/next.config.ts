import type { NextConfig } from 'next';
import { analyticsHosts } from './lib/analytics-hosts';

/**
 * Security headers are defaults, not options. The CSP allows exactly the
 * analytics hosts this site was configured with (read from
 * NEXT_PUBLIC_ANALYTICS) and nothing else — the table lives in
 * lib/analytics-hosts.ts, shared with the loader so the two cannot disagree.
 * Loosen it only with a reason written in the README.
 */
const analytics = (process.env.NEXT_PUBLIC_ANALYTICS ?? 'custom').split(',').map((s) => s.trim()).filter(Boolean);
const { script: scriptHosts, connect: connectHosts } = analyticsHosts(analytics, process.env as Record<string, string | undefined>);

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : ''} ${scriptHosts.join(' ')}`.trim(),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${connectHosts.join(' ')} ${process.env.NODE_ENV === 'development' ? 'ws: wss:' : ''}`.trim(),
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "frame-ancestors 'self' http://127.0.0.1:* http://localhost:*",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  ...(process.env.NODE_ENV === 'production' ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }] : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The preview is loaded at 127.0.0.1 inside Super Builds; dev origin protection must allow it.
  allowedDevOrigins: ['127.0.0.1', 'localhost', '*.127.0.0.1.nip.io'],
  experimental: { optimizePackageImports: ['three', '@react-three/drei'] },
  transpilePackages: ['three'],
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default nextConfig;
