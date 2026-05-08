'use client';

// ============================================
// KAIRO - Dashboard Layout Client Component
// ============================================

import { useState, useCallback, useEffect, createContext, useContext } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import PushPermissionModal from '@/components/features/PushPermissionModal';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { WorkspaceProvider, type WorkspaceOrganization } from '@/contexts/WorkspaceContext';
import { LoadingProvider } from '@/contexts/LoadingContext';
import { QueryProvider } from '@/providers/QueryProvider';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { Toaster } from 'sonner';
import { Sidebar, Header } from '@/components/layout';
import { cn } from '@/lib/utils';

// Type for user from Prisma (simplified for client)
export interface DashboardUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  systemRole: string;
  organizationMemberships?: Array<{
    organizationId: string;
    isOwner: boolean;
  }>;
  projectMemberships?: Array<{
    id: string;
    projectId: string;
    role: string;
    project: {
      id: string;
      name: string;
      slug: string;
    };
  }>;
}

// User context for dashboard
const UserContext = createContext<DashboardUser | null>(null);

export function useCurrentUser() {
  const user = useContext(UserContext);
  if (!user) {
    throw new Error('useCurrentUser must be used within DashboardLayoutClient');
  }
  return user;
}

interface DashboardLayoutClientProps {
  children: React.ReactNode;
  user: DashboardUser;
  initialOrganizations?: WorkspaceOrganization[];
}

function DashboardLayoutContent({ children, user }: DashboardLayoutClientProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showPushModal, setShowPushModal] = useState(false);
  const pathname = usePathname();
  const t = useTranslations('navigation');
  const { shouldShowModal, requestAndSubscribe, dismissModal } = usePushNotifications(user.id);

  // Show push modal after a brief delay post-login (non-intrusive)
  useEffect(() => {
    if (!shouldShowModal) return;
    const timer = setTimeout(() => setShowPushModal(true), 3000);
    return () => clearTimeout(timer);
  }, [shouldShowModal]);

  // Map pathname to page titles using translations
  const getPageTitle = (path: string): string => {
    // Remove locale prefix from path
    const cleanPath = path.replace(/^\/(es|en)/, '');

    const titles: Record<string, string> = {
      '/': t('dashboard'),
      '/dashboard': t('dashboard'),
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
    <UserContext.Provider value={user}>
      <div className="min-h-screen bg-[var(--bg-primary)]">
        {/* Sidebar */}
        <Sidebar isOpen={isSidebarOpen} onClose={handleCloseSidebar} />

        {/* Main content area */}
        <div className={cn('lg:pl-[240px]', 'min-h-screen', 'transition-all duration-300')}>
          {/* Header */}
          <Header title={pageTitle} onMenuClick={handleOpenSidebar} user={user} />

          {/* Page content - full width */}
          <main className="w-full">{children}</main>
        </div>
      </div>

      {/* Push notification permission modal (pre-permission pattern) */}
      {showPushModal && (
        <PushPermissionModal
          onAccept={async () => {
            await requestAndSubscribe();
            setShowPushModal(false);
          }}
          onDismiss={() => {
            dismissModal();
            setShowPushModal(false);
          }}
        />
      )}
    </UserContext.Provider>
  );
}

export default function DashboardLayoutClient({
  children,
  user,
  initialOrganizations = [],
}: DashboardLayoutClientProps) {
  return (
    <ThemeProvider defaultTheme="light">
      <QueryProvider>
        <WorkspaceProvider initialOrganizations={initialOrganizations}>
          <LoadingProvider>
            <DashboardLayoutContent user={user}>{children}</DashboardLayoutContent>
            <LoadingOverlay />
            <Toaster position="bottom-right" richColors closeButton duration={4000} />
          </LoadingProvider>
        </WorkspaceProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
