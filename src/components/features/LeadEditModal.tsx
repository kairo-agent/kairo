'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneInput, type E164Number } from '@/components/ui/PhoneInput';
import { Badge } from '@/components/ui/Badge';
import { LeadTemperature, LEAD_TEMPERATURE_CONFIG } from '@/types';
import { updateLead } from '@/lib/actions/leads';
import { validatePhone } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface LeadForEdit {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  temperature: LeadTemperature;
  // For display only (not editable)
  projectName?: string;
  organizationName?: string;
}

interface LeadEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  lead: LeadForEdit | null;
}

// ============================================
// Component
// ============================================

export default function LeadEditModal({
  isOpen,
  onClose,
  onSuccess,
  lead,
}: LeadEditModalProps) {
  const t = useTranslations('leads');
  const tCommon = useTranslations('common.buttons');

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '' as E164Number | undefined,
    position: '',
    temperature: LeadTemperature.COLD,
  });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  // Reset form when modal opens with a lead
  // Only reset when modal opens (isOpen changes to true), not on every re-render
  useEffect(() => {
    if (isOpen && lead) {
      setFormData({
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email || '',
        phone: (lead.phone || undefined) as E164Number | undefined,
        position: lead.position || '',
        temperature: lead.temperature,
      });
      setError('');
      setPhoneError('');
    }
  }, [isOpen]); // Only depend on isOpen to avoid resetting during interaction

  // Clear error when modal closes
  useEffect(() => {
    if (!isOpen) {
      setError('');
      setPhoneError('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;

    // Validate phone if provided
    if (formData.phone && !validatePhone(formData.phone)) {
      setPhoneError(t('editModal.phoneInvalid'));
      return;
    }

    setLoading(true);
    setError('');
    setPhoneError('');

    try {
      const result = await updateLead(lead.id, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email || null,
        phone: formData.phone || null,
        position: formData.position || null,
        temperature: formData.temperature,
      });

      if (result.success) {
        // Show syncing state while waiting for data to propagate
        setLoading(false);
        setSyncing(true);

        // Wait for the parent to refresh data
        await onSuccess();

        // Small delay to ensure UI updates are visible
        await new Promise(resolve => setTimeout(resolve, 150));

        setSyncing(false);
        onClose();
      } else {
        setError(result.error || 'Error al actualizar el lead');
        setLoading(false);
      }
    } catch {
      setError('Error inesperado');
      setLoading(false);
    }
  };

  if (!lead) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('editModal.title')}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
            {error}
          </div>
        )}

        {/* Workspace context (read-only) - Minimal design */}
        {(lead.organizationName || lead.projectName) && (
          <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span>
              {lead.organizationName && lead.projectName
                ? `${lead.organizationName} › ${lead.projectName}`
                : lead.projectName || lead.organizationName}
            </span>
          </div>
        )}

        {/* Name fields */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t('editModal.firstName')}
            value={formData.firstName}
            onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
            required
            placeholder="Juan"
          />
          <Input
            label={t('editModal.lastName')}
            value={formData.lastName}
            onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
            required
            placeholder="Perez"
          />
        </div>

        {/* Contact fields */}
        <Input
          label={t('editModal.email')}
          type="email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          placeholder="juan@empresa.com"
        />

        <PhoneInput
          label={t('editModal.phone')}
          value={formData.phone}
          onChange={(value) => {
            setFormData(prev => ({ ...prev, phone: value }));
            if (phoneError) setPhoneError('');
          }}
          error={phoneError}
          defaultCountry="PE"
          placeholder="999 999 999"
        />

        <Input
          label={t('editModal.position')}
          value={formData.position}
          onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
          placeholder="Gerente Comercial"
        />

        {/* Commercial Potential */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
            {t('editModal.potential')}
          </label>
          <p className="text-xs text-[var(--text-tertiary)] mb-3">
            {t('editModal.potentialHint')}
          </p>
          <div className="flex gap-2">
            {Object.entries(LEAD_TEMPERATURE_CONFIG).map(([temp, config]) => {
              const isSelected = formData.temperature === temp;
              return (
                <button
                  key={temp}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, temperature: temp as LeadTemperature }))}
                  className="flex-1"
                >
                  <Badge
                    variant="custom"
                    customColor={isSelected ? config.color : 'var(--text-tertiary)'}
                    customBgColor={isSelected ? `${config.color}20` : 'var(--bg-tertiary)'}
                    size="md"
                    className={`w-full justify-center cursor-pointer transition-all ${
                      isSelected
                        ? 'ring-2 ring-offset-2 ring-offset-[var(--bg-primary)]'
                        : 'opacity-60 hover:opacity-80'
                    }`}
                  >
                    {config.icon} {t(`potentialShort.${temp}`)}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-primary)]">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading || syncing}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" variant="primary" isLoading={loading || syncing}>
            {syncing ? t('editModal.syncing') : tCommon('save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
