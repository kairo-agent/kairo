// ============================================
// KAIRO - Supabase Server Client
// For use in Server Components, Route Handlers, Server Actions
// ============================================

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Re-export prisma from the canonical singleton to maintain backward compatibility
export { prisma } from '@/lib/prisma';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}
