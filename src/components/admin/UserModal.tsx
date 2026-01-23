'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { createUser, updateUser } from '@/lib/actions/admin';
import { SystemRole, ProjectRole } from '@/types';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  systemRole: SystemRole;
  isActive: boolean;
  avatarUrl?: string | null;
}

interface Organization {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
  organizationId: string;
}

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user?: User | null;
  organizations: Organization[];
  projects: Project[];
}

export default function UserModal({
  isOpen,
  onClose,
  onSuccess,
  user,
  organizations,
  projects,
}: UserModalProps) {
  const t = useTranslations('admin.users');
  const tRoles = useTranslations('admin.systemRoles');
  const tProjectRoles = useTranslations('admin.roles');
  const tCommon = useTranslations('common.buttons');

  const isEdit = !!user;

  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    systemRole: 'user' as SystemRole,
    isActive: true,
    avatarUrl: '',
    // Create-only fields
    generatePassword: true,
    password: '',
    organizationId: '',
    isOrgOwner: false,
    projectId: '',
    projectRole: ProjectRole.VIEWER,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [copied, setCopied] = useState(false);

  // Filter projects by selected organization
  const filteredProjects = formData.organizationId
    ? projects.filter(p => p.organizationId === formData.organizationId)
    : [];

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        systemRole: user.systemRole,
        isActive: user.isActive,
        avatarUrl: user.avatarUrl || '',
        generatePassword: true,
        password: '',
        organizationId: '',
        isOrgOwner: false,
        projectId: '',
        projectRole: ProjectRole.VIEWER,
      });
    } else {
      setFormData({
        email: '',
        firstName: '',
        lastName: '',
        systemRole: 'user' as SystemRole,
        isActive: true,
        avatarUrl: '',
        generatePassword: true,
        password: '',
        organizationId: '',
        isOrgOwner: false,
        projectId: '',
        projectRole: ProjectRole.VIEWER,
      });
    }
    setError('');
    setGeneratedPassword('');
    setCopied(false);
  }, [user, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isEdit) {
        const result = await updateUser(user.id, {
          firstName: formData.firstName,
          lastName: formData.lastName,
          systemRole: formData.systemRole,
          isActive: formData.isActive,
          avatarUrl: formData.avatarUrl || undefined,
        });

        if (result.error) {
          setError(result.error);
        } else {
          onSuccess();
          onClose();
        }
      } else {
        // Validar membresía para usuarios normales
        if (formData.systemRole !== 'super_admin') {
          if (!formData.organizationId) {
            setError('Los usuarios deben pertenecer a una organización');
            setLoading(false);
            return;
          }
          if (!formData.projectId) {
            setError('Los usuarios deben pertenecer a al menos un proyecto');
            setLoading(false);
            return;
          }
        }

        const result = await createUser({
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          systemRole: formData.systemRole,
          generatePassword: formData.generatePassword,
          password: formData.generatePassword ? undefined : formData.password,
          organizationId: formData.organizationId || undefined,
          isOrgOwner: formData.isOrgOwner,
          projectId: formData.projectId || undefined,
          projectRole: formData.projectId ? formData.projectRole : undefined,
        });

        if (result.error) {
          setError(result.error);
        } else if (result.generatedPassword) {
          setGeneratedPassword(result.generatedPassword);
        } else {
          onSuccess();
          onClose();
        }
      }
    } catch {
      setError('Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const copyPassword = async () => {
    await navigator.clipboard.writeText(generatedPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFinish = () => {
    onSuccess();
    onClose();
  };

  // Show generated password screen
  if (generatedPassword) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={handleFinish}
        title={t('password.generated')}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Usuario creado exitosamente. Guarda esta contraseña, no se mostrará nuevamente.
          </p>

          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-mono text-sm">
              {generatedPassword}
            </code>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={copyPassword}
            >
              {copied ? t('password.copied') : t('password.copy')}
            </Button>
          </div>

          <div className="flex justify-end pt-4 border-t border-[var(--border-primary)]">
            <Button type="button" variant="primary" onClick={handleFinish}>
              {tCommon('close')}
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

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

        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t('firstName')}
            value={formData.firstName}
            onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
            required
            placeholder="Juan"
          />
          <Input
            label={t('lastName')}
            value={formData.lastName}
            onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
            required
            placeholder="Pérez"
          />
        </div>

        <Input
          label={t('email')}
          type="email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          required
          disabled={isEdit}
          placeholder="juan@example.com"
        />

        {/* System Role */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
            {t('systemRole')}
          </label>
          <select
            value={formData.systemRole}
            onChange={(e) => setFormData(prev => ({ ...prev, systemRole: e.target.value as SystemRole }))}
            className="w-full px-3 py-2.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--kairo-cyan)] focus:border-transparent"
          >
            <option value="user">{tRoles('user')}</option>
            <option value="super_admin">{tRoles('super_admin')}</option>
          </select>
        </div>

        {/* Password (only for create) */}
        {!isEdit && (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={formData.generatePassword}
                  onChange={() => setFormData(prev => ({ ...prev, generatePassword: true, password: '' }))}
                  className="text-[var(--kairo-cyan)]"
                />
                <span className="text-sm text-[var(--text-primary)]">{t('password.generate')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={!formData.generatePassword}
                  onChange={() => setFormData(prev => ({ ...prev, generatePassword: false }))}
                  className="text-[var(--kairo-cyan)]"
                />
                <span className="text-sm text-[var(--text-primary)]">{t('password.manual')}</span>
              </label>
            </div>

            {!formData.generatePassword && (
              <Input
                label={t('password.label')}
                type="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                required
                placeholder="••••••••"
                minLength={6}
              />
            )}
          </div>
        )}

        {/* Organization membership (only for create) */}
        {!isEdit && (
          <div className="space-y-3 pt-4 border-t border-[var(--border-primary)]">
            <h4 className="text-sm font-medium text-[var(--text-primary)]">
              {formData.systemRole === 'super_admin'
                ? 'Membresía inicial (opcional)'
                : 'Membresía inicial (requerida)'}
            </h4>

            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                {t('organizations')}
              </label>
              <select
                value={formData.organizationId}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  organizationId: e.target.value,
                  projectId: '', // Reset project when org changes
                }))}
                className="w-full px-3 py-2.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--kairo-cyan)] focus:border-transparent"
              >
                {formData.systemRole === 'super_admin' && (
                  <option value="">Sin organización</option>
                )}
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>

            {formData.organizationId && (
              <>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isOrgOwner"
                    checked={formData.isOrgOwner}
                    onChange={(e) => setFormData(prev => ({ ...prev, isOrgOwner: e.target.checked }))}
                    className="w-4 h-4 rounded border-[var(--border-primary)] text-[var(--kairo-cyan)] focus:ring-[var(--kairo-cyan)]"
                  />
                  <label htmlFor="isOrgOwner" className="text-sm text-[var(--text-primary)]">
                    Es Owner de la organización
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                    {t('projects')}
                  </label>
                  <select
                    value={formData.projectId}
                    onChange={(e) => setFormData(prev => ({ ...prev, projectId: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--kairo-cyan)] focus:border-transparent"
                  >
                    {formData.systemRole === 'super_admin' && (
                      <option value="">Sin proyecto</option>
                    )}
                    {filteredProjects.map(project => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </select>
                </div>

                {formData.projectId && (
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
                      Rol en proyecto
                    </label>
                    <select
                      value={formData.projectRole}
                      onChange={(e) => setFormData(prev => ({ ...prev, projectRole: e.target.value as ProjectRole }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--kairo-cyan)] focus:border-transparent"
                    >
                      <option value="admin">{tProjectRoles('admin')}</option>
                      <option value="manager">{tProjectRoles('manager')}</option>
                      <option value="agent">{tProjectRoles('agent')}</option>
                      <option value="viewer">{tProjectRoles('viewer')}</option>
                    </select>
                  </div>
                )}
              </>
            )}
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
