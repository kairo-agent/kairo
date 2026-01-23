'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { createProject, updateProject } from '@/lib/actions/admin';

const PLANS = [
  { value: 'free', label: 'Free' },
  { value: 'starter', label: 'Starter' },
  { value: 'professional', label: 'Professional' },
  { value: 'enterprise', label: 'Enterprise' },
];

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  logoUrl?: string | null;
  isActive: boolean;
  plan: string;
  organizationId: string;
}

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  project?: Project | null;
  organizations: Organization[];
  defaultOrganizationId?: string;
}

export default function ProjectModal({
  isOpen,
  onClose,
  onSuccess,
  project,
  organizations,
  defaultOrganizationId,
}: ProjectModalProps) {
  const t = useTranslations('admin.projects');
  const tPlans = useTranslations('admin.plans');
  const tCommon = useTranslations('common.buttons');

  const isEdit = !!project;

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    logoUrl: '',
    organizationId: '',
    plan: 'free' as 'free' | 'starter' | 'professional' | 'enterprise',
    isActive: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name,
        slug: project.slug,
        description: project.description || '',
        logoUrl: project.logoUrl || '',
        organizationId: project.organizationId,
        plan: project.plan as 'free' | 'starter' | 'professional' | 'enterprise',
        isActive: project.isActive,
      });
    } else {
      setFormData({
        name: '',
        slug: '',
        description: '',
        logoUrl: '',
        organizationId: defaultOrganizationId || (organizations[0]?.id || ''),
        plan: 'free',
        isActive: true,
      });
    }
    setError('');
  }, [project, isOpen, defaultOrganizationId, organizations]);

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

    if (!formData.organizationId) {
      setError(t('selectOrg'));
      setLoading(false);
      return;
    }

    try {
      const result = isEdit
        ? await updateProject(project.id, {
            name: formData.name,
            slug: formData.slug,
            description: formData.description,
            logoUrl: formData.logoUrl,
            plan: formData.plan,
            isActive: formData.isActive,
          })
        : await createProject({
            organizationId: formData.organizationId,
            name: formData.name,
            slug: formData.slug,
            description: formData.description,
            logoUrl: formData.logoUrl,
          });

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

        {/* Organization (only for create) */}
        {!isEdit && (
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
              {t('organization')} *
            </label>
            <select
              value={formData.organizationId}
              onChange={(e) => setFormData(prev => ({ ...prev, organizationId: e.target.value }))}
              required
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--kairo-cyan)] focus:border-transparent"
            >
              <option value="">{t('selectOrg')}</option>
              {organizations.map(org => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          </div>
        )}

        <Input
          label={t('name')}
          value={formData.name}
          onChange={(e) => handleNameChange(e.target.value)}
          required
          placeholder="Mi Proyecto"
        />

        <Input
          label={t('slug')}
          value={formData.slug}
          onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
          required
          placeholder="mi-proyecto"
          helperText="Identificador único (URL-friendly)"
        />

        <Input
          label={t('description')}
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Descripción del proyecto..."
        />

        <Input
          label="Logo URL"
          value={formData.logoUrl}
          onChange={(e) => setFormData(prev => ({ ...prev, logoUrl: e.target.value }))}
          placeholder="https://example.com/logo.png"
        />

        {/* Plan (only for edit) */}
        {isEdit && (
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
              {t('plan')}
            </label>
            <select
              value={formData.plan}
              onChange={(e) => setFormData(prev => ({ ...prev, plan: e.target.value as typeof formData.plan }))}
              className="w-full px-3 py-2.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--kairo-cyan)] focus:border-transparent"
            >
              {PLANS.map(plan => (
                <option key={plan.value} value={plan.value}>{tPlans(plan.value)}</option>
              ))}
            </select>
          </div>
        )}

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
