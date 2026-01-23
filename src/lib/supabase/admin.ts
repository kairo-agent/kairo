// ============================================
// KAIRO - Supabase Admin Client
// For server-side operations requiring elevated privileges
// (creating users, managing auth, etc.)
// ============================================

import { createClient } from '@supabase/supabase-js';

// Admin client with service role key - NEVER expose to client
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase admin credentials');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
