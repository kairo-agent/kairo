'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { LeadChannel } from '@prisma/client';
import { Link, usePathname } from '@/i18n/routing';
import { useTheme } from '@/contexts/ThemeContext';
import { useCurrentUser } from '@/app/[locale]/(dashboard)/DashboardLayoutClient';
import { useEffectiveRole } from '@/hooks/useEffectiveRole';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { getProvisionedChannels } from '@/lib/actions/project-channels';
import { cn } from '@/lib/utils';
import { WorkspaceSelector } from './WorkspaceSelector';

// Navigation item type - href must match pathnames defined in i18n/routing.ts
type AppPathname = '/' | '/dashboard' | '/leads' | '/conversations' | '/agents' | '/reports' | '/settings' | '/settings/team' | '/settings/whatsapp' | '/settings/webchat' | '/admin';

interface NavItem {
  labelKey: string;
  href: AppPathname;
  icon: React.ReactNode;
  disabled?: boolean;
  hasBadge?: boolean;
}

// SVG Icons as inline components
const HomeIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const UsersIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const MessageIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const BotIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v4" />
    <line x1="8" y1="16" x2="8" y2="16" />
    <line x1="16" y1="16" x2="16" y2="16" />
  </svg>
);

const ChartIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const SettingsIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

// Admin icon (shield with gear) - Only visible for super_admin
const AdminIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

// AI Settings sub-icon
const AISettingsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z" />
    <circle cx="9" cy="15" r="1" />
    <circle cx="15" cy="15" r="1" />
  </svg>
);

// Team Settings sub-icon
const TeamSettingsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

// Chevron icon for collapsible sections
const ChevronDownIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn('transition-transform duration-200', isOpen && 'rotate-180')}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

// Navigation items configuration (labelKey maps to navigation.* in translations)
// Fase 3.7: /leads renombrado a /conversations. La nueva pagina /leads
// (vista CRM "Leads Unicos") viene en v0.26+.
const navigationItems: NavItem[] = [
  { labelKey: 'dashboard', href: '/dashboard', icon: <HomeIcon /> },
  { labelKey: 'conversations', href: '/conversations', icon: <MessageIcon /> },
  { labelKey: 'agents', href: '/agents', icon: <BotIcon />, disabled: true, hasBadge: true },
  { labelKey: 'reports', href: '/reports', icon: <ChartIcon />, disabled: true, hasBadge: true },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { theme } = useTheme();
  const user = useCurrentUser();
  const t = useTranslations('navigation');
  const tDashboard = useTranslations('dashboard');
  const tLogin = useTranslations('login');
  const [isMounted, setIsMounted] = useState(false);
  const isSettingsRoute = pathname.startsWith('/settings');
  const [isSettingsOpen, setIsSettingsOpen] = useState(isSettingsRoute);

  // Keep settings open when navigating to a settings sub-route
  useEffect(() => {
    if (isSettingsRoute) setIsSettingsOpen(true);
  }, [isSettingsRoute]);

  // Check if user is super_admin
  const isSuperAdmin = user.systemRole === 'super_admin';
  const effectiveRole = useEffectiveRole();
  const canSeeSettings = effectiveRole === 'super_admin' || effectiveRole === 'owner' || effectiveRole === 'admin' || effectiveRole === 'manager';

  // Provisioned channels for current project (Fase 2.2b — render condicional)
  const { selectedProject } = useWorkspace();
  const [provisionedChannels, setProvisionedChannels] = useState<LeadChannel[]>([]);

  useEffect(() => {
    if (!selectedProject?.id) {
      setProvisionedChannels([]);
      return;
    }
    let cancelled = false;
    getProvisionedChannels(selectedProject.id).then((result) => {
      if (cancelled) return;
      if (result.success) setProvisionedChannels(result.channels);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedProject?.id]);

  const hasWhatsApp = provisionedChannels.includes('whatsapp');
  const hasWebChat = provisionedChannels.includes('webchat');

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setIsMounted(true);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, []);

  // Close sidebar on escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Check if a nav item is active
  // pathname from next-intl already strips the locale prefix
  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard' || pathname === '/';
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  if (!isMounted) {
    return null;
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center h-16 px-6 border-b border-[var(--border-primary)]">
        <Link href="/conversations" className="flex items-center" onClick={onClose}>
          <div className="relative h-8 w-28">
            <Image
              src={theme === 'dark' ? '/images/logo-main.png' : '/images/logo-oscuro.png'}
              alt="KAIRO Logo"
              fill
              sizes="112px"
              priority
              style={{ objectFit: 'contain', objectPosition: 'left center' }}
            />
          </div>
        </Link>
      </div>

      {/* Workspace Selector - Organization & Project */}
      <WorkspaceSelector />

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navigationItems.map((item) => {
          const active = isActive(item.href);

          if (item.disabled) {
            // Hide disabled/coming-soon items for non-super_admin users
            if (!isSuperAdmin) return null;

            return (
              <div
                key={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg',
                  'text-[var(--text-tertiary)] cursor-not-allowed opacity-60'
                )}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                <span className="flex-1 text-sm font-medium">{t(item.labelKey)}</span>
                {item.hasBadge && (
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]">
                    {t('comingSoon')}
                  </span>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg relative',
                'transition-all duration-200',
                active
                  ? 'bg-[var(--accent-primary-light)] text-[var(--accent-text)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
              )}
            >
              {/* Active indicator - cyan left border */}
              {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[var(--accent-primary)] rounded-r-full" />
              )}
              <span className="flex-shrink-0">{item.icon}</span>
              <span className="text-sm font-medium">{t(item.labelKey)}</span>
            </Link>
          );
        })}

        {/* Settings section - Collapsible (admin+ only) */}
        {canSeeSettings && <div>
          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg w-full relative',
              'transition-all duration-200',
              isSettingsRoute
                ? 'bg-[var(--accent-primary-light)] text-[var(--accent-text)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
            )}
          >
            {isSettingsRoute && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[var(--accent-primary)] rounded-r-full" />
            )}
            <span className="flex-shrink-0"><SettingsIcon /></span>
            <span className="flex-1 text-left text-sm font-medium">{t('settings')}</span>
            <ChevronDownIcon isOpen={isSettingsOpen} />
          </button>

          {/* Sub-items */}
          <div
            className={cn(
              'overflow-hidden transition-all duration-200',
              // max-h dinamico: 4 items max (AI + WhatsApp + Web + Team)
              isSettingsOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
            )}
          >
            <div className="ml-4 pl-3 mt-1 space-y-0.5 border-l border-[var(--border-primary)]">
              <Link
                href="/settings"
                onClick={onClose}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg',
                  'transition-all duration-200',
                  pathname === '/settings'
                    ? 'text-[var(--accent-text)] bg-[var(--accent-primary-light)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                )}
              >
                <span className="flex-shrink-0"><AISettingsIcon /></span>
                <span className="text-sm">{t('settingsAI')}</span>
              </Link>

              {/* WhatsApp — solo si canal provisionado (Fase 2.2b) */}
              {hasWhatsApp && (
                <Link
                  href="/settings/whatsapp"
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg',
                    'transition-all duration-200',
                    pathname === '/settings/whatsapp'
                      ? 'text-[var(--accent-text)] bg-[var(--accent-primary-light)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                  )}
                >
                  <span className="flex-shrink-0">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </span>
                  <span className="text-sm">WhatsApp</span>
                </Link>
              )}

              {/* WebChat — solo si canal provisionado (Fase 2.2b) */}
              {hasWebChat && (
                <Link
                  href="/settings/webchat"
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg',
                    'transition-all duration-200',
                    pathname === '/settings/webchat'
                      ? 'text-[var(--accent-text)] bg-[var(--accent-primary-light)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                  )}
                >
                  <span className="flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.6 9h16.8M3.6 15h16.8M11.5 3a17 17 0 000 18M12.5 3a17 17 0 010 18" />
                    </svg>
                  </span>
                  <span className="text-sm">Web</span>
                </Link>
              )}

              <Link
                href="/settings/team"
                onClick={onClose}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg',
                  'transition-all duration-200',
                  pathname === '/settings/team'
                    ? 'text-[var(--accent-text)] bg-[var(--accent-primary-light)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                )}
              >
                <span className="flex-shrink-0"><TeamSettingsIcon /></span>
                <span className="text-sm">{t('settingsTeam')}</span>
              </Link>
            </div>
          </div>
        </div>}

        {/* Admin section - Only visible for super_admin */}
        {isSuperAdmin && (
          <>
            <div className="my-3 border-t border-[var(--border-primary)]" />
            <Link
              href="/admin"
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg relative',
                'transition-all duration-200',
                isActive('/admin')
                  ? 'bg-[var(--accent-primary-light)] text-[var(--accent-text)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
              )}
            >
              {isActive('/admin') && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[var(--accent-primary)] rounded-r-full" />
              )}
              <span className="flex-shrink-0"><AdminIcon /></span>
              <span className="text-sm font-medium">{t('admin')}</span>
            </Link>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-[var(--border-primary)]">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-[var(--text-tertiary)]">{tDashboard('systemStatus')}</span>
          </div>
          <span className="text-xs text-[var(--text-muted)]">
            v{process.env.NEXT_PUBLIC_APP_VERSION}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/50 z-40 lg:hidden',
          'transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar - Mobile (overlay) */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-[280px]',
          'bg-[var(--bg-secondary)] border-r border-[var(--border-primary)]',
          'transform transition-transform duration-300 ease-in-out',
          'lg:hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Close button for mobile */}
        <button
          onClick={onClose}
          className={cn(
            'absolute top-4 right-4 p-2 rounded-lg',
            'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]',
            'transition-colors duration-200'
          )}
          aria-label={tLogin('ariaLabels.closeMenu')}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        {sidebarContent}
      </aside>

      {/* Sidebar - Desktop (always visible) */}
      <aside
        className={cn(
          'hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0',
          'w-[240px] bg-[var(--bg-secondary)] border-r border-[var(--border-primary)]',
          'z-30'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}

export default Sidebar;
