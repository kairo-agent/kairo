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
      return NextResponse.json({
        isAdmin: false,
        userId: null,
        reason: 'not_authenticated'
      });
    }

    // Get user from our database
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        systemRole: true,
        isActive: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json({
        isAdmin: false,
        userId: user.id,
        reason: 'user_not_found'
      });
    }

    if (!dbUser.isActive) {
      return NextResponse.json({
        isAdmin: false,
        userId: user.id,
        reason: 'user_inactive'
      });
    }

    const isAdmin = dbUser.systemRole === 'super_admin';

    return NextResponse.json({
      isAdmin,
      userId: user.id,
      systemRole: dbUser.systemRole,
    });
  } catch (error) {
    console.error('Error verifying admin:', error);
    return NextResponse.json({
      isAdmin: false,
      userId: null,
      reason: 'error'
    }, { status: 500 });
  }
}
