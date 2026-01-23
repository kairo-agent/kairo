'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { createOrganization, updateOrganization } from '@/lib/actions/admin';

// Common timezones for Latin America and USA
const TIMEZONES = [
  { value: 'America/Lima', label: 'Lima (UTC-5)' },
  { value: 'America/Bogota', label: 'Bogotá (UTC-5)' },
  { value: 'America/Mexico_City', label: 'Ciudad de México (UTC-6)' },
  { value: 'America/Santiago', label: 'Santiago (UTC-3/-4)' },
  { value: 'America/Buenos_Aires', label: 'Buenos Aires (UTC-3)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (UTC-3)' },
  { value: 'America/New_York', label: 'New York (UTC-5/-4)' },
  { value: 'America/Chicago', label: 'Chicago (UTC-6/-5)' },
  { value: 'America/Denver', label: 'Denver (UTC-7/-6)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (UTC-8/-7)' },
  { value: 'Europe/Madrid', label: 'Madrid (UTC+1/+2)' },
  { value: 'UTC', label: 'UTC' },
];

const LOCALES = [
  { value: 'es-PE', label: 'Español (Perú)' },
  { value: 'es-MX', label: 'Español (México)' },
  { value: 'es-CO', label: 'Español (Colombia)' },
  { value: 'es-AR', label: 'Español (Argentina)' },
  { value: 'es-CL', label: 'Español (Chile)' },
  { value: 'es-ES', label: 'Español (España)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
];

interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  logoUrl?: string | null;
  isActive: boolean;
  defaultTimezone?: string;
  defaultLocale?: string;
}

interface OrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  organization?: Organization | null;
}

export default function OrganizationModal({
  isOpen,
  onClose,
  onSuccess,
  organization,
}: OrganizationModalProps) {
  const t = useTranslations('admin.organizations');
  const tCommon = useTranslations('common.buttons');

  const isEdit = !!organization;

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    logoUrl: '',
    defaultTimezone: 'America/Lima',
    defaultLocale: 'es-PE',
    isActive: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name,
        slug: organization.slug,
        description: organization.description || '',
        logoUrl: organization.logoUrl || '',
        defaultTimezone: organization.defaultTimezone || 'America/Lima',
        defaultLocale: organization.defaultLocale || 'es-PE',
        isActive: organization.isActive,
      });
    } else {
      setFormData({
        name: '',
        slug: '',
        description: '',
        logoUrl: '',
        defaultTimezone: 'America/Lima',
        defaultLocale: 'es-PE',
        isActive: true,
      });
    }
    setError('');
  }, [organization, isOpen]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[áàäâ]/g, 'a')
      .replace(/[éèëê]/g, 'e')
      .replace(/[íìïî]/g, 'i')
      .replace(/[óòöô]/g, 'o')
      .replace(/[úùüû]/g, 'u')
      .replace(/ñ/g, 'n')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleNameChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      name: value,
      slug: isEdit ? prev.slug : generateSlug(value),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = isEdit
        ? await updateOrganization(organization.id, formData)
        : await createOrganization(formData);

      if (result.error) {
        setError(result.error);
      } else {
        onSuccess();
        onClose();
      }
    } catch {
      setError('Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? t('edit') : t('new')}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
            {error}
          </div>
        )}

        <Input
          label={t('name')}
          value={formData.name}
          onChange={(e) => handleNameChange(e.target.value)}
          required
          placeholder="Mi Organización"
        />

        <Input
          label={t('slug')}
          value={formData.slug}
          onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
          required
          placeholder="mi-organizacion"
          helperText="Identificador único (URL-friendly)"
        />

        <Input
          label={t('description')}
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Descripción de la organización..."
        />

        <Input
          label={t('logo')}
          value={formData.logoUrl}
          onChange={(e) => setFormData(prev => ({ ...prev, logoUrl: e.target.value }))}
          placeholder="https://example.com/logo.png"
        />

        {/* Timezone */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
            Timezone
          </label>
          <select
            value={formData.defaultTimezone}
            onChange={(e) => setFormData(prev => ({ ...prev, defaultTimezone: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--kairo-cyan)] focus:border-transparent"
          >
            {TIMEZONES.map(tz => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </div>

        {/* Locale */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
            Locale
          </label>
          <select
            value={formData.defaultLocale}
            onChange={(e) => setFormData(prev => ({ ...prev, defaultLocale: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--kairo-cyan)] focus:border-transparent"
          >
            {LOCALES.map(loc => (
              <option key={loc.value} value={loc.value}>{loc.label}</option>
            ))}
          </select>
        </div>

        {/* Active status (only for edit) */}
        {isEdit && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
              className="w-4 h-4 rounded border-[var(--border-primary)] text-[var(--kairo-cyan)] focus:ring-[var(--kairo-cyan)]"
            />
            <label htmlFor="isActive" className="text-sm text-[var(--text-primary)]">
              {t('active')}
            </label>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-primary)]">
          <Button type="button" variant="ghost" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" variant="primary" isLoading={loading}>
            {tCommon('save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
