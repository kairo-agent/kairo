// ============================================
// KAIRO - Admin Layout (Server Component with RBAC)
// ============================================

import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { getCurrentUser } from '@/lib/actions/auth';
import { isSuperAdmin } from '@/lib/rbac';
import AdminLayoutClient from './AdminLayoutClient';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const user = await getCurrentUser();
  const locale = await getLocale();

  // If no user, redirect to login
  if (!user) {
    redirect(`/${locale}/login`);
  }

  // If user is not super_admin, redirect to leads (unauthorized)
  if (!isSuperAdmin(user.systemRole)) {
    redirect(`/${locale}/leads`);
  }

  return <AdminLayoutClient user={user}>{children}</AdminLayoutClient>;
}
