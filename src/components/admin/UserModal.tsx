'use client';

import { useState, useEffect, useMemo } from 'react';
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

// Password validation
interface PasswordValidation {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

function validatePassword(password: string): PasswordValidation {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  };
}

function generateStrongPassword(): string {
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowercase = 'abcdefghjkmnpqrstuvwxyz';
  const numbers = '23456789';
  const special = '!@#$%&*_+-=';
  const all = uppercase + lowercase + numbers + special;

  const getSecureRandom = (max: number) => {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] % max;
  };

  // Ensure at least one of each type
  let chars: string[] = [];
  chars.push(uppercase[getSecureRandom(uppercase.length)]);
  chars.push(lowercase[getSecureRandom(lowercase.length)]);
  chars.push(numbers[getSecureRandom(numbers.length)]);
  chars.push(special[getSecureRandom(special.length)]);

  // Fill remaining 12 characters (total 16)
  for (let i = 0; i < 12; i++) {
    chars.push(all[getSecureRandom(all.length)]);
  }

  // Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = getSecureRandom(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

// SVG icons as inline components to avoid extra dependencies
function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
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
    password: '',
    organizationId: '',
    isOrgOwner: false,
    projectId: '',
    projectRole: ProjectRole.ADMIN,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);

  // Filter projects by selected organization
  const filteredProjects = formData.organizationId
    ? projects.filter(p => p.organizationId === formData.organizationId)
    : [];

  // Password validation
  const passwordValidation = useMemo(
    () => validatePassword(formData.password),
    [formData.password]
  );
  const allPasswordChecksPass = useMemo(
    () => Object.values(passwordValidation).every(Boolean),
    [passwordValidation]
  );

  const passwordChecks = [
    { key: 'minLength' as const, pass: passwordValidation.minLength },
    { key: 'hasUppercase' as const, pass: passwordValidation.hasUppercase },
    { key: 'hasLowercase' as const, pass: passwordValidation.hasLowercase },
    { key: 'hasNumber' as const, pass: passwordValidation.hasNumber },
    { key: 'hasSpecial' as const, pass: passwordValidation.hasSpecial },
  ];

  useEffect(() => {
    if (user) {
      setFormData({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        systemRole: user.systemRole,
        isActive: user.isActive,
        avatarUrl: user.avatarUrl || '',
        password: '',
        organizationId: '',
        isOrgOwner: false,
        projectId: '',
        projectRole: ProjectRole.ADMIN,
      });
    } else {
      setFormData({
        email: '',
        firstName: '',
        lastName: '',
        systemRole: 'user' as SystemRole,
        isActive: true,
        avatarUrl: '',
        password: '',
        organizationId: '',
        isOrgOwner: false,
        projectId: '',
        projectRole: ProjectRole.ADMIN,
      });
    }
    setError('');
    setGeneratedPassword('');
    setCopied(false);
    setShowPassword(false);
    setPasswordCopied(false);
  }, [user, isOpen]);

  const handleGeneratePassword = () => {
    const pwd = generateStrongPassword();
    setFormData(prev => ({ ...prev, password: pwd }));
    setShowPassword(true); // Show so user can see it
  };

  const handleCopyPassword = async () => {
    await navigator.clipboard.writeText(formData.password);
    setPasswordCopied(true);
    setTimeout(() => setPasswordCopied(false), 2000);
  };

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
        // Validate password
        if (!formData.password) {
          setError('Se requiere una contraseña');
          setLoading(false);
          return;
        }
        if (!allPasswordChecksPass) {
          setError('La contraseña no cumple los requisitos mínimos');
          setLoading(false);
          return;
        }

        // Validate membership for regular users
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
          generatePassword: false,
          password: formData.password,
          organizationId: formData.organizationId || undefined,
          isOrgOwner: formData.isOrgOwner,
          projectId: formData.projectId || undefined,
          projectRole: formData.projectId ? formData.projectRole : undefined,
        });

        if (result.error) {
          setError(result.error);
        } else {
          // Show the password confirmation screen
          setGeneratedPassword(formData.password);
        }
      }
    } catch {
      setError('Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const copyGeneratedPassword = async () => {
    await navigator.clipboard.writeText(generatedPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFinish = () => {
    onSuccess();
    onClose();
  };

  // Show generated password screen after successful creation
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
              onClick={copyGeneratedPassword}
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
      <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
            {error}
          </div>
        )}

        {/* Email first */}
        <Input
          label={t('email')}
          type="email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          required
          disabled={isEdit}
          placeholder="user@company.com"
          autoComplete="off"
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t('firstName')}
            value={formData.firstName}
            onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
            required
            placeholder="Juan"
            autoComplete="off"
          />
          <Input
            label={t('lastName')}
            value={formData.lastName}
            onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
            required
            placeholder="Pérez"
            autoComplete="off"
          />
        </div>

        {/* Password (only for create) */}
        {!isEdit && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-[var(--text-primary)]">
                {t('password.label')}
              </label>
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-[var(--kairo-cyan)]/30 text-[var(--kairo-cyan)] hover:bg-[var(--kairo-cyan)]/10 transition-colors cursor-pointer"
              >
                <RefreshIcon className="h-3.5 w-3.5" />
                {t('password.generate')}
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                placeholder="••••••••"
                maxLength={128}
                required
                autoComplete="new-password"
                className="w-full px-3 py-2.5 pr-20 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--kairo-cyan)] focus:border-transparent"
              />
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                {formData.password && (
                  <button
                    type="button"
                    onClick={handleCopyPassword}
                    className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                    title={passwordCopied ? t('password.copied') : t('password.copy')}
                  >
                    {passwordCopied ? (
                      <CheckIcon className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <CopyIcon className="h-4 w-4" />
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
                  title={showPassword ? t('password.hidePassword') : t('password.showPassword')}
                >
                  {showPassword ? (
                    <EyeOffIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Password checklist */}
            {formData.password.length > 0 && (
              <ul className="space-y-0.5 pt-1">
                {passwordChecks.map((check) => (
                  <li
                    key={check.key}
                    className={`flex items-center gap-2 text-xs transition-colors ${
                      check.pass
                        ? 'text-emerald-500 dark:text-emerald-400'
                        : 'text-[var(--text-tertiary)]'
                    }`}
                  >
                    <CheckIcon
                      className={`h-3 w-3 shrink-0 ${
                        check.pass ? 'opacity-100' : 'opacity-30'
                      }`}
                    />
                    {t(`password.${check.key}`)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* System Role */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
            {t('systemRole')}
          </label>
          <select
            value={formData.systemRole}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              systemRole: e.target.value as SystemRole,
              // Reset membership fields when role changes
              organizationId: '',
              isOrgOwner: false,
              projectId: '',
              projectRole: ProjectRole.ADMIN,
            }))}
            className="w-full px-3 py-2.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--kairo-cyan)] focus:border-transparent"
          >
            <option value="user">{tRoles('user')}</option>
            <option value="super_admin">{tRoles('super_admin')}</option>
          </select>
        </div>

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
                <option value="">{t('password.selectOrg')}</option>
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
                    <option value="">{t('password.selectProject')}</option>
                    {filteredProjects.map(project => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </select>
                </div>

                {formData.projectId && formData.systemRole !== 'super_admin' && (
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
          <Button
            type="submit"
            variant="primary"
            isLoading={loading}
            disabled={!isEdit && formData.password.length > 0 && !allPasswordChecksPass}
          >
            {tCommon('save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
