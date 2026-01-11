'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

// Navigation item type - href must match pathnames defined in i18n/routing.ts
type AppPathname = '/' | '/dashboard' | '/leads' | '/conversations' | '/agents' | '/reports' | '/settings';

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

// Navigation items configuration (labelKey maps to navigation.* in translations)
const navigationItems: NavItem[] = [
  { labelKey: 'dashboard', href: '/dashboard', icon: <HomeIcon /> },
  { labelKey: 'leads', href: '/leads', icon: <UsersIcon /> },
  { labelKey: 'conversations', href: '/conversations', icon: <MessageIcon />, disabled: true, hasBadge: true },
  { labelKey: 'agents', href: '/agents', icon: <BotIcon />, disabled: true, hasBadge: true },
  { labelKey: 'reports', href: '/reports', icon: <ChartIcon />, disabled: true, hasBadge: true },
  { labelKey: 'settings', href: '/settings', icon: <SettingsIcon />, disabled: true, hasBadge: true },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { theme } = useTheme();
  const t = useTranslations('navigation');
  const tDashboard = useTranslations('dashboard');
  const tLogin = useTranslations('login');
  const [isMounted, setIsMounted] = useState(false);

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
        <Link href="/leads" className="flex items-center" onClick={onClose}>
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

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navigationItems.map((item) => {
          const active = isActive(item.href);

          if (item.disabled) {
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
                  ? 'bg-[var(--accent-primary-light)] text-[var(--accent-primary)]'
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
