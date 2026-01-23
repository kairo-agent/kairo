// ============================================
// KAIRO - Dashboard Layout (Server Component with Auth)
// ============================================

import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { getCurrentUser } from '@/lib/actions/auth';
import { getOrganizations } from '@/lib/actions/workspace';
import DashboardLayoutClient from './DashboardLayoutClient';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const user = await getCurrentUser();
  const locale = await getLocale();

  // If no user, redirect to login
  if (!user) {
    redirect(`/${locale}/login`);
  }

  // Prefetch organizations for WorkspaceSelector (eliminates client-side loading delay)
  const organizations = await getOrganizations();

  return (
    <DashboardLayoutClient user={user} initialOrganizations={organizations}>
      {children}
    </DashboardLayoutClient>
  );
}
