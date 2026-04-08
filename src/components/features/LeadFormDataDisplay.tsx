'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { getLeadFormData } from '@/lib/actions/lead-form-data';
import type { FormConfig, FormField } from '@/lib/types/form-template';

interface LeadFormDataDisplayProps {
  leadId: string;
  agentId: string;
  formConfig: FormConfig;
}

export function LeadFormDataDisplay({ leadId, agentId, formConfig }: LeadFormDataDisplayProps) {
  const t = useTranslations('leads');
  const [data, setData] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!leadId || !agentId) return;
    setIsLoading(true);
    getLeadFormData(leadId, agentId).then((result) => {
      setData(result);
      setIsLoading(false);
    });
  }, [leadId, agentId]);

  if (!formConfig?.isActive || !formConfig.fields?.length) return null;

  const fields = [...formConfig.fields].sort((a, b) => a.order - b.order);
  const filledCount = fields.filter(f => data[f.key]?.trim()).length;
  const totalCount = fields.length;

  return (
    <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-primary)]">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-[var(--accent-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">
          {t('panel.formData')}
        </h4>
        <span className={cn(
          'ml-auto text-xs font-medium px-2 py-0.5 rounded-full',
          filledCount === totalCount
            ? 'bg-green-500/15 text-green-500'
            : 'bg-amber-500/15 text-amber-500'
        )}>
          {filledCount}/{totalCount}
        </span>
      </div>

      {/* Fields */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-8 rounded bg-[var(--bg-secondary)] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {fields.map((field) => {
            const value = data[field.key]?.trim();
            return (
              <div key={field.key} className="flex items-baseline gap-2">
                <span className={cn(
                  'text-xs min-w-[100px] flex-shrink-0',
                  value ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-tertiary)] opacity-50'
                )}>
                  {field.label}
                  {field.required && <span className="text-red-400 ml-0.5">*</span>}
                </span>
                {value ? (
                  <span className="text-sm text-[var(--text-primary)] font-medium">{value}</span>
                ) : (
                  <span className="text-xs text-[var(--text-tertiary)] italic opacity-50">
                    {t('panel.formPending')}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
