// ============================================
// KAIRO - Dashboard Layout (Server Component with Auth)
// ============================================

import { getLocale } from 'next-intl/server';
import { getCurrentUser } from '@/lib/actions/auth';
import { getOrganizations } from '@/lib/actions/workspace';
import DashboardLayoutClient from './DashboardLayoutClient';
import AuthRedirect from '@/components/layout/AuthRedirect';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const user = await getCurrentUser();
  const locale = await getLocale();

  // If no user, render client-side redirect that preserves URL (incl. query params)
  // Server-side redirect() creates a new HTTP response that discards query params
  if (!user) {
    return <AuthRedirect />;
  }

  // Prefetch organizations for WorkspaceSelector (eliminates client-side loading delay)
  const organizations = await getOrganizations();

  return (
    <DashboardLayoutClient user={user} initialOrganizations={organizations}>
      {children}
    </DashboardLayoutClient>
  );
}
