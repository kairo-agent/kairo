import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify super admin
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (dbUser?.systemRole !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get counts
    const [totalOrganizations, totalProjects, totalUsers, totalLeads] = await Promise.all([
      prisma.organization.count(),
      prisma.project.count(),
      prisma.user.count(),
      prisma.lead.count(),
    ]);

    return NextResponse.json({
      totalOrganizations,
      totalProjects,
      totalUsers,
      totalLeads,
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
