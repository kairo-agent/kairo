'use client';

import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export function Card({
  children,
  className,
  variant = 'default',
  padding = 'md',
  hover = false,
  onClick,
}: CardProps) {
  const baseStyles = 'rounded-xl transition-all duration-200';

  const variants = {
    default: 'bg-[var(--bg-card)] border border-[var(--border-primary)]',
    elevated: 'bg-[var(--bg-card)] shadow-[var(--shadow-md)]',
    outlined: 'bg-transparent border-2 border-[var(--border-primary)]',
  };

  const paddings = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  const hoverStyles = hover
    ? 'cursor-pointer hover:border-[var(--accent-primary)] hover:shadow-[var(--shadow-lg)]'
    : '';

  return (
    <div
      className={cn(baseStyles, variants[variant], paddings[padding], hoverStyles, className)}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
}

// Card Header
interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between mb-4', className)}>
      {children}
    </div>
  );
}

// Card Title
interface CardTitleProps {
  children: ReactNode;
  className?: string;
}

export function CardTitle({ children, className }: CardTitleProps) {
  return (
    <h3 className={cn('text-lg font-semibold text-[var(--text-primary)]', className)}>
      {children}
    </h3>
  );
}

// Card Content
interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
  return <div className={cn('', className)}>{children}</div>;
}

// Card Footer
interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 mt-4 pt-4 border-t border-[var(--border-primary)]',
        className
      )}
    >
      {children}
    </div>
  );
}
