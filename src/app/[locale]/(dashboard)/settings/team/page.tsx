'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Link } from '@/i18n/routing';
import { cn, getInitials } from '@/lib/utils';
import {
  getProjectLeadVisibility,
  updateProjectLeadVisibility,
  getProjectAutoAssignment,
  updateProjectAutoAssignment,
} from '@/lib/actions/team-settings';
import { getProjectTeamMembers } from '@/lib/actions/leads';

type VisibilityMode = 'all_leads' | 'assigned_and_unassigned' | 'only_assigned';

interface MemberAssignment {
  userId: string;
  firstName: string;
  lastName: string;
  role: string;
  enabled: boolean;
  percentage: number;
}

const ROLE_BADGE_COLORS: Record<string, { color: string; bgColor: string }> = {
  admin: { color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.15)' },
  manager: { color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.15)' },
  agent: { color: '#3B82F6', bgColor: 'rgba(59, 130, 246, 0.15)' },
  viewer: { color: '#6B7280', bgColor: 'rgba(107, 114, 128, 0.15)' },
};

export default function TeamSettingsPage() {
  const t = useTranslations('teamSettings');
  const tAdmin = useTranslations('admin');
  const { selectedProject } = useWorkspace();

  // === Tab State ===
  const [activeTab, setActiveTab] = useState<'visibility' | 'autoAssignment'>('visibility');

  // === Visibility State ===
  const [mode, setMode] = useState<VisibilityMode>('all_leads');
  const [initialMode, setInitialMode] = useState<VisibilityMode>('all_leads');
  const [isLoadingVisibility, setIsLoadingVisibility] = useState(true);
  const [isSavingVisibility, setIsSavingVisibility] = useState(false);
  const [visibilityToast, setVisibilityToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // === Auto-Assignment State ===
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [initialAutoEnabled, setInitialAutoEnabled] = useState(false);
  const [members, setMembers] = useState<MemberAssignment[]>([]);
  const [initialMembers, setInitialMembers] = useState<string>('');
  const [isLoadingAuto, setIsLoadingAuto] = useState(true);
  const [isSavingAuto, setIsSavingAuto] = useState(false);
  const [autoToast, setAutoToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load visibility setting
  useEffect(() => {
    if (!selectedProject?.id) {
      setIsLoadingVisibility(false);
      return;
    }
    setIsLoadingVisibility(true);
    getProjectLeadVisibility(selectedProject.id).then((result) => {
      if (result.success && result.mode) {
        setMode(result.mode);
        setInitialMode(result.mode);
      }
      setIsLoadingVisibility(false);
    });
  }, [selectedProject?.id]);

  // Load auto-assignment config + team members
  useEffect(() => {
    if (!selectedProject?.id) {
      setIsLoadingAuto(false);
      return;
    }
    setIsLoadingAuto(true);

    Promise.all([
      getProjectTeamMembers(selectedProject.id),
      getProjectAutoAssignment(selectedProject.id),
    ]).then(([teamResult, configResult]) => {
      if (teamResult.success && teamResult.members) {
        const config = configResult.success ? configResult.config : null;
        const memberList: MemberAssignment[] = teamResult.members.map((m) => {
          const saved = config?.members?.find((cm) => cm.userId === m.id);
          return {
            userId: m.id,
            firstName: m.firstName,
            lastName: m.lastName,
            role: m.role,
            enabled: saved ? saved.percentage > 0 : false,
            percentage: saved?.percentage || 0,
          };
        });
        setMembers(memberList);
        setInitialMembers(JSON.stringify(memberList));
        setAutoEnabled(config?.enabled || false);
        setInitialAutoEnabled(config?.enabled || false);
      }
      setIsLoadingAuto(false);
    });
  }, [selectedProject?.id]);

  // === Visibility handlers ===
  const hasVisibilityChanges = mode !== initialMode;

  const handleSaveVisibility = useCallback(async () => {
    if (!selectedProject?.id || !hasVisibilityChanges) return;
    setIsSavingVisibility(true);
    const result = await updateProjectLeadVisibility(selectedProject.id, mode);
    if (result.success) {
      setInitialMode(mode);
      setVisibilityToast({ type: 'success', message: t('saved') });
    } else {
      setVisibilityToast({ type: 'error', message: t('saveError') });
    }
    setIsSavingVisibility(false);
    setTimeout(() => setVisibilityToast(null), 3000);
  }, [selectedProject?.id, mode, hasVisibilityChanges, t]);

  // === Auto-Assignment handlers ===
  const totalPercentage = members.reduce((sum, m) => sum + (m.enabled ? m.percentage : 0), 0);
  const hasAutoChanges = autoEnabled !== initialAutoEnabled || JSON.stringify(members) !== initialMembers;
  const isValid = !autoEnabled || totalPercentage === 100;

  const handleToggleMember = useCallback((userId: string) => {
    setMembers((prev) =>
      prev.map((m) =>
        m.userId === userId
          ? { ...m, enabled: !m.enabled, percentage: !m.enabled ? m.percentage : 0 }
          : m
      )
    );
  }, []);

  const handlePercentageChange = useCallback((userId: string, value: string) => {
    const num = Math.min(100, Math.max(0, parseInt(value) || 0));
    setMembers((prev) =>
      prev.map((m) => (m.userId === userId ? { ...m, percentage: num } : m))
    );
  }, []);

  const handleEqualForAll = useCallback(() => {
    setMembers((prev) => {
      const enabledCount = prev.filter((m) => m.enabled).length;
      if (enabledCount === 0) return prev;
      const base = Math.floor(100 / enabledCount);
      const remainder = 100 - base * enabledCount;
      let idx = 0;
      return prev.map((m) => {
        if (!m.enabled) return { ...m, percentage: 0 };
        const pct = base + (idx < remainder ? 1 : 0);
        idx++;
        return { ...m, percentage: pct };
      });
    });
  }, []);

  const handleSaveAuto = useCallback(async () => {
    if (!selectedProject?.id || !hasAutoChanges || !isValid) return;
    setIsSavingAuto(true);
    const config = {
      enabled: autoEnabled,
      members: members
        .filter((m) => m.enabled && m.percentage > 0)
        .map((m) => ({ userId: m.userId, percentage: m.percentage })),
    };
    const result = await updateProjectAutoAssignment(selectedProject.id, config);
    if (result.success) {
      setInitialAutoEnabled(autoEnabled);
      setInitialMembers(JSON.stringify(members));
      setAutoToast({ type: 'success', message: t('saved') });
    } else {
      setAutoToast({ type: 'error', message: result.error || t('saveError') });
    }
    setIsSavingAuto(false);
    setTimeout(() => setAutoToast(null), 3000);
  }, [selectedProject?.id, autoEnabled, members, hasAutoChanges, isValid, t]);

  if (!selectedProject) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-[var(--text-secondary)]">{t('noProject')}</p>
        <Link
          href="/select-workspace"
          className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-[var(--kairo-midnight)] font-medium hover:opacity-90 transition-opacity"
        >
          {t('noProjectAction')}
        </Link>
      </div>
    );
  }

  const visibilityOptions: { value: VisibilityMode; labelKey: string; descKey: string }[] = [
    { value: 'all_leads', labelKey: 'visibility.allLeads', descKey: 'visibility.allLeadsDescription' },
    { value: 'assigned_and_unassigned', labelKey: 'visibility.assignedAndUnassigned', descKey: 'visibility.assignedAndUnassignedDescription' },
    { value: 'only_assigned', labelKey: 'visibility.onlyAssigned', descKey: 'visibility.onlyAssignedDescription' },
  ];

  const enabledMembersCount = members.filter((m) => m.enabled).length;

  const tabs = [
    {
      id: 'visibility' as const,
      label: t('visibility.title'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
    },
    {
      id: 'autoAssignment' as const,
      label: t('autoAssignment.title'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('title')}</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{t('subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[var(--border-primary)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-[1px] transition-colors',
              activeTab === tab.id
                ? 'text-[var(--accent-text)] border-[var(--accent-primary)]'
                : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
            )}
          >
            {tab.icon}
            <span className={cn(activeTab === tab.id ? 'inline' : 'hidden sm:inline')}>
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* ========== Tab: Visibility ========== */}
      {activeTab === 'visibility' && (
        <div>
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            {t('visibility.description')}
          </p>

          {isLoadingVisibility ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-lg bg-[var(--bg-tertiary)] animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {visibilityOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMode(option.value)}
                  className={cn(
                    'w-full text-left p-4 rounded-lg border-2 transition-all duration-200',
                    mode === option.value
                      ? 'border-[var(--accent-primary)] bg-[rgba(0,229,255,0.08)]'
                      : 'border-[var(--border-primary)] bg-[var(--bg-secondary)] hover:border-[var(--border-secondary)]'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                        mode === option.value ? 'border-[var(--accent-primary)]' : 'border-[var(--text-tertiary)]'
                      )}
                    >
                      {mode === option.value && (
                        <div className="w-2 h-2 rounded-full bg-[var(--accent-primary)]" />
                      )}
                    </div>
                    <div>
                      <span className={cn(
                        'text-sm font-medium',
                        mode === option.value ? 'text-[var(--accent-text)]' : 'text-[var(--text-primary)]'
                      )}>
                        {t(option.labelKey)}
                      </span>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t(option.descKey)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {mode === 'only_assigned' && (
            <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p className="text-xs text-amber-500">{t('visibility.warning')}</p>
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleSaveVisibility}
              disabled={!hasVisibilityChanges || isSavingVisibility}
              className={cn(
                'px-5 py-2 rounded-lg font-medium text-sm transition-all',
                hasVisibilityChanges
                  ? 'bg-[var(--accent-primary)] text-[var(--kairo-midnight)] hover:opacity-90 cursor-pointer'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] cursor-not-allowed'
              )}
            >
              {isSavingVisibility ? '...' : 'Guardar'}
            </button>
            {visibilityToast && (
              <span className={cn('text-sm font-medium', visibilityToast.type === 'success' ? 'text-green-500' : 'text-red-500')}>
                {visibilityToast.message}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ========== Tab: Auto-Assignment ========== */}
      {activeTab === 'autoAssignment' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-[var(--text-secondary)] flex-1 pr-4">
              {t('autoAssignment.description')}
            </p>
            {/* Toggle */}
            <button
              type="button"
              onClick={() => setAutoEnabled(!autoEnabled)}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0',
                autoEnabled ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-tertiary)]'
              )}
            >
              <div
                className={cn(
                  'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200',
                  autoEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                )}
              />
            </button>
          </div>

          <div className={cn('transition-all duration-300', autoEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none')}>
            {isLoadingAuto ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 rounded-lg bg-[var(--bg-tertiary)] animate-pulse" />
                ))}
              </div>
            ) : members.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)] py-4">{t('autoAssignment.noMembers')}</p>
            ) : (
              <>
                {/* Equal for all button */}
                <button
                  type="button"
                  onClick={handleEqualForAll}
                  disabled={enabledMembersCount === 0}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium mb-4 transition-all',
                    enabledMembersCount > 0
                      ? 'bg-[rgba(0,229,255,0.15)] text-[var(--accent-text)] border border-[var(--accent-primary)] hover:bg-[rgba(0,229,255,0.25)] cursor-pointer'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] border border-transparent cursor-not-allowed'
                  )}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  {t('autoAssignment.equalForAll')}
                </button>

                {/* Members list */}
                <div className="space-y-2">
                  {members.map((member) => {
                    const initials = getInitials(member.firstName, member.lastName);
                    const roleBadge = ROLE_BADGE_COLORS[member.role] || ROLE_BADGE_COLORS.viewer;

                    return (
                      <div
                        key={member.userId}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border transition-all duration-200',
                          member.enabled
                            ? 'border-[var(--border-secondary)] bg-[var(--bg-secondary)]'
                            : 'border-transparent bg-[var(--bg-secondary)] opacity-50'
                        )}
                      >
                        {/* Checkbox */}
                        <button
                          type="button"
                          onClick={() => handleToggleMember(member.userId)}
                          className={cn(
                            'w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors',
                            member.enabled
                              ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)]'
                              : 'border-[var(--text-tertiary)]'
                          )}
                        >
                          {member.enabled && (
                            <svg className="w-3 h-3 text-[var(--kairo-midnight)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>

                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-[var(--text-secondary)]">{initials}</span>
                        </div>

                        {/* Name + Role */}
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-[var(--text-primary)] truncate block">
                            {member.firstName} {member.lastName}
                          </span>
                          <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full inline-block mt-0.5"
                            style={{ color: roleBadge.color, backgroundColor: roleBadge.bgColor }}
                          >
                            {tAdmin(`roles.${member.role}`)}
                          </span>
                        </div>

                        {/* Percentage input */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={member.enabled ? member.percentage : 0}
                            onChange={(e) => handlePercentageChange(member.userId, e.target.value)}
                            disabled={!member.enabled}
                            className={cn(
                              'w-16 px-2 py-1.5 text-sm text-center rounded-lg border transition-colors',
                              'bg-[var(--bg-input)] border-[var(--border-primary)]',
                              'focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent',
                              !member.enabled && 'opacity-40 cursor-not-allowed'
                            )}
                          />
                          <span className="text-xs text-[var(--text-tertiary)]">%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Total bar */}
                <div className={cn(
                  'mt-4 flex items-center justify-between px-3 py-2 rounded-lg',
                  totalPercentage === 100
                    ? 'bg-green-500/10 border border-green-500/20'
                    : totalPercentage > 0
                      ? 'bg-amber-500/10 border border-amber-500/20'
                      : 'bg-[var(--bg-tertiary)]'
                )}>
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {t('autoAssignment.total')}: {totalPercentage}%
                  </span>
                  {totalPercentage !== 100 && totalPercentage > 0 && (
                    <span className="text-xs text-amber-500">{t('autoAssignment.mustSum100')}</span>
                  )}
                  {totalPercentage === 100 && (
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Save button */}
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handleSaveAuto}
              disabled={!hasAutoChanges || !isValid || isSavingAuto}
              className={cn(
                'px-5 py-2 rounded-lg font-medium text-sm transition-all',
                hasAutoChanges && isValid
                  ? 'bg-[var(--accent-primary)] text-[var(--kairo-midnight)] hover:opacity-90 cursor-pointer'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] cursor-not-allowed'
              )}
            >
              {isSavingAuto ? '...' : 'Guardar'}
            </button>
            {autoToast && (
              <span className={cn('text-sm font-medium', autoToast.type === 'success' ? 'text-green-500' : 'text-red-500')}>
                {autoToast.message}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
