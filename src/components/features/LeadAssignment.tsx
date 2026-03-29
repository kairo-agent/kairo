'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useCurrentUser } from '@/app/[locale]/(dashboard)/DashboardLayoutClient';
import { useEffectiveRole } from '@/hooks/useEffectiveRole';
import {
  canTakeUnassignedLead,
  canReassignLead,
  isViewerOnly,
} from '@/lib/permissions';
import { assignLead, getProjectTeamMembers } from '@/lib/actions/leads';
import { getInitials } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface LeadAssignmentProps {
  lead: {
    id: string;
    assignedUserId?: string;
    assignedUser?: { id: string; firstName: string; lastName: string } | null;
    projectId: string;
  };
  onAssignmentChanged?: () => Promise<void>;
}

// ============================================
// Icons
// ============================================

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg className={className || 'w-4 h-4'} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const SpinnerIcon = ({ className }: { className?: string }) => (
  <svg className={`animate-spin ${className || 'w-4 h-4'}`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

// ============================================
// Component
// ============================================

export function LeadAssignment({ lead, onAssignmentChanged }: LeadAssignmentProps) {
  const t = useTranslations('leads.assignment');
  const user = useCurrentUser();
  const effectiveRole = useEffectiveRole();

  const [isLoading, setIsLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<
    { id: string; firstName: string; lastName: string; role: string }[]
  >([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isAssigned = !!lead.assignedUserId;
  const isAssignedToMe = lead.assignedUserId === user.id;
  const canTake = canTakeUnassignedLead(effectiveRole) && !isAssigned;
  const canReassign = canReassignLead(effectiveRole);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  // Lazy load team members when dropdown opens
  const handleOpenDropdown = async () => {
    setIsDropdownOpen(true);
    if (teamMembers.length === 0) {
      setIsLoadingMembers(true);
      try {
        const result = await getProjectTeamMembers(lead.projectId);
        if (result.success && result.members) {
          // Filter out viewers - they can't be assigned leads
          setTeamMembers(result.members.filter((m) => m.role !== 'viewer'));
        }
      } catch {
        toast.error(t('error'));
      } finally {
        setIsLoadingMembers(false);
      }
    }
  };

  const handleAssign = async (targetUserId: string | null) => {
    setIsLoading(true);
    setIsDropdownOpen(false);
    try {
      const result = await assignLead(lead.id, targetUserId);
      if (result.success) {
        if (targetUserId === null) {
          toast.success(t('unassigned_success'));
        } else if (targetUserId === user.id) {
          toast.success(t('selfAssigned'));
        } else {
          toast.success(t('reassigned'));
        }
        if (onAssignmentChanged) await onAssignmentChanged();
      } else {
        toast.error(result.error || t('error'));
      }
    } catch {
      toast.error(t('error'));
    } finally {
      setIsLoading(false);
    }
  };

  // Viewer: show nothing
  if (isViewerOnly(effectiveRole)) return null;

  const assignedName = lead.assignedUser
    ? `${lead.assignedUser.firstName} ${lead.assignedUser.lastName}`
    : null;

  return (
    <div className="flex items-center gap-3 p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-primary)]">
      {/* Avatar / Unassigned indicator */}
      {isAssigned && lead.assignedUser ? (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-xs font-bold text-[var(--kairo-midnight)]">
          {getInitials(lead.assignedUser.firstName, lead.assignedUser.lastName)}
        </div>
      ) : (
        <div className="flex-shrink-0 w-8 h-8 rounded-full border-2 border-dashed border-[var(--text-tertiary)] flex items-center justify-center">
          <svg className="w-4 h-4 text-[var(--text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
      )}

      {/* Name / Status */}
      <div className="flex-1 min-w-0">
        {isAssigned ? (
          <p className="text-sm text-[var(--text-primary)] font-medium truncate">
            {t('assignedTo')} {assignedName}
            {isAssignedToMe && (
              <span className="text-xs text-[var(--text-tertiary)] ml-1">(t&uacute;)</span>
            )}
          </p>
        ) : (
          <p className="text-sm text-[var(--text-tertiary)]">{t('unassigned')}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Take Lead button - only when unassigned and user can take */}
        {canTake && (
          <button
            onClick={() => handleAssign(user.id)}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--accent-primary)] text-[var(--kairo-midnight)] hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isLoading ? <SpinnerIcon className="w-3 h-3" /> : t('takeLead')}
          </button>
        )}

        {/* Reassign dropdown - for managers+ */}
        {canReassign && isAssigned && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={handleOpenDropdown}
              disabled={isLoading}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              {t('reassign')}
              <ChevronDownIcon className="w-3 h-3" />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg shadow-lg overflow-hidden z-30">
                {isLoadingMembers ? (
                  <div className="flex justify-center py-4">
                    <SpinnerIcon className="w-5 h-5 text-[var(--accent-primary)]" />
                  </div>
                ) : (
                  <div className="py-1 max-h-48 overflow-y-auto">
                    {teamMembers
                      .filter((m) => m.id !== lead.assignedUserId)
                      .map((member) => (
                        <button
                          key={member.id}
                          onClick={() => handleAssign(member.id)}
                          className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-[var(--bg-tertiary)] transition-colors"
                        >
                          <div className="w-6 h-6 rounded-full bg-[var(--accent-primary)]/20 flex items-center justify-center text-[10px] font-bold text-[var(--accent-primary)]">
                            {getInitials(member.firstName, member.lastName)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-[var(--text-primary)] truncate block">
                              {member.firstName} {member.lastName}
                            </span>
                            <span className="text-[10px] text-[var(--text-tertiary)] uppercase">
                              {member.role}
                            </span>
                          </div>
                          {member.id === user.id && (
                            <span className="text-[10px] text-[var(--text-tertiary)]">(t&uacute;)</span>
                          )}
                        </button>
                      ))}
                    {/* Unassign option */}
                    <div className="border-t border-[var(--border-primary)]">
                      <button
                        onClick={() => handleAssign(null)}
                        className="w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                      >
                        {t('unassign')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default LeadAssignment;
