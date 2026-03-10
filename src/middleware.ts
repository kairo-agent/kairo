// ============================================
// KAIRO - Middleware (i18n + Supabase Auth + RBAC)
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

export async function middleware(request: NextRequest) {
  // First, handle i18n
  const intlResponse = intlMiddleware(request);

  // Create response with request headers + original URL for server components
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-kairo-pathname', request.nextUrl.pathname);
  if (request.nextUrl.search) {
    requestHeaders.set('x-kairo-search', request.nextUrl.search);
  }
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Copy headers from intl response
  intlResponse.headers.forEach((value, key) => {
    response.headers.set(key, value);
  });

  // Create Supabase client
  const supabase = createServerClient(
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

  // Refresh session if needed
  const { data: { user } } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const locale = pathname.match(/^\/(es|en)/)?.[1] || 'es';

  // If user is authenticated and trying to access login page
  if (user && isPublicRoute(pathname) && pathname.includes('/login')) {
    const redirectTo = request.nextUrl.searchParams.get('redirect');
    // SECURITY: Only allow internal redirects (prevent Open Redirect - OWASP A01:2021)
    // Must start with / but not // (protocol-relative URL attack)
    if (redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//') && !isAdminRoute(redirectTo)) {
      return NextResponse.redirect(new URL(redirectTo, request.url));
    }
    return NextResponse.redirect(new URL(`/${locale}/leads`, request.url));
  }

  // For admin routes: verify super_admin role via internal API
  if (user && isAdminRoute(pathname)) {
    try {
      // Call internal API to verify admin status
      const verifyUrl = new URL('/api/auth/verify-admin', request.url);
      const verifyResponse = await fetch(verifyUrl, {
        headers: {
          cookie: request.headers.get('cookie') || '',
        },
      });

      if (verifyResponse.ok) {
        const { isAdmin } = await verifyResponse.json();

        if (!isAdmin) {
          // Not a super_admin, redirect to leads
          return NextResponse.redirect(new URL(`/${locale}/leads`, request.url));
        }
      } else {
        // API error, redirect to login
        return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
      }
    } catch (error) {
      console.error('Error verifying admin in middleware:', error);
      return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
    }

    return response;
  }

  // Return response (has both intl headers + custom x-kairo-* request headers)
  return response;
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
