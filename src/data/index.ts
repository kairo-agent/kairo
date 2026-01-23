// ============================================
// KAIRO - Mock Data Exports
// ============================================

// Companies (Projects)
export {
  companies,
  getCompanyById,
  defaultCompany,
} from './companies';

// Users
export {
  users,
  getUserById,
  getUsersByProject,
  currentUser,
} from './users';

// AI Agents
export {
  agents,
  getAgentById,
  getActiveAgents,
  getAgentsByProject,
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
