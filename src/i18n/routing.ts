import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: ['es', 'en'],

  // Used when no locale matches
  defaultLocale: 'es',

  // Prefix for locale in URL (always show locale in URL)
  localePrefix: 'always',

  // Pathnames for different locales (optional)
  pathnames: {
    '/': '/',
    '/login': '/login',
    '/register': '/register',
    '/forgot-password': '/forgot-password',
    '/dashboard': '/dashboard',
    '/leads': '/leads',
    '/conversations': '/conversations',
    '/agents': '/agents',
    '/reports': '/reports',
    '/settings': '/settings',
    '/profile': '/profile',
    '/terms': '/terms',
    '/privacy': '/privacy',
    // Workspace selection route
    '/select-workspace': '/select-workspace',
    // Admin routes
    '/admin': '/admin',
    '/admin/organizations': '/admin/organizations',
    '/admin/projects': '/admin/projects',
    '/admin/users': '/admin/users',
  }
});

// Lightweight wrappers around Next.js' navigation APIs
// that will consider the routing configuration
export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);
