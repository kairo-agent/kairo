'use client';

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = 'text',
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      size = 'md',
      disabled,
      id,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2.5 text-sm',
      lg: 'px-4 py-3 text-base',
    };

    const inputStyles = cn(
      `
      w-full rounded-lg
      bg-[var(--bg-input)] text-[var(--text-primary)]
      border border-[var(--border-primary)]
      placeholder:text-[var(--text-tertiary)]
      transition-all duration-200
      focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent
      disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-[var(--bg-tertiary)]
    `,
      sizes[size],
      leftIcon && 'pl-10',
      rightIcon && 'pr-10',
      error && 'border-[var(--status-lost)] focus:ring-[var(--status-lost)]',
      className
    );

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[var(--text-primary)] mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            type={type}
            className={inputStyles}
            disabled={disabled}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
              {rightIcon}
            </div>
          )}
        </div>
        {(error || helperText) && (
          <p
            className={cn(
              'mt-1.5 text-xs',
              error ? 'text-[var(--status-lost)]' : 'text-[var(--text-tertiary)]'
            )}
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
