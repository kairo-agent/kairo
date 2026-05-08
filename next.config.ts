import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// ============================================
// Security Headers Configuration
// ============================================
const securityHeaders = [
  {
    // Prevent clickjacking attacks
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    // Prevent MIME type sniffing
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    // Control referrer information
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    // Restrict browser features
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  {
    // Enable HSTS (HTTP Strict Transport Security)
    // max-age: 2 years, includeSubDomains for all subdomains
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    // Content Security Policy
    // Allows Supabase, WhatsApp/Facebook for integrations
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`, // unsafe-eval only in dev (Next.js HMR)
      "style-src 'self' 'unsafe-inline'", // Tailwind uses inline styles
      "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in",
      "font-src 'self' data:",
      "media-src 'self' blob: https://*.supabase.co https://*.supabase.in",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://graph.facebook.com https://*.railway.app https://fcm.googleapis.com https://*.push.services.mozilla.com https://*.notify.windows.com https://*.push.apple.com",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join('; '),
  },
  // === Additional OWASP Recommended Headers ===
  {
    // Prevent Adobe Flash/PDF cross-domain policy files
    key: 'X-Permitted-Cross-Domain-Policies',
    value: 'none',
  },
  {
    // Prevent IE from executing downloads in site's context
    key: 'X-Download-Options',
    value: 'noopen',
  },
  {
    // Isolate browsing context (prevents Spectre-like attacks)
    key: 'Cross-Origin-Opener-Policy',
    value: 'same-origin',
  },
  {
    // Protect resources from being loaded cross-origin
    key: 'Cross-Origin-Resource-Policy',
    value: 'same-origin',
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ['@prisma/client', 'prisma', 'openai', 'web-push', 'resend'],
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || '0.0.0',
  },
  // Legacy redirects: /leads -> /conversations (Fase 3.7)
  // Status 307 (temporal) — en v0.26+ se creara una NUEVA pagina /leads para
  // la vista CRM "Leads Unicos". Cuando eso suceda, se elimina este redirect.
  // Browsers no cachean 307 permanentemente.
  async redirects() {
    return [
      { source: '/leads', destination: '/conversations', permanent: false },
      { source: '/leads/:path*', destination: '/conversations/:path*', permanent: false },
      { source: '/:locale(es|en)/leads', destination: '/:locale/conversations', permanent: false },
      { source: '/:locale(es|en)/leads/:path*', destination: '/:locale/conversations/:path*', permanent: false },
    ];
  },
  // Apply security headers to all routes
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
