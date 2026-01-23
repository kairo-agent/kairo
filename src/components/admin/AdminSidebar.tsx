'use client';

import { useTranslations } from 'next-intl';
import { useTheme } from '@/contexts/ThemeContext';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

// Icons as SVG components
const OverviewIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);

const BackIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

export default function AdminSidebar({ isOpen, onClose }: AdminSidebarProps) {
  const { theme } = useTheme();
  const t = useTranslations('admin');

  const logoSrc = theme === 'dark' ? '/images/logo-main.png' : '/images/logo-oscuro.png';

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-[240px]',
          'bg-[var(--bg-secondary)] border-r border-[var(--border-primary)]',
          'transform transition-transform duration-300 ease-in-out',
          'lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-center border-b border-[var(--border-primary)]">
          <Link href="/admin" className="flex items-center gap-2">
            <Image
              src={logoSrc}
              alt="KAIRO"
              width={120}
              height={32}
              className="h-8 w-auto"
            />
            <span className="text-xs font-medium text-[var(--kairo-cyan)] bg-[var(--kairo-cyan)]/10 px-2 py-0.5 rounded">
              ADMIN
            </span>
          </Link>
        </div>

        {/* Navigation - Solo Overview */}
        <nav className="p-4 space-y-1">
          <Link
            href="/admin"
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors bg-[var(--kairo-cyan)]/10 text-[var(--kairo-cyan)]"
          >
            <OverviewIcon />
            {t('nav.overview')}
          </Link>
        </nav>

        {/* Back to dashboard */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[var(--border-primary)]">
          <Link
            href="/leads"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <BackIcon />
            {t('nav.backToDashboard')}
          </Link>
        </div>
      </aside>
    </>
  );
}
