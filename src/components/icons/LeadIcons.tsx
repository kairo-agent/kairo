'use client';

import { LeadTemperature, LeadType } from '@/types';

// ============================================
// TEMPERATURE ICONS
// ============================================

export const SnowflakeIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="2" y1="12" x2="22" y2="12"/>
    <line x1="12" y1="2" x2="12" y2="22"/>
    <line x1="20" y1="16" x2="4" y2="8"/>
    <line x1="20" y1="8" x2="4" y2="16"/>
    <line x1="4" y1="2" x2="8" y2="6"/>
    <line x1="16" y1="18" x2="20" y2="22"/>
    <line x1="4" y1="22" x2="8" y2="18"/>
    <line x1="16" y1="6" x2="20" y2="2"/>
  </svg>
);

export const SunIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);

export const FlameIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/>
  </svg>
);

// Temperature Icon component
interface TemperatureIconProps {
  temperature: LeadTemperature;
  className?: string;
}

export function TemperatureIcon({ temperature, className = 'w-4 h-4' }: TemperatureIconProps) {
  const iconProps = { className };

  switch (temperature) {
    case LeadTemperature.COLD:
      return <SnowflakeIcon {...iconProps} />;
    case LeadTemperature.WARM:
      return <SunIcon {...iconProps} />;
    case LeadTemperature.HOT:
      return <FlameIcon {...iconProps} />;
    default:
      return <SunIcon {...iconProps} />;
  }
}

// ============================================
// LEAD TYPE ICONS
// ============================================

export const BotIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8V4H8"/>
    <rect x="4" y="8" width="16" height="12" rx="2"/>
    <path d="M2 14h2"/>
    <path d="M20 14h2"/>
    <path d="M15 13v2"/>
    <path d="M9 13v2"/>
  </svg>
);

export const HandIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 11V6a2 2 0 00-4 0v5"/>
    <path d="M14 10V4a2 2 0 00-4 0v6"/>
    <path d="M10 10.5V6a2 2 0 00-4 0v8"/>
    <path d="M18 8a2 2 0 014 0v6a8 8 0 01-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 012.83-2.82L7 15"/>
  </svg>
);

// Lead Type Icon component
interface LeadTypeIconProps {
  type: LeadType;
  className?: string;
}

export function LeadTypeIcon({ type, className = 'w-4 h-4' }: LeadTypeIconProps) {
  const iconProps = { className };

  switch (type) {
    case LeadType.AI_AGENT:
      return <BotIcon {...iconProps} />;
    case LeadType.MANUAL:
      return <HandIcon {...iconProps} />;
    default:
      return <BotIcon {...iconProps} />;
  }
}

// ============================================
// ACTIVITY ICONS
// ============================================

export const RefreshIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2v6h-6"/>
    <path d="M3 12a9 9 0 0115-6.7L21 8"/>
    <path d="M3 22v-6h6"/>
    <path d="M21 12a9 9 0 01-15 6.7L3 16"/>
  </svg>
);

export const NoteIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);

export const MessageIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
  </svg>
);

// Activity Icon component
interface ActivityIconProps {
  type: string;
  className?: string;
}

export function ActivityIcon({ type, className = 'w-3.5 h-3.5' }: ActivityIconProps) {
  const iconProps = { className };

  switch (type) {
    case 'status_change':
      return <RefreshIcon {...iconProps} />;
    case 'note_added':
      return <NoteIcon {...iconProps} />;
    case 'contact':
      return <MessageIcon {...iconProps} />;
    default:
      return <span className="text-xs">*</span>;
  }
}

// ============================================
// AGENT ICONS (for ProjectSettingsModal)
// ============================================

export const BriefcaseIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
    <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
  </svg>
);

export const HeadphonesIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 18v-6a9 9 0 0118 0v6"/>
    <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z"/>
  </svg>
);

export const BarChartIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="20" x2="12" y2="10"/>
    <line x1="18" y1="20" x2="18" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="16"/>
  </svg>
);

export const CalendarIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);

export const TargetIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <circle cx="12" cy="12" r="6"/>
    <circle cx="12" cy="12" r="2"/>
  </svg>
);

export const StarIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

export const RocketIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z"/>
    <path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z"/>
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
  </svg>
);

export const UserIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

// Agent icon name to component mapping
export const AGENT_ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  bot: BotIcon,
  briefcase: BriefcaseIcon,
  headphones: HeadphonesIcon,
  'bar-chart': BarChartIcon,
  calendar: CalendarIcon,
  message: MessageIcon,
  target: TargetIcon,
  star: StarIcon,
  rocket: RocketIcon,
  user: UserIcon,
};

// Agent icon names array (for picker UI)
export const AGENT_ICON_NAMES = Object.keys(AGENT_ICON_MAP);

// Default agent icon
export const DEFAULT_AGENT_ICON = 'bot';

// Render an agent icon by name (with emoji fallback for old DB entries)
interface AgentIconProps {
  name: string;
  className?: string;
}

export function AgentIcon({ name, className = 'w-5 h-5' }: AgentIconProps) {
  const IconComponent = AGENT_ICON_MAP[name];
  if (IconComponent) {
    return <IconComponent className={className} />;
  }
  // Fallback: if name is an old emoji string, show bot icon
  return <BotIcon className={className} />;
}

// Agent type to icon name mapping (replaces agentTypeConfig icons)
export const AGENT_TYPE_ICON_MAP: Record<string, string> = {
  sales: 'briefcase',
  support: 'headphones',
  qualification: 'bar-chart',
  appointment: 'calendar',
};
