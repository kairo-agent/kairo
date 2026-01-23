'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'custom';
  size?: 'sm' | 'md';
  customColor?: string;
  customBgColor?: string;
  className?: string;
}

export function Badge({
  children,
  variant = 'default',
  size = 'sm',
  customColor,
  customBgColor,
  className,
}: BadgeProps) {
  const baseStyles = 'inline-flex items-center font-medium rounded-full';

  const variants = {
    default: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    error: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700',
    custom: '',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };

  const customStyles =
    variant === 'custom' && customColor && customBgColor
      ? { color: customColor, backgroundColor: customBgColor }
      : {};

  return (
    <span
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      style={customStyles}
    >
      {children}
    </span>
  );
}
