// ============================================
// KAIRO - Type Definitions
// Multi-tenant: Organization → Project → User
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

// ============================================
// MULTI-TENANT HIERARCHY
// ============================================

// System Role (global access level)
export enum SystemRole {
  SUPER_ADMIN = 'super_admin',
  USER = 'user'
}

// Project Role (within a specific project)
export enum ProjectRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  AGENT = 'agent',
  VIEWER = 'viewer'
}

// Organization Type
export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Organization Member (links user to org)
export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  isOwner: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Populated relations
  organization?: Organization;
  user?: User;
}

// Project Type (formerly Company)
export interface Project {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  logoUrl?: string;
  description?: string;
  plan: ProjectPlan;
  defaultCurrency: CurrencyCode;
  supportedCurrencies: CurrencyCode[];
  exchangeRates?: Record<string, number>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Populated relations
  organization?: Organization;
}

export enum ProjectPlan {
  FREE = 'free',
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise'
}

// Project Member (links user to project with role)
export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  createdAt: Date;
  updatedAt: Date;
  // Populated relations
  project?: Project;
  user?: User;
}

// User Type
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  systemRole: SystemRole;
  isActive: boolean;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
  // Populated relations
  organizationMemberships?: OrganizationMember[];
  projectMemberships?: ProjectMember[];
}

// Full user context (with all memberships)
export interface UserContext {
  user: User;
  currentOrganization?: Organization;
  currentProject?: Project;
  currentProjectRole?: ProjectRole;
  organizations: OrganizationMember[];
  projects: ProjectMember[];
}

// ============================================
// LEGACY ALIASES (for backward compatibility)
// ============================================

// Keep old UserRole for now, mapping to ProjectRole
export const UserRole = ProjectRole;
export type UserRoleType = ProjectRole;

// Company is now Project
export type Company = Project;
export const CompanyPlan = ProjectPlan;
export type CompanyPlanType = ProjectPlan;

// ============================================
// LEAD TYPES
// ============================================

export interface Lead {
  id: string;
  projectId: string; // Changed from companyId
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
  type: LeadType;
  assignedAgentId?: string;
  assignedUserId?: string;
  pipelineStage: string;
  estimatedValue?: number;
  currency: CurrencyCode;
  tags: string[];
  archivedAt?: Date;
  lastContactAt?: Date;
  nextFollowUpAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Populated relations
  project?: Project;
  assignedAgent?: AIAgent;
  assignedUser?: User;
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
  // Canales adicionales - mantener para compatibilidad con datos existentes
  // El filtro de canal está oculto en el MVP (solo WhatsApp activo)
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

// ============================================
// AI AGENT TYPES
// ============================================

export interface AIAgent {
  id: string;
  projectId: string; // Changed from companyId
  name: string;
  type: AIAgentType;
  description?: string;
  avatarUrl?: string;
  systemInstructions?: string; // System prompt for lead qualification and behavior
  isActive: boolean;
  stats: AIAgentStats;
  createdAt: Date;
  updatedAt: Date;
  // Populated relations
  project?: Project;
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

// ============================================
// UI TYPES
// ============================================

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
  archiveFilter: 'active' | 'archived' | 'all';
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
  [LeadStatus.NEGOTIATION]: { label: 'Negociación', color: '#EC4899', bgColor: 'rgba(236, 72, 153, 0.1)' },
  [LeadStatus.WON]: { label: 'Ganado', color: '#059669', bgColor: 'rgba(5, 150, 105, 0.1)' },
  [LeadStatus.LOST]: { label: 'Perdido', color: '#EF4444', bgColor: 'rgba(239, 68, 68, 0.1)' },
};

export const LEAD_TEMPERATURE_CONFIG: Record<LeadTemperature, { label: string; color: string; icon: string }> = {
  [LeadTemperature.COLD]: { label: 'Frío', color: '#3B82F6', icon: '❄️' },
  [LeadTemperature.WARM]: { label: 'Tibio', color: '#F59E0B', icon: '🌤️' },
  [LeadTemperature.HOT]: { label: 'Caliente', color: '#EF4444', icon: '🔥' },
};

export const LEAD_CHANNEL_CONFIG: Record<LeadChannel, { label: string; icon: string }> = {
  [LeadChannel.WHATSAPP]: { label: 'WhatsApp', icon: '📱' },
  // Canales adicionales - mantener para compatibilidad con datos existentes
  // El filtro de canal está oculto en el MVP (solo WhatsApp activo)
  [LeadChannel.EMAIL]: { label: 'Email', icon: '📧' },
  [LeadChannel.PHONE]: { label: 'Teléfono', icon: '📞' },
  [LeadChannel.WEBCHAT]: { label: 'Web Chat', icon: '💬' },
  [LeadChannel.INSTAGRAM]: { label: 'Instagram', icon: '📷' },
  [LeadChannel.FACEBOOK]: { label: 'Facebook', icon: '👤' },
  [LeadChannel.OTHER]: { label: 'Otro', icon: '📌' },
};

// ============================================
// PAGINATION TYPES
// ============================================

export interface PaginationParams {
  page: number; // 1-based
  limit: number; // items per page
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationInfo;
}

// Pagination constants
export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

// ============================================
// ROLE CONFIGS
// ============================================

export const SYSTEM_ROLE_CONFIG: Record<SystemRole, { label: string; description: string }> = {
  [SystemRole.SUPER_ADMIN]: { label: 'Super Admin', description: 'Acceso total al sistema' },
  [SystemRole.USER]: { label: 'Usuario', description: 'Acceso según membresías' },
};

export const PROJECT_ROLE_CONFIG: Record<ProjectRole, { label: string; description: string; color: string }> = {
  [ProjectRole.ADMIN]: { label: 'Administrador', description: 'Control total del proyecto', color: '#EF4444' },
  [ProjectRole.MANAGER]: { label: 'Manager', description: 'Gestión de equipo y leads', color: '#F59E0B' },
  [ProjectRole.AGENT]: { label: 'Agente', description: 'Gestión de leads asignados', color: '#3B82F6' },
  [ProjectRole.VIEWER]: { label: 'Visualizador', description: 'Solo lectura', color: '#6B7280' },
};
