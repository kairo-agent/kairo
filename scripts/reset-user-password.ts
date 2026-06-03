/**
 * Reset user password via Supabase Admin API
 *
 * Usage:
 *   npx tsx scripts/reset-user-password.ts <email> [password]
 *
 * If password is omitted, a secure random one is generated.
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

function generatePassword(): string {
  // Format: Kairo-XXXX-9999 (memorable + safe to share)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I, O (ambiguous)
  const letters = Array.from({ length: 4 }, () =>
    chars[randomBytes(1)[0] % chars.length]
  ).join('');
  const digits = String(randomBytes(2).readUInt16BE(0) % 10000).padStart(4, '0');
  return `Kairo-${letters}-${digits}`;
}

async function main() {
  const email = process.argv[2];
  const passwordArg = process.argv[3];

  if (!email) {
    console.error('Usage: npx tsx scripts/reset-user-password.ts <email> [password]');
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const password = passwordArg ?? generatePassword();

  // Find user by email via admin listUsers (filter by email)
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) {
    console.error('Error listing users:', listErr.message);
    process.exit(1);
  }

  const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  const { error: updateErr } = await supabase.auth.admin.updateUserById(user.id, {
    password,
  });

  if (updateErr) {
    console.error('Error updating password:', updateErr.message);
    process.exit(1);
  }

  console.log('');
  console.log('=== PASSWORD RESET SUCCESSFUL ===');
  console.log(`Email:    ${user.email}`);
  console.log(`User ID:  ${user.id}`);
  console.log(`Password: ${password}`);
  console.log('');
  console.log('Share this password securely with the user.');
  console.log('Recommend they change it after first login.');
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
