'use client';

import { useState, useEffect, useRef } from 'react';
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

// ============================================
// Types
// ============================================

interface Message {
  id: string;
  sender: 'agent' | 'lead';
  content: string;
  timestamp: Date;
}

interface Note {
  id: string;
  content: string;
  author: string;
  createdAt: Date;
}

interface Activity {
  id: string;
  type: 'status_change' | 'note_added' | 'contact' | 'assignment';
  description: string;
  timestamp: Date;
  user?: string;
}

interface LeadDetailPanelProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (lead: Lead, newStatus: LeadStatus) => void;
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

const BriefcaseIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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

const ArchiveIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
  </svg>
);

// ============================================
// Mock Data for Demo
// ============================================

const generateMockMessages = (leadName: string): Message[] => [
  {
    id: '1',
    sender: 'agent',
    content: `Hola ${leadName}! Soy Luna, tu asistente de ventas. Vi que estabas interesado en nuestros servicios. ¿En qué puedo ayudarte?`,
    timestamp: new Date(Date.now() - 3600000 * 24 * 2),
  },
  {
    id: '2',
    sender: 'lead',
    content: 'Hola Luna! Sí, estoy buscando información sobre sus planes empresariales.',
    timestamp: new Date(Date.now() - 3600000 * 24 * 2 + 300000),
  },
  {
    id: '3',
    sender: 'agent',
    content: 'Excelente! Tenemos varios planes que se adaptan a diferentes necesidades. ¿Podrías contarme un poco más sobre tu empresa y qué solución estás buscando?',
    timestamp: new Date(Date.now() - 3600000 * 24 * 2 + 600000),
  },
  {
    id: '4',
    sender: 'lead',
    content: 'Somos una empresa de comercio electrónico con aproximadamente 50 empleados. Necesitamos automatizar nuestro proceso de atención al cliente.',
    timestamp: new Date(Date.now() - 3600000 * 24 + 1800000),
  },
  {
    id: '5',
    sender: 'agent',
    content: 'Perfecto! Para empresas de tu tamaño, nuestro plan Professional sería ideal. Incluye automatización completa, integración con WhatsApp Business API, y soporte 24/7. ¿Te gustaría agendar una demo?',
    timestamp: new Date(Date.now() - 3600000 * 24 + 2100000),
  },
  {
    id: '6',
    sender: 'lead',
    content: 'Sí, me interesa ver la demo. ¿Cuándo podría ser?',
    timestamp: new Date(Date.now() - 3600000 * 2),
  },
];

const generateMockNotes = (): Note[] => [
  {
    id: '1',
    content: 'Cliente muy interesado, responde rápido a los mensajes.',
    author: 'Carlos García',
    createdAt: new Date(Date.now() - 3600000 * 48),
  },
  {
    id: '2',
    content: 'Mencionó que tiene presupuesto aprobado para Q1.',
    author: 'María López',
    createdAt: new Date(Date.now() - 3600000 * 24),
  },
];

const generateMockActivity = (leadName: string): Activity[] => [
  {
    id: '1',
    type: 'status_change',
    description: `Estado cambiado de "Nuevo" a "Contactado"`,
    timestamp: new Date(Date.now() - 3600000 * 48),
    user: 'Luna (IA)',
  },
  {
    id: '2',
    type: 'contact',
    description: `Mensaje enviado a ${leadName} via WhatsApp`,
    timestamp: new Date(Date.now() - 3600000 * 24),
    user: 'Luna (IA)',
  },
  {
    id: '3',
    type: 'status_change',
    description: `Estado cambiado de "Contactado" a "Calificado"`,
    timestamp: new Date(Date.now() - 3600000 * 12),
    user: 'Carlos García',
  },
  {
    id: '4',
    type: 'note_added',
    description: 'Nueva nota agregada',
    timestamp: new Date(Date.now() - 3600000 * 6),
    user: 'María López',
  },
];

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
          'overflow-hidden transition-all duration-300 ease-out',
          isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
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
}: LeadDetailPanelProps) {
  const t = useTranslations('leads');
  const panelRef = useRef<HTMLDivElement>(null);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);

  // Mock data
  const messages = lead ? generateMockMessages(lead.firstName) : [];
  const notes = generateMockNotes();
  const activities = lead ? generateMockActivity(lead.firstName) : [];

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

  // Prevent body scroll when panel is open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
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
                  {lead.businessName && (
                    <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                      {lead.businessName}
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
                  onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                  className="inline-flex items-center gap-1"
                >
                  <Badge
                    variant="custom"
                    customColor={statusConfig.color}
                    customBgColor={statusConfig.bgColor}
                    size="md"
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    {t(`status.${lead.status}`)}
                    <ChevronDownIcon className="w-3 h-3 ml-1" />
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

            {lead.position && (
              <div className="flex items-center gap-3 p-3 bg-[var(--bg-tertiary)] rounded-lg sm:col-span-2">
                <div className="p-2 bg-[var(--bg-card)] rounded-lg text-[var(--text-secondary)]">
                  <BriefcaseIcon />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide">
                    {t('detail.position')}
                  </p>
                  <p className="text-sm text-[var(--text-primary)] font-medium">
                    {lead.position}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Tags */}
          {lead.tags.length > 0 && (
            <div>
              <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide mb-2">
                {t('detail.tags')}
              </p>
              <div className="flex flex-wrap gap-2">
                {lead.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 text-xs bg-[var(--bg-tertiary)] text-[var(--text-secondary)] rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Conversation History */}
          <CollapsibleSection
            title={t('panel.conversationHistory')}
            icon={<ChatIcon />}
            defaultOpen={true}
            badge={messages.length}
          >
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex',
                    message.sender === 'agent' ? 'justify-start' : 'justify-end'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[85%] p-3 rounded-2xl',
                      message.sender === 'agent'
                        ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-bl-sm'
                        : 'bg-[var(--accent-primary)] text-[var(--kairo-midnight)] rounded-br-sm'
                    )}
                  >
                    <p className="text-sm">{message.content}</p>
                    <p
                      className={cn(
                        'text-xs mt-1',
                        message.sender === 'agent'
                          ? 'text-[var(--text-tertiary)]'
                          : 'text-[var(--kairo-midnight)]/70'
                      )}
                    >
                      {formatRelativeTime(message.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* Internal Notes */}
          <CollapsibleSection
            title={t('panel.internalNotes')}
            icon={<NoteIcon />}
            badge={notes.length}
          >
            <div className="space-y-3">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="p-3 bg-[var(--bg-tertiary)] rounded-lg"
                >
                  <p className="text-sm text-[var(--text-primary)]">{note.content}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-[var(--text-tertiary)]">
                    <span className="font-medium">{note.author}</span>
                    <span>•</span>
                    <span>{formatRelativeTime(note.createdAt)}</span>
                  </div>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="w-full">
                <NoteIcon />
                <span>{t('panel.addNote')}</span>
              </Button>
            </div>
          </CollapsibleSection>

          {/* Activity Timeline */}
          <CollapsibleSection
            title={t('panel.activityHistory')}
            icon={<ClockIcon />}
            badge={activities.length}
          >
            <div className="space-y-3">
              {activities.map((activity, index) => (
                <div key={activity.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-[var(--accent-primary)]" />
                    {index < activities.length - 1 && (
                      <div className="w-px flex-1 bg-[var(--border-primary)] mt-1" />
                    )}
                  </div>
                  <div className="flex-1 pb-3">
                    <p className="text-sm text-[var(--text-primary)]">
                      {activity.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-tertiary)]">
                      {activity.user && (
                        <>
                          <span>{activity.user}</span>
                          <span>•</span>
                        </>
                      )}
                      <span>{formatRelativeTime(activity.timestamp)}</span>
                    </div>
                  </div>
                </div>
              ))}
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
            <Button variant="primary" fullWidth>
              <ChannelIcon channel={lead.channel} className="w-4 h-4" />
              <span>{t('detail.contact')}</span>
            </Button>
            <Button variant="secondary" fullWidth>
              <EditIcon />
              <span>{t('detail.edit')}</span>
            </Button>
            <Button
              variant="ghost"
              className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <ArchiveIcon />
              <span className="sm:hidden">{t('actions.archiveLead')}</span>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export default LeadDetailPanel;
