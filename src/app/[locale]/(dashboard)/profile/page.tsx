'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getProfile, updateProfile, changePassword } from '@/lib/actions/profile';
import { cn } from '@/lib/utils';

// Timezones (same as OrganizationModal)
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

// Icons
const UserIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const LockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const BuildingIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
    <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
    <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
    <path d="M10 6h4" />
    <path d="M10 10h4" />
    <path d="M10 14h4" />
    <path d="M10 18h4" />
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

const CopyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

// Password validation helpers
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
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };
}

function getPasswordStrength(validation: PasswordValidation): 'weak' | 'fair' | 'good' | 'strong' {
  const passed = Object.values(validation).filter(Boolean).length;
  if (passed <= 2) return 'weak';
  if (passed === 3) return 'fair';
  if (passed === 4) return 'good';
  return 'strong';
}

function generateStrongPassword(): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';
  const all = uppercase + lowercase + numbers + special;

  let password = '';
  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill remaining 8 characters (total 12)
  for (let i = 0; i < 8; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

interface Profile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  systemRole: string;
  timezone: string | null;
  locale: string | null;
  organizationMemberships: Array<{
    isOwner: boolean;
    organization: {
      id: string;
      name: string;
      slug: string;
      logoUrl: string | null;
    };
  }>;
  projectMemberships: Array<{
    role: string;
    project: {
      id: string;
      name: string;
      slug: string;
      logoUrl: string | null;
      organization: {
        id: string;
        name: string;
      };
    };
  }>;
}

type TabType = 'profile' | 'password' | 'memberships';

export default function ProfilePage() {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common');
  const tRoles = useTranslations('admin.roles');

  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Profile form
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    avatarUrl: '',
    timezone: '',
    locale: '',
  });

  // Password form
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);

  // Password validation state
  const passwordValidation = validatePassword(passwordData.newPassword);
  const passwordStrength = getPasswordStrength(passwordValidation);
  const passwordsMatch = passwordData.newPassword === passwordData.confirmPassword && passwordData.confirmPassword.length > 0;

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    const result = await getProfile();

    if (result.error) {
      setError(result.error);
    } else if (result.profile) {
      setProfile(result.profile as Profile);
      setFormData({
        firstName: result.profile.firstName,
        lastName: result.profile.lastName,
        avatarUrl: result.profile.avatarUrl || '',
        timezone: result.profile.timezone || '',
        locale: result.profile.locale || '',
      });
    }
    setLoading(false);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    const result = await updateProfile({
      firstName: formData.firstName,
      lastName: formData.lastName,
      avatarUrl: formData.avatarUrl || undefined,
      timezone: formData.timezone || undefined,
      locale: formData.locale || undefined,
    });

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(t('messages.profileUpdated'));
      loadProfile();
    }
    setSaving(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError(t('messages.passwordMismatch'));
      setSaving(false);
      return;
    }

    // Check all password requirements
    const allRequirementsMet = Object.values(passwordValidation).every(Boolean);
    if (!allRequirementsMet) {
      setError(t('messages.passwordTooShort'));
      setSaving(false);
      return;
    }

    const result = await changePassword(passwordData.currentPassword, passwordData.newPassword);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(t('messages.passwordChanged'));
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    }
    setSaving(false);
  };

  const handleGeneratePassword = () => {
    const newPassword = generateStrongPassword();
    setPasswordData(prev => ({
      ...prev,
      newPassword,
      confirmPassword: newPassword,
    }));
    setShowNewPassword(true);
    setShowConfirmPassword(true);
  };

  const handleCopyPassword = async () => {
    await navigator.clipboard.writeText(passwordData.newPassword);
    setPasswordCopied(true);
    setTimeout(() => setPasswordCopied(false), 2000);
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: tRoles('admin'),
      manager: tRoles('manager'),
      agent: tRoles('agent'),
      viewer: tRoles('viewer'),
    };
    return labels[role] || role;
  };

  const tabs = [
    { id: 'profile' as const, label: t('tabs.profile'), icon: UserIcon },
    { id: 'password' as const, label: t('tabs.password'), icon: LockIcon },
    { id: 'memberships' as const, label: t('tabs.memberships'), icon: BuildingIcon },
  ];

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[var(--bg-tertiary)] rounded w-48" />
          <div className="h-64 bg-[var(--bg-tertiary)] rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('title')}</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">{t('subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[var(--bg-secondary)] rounded-lg w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
          >
            <tab.icon />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 text-sm flex items-center gap-2">
          <CheckIcon />
          {success}
        </div>
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <Card className="p-6">
          <form onSubmit={handleSaveProfile} className="space-y-6">
            {/* Avatar & Basic Info */}
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0">
                <div className="w-20 h-20 rounded-full bg-[var(--kairo-cyan)] text-[var(--kairo-midnight)] flex items-center justify-center text-2xl font-bold">
                  {formData.firstName?.[0]?.toUpperCase()}{formData.lastName?.[0]?.toUpperCase()}
                </div>
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                  {profile?.firstName} {profile?.lastName}
                </h3>
                <p className="text-sm text-[var(--text-secondary)]">{profile?.email}</p>
                <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full bg-[var(--kairo-cyan)]/10 text-[var(--kairo-cyan)]">
                  {profile?.systemRole === 'super_admin' ? 'Super Admin' : 'Usuario'}
                </span>
              </div>
            </div>

            <hr className="border-[var(--border-primary)]" />

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label={t('fields.firstName')}
                value={formData.firstName}
                onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                required
              />
              <Input
                label={t('fields.lastName')}
                value={formData.lastName}
                onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                required
              />
            </div>

            <Input
              label={t('fields.avatarUrl')}
              value={formData.avatarUrl}
              onChange={(e) => setFormData(prev => ({ ...prev, avatarUrl: e.target.value }))}
              placeholder="https://example.com/avatar.png"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                  {t('fields.timezone')}
                </label>
                <select
                  value={formData.timezone}
                  onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--kairo-cyan)] focus:border-transparent"
                >
                  <option value="">{t('fields.useOrgDefault')}</option>
                  {TIMEZONES.map(tz => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                  {t('fields.locale')}
                </label>
                <select
                  value={formData.locale}
                  onChange={(e) => setFormData(prev => ({ ...prev, locale: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--kairo-cyan)] focus:border-transparent"
                >
                  <option value="">{t('fields.useOrgDefault')}</option>
                  {LOCALES.map(loc => (
                    <option key={loc.value} value={loc.value}>{loc.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" variant="primary" isLoading={saving}>
                {tCommon('buttons.save')}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Password Tab */}
      {activeTab === 'password' && (
        <Card className="p-6">
          <form onSubmit={handleChangePassword} className="space-y-6 max-w-lg">
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">{t('changePassword.title')}</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">{t('changePassword.subtitle')}</p>
            </div>

            {/* Current Password */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                {t('changePassword.current')}
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                  required
                  className="w-full px-3 py-2.5 pr-12 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--kairo-cyan)] focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  {showCurrentPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-[var(--text-primary)]">
                  {t('changePassword.new')}
                </label>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="flex items-center gap-1.5 text-xs font-medium text-[var(--kairo-cyan)] hover:text-[var(--kairo-cyan)]/80 transition-colors"
                >
                  <RefreshIcon />
                  {t('changePassword.generate')}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                  required
                  className="w-full px-3 py-2.5 pr-20 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--kairo-cyan)] focus:border-transparent"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {passwordData.newPassword && (
                    <button
                      type="button"
                      onClick={handleCopyPassword}
                      className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors p-1"
                      title={passwordCopied ? t('changePassword.copied') : 'Copy'}
                    >
                      {passwordCopied ? <CheckIcon /> : <CopyIcon />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors p-1"
                  >
                    {showNewPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              {/* Password Strength Bar */}
              {passwordData.newPassword && (
                <div className="mt-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-[var(--text-secondary)]">{t('changePassword.strength.label')}:</span>
                    <span className={cn(
                      'text-xs font-medium',
                      passwordStrength === 'weak' && 'text-red-500',
                      passwordStrength === 'fair' && 'text-orange-500',
                      passwordStrength === 'good' && 'text-yellow-500',
                      passwordStrength === 'strong' && 'text-green-500'
                    )}>
                      {t(`changePassword.strength.${passwordStrength}`)}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={cn(
                          'h-1.5 flex-1 rounded-full transition-colors',
                          level === 1 && passwordStrength !== 'weak' ? 'bg-red-500' :
                          level === 1 ? 'bg-red-500' :
                          level === 2 && (passwordStrength === 'fair' || passwordStrength === 'good' || passwordStrength === 'strong') ? 'bg-orange-500' :
                          level === 3 && (passwordStrength === 'good' || passwordStrength === 'strong') ? 'bg-yellow-500' :
                          level === 4 && passwordStrength === 'strong' ? 'bg-green-500' :
                          'bg-[var(--bg-tertiary)]'
                        )}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Password Requirements */}
            <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
              <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">
                {t('changePassword.requirements.title')}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { key: 'minLength', valid: passwordValidation.minLength },
                  { key: 'uppercase', valid: passwordValidation.hasUppercase },
                  { key: 'lowercase', valid: passwordValidation.hasLowercase },
                  { key: 'number', valid: passwordValidation.hasNumber },
                  { key: 'special', valid: passwordValidation.hasSpecial },
                ].map(({ key, valid }) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className={cn(
                      'flex-shrink-0',
                      valid ? 'text-green-500' : 'text-[var(--text-tertiary)]'
                    )}>
                      {valid ? <CheckIcon /> : <XIcon />}
                    </span>
                    <span className={cn(
                      'text-xs',
                      valid ? 'text-green-500' : 'text-[var(--text-secondary)]'
                    )}>
                      {t(`changePassword.requirements.${key}`)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                {t('changePassword.confirm')}
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  required
                  className={cn(
                    'w-full px-3 py-2.5 pr-12 rounded-lg border bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm font-mono focus:outline-none focus:ring-2 focus:border-transparent',
                    passwordData.confirmPassword && !passwordsMatch
                      ? 'border-red-500 focus:ring-red-500'
                      : passwordsMatch
                        ? 'border-green-500 focus:ring-green-500'
                        : 'border-[var(--border-primary)] focus:ring-[var(--kairo-cyan)]'
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              {passwordData.confirmPassword && (
                <p className={cn(
                  'mt-1.5 text-xs flex items-center gap-1',
                  passwordsMatch ? 'text-green-500' : 'text-red-500'
                )}>
                  {passwordsMatch ? <CheckIcon /> : <XIcon />}
                  {passwordsMatch ? t('messages.passwordMatch') : t('messages.passwordMismatch')}
                </p>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                variant="primary"
                isLoading={saving}
                disabled={!Object.values(passwordValidation).every(Boolean) || !passwordsMatch || !passwordData.currentPassword}
              >
                {t('changePassword.button')}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Memberships Tab */}
      {activeTab === 'memberships' && (
        <div className="space-y-6">
          {/* Organizations */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">{t('memberships.organizations')}</h3>
            {profile?.organizationMemberships.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">{t('memberships.noOrganizations')}</p>
            ) : (
              <div className="space-y-3">
                {profile?.organizationMemberships.map((membership) => (
                  <div
                    key={membership.organization.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <BuildingIcon />
                      </div>
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">{membership.organization.name}</p>
                        <p className="text-xs text-[var(--text-secondary)]">/{membership.organization.slug}</p>
                      </div>
                    </div>
                    {membership.isOwner && (
                      <span className="px-2 py-1 rounded text-xs font-medium bg-purple-500/10 text-purple-500">
                        Owner
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Projects */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">{t('memberships.projects')}</h3>
            {profile?.projectMemberships.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">{t('memberships.noProjects')}</p>
            ) : (
              <div className="space-y-3">
                {profile?.projectMemberships.map((membership) => (
                  <div
                    key={membership.project.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">{membership.project.name}</p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {membership.project.organization.name} / {membership.project.slug}
                        </p>
                      </div>
                    </div>
                    <span className={cn(
                      'px-2 py-1 rounded text-xs font-medium',
                      membership.role === 'admin' && 'bg-red-500/10 text-red-500',
                      membership.role === 'manager' && 'bg-orange-500/10 text-orange-500',
                      membership.role === 'agent' && 'bg-blue-500/10 text-blue-500',
                      membership.role === 'viewer' && 'bg-gray-500/10 text-gray-500'
                    )}>
                      {getRoleLabel(membership.role)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
