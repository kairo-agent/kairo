'use client';

import { useState, useRef, useEffect, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Modal } from './Modal';

interface ExpandableTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  expandLabel?: string;
  modalTitle?: string;
}

export function ExpandableTextarea({
  value,
  onChange,
  expandLabel = 'Expandir',
  modalTitle,
  className,
  placeholder,
  rows = 6,
  ...rest
}: ExpandableTextareaProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const expandedRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus expanded textarea
  useEffect(() => {
    if (isExpanded && expandedRef.current) {
      const el = expandedRef.current;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [isExpanded]);

  return (
    <>
      {/* Normal textarea with expand button */}
      <div className="relative group">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={cn(
            'w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm resize-none pr-10',
            className
          )}
          {...rest}
        />
        {/* Expand icon button */}
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="absolute bottom-2 right-2 p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
          title={expandLabel}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
          </svg>
        </button>
      </div>

      {/* Fullscreen modal */}
      <Modal
        isOpen={isExpanded}
        onClose={() => setIsExpanded(false)}
        title={modalTitle}
        size="3xl"
        showCloseButton={true}
      >
        <textarea
          ref={expandedRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm resize-none min-h-[60vh] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent"
        />
      </Modal>
    </>
  );
}
