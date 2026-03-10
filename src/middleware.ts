// ============================================
// KAIRO - Middleware (i18n + Supabase Auth + RBAC)
// Auth check runs BEFORE intl to preserve query params on redirects
// ============================================

import { NextResponse, type NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { routing } from './i18n/routing';

// Create the intl middleware
const intlMiddleware = createIntlMiddleware(routing);

// Public routes that don't require authentication
const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password'];

// Admin routes that require super_admin role
const adminRoutes = ['/admin'];

// Check if path is public (supports locale prefix)
function isPublicRoute(pathname: string): boolean {
  const pathWithoutLocale = pathname.replace(/^\/(es|en)/, '');
  return publicRoutes.some(route => pathWithoutLocale.startsWith(route)) || pathWithoutLocale === '';
}

// Check if path is admin route
function isAdminRoute(pathname: string): boolean {
  const pathWithoutLocale = pathname.replace(/^\/(es|en)/, '');
  return adminRoutes.some(route => pathWithoutLocale.startsWith(route));
}

// Create Supabase client for auth check
function createAuthClient(request: NextRequest, response: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const locale = pathname.match(/^\/(es|en)/)?.[1] || 'es';

  // ── Auth check BEFORE intl middleware ──
  // This prevents intl redirects from stripping query params (e.g. ?leadId=xxx)
  // on protected routes that need to redirect to login.
  if (!isPublicRoute(pathname)) {
    const tempResponse = NextResponse.next({ request: { headers: request.headers } });
    const supabase = createAuthClient(request, tempResponse);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Preserve full path with query params for post-login redirect
      const fullPath = pathname + request.nextUrl.search;
      const loginUrl = new URL(`/${locale}/login`, request.url);
      loginUrl.searchParams.set('redirect', fullPath);
      return NextResponse.redirect(loginUrl);
    }

    // ── Admin route RBAC ──
    if (isAdminRoute(pathname)) {
      try {
        const verifyUrl = new URL('/api/auth/verify-admin', request.url);
        const verifyResponse = await fetch(verifyUrl, {
          headers: { cookie: request.headers.get('cookie') || '' },
        });

        if (verifyResponse.ok) {
          const { isAdmin } = await verifyResponse.json();
          if (!isAdmin) {
            return NextResponse.redirect(new URL(`/${locale}/leads`, request.url));
          }
        } else {
          return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
        }
      } catch (error) {
        console.error('Error verifying admin in middleware:', error);
        return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
      }
    }
  }

  // ── i18n middleware (runs after auth is verified) ──
  const intlResponse = intlMiddleware(request);

  // Create response with intl headers + Supabase session refresh
  const response = NextResponse.next({ request: { headers: request.headers } });
  intlResponse.headers.forEach((value, key) => {
    response.headers.set(key, value);
  });

  // Refresh Supabase session cookies
  const supabase = createAuthClient(request, response);
  await supabase.auth.getUser();

  // ── Authenticated user on login page → redirect away ──
  if (isPublicRoute(pathname) && pathname.includes('/login')) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const redirectTo = request.nextUrl.searchParams.get('redirect');
      // SECURITY: Only allow internal redirects (prevent Open Redirect - OWASP A01:2021)
      if (redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//') && !isAdminRoute(redirectTo)) {
        return NextResponse.redirect(new URL(redirectTo, request.url));
      }
      return NextResponse.redirect(new URL(`/${locale}/leads`, request.url));
    }
  }

  return intlResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api (API routes)
     */
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\..*).)*',
  ],
};
