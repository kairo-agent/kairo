'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Lead,
  LeadStatus,
  LeadTemperature,
  LEAD_STATUS_CONFIG,
  LEAD_TEMPERATURE_CONFIG,
} from '@/types';
import { cn, formatRelativeTime, getInitials } from '@/lib/utils';
import { ChannelIcon, CHANNEL_ICON_COLORS } from '@/components/icons/ChannelIcons';
import {
  getLeadNotes,
  addLeadNote,
  getLeadActivities,
  getLeadPanelData,
  type NoteWithAuthor,
  type ActivityWithPerformer,
} from '@/lib/actions/leads';
import LeadEditModal from './LeadEditModal';
import LeadChat from './LeadChat';

// ============================================
// Types
// ============================================

interface LeadDetailPanelProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (lead: Lead, newStatus: LeadStatus) => void;
  isUpdatingStatus?: boolean;
  onLeadUpdated?: () => Promise<void>;
  projectName?: string;
  organizationName?: string;
}

// ============================================
// Icons
// ============================================

const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-4 h-4', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const EmailIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const PhoneIconSmall = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
);

const ChatIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

const NoteIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const EditIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const SpinnerIcon = ({ className }: { className?: string }) => (
  <svg
    className={cn('animate-spin', className)}
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

// ============================================
// Collapsible Section Component
// ============================================

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: number;
}

function CollapsibleSection({
  title,
  icon,
  children,
  defaultOpen = false,
  badge,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-[var(--border-primary)] rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] transition-colors"
      >
        <div className="flex items-center gap-2 text-[var(--text-primary)] font-medium">
          <span className="text-[var(--text-secondary)]">{icon}</span>
          <span>{title}</span>
          {badge !== undefined && badge > 0 && (
            <Badge variant="custom" customColor="#0B1220" customBgColor="#00E5FF" size="sm">
              {badge}
            </Badge>
          )}
        </div>
        <ChevronDownIcon
          className={cn(
            'text-[var(--text-tertiary)] transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>
      <div
        className={cn(
          'transition-all duration-300 ease-out',
          isOpen ? 'opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
        )}
      >
        <div className="p-3 border-t border-[var(--border-primary)]">{children}</div>
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function LeadDetailPanel({
  lead,
  isOpen,
  onClose,
  onStatusChange,
  isUpdatingStatus = false,
  onLeadUpdated,
  projectName,
  organizationName,
}: LeadDetailPanelProps) {
  const t = useTranslations('leads');
  const panelRef = useRef<HTMLDivElement>(null);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);

  // Real data states
  const [notes, setNotes] = useState<NoteWithAuthor[]>([]);
  const [activities, setActivities] = useState<ActivityWithPerformer[]>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);

  // Add note form state
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // PERFORMANCE (P2-2): Single consolidated call instead of 2 separate server actions
  const loadNotesAndActivities = useCallback(async () => {
    if (!lead?.id) return;

    setIsLoadingNotes(true);
    setIsLoadingActivities(true);

    try {
      const panelData = await getLeadPanelData(lead.id);
      if (panelData) {
        setNotes(panelData.notes);
        setActivities(panelData.activities);
      }
    } catch (error) {
      console.error('Error loading panel data:', error);
    } finally {
      setIsLoadingNotes(false);
      setIsLoadingActivities(false);
    }
  }, [lead?.id]);

  useEffect(() => {
    if (isOpen && lead?.id) {
      loadNotesAndActivities();
    }
  }, [isOpen, lead?.id, loadNotesAndActivities]);

  // Handle add note
  const handleAddNote = async () => {
    if (!lead?.id || !newNoteContent.trim() || isAddingNote) return;

    setIsAddingNote(true);
    try {
      const result = await addLeadNote(lead.id, newNoteContent);
      if (result.success && result.note) {
        setNotes((prev) => [result.note!, ...prev]);
        setNewNoteContent('');
        // Refresh activities to show the new "note_added" activity
        const activitiesData = await getLeadActivities(lead.id);
        setActivities(activitiesData);
      } else {
        console.error('Error adding note:', result.error);
      }
    } catch (error) {
      console.error('Error adding note:', error);
    } finally {
      setIsAddingNote(false);
    }
  };

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when panel is open (block window scroll completely)
  useEffect(() => {
    if (isOpen) {
      // Block scroll on both html and body for cross-browser support
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!lead) return null;

  const statusConfig = LEAD_STATUS_CONFIG[lead.status];
  const temperatureConfig = LEAD_TEMPERATURE_CONFIG[lead.temperature];
  const channelColor = CHANNEL_ICON_COLORS[lead.channel];
  const isHot = lead.temperature === LeadTemperature.HOT;

  const getAvatarColor = () => {
    switch (lead.temperature) {
      case LeadTemperature.HOT:
        return 'bg-gradient-to-br from-red-500 to-orange-500';
      case LeadTemperature.WARM:
        return 'bg-gradient-to-br from-amber-400 to-yellow-500';
      case LeadTemperature.COLD:
      default:
        return 'bg-gradient-to-br from-blue-400 to-cyan-500';
    }
  };

  const handleStatusChange = (newStatus: LeadStatus) => {
    setIsStatusDropdownOpen(false);
    onStatusChange?.(lead, newStatus);
    // Refresh activities after status change
    setTimeout(() => {
      if (lead?.id) {
        getLeadActivities(lead.id).then(setActivities);
      }
    }, 500);
  };

  const getActivityTypeIcon = (type: string) => {
    switch (type) {
      case 'status_change':
        return '🔄';
      case 'note_added':
        return '📝';
      case 'contact':
        return '💬';
      default:
        return '•';
    }
  };

  return (
    <>
      {/* Backdrop with blur */}
      <div
        className={cn(
          'fixed inset-0 bg-black/40 z-40 transition-all duration-300',
          'backdrop-blur-sm',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          'fixed top-0 right-0 h-full bg-[var(--bg-primary)] shadow-2xl z-50',
          'w-full md:w-1/2 lg:w-[45%] xl:w-[40%]',
          'transform transition-transform duration-300 ease-out',
          'flex flex-col',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex-shrink-0 border-b border-[var(--border-primary)]">
          {/* Hot Lead Indicator */}
          {isHot && (
            <div className="h-1 bg-gradient-to-r from-red-500 to-orange-500" />
          )}

          <div className="p-4 lg:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div
                  className={cn(
                    'flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg',
                    getAvatarColor(),
                    isHot && 'ring-2 ring-red-400/50 ring-offset-2 ring-offset-[var(--bg-primary)]'
                  )}
                >
                  {getInitials(lead.firstName, lead.lastName)}
                </div>

                {/* Name and Company */}
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">
                    {lead.firstName} {lead.lastName}
                  </h2>
                  {(organizationName || projectName) && (
                    <p className="text-sm text-[var(--text-secondary)] mt-0.5 flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      {organizationName && projectName
                        ? `${organizationName} › ${projectName}`
                        : projectName || organizationName}
                    </p>
                  )}
                  {lead.position && (
                    <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                      {lead.position}
                    </p>
                  )}
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <CloseIcon />
              </button>
            </div>

            {/* Status and Temperature Badges */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {/* Status with Dropdown */}
              <div className="relative">
                <button
                  onClick={() => !isUpdatingStatus && setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                  className="inline-flex items-center gap-1"
                  disabled={isUpdatingStatus}
                >
                  <Badge
                    variant="custom"
                    customColor={statusConfig.color}
                    customBgColor={statusConfig.bgColor}
                    size="md"
                    className={cn(
                      'cursor-pointer hover:opacity-80 transition-opacity',
                      isUpdatingStatus && 'opacity-70 cursor-wait'
                    )}
                  >
                    {isUpdatingStatus ? (
                      <SpinnerIcon className="w-3 h-3 mr-1" />
                    ) : null}
                    {t(`status.${lead.status}`)}
                    {!isUpdatingStatus && <ChevronDownIcon className="w-3 h-3 ml-1" />}
                  </Badge>
                </button>

                {isStatusDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-40 bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg shadow-lg overflow-hidden z-20">
                    <div className="py-1">
                      {Object.entries(LEAD_STATUS_CONFIG).map(([status, config]) => (
                        <button
                          key={status}
                          onClick={() => handleStatusChange(status as LeadStatus)}
                          className={cn(
                            'w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-[var(--bg-tertiary)] transition-colors',
                            lead.status === status && 'bg-[var(--bg-tertiary)]'
                          )}
                        >
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: config.color }}
                          />
                          <span className="text-[var(--text-primary)]">
                            {t(`status.${status}`)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Temperature */}
              <Badge
                variant="custom"
                customColor={temperatureConfig.color}
                customBgColor={`${temperatureConfig.color}20`}
                size="md"
              >
                {temperatureConfig.icon} {t(`potential.${lead.temperature}`)}
              </Badge>

              {/* Channel */}
              <Badge variant="default" size="md">
                <span style={{ color: channelColor }} className="mr-1">
                  <ChannelIcon channel={lead.channel} className="w-3.5 h-3.5" />
                </span>
                {t(`channel.${lead.channel}`)}
              </Badge>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
          {/* Contact Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {lead.email && (
              <div className="flex items-center gap-3 p-3 bg-[var(--bg-tertiary)] rounded-lg">
                <div className="p-2 bg-[var(--bg-card)] rounded-lg text-[var(--text-secondary)]">
                  <EmailIcon />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide">
                    {t('detail.email')}
                  </p>
                  <p className="text-sm text-[var(--text-primary)] font-medium truncate">
                    {lead.email}
                  </p>
                </div>
              </div>
            )}

            {lead.phone && (
              <div className="flex items-center gap-3 p-3 bg-[var(--bg-tertiary)] rounded-lg">
                <div className="p-2 bg-[var(--bg-card)] rounded-lg text-[var(--text-secondary)]">
                  <PhoneIconSmall />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide">
                    {t('detail.phone')}
                  </p>
                  <p className="text-sm text-[var(--text-primary)] font-medium">
                    {lead.phone}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Conversation History with Chat */}
          <CollapsibleSection
            title={t('panel.conversationHistory')}
            icon={<ChatIcon />}
            defaultOpen={true}
          >
            {/* Fixed height container for chat - prevents infinite growth */}
            <div className="h-[700px]">
              <LeadChat
                leadId={lead.id}
                leadName={`${lead.firstName} ${lead.lastName}`}
                isOpen={isOpen}
              />
            </div>
          </CollapsibleSection>

          {/* Internal Notes */}
          <CollapsibleSection
            title={t('panel.internalNotes')}
            icon={<NoteIcon />}
            badge={notes.length}
          >
            <div className="space-y-3">
              {isLoadingNotes ? (
                <div className="flex justify-center py-4">
                  <SpinnerIcon className="w-6 h-6 text-[var(--accent-primary)]" />
                </div>
              ) : notes.length === 0 ? (
                <p className="text-sm text-[var(--text-tertiary)] text-center py-2">
                  {t('panel.noNotes')}
                </p>
              ) : (
                notes.map((note) => (
                  <div
                    key={note.id}
                    className="p-3 bg-[var(--bg-tertiary)] rounded-lg"
                  >
                    <p className="text-sm text-[var(--text-primary)]">{note.content}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-[var(--text-tertiary)]">
                      <span className="font-medium">
                        {note.author ? `${note.author.firstName} ${note.author.lastName}` : 'Usuario'}
                      </span>
                      <span>•</span>
                      <span>{formatRelativeTime(note.createdAt)}</span>
                    </div>
                  </div>
                ))
              )}

              {/* Add Note Form */}
              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder={t('panel.addNotePlaceholder')}
                  className="flex-1 px-3 py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddNote();
                    }
                  }}
                  disabled={isAddingNote}
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleAddNote}
                  disabled={!newNoteContent.trim() || isAddingNote}
                  className="px-3"
                >
                  {isAddingNote ? (
                    <SpinnerIcon className="w-4 h-4" />
                  ) : (
                    <PlusIcon />
                  )}
                </Button>
              </div>
            </div>
          </CollapsibleSection>

          {/* Activity Timeline */}
          <CollapsibleSection
            title={t('panel.activityHistory')}
            icon={<ClockIcon />}
            badge={activities.length}
          >
            <div className="space-y-3">
              {isLoadingActivities ? (
                <div className="flex justify-center py-4">
                  <SpinnerIcon className="w-6 h-6 text-[var(--accent-primary)]" />
                </div>
              ) : activities.length === 0 ? (
                <p className="text-sm text-[var(--text-tertiary)] text-center py-2">
                  {t('panel.noActivity')}
                </p>
              ) : (
                activities.map((activity, index) => (
                  <div key={activity.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-6 h-6 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-xs">
                        {getActivityTypeIcon(activity.type)}
                      </div>
                      {index < activities.length - 1 && (
                        <div className="w-px flex-1 bg-[var(--border-primary)] mt-1" />
                      )}
                    </div>
                    <div className="flex-1 pb-3">
                      <p className="text-sm text-[var(--text-primary)]">
                        {activity.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-tertiary)]">
                        {activity.performer && (
                          <>
                            <span>{activity.performer.firstName} {activity.performer.lastName}</span>
                            <span>•</span>
                          </>
                        )}
                        <span>{formatRelativeTime(activity.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CollapsibleSection>

          {/* Dates Info */}
          <div className="pt-2 border-t border-[var(--border-primary)] text-xs text-[var(--text-tertiary)] space-y-1">
            {lead.lastContactAt && (
              <p>
                {t('detail.lastContact')}: {formatRelativeTime(lead.lastContactAt)}
              </p>
            )}
            {lead.nextFollowUpAt && (
              <p>
                {t('detail.nextFollowUp')}:{' '}
                {new Date(lead.nextFollowUpAt).toLocaleDateString('es-PE', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
            <p>
              {t('detail.createdAt')}:{' '}
              {new Date(lead.createdAt).toLocaleDateString('es-PE', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex-shrink-0 border-t border-[var(--border-primary)] p-4 lg:p-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="primary" fullWidth disabled>
              <PhoneIconSmall />
              <span>{t('detail.call')}</span>
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setIsEditModalOpen(true)}>
              <EditIcon />
              <span>{t('detail.edit')}</span>
            </Button>
            {/* TODO: Habilitar cuando se implemente archivado de leads
            <Button
              variant="ghost"
              className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <ArchiveIcon />
              <span className="sm:hidden">{t('actions.archiveLead')}</span>
            </Button>
            */}
          </div>
        </div>
      </div>

      {/* Edit Lead Modal */}
      <LeadEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={async () => {
          // Refresh activities to show the update
          if (lead?.id) {
            const activitiesData = await getLeadActivities(lead.id);
            setActivities(activitiesData);
          }
          // Wait for parent to refresh leads data
          if (onLeadUpdated) {
            await onLeadUpdated();
          }
        }}
        lead={lead ? {
          id: lead.id,
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email ?? null,
          phone: lead.phone ?? null,
          position: lead.position ?? null,
          temperature: lead.temperature,
          projectName,
          organizationName,
        } : null}
      />
    </>
  );
}

export default LeadDetailPanel;
