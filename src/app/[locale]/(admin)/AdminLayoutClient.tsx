'use client';

// ============================================
// KAIRO - Admin Layout Client Component
// ============================================

import { useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ModalProvider } from '@/contexts/ModalContext';
import { LoadingProvider } from '@/contexts/LoadingContext';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { Header } from '@/components/layout';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { cn } from '@/lib/utils';

// Type for user from Prisma (simplified for client)
interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  systemRole: string;
}

interface AdminLayoutClientProps {
  children: React.ReactNode;
  user: AdminUser;
}

function AdminLayoutContent({ children, user }: AdminLayoutClientProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();
  const t = useTranslations('admin');

  const getPageTitle = (path: string): string => {
    const cleanPath = path.replace(/^\/(es|en)/, '');

    const titles: Record<string, string> = {
      '/admin': t('title'),
      '/admin/organizations': t('organizations.title'),
      '/admin/projects': t('projects.title'),
      '/admin/users': t('users.title'),
    };

    if (titles[cleanPath]) {
      return titles[cleanPath];
    }

    for (const [routePath, title] of Object.entries(titles)) {
      if (cleanPath.startsWith(routePath) && routePath !== '/admin') {
        return title;
      }
    }

    return t('title');
  };

  const handleOpenSidebar = useCallback(() => {
    setIsSidebarOpen(true);
  }, []);

  const handleCloseSidebar = useCallback(() => {
    setIsSidebarOpen(false);
  }, []);

  const pageTitle = getPageTitle(pathname);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <AdminSidebar isOpen={isSidebarOpen} onClose={handleCloseSidebar} />

      <div className={cn('lg:pl-[240px]', 'min-h-screen', 'transition-all duration-300')}>
        <Header title={pageTitle} onMenuClick={handleOpenSidebar} user={user} />
        <main className="w-full">{children}</main>
      </div>
    </div>
  );
}

export default function AdminLayoutClient({ children, user }: AdminLayoutClientProps) {
  return (
    <ThemeProvider defaultTheme="light">
      <ModalProvider>
        <LoadingProvider>
          <AdminLayoutContent user={user}>{children}</AdminLayoutContent>
          <LoadingOverlay />
        </LoadingProvider>
      </ModalProvider>
    </ThemeProvider>
  );
}
