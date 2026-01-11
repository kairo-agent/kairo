// ============================================
// KAIRO - Mock AI Agents Data
// ============================================

import { AIAgent, AIAgentType } from '@/types';

export const agents: AIAgent[] = [
  {
    id: 'agent-luna',
    companyId: 'company-001',
    name: 'Luna',
    type: AIAgentType.SALES,
    description:
      'Agente de ventas especializada en cerrar negocios y generar propuestas personalizadas. Experta en identificar oportunidades de upselling y cross-selling.',
    avatarUrl: '/agents/luna.png',
    isActive: true,
    stats: {
      totalConversations: 1847,
      totalLeadsGenerated: 423,
      averageResponseTime: 1.2, // segundos
      satisfactionScore: 4.8, // de 5
    },
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-12-28'),
  },
  {
    id: 'agent-atlas',
    companyId: 'company-001',
    name: 'Atlas',
    type: AIAgentType.SUPPORT,
    description:
      'Agente de soporte tecnico con conocimiento profundo de productos y servicios. Resuelve dudas y escala casos complejos al equipo humano.',
    avatarUrl: '/agents/atlas.png',
    isActive: true,
    stats: {
      totalConversations: 3256,
      totalLeadsGenerated: 156,
      averageResponseTime: 0.8,
      satisfactionScore: 4.9,
    },
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-12-28'),
  },
  {
    id: 'agent-nova',
    companyId: 'company-001',
    name: 'Nova',
    type: AIAgentType.QUALIFICATION,
    description:
      'Agente de calificacion de leads. Realiza preguntas inteligentes para determinar el potencial de cada prospecto y priorizar los mas prometedores.',
    avatarUrl: '/agents/nova.png',
    isActive: true,
    stats: {
      totalConversations: 2134,
      totalLeadsGenerated: 687,
      averageResponseTime: 1.5,
      satisfactionScore: 4.7,
    },
    createdAt: new Date('2024-02-15'),
    updatedAt: new Date('2024-12-28'),
  },
  {
    id: 'agent-orion',
    companyId: 'company-001',
    name: 'Orion',
    type: AIAgentType.APPOINTMENT,
    description:
      'Agente especializado en agendar citas y reuniones. Coordina horarios y envia recordatorios automaticos a los prospectos.',
    avatarUrl: '/agents/orion.png',
    isActive: false, // Inactivo para el MVP
    stats: {
      totalConversations: 567,
      totalLeadsGenerated: 234,
      averageResponseTime: 2.1,
      satisfactionScore: 4.5,
    },
    createdAt: new Date('2024-06-01'),
    updatedAt: new Date('2024-12-15'),
  },
];

// Helper to get agent by ID
export const getAgentById = (id: string): AIAgent | undefined => {
  return agents.find((agent) => agent.id === id);
};

// Get active agents only
export const getActiveAgents = (): AIAgent[] => {
  return agents.filter((agent) => agent.isActive);
};

// Get agents by company
export const getAgentsByCompany = (companyId: string): AIAgent[] => {
  return agents.filter((agent) => agent.companyId === companyId);
};

// Get agents by type
export const getAgentsByType = (type: AIAgentType): AIAgent[] => {
  return agents.filter((agent) => agent.type === type);
};
