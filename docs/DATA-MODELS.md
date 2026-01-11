# KAIRO - Modelos de Datos

## Entidades del MVP

### User (Usuario)
```typescript
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  role: UserRole;
  companyId: string;
  createdAt: Date;
  updatedAt: Date;
}

enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  AGENT = 'agent',
  VIEWER = 'viewer'
}
```

### Company (Empresa/Cuenta)
```typescript
interface Company {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  plan: CompanyPlan;
  settings: CompanySettings;
  createdAt: Date;
  updatedAt: Date;
}

enum CompanyPlan {
  FREE = 'free',
  STARTER = 'starter',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise'
}

interface CompanySettings {
  timezone: string;
  language: string;
  currency: string;
  leadStatuses: LeadStatus[]; // Personalizable por empresa
}
```

### Lead
```typescript
interface Lead {
  id: string;
  companyId: string;

  // Información de contacto
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;

  // Información empresarial
  businessName?: string;
  position?: string;

  // Clasificación
  status: LeadStatus;
  temperature: LeadTemperature;
  source: LeadSource;
  channel: LeadChannel;

  // Asignación
  assignedAgentId?: string;    // Sub-agente IA asignado
  assignedUserId?: string;     // Usuario humano asignado

  // Pipeline
  pipelineStage: string;
  estimatedValue?: number;

  // Metadata
  tags: string[];
  customFields: Record<string, unknown>;

  // Timestamps
  lastContactAt?: Date;
  nextFollowUpAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

enum LeadStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  QUALIFIED = 'qualified',
  PROPOSAL = 'proposal',
  NEGOTIATION = 'negotiation',
  WON = 'won',
  LOST = 'lost'
}

enum LeadTemperature {
  COLD = 'cold',
  WARM = 'warm',
  HOT = 'hot'
}

enum LeadSource {
  WEBSITE = 'website',
  REFERRAL = 'referral',
  SOCIAL_MEDIA = 'social_media',
  ADVERTISING = 'advertising',
  EVENT = 'event',
  OTHER = 'other'
}

enum LeadChannel {
  WHATSAPP = 'whatsapp',
  EMAIL = 'email',
  PHONE = 'phone',
  WEBCHAT = 'webchat',
  INSTAGRAM = 'instagram',
  FACEBOOK = 'facebook',
  OTHER = 'other'
}
```

### AIAgent (Sub-agente de IA)
```typescript
interface AIAgent {
  id: string;
  companyId: string;
  name: string;
  type: AIAgentType;
  description?: string;
  avatarUrl?: string;
  isActive: boolean;
  config: AIAgentConfig;
  stats: AIAgentStats;
  createdAt: Date;
  updatedAt: Date;
}

enum AIAgentType {
  SALES = 'sales',
  SUPPORT = 'support',
  QUALIFICATION = 'qualification',
  APPOINTMENT = 'appointment'
}

interface AIAgentConfig {
  personality: string;
  tone: 'formal' | 'friendly' | 'professional';
  language: string;
  workingHours?: {
    start: string;
    end: string;
    timezone: string;
  };
}

interface AIAgentStats {
  totalConversations: number;
  totalLeadsGenerated: number;
  averageResponseTime: number;
  satisfactionScore: number;
}
```

### Conversation (Conversación)
```typescript
interface Conversation {
  id: string;
  leadId: string;
  agentId: string;        // Sub-agente IA
  channel: LeadChannel;
  status: ConversationStatus;
  startedAt: Date;
  endedAt?: Date;
  summary?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
}

enum ConversationStatus {
  ACTIVE = 'active',
  WAITING = 'waiting',
  RESOLVED = 'resolved',
  TRANSFERRED = 'transferred'
}
```

### Message (Mensaje)
```typescript
interface Message {
  id: string;
  conversationId: string;
  sender: MessageSender;
  content: string;
  contentType: MessageContentType;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

type MessageSender =
  | { type: 'lead'; leadId: string }
  | { type: 'agent'; agentId: string }
  | { type: 'user'; userId: string };

enum MessageContentType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  AUDIO = 'audio',
  TEMPLATE = 'template'
}
```

---

## Relaciones

```
Company (1) ─────< (N) User
Company (1) ─────< (N) Lead
Company (1) ─────< (N) AIAgent

Lead (1) ─────< (N) Conversation
AIAgent (1) ─────< (N) Conversation

Conversation (1) ─────< (N) Message
```

---

## Notas para Backend (Futuro)

### Índices recomendados
- `Lead`: companyId, status, createdAt, assignedAgentId
- `Conversation`: leadId, agentId, status
- `Message`: conversationId, createdAt

### Multitenancy
- Toda query debe filtrar por `companyId`
- Row Level Security en Supabase cuando se implemente
