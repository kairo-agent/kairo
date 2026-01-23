'use client';

// ============================================
// KAIRO - Pagination Component
// Hybrid compact design with page input
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { PAGE_SIZE_OPTIONS, type PageSize } from '@/types';

// Icons
const ChevronLeftIcon = () => (
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
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ChevronRightIcon = () => (
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
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg
    width="14"
    height="14"
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

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: PageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
  isLoading?: boolean;
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  isLoading = false,
}: PaginationProps) {
  const t = useTranslations('pagination');
  const [pageInput, setPageInput] = useState(currentPage.toString());
  const [isPageSizeOpen, setIsPageSizeOpen] = useState(false);

  // Sync page input with current page
  useEffect(() => {
    setPageInput(currentPage.toString());
  }, [currentPage]);

  // Calculate range display
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Handle page input change
  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numbers
    if (value === '' || /^\d+$/.test(value)) {
      setPageInput(value);
    }
  };

  // Handle page input submit
  const handlePageInputSubmit = useCallback(() => {
    const page = parseInt(pageInput, 10);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      onPageChange(page);
    } else {
      // Reset to current page if invalid
      setPageInput(currentPage.toString());
    }
  }, [pageInput, totalPages, onPageChange, currentPage]);

  // Handle key press on page input
  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handlePageInputSubmit();
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setPageInput(currentPage.toString());
      (e.target as HTMLInputElement).blur();
    }
  };

  // Handle page size change
  const handlePageSizeSelect = (size: PageSize) => {
    onPageSizeChange(size);
    setIsPageSizeOpen(false);
  };

  // No pagination needed for single page or no items
  if (totalPages <= 1 && totalItems <= pageSize) {
    return (
      <div className="flex items-center justify-between py-3 px-4 text-sm text-[var(--text-secondary)]">
        <span>
          {totalItems > 0
            ? `${t('showing')} ${totalItems} ${t('items')}`
            : t('noItems')}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-center justify-between gap-3 py-3 px-4',
        'border-t border-[var(--border-primary)]',
        'bg-[var(--bg-secondary)]',
        isLoading && 'opacity-60 pointer-events-none'
      )}
    >
      {/* Left: Navigation controls */}
      <div className="flex items-center gap-2">
        {/* Previous button */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || isLoading}
          className={cn(
            'p-2 rounded-lg transition-colors duration-200',
            currentPage <= 1
              ? 'text-[var(--text-tertiary)] cursor-not-allowed'
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
          )}
          aria-label={t('prev')}
        >
          <ChevronLeftIcon />
        </button>

        {/* Next button */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages || isLoading}
          className={cn(
            'p-2 rounded-lg transition-colors duration-200',
            currentPage >= totalPages
              ? 'text-[var(--text-tertiary)] cursor-not-allowed'
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
          )}
          aria-label={t('next')}
        >
          <ChevronRightIcon />
        </button>

        {/* Page input */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[var(--text-secondary)]">{t('page')}</span>
          <input
            type="text"
            value={pageInput}
            onChange={handlePageInputChange}
            onBlur={handlePageInputSubmit}
            onKeyDown={handlePageInputKeyDown}
            disabled={isLoading}
            className={cn(
              'w-12 px-2 py-1 text-center rounded-md',
              'bg-[var(--bg-primary)] border border-[var(--border-primary)]',
              'text-[var(--text-primary)] text-sm',
              'focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]',
              'transition-colors duration-200'
            )}
            aria-label={t('pageInput')}
          />
          <span className="text-[var(--text-secondary)]">
            {t('of')} {totalPages}
          </span>
        </div>
      </div>

      {/* Center: Range display */}
      <div className="text-sm text-[var(--text-tertiary)] hidden md:block">
        {t('showing')} {startItem.toLocaleString()}-{endItem.toLocaleString()} {t('of')}{' '}
        {totalItems.toLocaleString()} {t('items')}
      </div>

      {/* Right: Page size selector */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsPageSizeOpen(!isPageSizeOpen)}
          disabled={isLoading}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg',
            'bg-[var(--bg-primary)] border border-[var(--border-primary)]',
            'text-sm text-[var(--text-secondary)]',
            'hover:border-[var(--accent-primary)] transition-colors duration-200',
            isPageSizeOpen && 'border-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)]'
          )}
        >
          <span>{pageSize}</span>
          <span className="text-[var(--text-tertiary)]">{t('perPage')}</span>
          <ChevronDownIcon />
        </button>

        {/* Dropdown */}
        {isPageSizeOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsPageSizeOpen(false)}
            />
            {/* Menu */}
            <div
              className={cn(
                'absolute right-0 bottom-full mb-1 z-50',
                'bg-[var(--bg-card)] border border-[var(--border-primary)]',
                'rounded-lg shadow-lg py-1 min-w-[100px]',
                'animate-scale-in origin-bottom-right'
              )}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => handlePageSizeSelect(size)}
                  className={cn(
                    'w-full px-4 py-2 text-sm text-left transition-colors duration-150',
                    size === pageSize
                      ? 'bg-[var(--accent-primary-light)] text-[var(--accent-primary)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                  )}
                >
                  {size}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Pagination;
