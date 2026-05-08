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

  // Create Supabase client - set cookies directly on intlResponse
  // so session tokens are preserved in the response that gets returned
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
            intlResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh session if needed
  const { data: { user } } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const locale = pathname.match(/^\/(es|en)/)?.[1] || 'es';

  // Helper: copy Supabase session cookies to a redirect response
  const redirectWithCookies = (url: URL, status?: 301 | 302 | 307 | 308) => {
    const redirectResponse = status
      ? NextResponse.redirect(url, status)
      : NextResponse.redirect(url);
    intlResponse.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  };

  // Legacy redirect: /leads -> /conversations (Fase 3.7).
  // Status 302 (temporal) — en v0.26+ se creara una NUEVA pagina /leads para
  // la vista CRM "Leads Unicos" (deduplicacion por email/telefono). En ese
  // momento se elimina este redirect y la nueva ruta sirve directo.
  // Browsers no cachean 302 permanentemente, asi que la transicion es segura.
  const pathWithoutLocale = pathname.replace(/^\/(es|en)/, '');
  if (pathWithoutLocale === '/leads' || pathWithoutLocale.startsWith('/leads/')) {
    const newPath = pathWithoutLocale.replace(/^\/leads/, '/conversations');
    const newUrl = new URL(`/${locale}${newPath}${request.nextUrl.search}`, request.url);
    return redirectWithCookies(newUrl, 302);
  }

  // Redirect unauthenticated users from protected routes to login
  if (!user && !isPublicRoute(pathname)) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    // Preserve the original URL so user can return after login
    loginUrl.searchParams.set('redirect', pathname);
    return redirectWithCookies(loginUrl);
  }

  // If user is authenticated and trying to access login page
  if (user && isPublicRoute(pathname) && pathname.includes('/login')) {
    const redirectTo = request.nextUrl.searchParams.get('redirect');
    // SECURITY: Only allow internal redirects (prevent Open Redirect - OWASP A01:2021)
    // Must start with / but not // (protocol-relative URL attack)
    // Also decode to catch encoded bypasses like %2F%2F -> //
    const decodedRedirect = redirectTo ? decodeURIComponent(redirectTo) : null;
    if (redirectTo && decodedRedirect && decodedRedirect.startsWith('/') && !decodedRedirect.startsWith('//') && !isAdminRoute(decodedRedirect)) {
      // Ensure redirect target has locale prefix
      const hasLocale = /^\/(es|en)(\/|$)/.test(redirectTo);
      const safeRedirect = hasLocale ? redirectTo : `/${locale}${redirectTo}`;
      return redirectWithCookies(new URL(safeRedirect, request.url));
    }
    return redirectWithCookies(new URL(`/${locale}/leads`, request.url));
  }

  // For admin routes: verify super_admin role directly (no self-fetch)
  if (user && isAdminRoute(pathname)) {
    try {
      // Query DB directly instead of calling /api/auth/verify-admin (saves cold start + round-trip)
      const { data: dbUser } = await supabase
        .from('users')
        .select('systemRole, isActive')
        .eq('id', user.id)
        .single();

      if (!dbUser || !dbUser.isActive || dbUser.systemRole !== 'super_admin') {
        return redirectWithCookies(new URL(`/${locale}/leads`, request.url));
      }
    } catch (error) {
      console.error('Error verifying admin in middleware:', error);
      return redirectWithCookies(new URL(`/${locale}/leads`, request.url));
    }

    return intlResponse;
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
