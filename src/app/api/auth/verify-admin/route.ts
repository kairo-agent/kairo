// ============================================
// KAIRO - Admin Verification API Route
// Used by middleware to verify super_admin status
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Create Supabase client from request cookies
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {
            // Not needed for read-only operation
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ isAdmin: false });
    }

    // Get user from our database
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        systemRole: true,
        isActive: true,
      },
    });

    if (!dbUser || !dbUser.isActive) {
      return NextResponse.json({ isAdmin: false });
    }

    return NextResponse.json({
      isAdmin: dbUser.systemRole === 'super_admin',
    });
  } catch (error) {
    console.error('Error verifying admin:', error);
    return NextResponse.json({ isAdmin: false }, { status: 500 });
  }
}
