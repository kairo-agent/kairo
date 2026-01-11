// ============================================
// KAIRO - Type Definitions
// ============================================

// UI Base Types (needed early for UserPreferences)
export type Theme = 'light' | 'dark';
export type ViewMode = 'grid' | 'table';

// Localization Types
export type Locale = 'es' | 'en';
export type CurrencyCode = 'PEN' | 'USD' | 'EUR' | 'MXN';

export interface UserPreferences {
  language: Locale;
  displayCurrency: CurrencyCode;
  timezone: string;
  theme: Theme;
}

export const CURRENCY_CONFIG: Record<CurrencyCode, { symbol: string; name: string; locale: string }> = {
  PEN: { symbol: 'S/', name: 'Sol Peruano', locale: 'es-PE' },
  USD: { symbol: '$', name: 'US Dollar', locale: 'en-US' },
  EUR: { symbol: '€', name: 'Euro', locale: 'es-ES' },
  MXN: { symbol: '$', name: 'Peso Mexicano', locale: 'es-MX' },
};

export const SUPPORTED_LOCALES: Locale[] = ['es', 'en'];
export const DEFAULT_LOCALE: Locale = 'es';

// User Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  role: UserRole;
  companyId: string;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  AGENT = 'agent',
  VIEWER = 'viewer'
}

// Company Types
export interface Company {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  plan: CompanyPlan;
  // Currency settings
  defaultCurrency: CurrencyCode;
  supportedCurrencies: CurrencyCode[];
  exchangeRates?: Record<string, number>; // e.g., { 'USD_PEN': 3.72 }
  createdAt: Date;
  updatedAt: Date;
}

export enum CompanyPlan {
  FREE = 'free',
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise'
}

// Lead Types
export interface Lead {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  businessName?: string;
  position?: string;
  status: LeadStatus;
  temperature: LeadTemperature;
  source: LeadSource;
  channel: LeadChannel;
  type: LeadType; // ai_agent or manual
  assignedAgentId?: string;
  assignedUserId?: string;
  pipelineStage: string;
  estimatedValue?: number;
  currency: CurrencyCode; // Currency of the estimated value
  tags: string[];
  lastContactAt?: Date;
  nextFollowUpAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum LeadStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  QUALIFIED = 'qualified',
  PROPOSAL = 'proposal',
  NEGOTIATION = 'negotiation',
  WON = 'won',
  LOST = 'lost'
}

export enum LeadTemperature {
  COLD = 'cold',
  WARM = 'warm',
  HOT = 'hot'
}

export enum LeadSource {
  WEBSITE = 'website',
  REFERRAL = 'referral',
  SOCIAL_MEDIA = 'social_media',
  ADVERTISING = 'advertising',
  EVENT = 'event',
  OTHER = 'other'
}

export enum LeadChannel {
  WHATSAPP = 'whatsapp',
  EMAIL = 'email',
  PHONE = 'phone',
  WEBCHAT = 'webchat',
  INSTAGRAM = 'instagram',
  FACEBOOK = 'facebook',
  OTHER = 'other'
}

export enum LeadType {
  AI_AGENT = 'ai_agent',
  MANUAL = 'manual'
}

// AI Agent Types
export interface AIAgent {
  id: string;
  companyId: string;
  name: string;
  type: AIAgentType;
  description?: string;
  avatarUrl?: string;
  isActive: boolean;
  stats: AIAgentStats;
  createdAt: Date;
  updatedAt: Date;
}

export enum AIAgentType {
  SALES = 'sales',
  SUPPORT = 'support',
  QUALIFICATION = 'qualification',
  APPOINTMENT = 'appointment'
}

export interface AIAgentStats {
  totalConversations: number;
  totalLeadsGenerated: number;
  averageResponseTime: number;
  satisfactionScore: number;
}

// UI Types
export interface ModalConfig {
  isOpen: boolean;
  type: 'info' | 'success' | 'warning' | 'error' | 'confirm';
  title: string;
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

// Filter Types
export interface LeadFilters {
  search: string;
  status: LeadStatus | 'all';
  temperature: LeadTemperature | 'all';
  channel: LeadChannel | 'all';
  type: LeadType | 'all';
  dateRange: DateRangePreset | 'custom';
  customDateRange: {
    start: Date | null;
    end: Date | null;
  };
}

export type DateRangePreset = 'today' | 'last7days' | 'last30days' | 'last90days' | 'all';

export const DATE_RANGE_CONFIG: Record<DateRangePreset, { days: number | null }> = {
  today: { days: 0 },
  last7days: { days: 7 },
  last30days: { days: 30 },
  last90days: { days: 90 },
  all: { days: null },
};

export const LEAD_TYPE_CONFIG: Record<LeadType, { color: string; bgColor: string; icon: string }> = {
  [LeadType.AI_AGENT]: { color: '#00E5FF', bgColor: 'rgba(0, 229, 255, 0.15)', icon: '🤖' },
  [LeadType.MANUAL]: { color: '#8B5CF6', bgColor: 'rgba(139, 92, 246, 0.15)', icon: '✋' },
};

// Status Config for UI
export const LEAD_STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bgColor: string }> = {
  [LeadStatus.NEW]: { label: 'Nuevo', color: '#3B82F6', bgColor: 'rgba(59, 130, 246, 0.1)' },
  [LeadStatus.CONTACTED]: { label: 'Contactado', color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.1)' },
  [LeadStatus.QUALIFIED]: { label: 'Calificado', color: '#10B981', bgColor: 'rgba(16, 185, 129, 0.1)' },
  [LeadStatus.PROPOSAL]: { label: 'Propuesta', color: '#8B5CF6', bgColor: 'rgba(139, 92, 246, 0.1)' },
  [LeadStatus.NEGOTIATION]: { label: 'Negociaci\u00f3n', color: '#EC4899', bgColor: 'rgba(236, 72, 153, 0.1)' },
  [LeadStatus.WON]: { label: 'Ganado', color: '#059669', bgColor: 'rgba(5, 150, 105, 0.1)' },
  [LeadStatus.LOST]: { label: 'Perdido', color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.1)' },
};

export const LEAD_TEMPERATURE_CONFIG: Record<LeadTemperature, { label: string; color: string; icon: string }> = {
  [LeadTemperature.COLD]: { label: 'Fr\u00edo', color: '#3B82F6', icon: '❄️' },
  [LeadTemperature.WARM]: { label: 'Tibio', color: '#F59E0B', icon: '🌤️' },
  [LeadTemperature.HOT]: { label: 'Caliente', color: '#EF4444', icon: '🔥' },
};

export const LEAD_CHANNEL_CONFIG: Record<LeadChannel, { label: string; icon: string }> = {
  [LeadChannel.WHATSAPP]: { label: 'WhatsApp', icon: '📱' },
  [LeadChannel.EMAIL]: { label: 'Email', icon: '📧' },
  [LeadChannel.PHONE]: { label: 'Tel\u00e9fono', icon: '📞' },
  [LeadChannel.WEBCHAT]: { label: 'Web Chat', icon: '💬' },
  [LeadChannel.INSTAGRAM]: { label: 'Instagram', icon: '📷' },
  [LeadChannel.FACEBOOK]: { label: 'Facebook', icon: '👤' },
  [LeadChannel.OTHER]: { label: 'Otro', icon: '📌' },
};
