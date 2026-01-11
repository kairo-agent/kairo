// ============================================
// KAIRO - Mock Data Exports
// ============================================

// Companies
export {
  companies,
  getCompanyById,
  defaultCompany,
} from './companies';

// Users
export {
  users,
  getUserById,
  getUsersByCompany,
  currentUser,
} from './users';

// AI Agents
export {
  agents,
  getAgentById,
  getActiveAgents,
  getAgentsByCompany,
  getAgentsByType,
} from './agents';

// Leads
export {
  leads,
  getLeadById,
  getLeadsByStatus,
  getLeadsByTemperature,
  getLeadsByChannel,
  getLeadsByAgent,
  getLeadsByUser,
  getLeadsStats,
} from './leads';
