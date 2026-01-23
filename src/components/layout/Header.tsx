'use client';

import { useState, useRef, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';
import { useTheme } from '@/contexts/ThemeContext';
import { useLoading } from '@/contexts/LoadingContext';
import { cn } from '@/lib/utils';
import { getInitials } from '@/lib/utils';
import { signOut } from '@/lib/actions/auth';
import type { Locale } from '@/types';

// SVG Icons
const MenuIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const SunIcon = () => (
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
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = () => (
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
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const BellIcon = () => (
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
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const LogoutIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const UserIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const GlobeIcon = () => (
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
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const LOCALE_LABELS: Record<Locale, string> = {
  es: 'Espanol',
  en: 'English',
};

const LOCALE_FLAGS: Record<Locale, string> = {
  es: '🇪🇸',
  en: '🇺🇸',
};

// User type for Header
interface HeaderUser {
  firstName: string;
  lastName: string;
  email: string;
  systemRole: string;
}

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
  user?: HeaderUser;
}

export function Header({ title, onMenuClick, user }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { showLoading } = useLoading();
  const locale = useLocale() as Locale;
  const t = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLocaleDropdownOpen, setIsLocaleDropdownOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const localeDropdownRef = useRef<HTMLDivElement>(null);

  // Fallback user data if not provided
  const displayUser = user || {
    firstName: 'Usuario',
    lastName: '',
    email: '',
    systemRole: 'user',
  };

  // Get role display label
  const getRoleLabel = (role: string): string => {
    const roleLabels: Record<string, string> = {
      super_admin: 'Super Admin',
      admin: 'Admin',
      manager: 'Manager',
      agent: 'Agente',
      viewer: 'Viewer',
      user: 'Usuario',
    };
    return roleLabels[role] || role;
  };

  const handleLocaleChange = (newLocale: Locale) => {
    // Use persist=true because language change causes full page reload
    showLoading(t('messages.loading'), true);
    setIsLocaleDropdownOpen(false);
    router.replace(pathname, { locale: newLocale });
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    setIsDropdownOpen(false);
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoggingOut(false);
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (localeDropdownRef.current && !localeDropdownRef.current.contains(event.target as Node)) {
        setIsLocaleDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdowns on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
        setIsLocaleDropdownOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-20',
        'h-16 px-4 lg:px-6',
        'bg-[var(--bg-primary)] border-b border-[var(--border-primary)]',
        'shadow-[var(--shadow-sm)]',
        'flex items-center justify-between gap-4'
      )}
    >
      {/* Left section */}
      <div className="flex items-center gap-4">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className={cn(
            'lg:hidden p-2 -ml-2 rounded-lg',
            'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]',
            'transition-colors duration-200'
          )}
          aria-label="Abrir menu"
        >
          <MenuIcon />
        </button>

        {/* Page title */}
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h1>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* Language selector */}
        <div className="relative" ref={localeDropdownRef}>
          <button
            onClick={() => setIsLocaleDropdownOpen(!isLocaleDropdownOpen)}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1.5 rounded-lg',
              'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]',
              'transition-colors duration-200'
            )}
            aria-label="Cambiar idioma"
            aria-expanded={isLocaleDropdownOpen}
          >
            <GlobeIcon />
            <span className="hidden sm:block text-sm font-medium uppercase">{locale}</span>
            <ChevronDownIcon />
          </button>

          {/* Locale dropdown */}
          {isLocaleDropdownOpen && (
            <div
              className={cn(
                'absolute right-0 mt-2 w-36',
                'bg-[var(--bg-card)] border border-[var(--border-primary)]',
                'rounded-lg shadow-[var(--shadow-lg)]',
                'py-1 z-50',
                'animate-scale-in origin-top-right'
              )}
            >
              {(['es', 'en'] as Locale[]).map((loc) => (
                <button
                  key={loc}
                  onClick={() => handleLocaleChange(loc)}
                  className={cn(
                    'w-full flex items-center gap-2 px-4 py-2',
                    'text-sm',
                    locale === loc
                      ? 'bg-[var(--accent-primary-light)] text-[var(--accent-primary)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]',
                    'transition-colors duration-200'
                  )}
                >
                  <span>{LOCALE_FLAGS[loc]}</span>
                  <span>{LOCALE_LABELS[loc]}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={cn(
            'p-2 rounded-lg',
            'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]',
            'transition-colors duration-200'
          )}
          aria-label={theme === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}
        >
          {theme === 'light' ? <MoonIcon /> : <SunIcon />}
        </button>

        {/* Notifications */}
        <button
          className={cn(
            'p-2 rounded-lg relative',
            'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]',
            'transition-colors duration-200'
          )}
          aria-label="Notificaciones"
        >
          <BellIcon />
          {/* Notification badge */}
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[var(--status-lost)] rounded-full" />
        </button>

        {/* User dropdown */}
        <div className="relative ml-2" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={cn(
              'flex items-center gap-2 p-1.5 pr-2 rounded-lg',
              'hover:bg-[var(--bg-tertiary)]',
              'transition-colors duration-200'
            )}
            aria-expanded={isDropdownOpen}
            aria-haspopup="true"
          >
            {/* Avatar */}
            <div
              className={cn(
                'w-8 h-8 rounded-full',
                'bg-[var(--accent-primary)] text-[var(--kairo-midnight)]',
                'flex items-center justify-center',
                'text-sm font-semibold'
              )}
            >
              {getInitials(displayUser.firstName, displayUser.lastName)}
            </div>

            {/* Name - hidden on mobile */}
            <span className="hidden sm:block text-sm font-medium text-[var(--text-primary)]">
              {displayUser.firstName}
            </span>

            <ChevronDownIcon />
          </button>

          {/* Dropdown menu */}
          {isDropdownOpen && (
            <div
              className={cn(
                'absolute right-0 mt-2 w-56',
                'bg-[var(--bg-card)] border border-[var(--border-primary)]',
                'rounded-lg shadow-[var(--shadow-lg)]',
                'py-1 z-50',
                'animate-scale-in origin-top-right'
              )}
            >
              {/* User info */}
              <div className="px-4 py-3 border-b border-[var(--border-primary)]">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {displayUser.firstName} {displayUser.lastName}
                </p>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{displayUser.email}</p>
                <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-[var(--accent-primary-light)] text-[var(--accent-primary)]">
                  {getRoleLabel(displayUser.systemRole)}
                </span>
              </div>

              {/* Menu items */}
              <div className="py-1">
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    router.push('/profile');
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2',
                    'text-sm text-[var(--text-secondary)]',
                    'hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]',
                    'transition-colors duration-200'
                  )}
                >
                  <UserIcon />
                  <span>{t('profile.myProfile')}</span>
                </button>
              </div>

              {/* Logout */}
              <div className="py-1 border-t border-[var(--border-primary)]">
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2',
                    'text-sm text-[var(--status-lost)]',
                    'hover:bg-red-50 dark:hover:bg-red-900/10',
                    'transition-colors duration-200',
                    isLoggingOut && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <LogoutIcon />
                  <span>{isLoggingOut ? t('buttons.loading') : t('profile.logout')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
