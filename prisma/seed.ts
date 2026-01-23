// ============================================
// KAIRO - Database Seed Script
// Creates super_admin user in Supabase Auth + Prisma DB
// ============================================

import { PrismaClient, SystemRole } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();

// Super admin configuration
const SUPER_ADMIN = {
  email: 'joseleon86@gmail.com',
  password: 'Kairo2025!Temp', // Temporary password - change after first login
  firstName: 'Leo',
  lastName: 'Admin',
};

async function main() {
  console.log('🚀 Starting KAIRO seed...\n');

  // Initialize Supabase admin client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Check if super_admin already exists in our DB
  const existingUser = await prisma.user.findUnique({
    where: { email: SUPER_ADMIN.email },
  });

  if (existingUser) {
    console.log(`✅ Super admin already exists: ${SUPER_ADMIN.email}`);
    console.log(`   ID: ${existingUser.id}`);
    console.log(`   Role: ${existingUser.systemRole}`);
    return;
  }

  // Create user in Supabase Auth
  console.log(`📧 Creating Supabase Auth user: ${SUPER_ADMIN.email}`);

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: SUPER_ADMIN.email,
    password: SUPER_ADMIN.password,
    email_confirm: true, // Auto-confirm email
    user_metadata: {
      first_name: SUPER_ADMIN.firstName,
      last_name: SUPER_ADMIN.lastName,
    },
  });

  if (authError) {
    // Check if user already exists in Auth but not in our DB
    if (authError.message.includes('already been registered')) {
      console.log('⚠️  User exists in Supabase Auth, fetching ID...');

      // List users to find the existing one
      const { data: users } = await supabase.auth.admin.listUsers();
      const existingAuthUser = users?.users.find(u => u.email === SUPER_ADMIN.email);

      if (existingAuthUser) {
        // Create in our DB with the existing Auth ID
        const user = await prisma.user.create({
          data: {
            id: existingAuthUser.id,
            email: SUPER_ADMIN.email,
            firstName: SUPER_ADMIN.firstName,
            lastName: SUPER_ADMIN.lastName,
            systemRole: SystemRole.super_admin,
            isActive: true,
            // timezone/locale null = use org default or browser detection
            timezone: null,
            locale: null,
            preferences: {
              displayCurrency: 'PEN',
              theme: 'light',
            },
          },
        });

        console.log('\n✅ Super admin synced to database!');
        console.log(`   ID: ${user.id}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.systemRole}`);
        return;
      }
    }
    throw new Error(`Failed to create auth user: ${authError.message}`);
  }

  if (!authData.user) {
    throw new Error('No user returned from Supabase Auth');
  }

  console.log(`✅ Supabase Auth user created: ${authData.user.id}`);

  // Create user in Prisma DB
  console.log('💾 Creating user in database...');

  const user = await prisma.user.create({
    data: {
      id: authData.user.id, // Use Supabase Auth ID
      email: SUPER_ADMIN.email,
      firstName: SUPER_ADMIN.firstName,
      lastName: SUPER_ADMIN.lastName,
      systemRole: SystemRole.super_admin,
      isActive: true,
      // timezone/locale null = use org default or browser detection
      timezone: null,
      locale: null,
      preferences: {
        displayCurrency: 'PEN',
        theme: 'light',
      },
    },
  });

  console.log('\n✅ Super admin created successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   Email:    ${user.email}`);
  console.log(`   Password: ${SUPER_ADMIN.password}`);
  console.log(`   Role:     ${user.systemRole}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n⚠️  IMPORTANTE: Cambia tu contraseña después del primer login\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
