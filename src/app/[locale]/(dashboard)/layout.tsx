// ============================================
// KAIRO - Dashboard Layout (Server Component with Auth)
// ============================================

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
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

  // If no user, redirect to login preserving the original URL for post-login deep-link
  if (!user) {
    const headersList = await headers();
    const originalPath = headersList.get('x-kairo-pathname') || '';
    const originalSearch = headersList.get('x-kairo-search') || '';
    // Only add redirect param if there are query params to preserve (e.g. ?leadId=xxx)
    if (originalSearch) {
      const fullPath = `${originalPath}${originalSearch}`;
      redirect(`/${locale}/login?redirect=${encodeURIComponent(fullPath)}`);
    }
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
