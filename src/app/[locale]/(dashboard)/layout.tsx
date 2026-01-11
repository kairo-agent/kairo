'use client';

import { useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ModalProvider } from '@/contexts/ModalContext';
import { Sidebar, Header } from '@/components/layout';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

function DashboardLayoutContent({ children }: DashboardLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();
  const t = useTranslations('navigation');

  // Map pathname to page titles using translations
  const getPageTitle = (path: string): string => {
    // Remove locale prefix from path
    const cleanPath = path.replace(/^\/(es|en)/, '');

    const titles: Record<string, string> = {
      '/': t('dashboard'),
      '/dashboard': t('dashboard'),
      '/leads': t('leads'),
      '/conversations': t('conversations'),
      '/agents': t('agents'),
      '/reports': t('reports'),
      '/settings': t('settings'),
    };

    // Check for exact match first
    if (titles[cleanPath]) {
      return titles[cleanPath];
    }

    // Check for partial matches (for nested routes)
    for (const [routePath, title] of Object.entries(titles)) {
      if (cleanPath.startsWith(routePath) && routePath !== '/') {
        return title;
      }
    }

    return 'KAIRO';
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
      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onClose={handleCloseSidebar} />

      {/* Main content area */}
      <div className={cn('lg:pl-[240px]', 'min-h-screen', 'transition-all duration-300')}>
        {/* Header */}
        <Header title={pageTitle} onMenuClick={handleOpenSidebar} />

        {/* Page content - full width */}
        <main className="w-full">{children}</main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <ThemeProvider defaultTheme="light">
      <ModalProvider>
        <DashboardLayoutContent>{children}</DashboardLayoutContent>
      </ModalProvider>
    </ThemeProvider>
  );
}
