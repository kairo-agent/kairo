'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui';
import { cn, formatDate } from '@/lib/utils';
import {
  getAdminOverviewData,
  deleteOrganization,
  deleteProject,
  deleteUser,
  joinOrganization,
  joinProject,
  type AdminViewType,
  type AdminFilters,
} from '@/lib/actions/admin';
import { SystemRole } from '@/types';
import OrganizationModal from '@/components/admin/OrganizationModal';
import ProjectModal from '@/components/admin/ProjectModal';
import UserModal from '@/components/admin/UserModal';
import DeleteConfirmModal from '@/components/admin/DeleteConfirmModal';
import ProjectSettingsModal from '@/components/admin/ProjectSettingsModal';

// Types for data
interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  logoUrl?: string | null;
  defaultTimezone?: string;
  defaultLocale?: string;
  isActive: boolean;
  createdAt: Date;
  _count: { projects: number; members: number };
}

interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  logoUrl?: string | null;
  plan: string;
  isActive: boolean;
  createdAt: Date;
  organizationId: string;
  organization: { id: string; name: string };
  _count: { members: number; leads: number };
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string | null;
  systemRole: SystemRole;
  isActive: boolean;
  createdAt: Date;
  organizationMemberships: Array<{
    isOwner: boolean;
    organization: { id: string; name: string };
  }>;
  projectMemberships: Array<{
    role: string;
    project: { id: string; name: string };
  }>;
}

interface AdminStats {
  totalOrganizations: number;
  totalProjects: number;
  totalUsers: number;
  totalLeads: number;
}

// Icons
const OrganizationIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const ProjectIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

const UsersIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const LeadsIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const EditIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const DeleteIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const JoinIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const BotIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

export default function AdminOverviewPage() {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');

  // State
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminStats>({
    totalOrganizations: 0,
    totalProjects: 0,
    totalUsers: 0,
    totalLeads: 0,
  });
  const [viewType, setViewType] = useState<AdminViewType>('organizations');
  const [organizationId, setOrganizationId] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [projDropdownOpen, setProjDropdownOpen] = useState(false);

  // Data lists
  const [organizationsList, setOrganizationsList] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [projectsList, setProjectsList] = useState<Array<{ id: string; name: string; slug: string; organizationId: string }>>([]);

  // Current user memberships
  const [myOrgIds, setMyOrgIds] = useState<string[]>([]);
  const [myProjectIds, setMyProjectIds] = useState<string[]>([]);

  // Current data
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Action loading state
  const [joiningId, setJoiningId] = useState<string | null>(null);

  // Modal states
  const [orgModalOpen, setOrgModalOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Edit item state
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Settings modal state
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settingsProject, setSettingsProject] = useState<Project | null>(null);

  // Delete item state
  const [deletingItem, setDeletingItem] = useState<{
    type: 'organization' | 'project' | 'user';
    id: string;
    name: string;
  } | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const filters: AdminFilters = {
        viewType,
        organizationId: organizationId || undefined,
        projectId: projectId || undefined,
        search: debouncedSearch || undefined,
      };

      const result = await getAdminOverviewData(filters);

      if ('error' in result && result.error) {
        console.error(result.error);
        return;
      }

      if ('stats' in result && result.stats) setStats(result.stats);
      if ('organizationsList' in result && result.organizationsList) setOrganizationsList(result.organizationsList);
      if ('projectsList' in result && result.projectsList) setProjectsList(result.projectsList);
      if ('myOrgIds' in result && result.myOrgIds) setMyOrgIds(result.myOrgIds as string[]);
      if ('myProjectIds' in result && result.myProjectIds) setMyProjectIds(result.myProjectIds as string[]);
      if ('organizations' in result && result.organizations) setOrganizations(result.organizations as Organization[]);
      if ('projects' in result && result.projects) setProjects(result.projects as Project[]);
      if ('users' in result && result.users) setUsers(result.users as User[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [viewType, organizationId, projectId, debouncedSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset project when org changes
  useEffect(() => {
    setProjectId('');
  }, [organizationId]);

  // Stat cards
  const statCards = [
    { label: t('overview.totalOrganizations'), value: stats.totalOrganizations, icon: <OrganizationIcon />, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
    { label: t('overview.totalProjects'), value: stats.totalProjects, icon: <ProjectIcon />, color: 'text-green-500', bgColor: 'bg-green-500/10' },
    { label: t('overview.totalUsers'), value: stats.totalUsers, icon: <UsersIcon />, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
    { label: t('overview.totalLeads'), value: stats.totalLeads, icon: <LeadsIcon />, color: 'text-[var(--kairo-cyan)]', bgColor: 'bg-[var(--kairo-cyan)]/10' },
  ];

  // View type buttons
  const viewTypes: { type: AdminViewType; label: string }[] = [
    { type: 'organizations', label: t('nav.organizations') },
    { type: 'projects', label: t('nav.projects') },
    { type: 'users', label: t('nav.users') },
  ];

  // Handle join organization
  const handleJoinOrg = async (orgId: string) => {
    setJoiningId(orgId);
    try {
      const result = await joinOrganization(orgId);
      if (result.error) {
        alert(result.error);
      } else {
        await fetchData();
      }
    } catch (error) {
      console.error('Error joining org:', error);
    } finally {
      setJoiningId(null);
    }
  };

  // Handle join project
  const handleJoinProject = async (projId: string) => {
    setJoiningId(projId);
    try {
      const result = await joinProject(projId);
      if (result.error) {
        alert(result.error);
      } else {
        await fetchData();
      }
    } catch (error) {
      console.error('Error joining project:', error);
    } finally {
      setJoiningId(null);
    }
  };

  // Modal handlers - Organizations
  const handleCreateOrg = () => {
    setEditingOrg(null);
    setOrgModalOpen(true);
  };

  const handleEditOrg = (org: Organization) => {
    setEditingOrg(org);
    setOrgModalOpen(true);
  };

  const handleDeleteOrg = (org: Organization) => {
    setDeletingItem({ type: 'organization', id: org.id, name: org.name });
    setDeleteModalOpen(true);
  };

  // Modal handlers - Projects
  const handleCreateProject = () => {
    setEditingProject(null);
    setProjectModalOpen(true);
  };

  const handleEditProject = (project: Project) => {
    setEditingProject(project);
    setProjectModalOpen(true);
  };

  const handleDeleteProject = (project: Project) => {
    setDeletingItem({ type: 'project', id: project.id, name: project.name });
    setDeleteModalOpen(true);
  };

  // Modal handlers - Project Settings
  const handleOpenProjectSettings = (project: Project) => {
    setSettingsProject(project);
    setSettingsModalOpen(true);
  };

  // Modal handlers - Users
  const handleCreateUser = () => {
    setEditingUser(null);
    setUserModalOpen(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setUserModalOpen(true);
  };

  const handleDeleteUser = (user: User) => {
    setDeletingItem({ type: 'user', id: user.id, name: `${user.firstName} ${user.lastName}` });
    setDeleteModalOpen(true);
  };

  // Translate delete error codes to user-friendly messages
  const getDeleteErrorMessage = (error: string, count?: number, type?: string): string => {
    const countStr = count?.toString() || '0';

    if (type === 'organization') {
      if (error === 'HAS_PROJECTS') {
        return t('messages.cannotDeleteOrgHasProjects', { count: countStr });
      }
      if (error === 'HAS_MEMBERS') {
        return t('messages.cannotDeleteOrgHasMembers', { count: countStr });
      }
    }

    if (type === 'project') {
      if (error === 'HAS_MEMBERS') {
        return t('messages.cannotDeleteProjectHasMembers', { count: countStr });
      }
      if (error === 'HAS_LEADS') {
        return t('messages.cannotDeleteProjectHasLeads', { count: countStr });
      }
    }

    return error;
  };

  // Handle delete confirmation
  const handleConfirmDelete = async () => {
    if (!deletingItem) return { error: 'No item to delete' };

    try {
      let result: { error?: string; success?: boolean; count?: number };
      if (deletingItem.type === 'organization') {
        result = await deleteOrganization(deletingItem.id);
      } else if (deletingItem.type === 'project') {
        result = await deleteProject(deletingItem.id);
      } else {
        result = await deleteUser(deletingItem.id);
      }

      if (result.success) {
        await fetchData();
        setDeletingItem(null);
        return result;
      }

      // Translate error codes to messages
      if (result.error) {
        return {
          error: getDeleteErrorMessage(result.error, result.count, deletingItem.type),
        };
      }

      return result;
    } catch {
      return { error: 'Error inesperado' };
    }
  };

  // Get all projects for user modal (projectsList already has organizationId)
  const allProjectsForModal = projectsList.map(p => ({
    id: p.id,
    name: p.name,
    organizationId: p.organizationId,
  }));

  // Render table based on view type
  const renderTable = () => {
    if (loading) {
      return (
        <div className="p-8 text-center text-[var(--text-secondary)]">
          {tCommon('buttons.loading')}
        </div>
      );
    }

    if (viewType === 'organizations') {
      if (organizations.length === 0) {
        return <div className="p-8 text-center text-[var(--text-secondary)]">{t('organizations.empty')}</div>;
      }
      return (
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-primary)]">
              <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">{t('organizations.name')}</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">{t('organizations.slug')}</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">{t('organizations.projects')}</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">{t('organizations.members')}</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">{t('organizations.status')}</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">{t('organizations.created')}</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">{tCommon('labels.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {organizations.map((org) => (
              <tr key={org.id} className="border-b border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)]">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center text-sm font-medium">
                      {org.name.charAt(0)}
                    </div>
                    <span className="font-medium text-[var(--text-primary)]">{org.name}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-[var(--text-secondary)]">{org.slug}</td>
                <td className="py-3 px-4 text-[var(--text-secondary)]">{org._count.projects}</td>
                <td className="py-3 px-4 text-[var(--text-secondary)]">{org._count.members}</td>
                <td className="py-3 px-4">
                  <span className={cn(
                    'px-2 py-1 rounded text-xs font-medium',
                    org.isActive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                  )}>
                    {org.isActive ? t('organizations.active') : t('organizations.inactive')}
                  </span>
                </td>
                <td className="py-3 px-4 text-[var(--text-secondary)]">{formatDate(org.createdAt)}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-end gap-2">
                    {myOrgIds.includes(org.id) ? (
                      <span className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-500/10 text-green-500">
                        <CheckIcon />
                        {t('actions.joined')}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleJoinOrg(org.id)}
                        disabled={joiningId === org.id}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-[var(--kairo-cyan)]/10 text-[var(--kairo-cyan)] hover:bg-[var(--kairo-cyan)]/20 transition-colors disabled:opacity-50"
                      >
                        <JoinIcon />
                        {joiningId === org.id ? '...' : t('actions.join')}
                      </button>
                    )}
                    <button
                      onClick={() => handleEditOrg(org)}
                      className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
                      title={t('organizations.edit')}
                    >
                      <EditIcon />
                    </button>
                    <button
                      onClick={() => handleDeleteOrg(org)}
                      className="p-1.5 rounded hover:bg-red-500/10 text-red-500"
                      title={t('organizations.delete')}
                    >
                      <DeleteIcon />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (viewType === 'projects') {
      if (projects.length === 0) {
        return <div className="p-8 text-center text-[var(--text-secondary)]">{t('projects.empty')}</div>;
      }
      return (
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-primary)]">
              <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">{t('projects.name')}</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">{t('projects.organization')}</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">{t('projects.plan')}</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">{t('projects.members')}</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">{t('projects.leads')}</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">{t('projects.status')}</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">{tCommon('labels.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id} className="border-b border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)]">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-green-500/10 text-green-500 flex items-center justify-center text-sm font-medium">
                      {project.name.charAt(0)}
                    </div>
                    <span className="font-medium text-[var(--text-primary)]">{project.name}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-[var(--text-secondary)]">{project.organization.name}</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-1 rounded text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-primary)]">
                    {t(`plans.${project.plan}`)}
                  </span>
                </td>
                <td className="py-3 px-4 text-[var(--text-secondary)]">{project._count.members}</td>
                <td className="py-3 px-4 text-[var(--text-secondary)]">{project._count.leads}</td>
                <td className="py-3 px-4">
                  <span className={cn(
                    'px-2 py-1 rounded text-xs font-medium',
                    project.isActive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                  )}>
                    {project.isActive ? t('projects.active') : t('projects.inactive')}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-end gap-2">
                    {myProjectIds.includes(project.id) ? (
                      <span className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-500/10 text-green-500">
                        <CheckIcon />
                        {t('actions.joined')}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleJoinProject(project.id)}
                        disabled={joiningId === project.id}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-[var(--kairo-cyan)]/10 text-[var(--kairo-cyan)] hover:bg-[var(--kairo-cyan)]/20 transition-colors disabled:opacity-50"
                      >
                        <JoinIcon />
                        {joiningId === project.id ? '...' : t('actions.join')}
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenProjectSettings(project)}
                      className="p-1.5 rounded hover:bg-[var(--kairo-cyan)]/10 text-[var(--kairo-cyan)]"
                      title={t('actions.configure')}
                    >
                      <BotIcon />
                    </button>
                    <button
                      onClick={() => handleEditProject(project)}
                      className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
                      title={t('projects.edit')}
                    >
                      <EditIcon />
                    </button>
                    <button
                      onClick={() => handleDeleteProject(project)}
                      className="p-1.5 rounded hover:bg-red-500/10 text-red-500"
                      title={t('projects.delete')}
                    >
                      <DeleteIcon />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (viewType === 'users') {
      if (users.length === 0) {
        return <div className="p-8 text-center text-[var(--text-secondary)]">{t('users.empty')}</div>;
      }
      return (
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-primary)]">
              <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">{t('users.name')}</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">{t('users.email')}</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">{t('users.systemRole')}</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">{t('users.organization')}</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">{t('users.projects')}</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">{t('users.status')}</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-[var(--text-secondary)]">{tCommon('labels.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-[var(--border-primary)] hover:bg-[var(--bg-tertiary)]">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center text-sm font-medium">
                      {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                    </div>
                    <span className="font-medium text-[var(--text-primary)]">{user.firstName} {user.lastName}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-[var(--text-secondary)]">{user.email}</td>
                <td className="py-3 px-4">
                  <span className={cn(
                    'px-2 py-1 rounded text-xs font-medium',
                    user.systemRole === 'super_admin' ? 'bg-[var(--kairo-cyan)]/10 text-[var(--kairo-cyan)]' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                  )}>
                    {user.systemRole === 'super_admin' ? 'Super Admin' : t(`systemRoles.${user.systemRole}`)}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm text-[var(--text-secondary)]">
                  {user.organizationMemberships.length > 0
                    ? user.organizationMemberships.map((m, i) => (
                        <span key={i}>
                          {m.organization.name}{m.isOwner ? ' (Owner)' : ''}
                          {i < user.organizationMemberships.length - 1 ? ', ' : ''}
                        </span>
                      ))
                    : <span className="text-[var(--text-muted)]">—</span>
                  }
                </td>
                <td className="py-3 px-4 text-sm text-[var(--text-secondary)]">
                  {user.projectMemberships.length > 0
                    ? user.projectMemberships.map((m, i) => (
                        <span key={i}>
                          {m.project.name} ({m.role})
                          {i < user.projectMemberships.length - 1 ? ', ' : ''}
                        </span>
                      ))
                    : <span className="text-[var(--text-muted)]">—</span>
                  }
                </td>
                <td className="py-3 px-4">
                  <span className={cn(
                    'px-2 py-1 rounded text-xs font-medium',
                    user.isActive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                  )}>
                    {user.isActive ? t('users.active') : t('users.inactive')}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleEditUser(user)}
                      className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"
                      title={t('users.edit')}
                    >
                      <EditIcon />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user)}
                      className="p-1.5 rounded hover:bg-red-500/10 text-red-500"
                      title={t('users.delete')}
                    >
                      <DeleteIcon />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    return null;
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">
        {t('overview.title')}
      </h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((stat, index) => (
          <Card key={index} className="p-4">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${stat.bgColor} ${stat.color}`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-sm text-[var(--text-secondary)]">{stat.label}</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters Row */}
      <Card className="p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* View Type Selector */}
          <div className="flex rounded-lg border border-[var(--border-primary)] overflow-hidden">
            {viewTypes.map((vt) => (
              <button
                key={vt.type}
                onClick={() => setViewType(vt.type)}
                className={cn(
                  'px-4 py-2 text-sm font-medium transition-colors',
                  viewType === vt.type
                    ? 'bg-[var(--kairo-cyan)] text-white'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                )}
              >
                {vt.label}
              </button>
            ))}
          </div>

          {/* Organization Filter - Custom Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setOrgDropdownOpen(!orgDropdownOpen);
                setProjDropdownOpen(false);
              }}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors min-w-[160px]',
                organizationId
                  ? 'border-[var(--kairo-cyan)] bg-[var(--kairo-cyan)]/10 text-[var(--kairo-cyan)]'
                  : 'border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              )}
            >
              <OrganizationIcon />
              <span className="flex-1 text-left truncate">
                {organizationId
                  ? organizationsList.find(o => o.id === organizationId)?.name || t('projects.selectOrg')
                  : t('projects.selectOrg')
                }
              </span>
              <ChevronDownIcon />
            </button>
            {orgDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setOrgDropdownOpen(false)}
                />
                <div className="absolute top-full left-0 mt-1 w-full min-w-[200px] bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg shadow-lg z-20 py-1 max-h-60 overflow-y-auto">
                  <button
                    onClick={() => {
                      setOrganizationId('');
                      setOrgDropdownOpen(false);
                    }}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm transition-colors',
                      !organizationId
                        ? 'bg-[var(--kairo-cyan)]/10 text-[var(--kairo-cyan)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                    )}
                  >
                    {t('filters.allOrganizations')}
                  </button>
                  {organizationsList.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => {
                        setOrganizationId(org.id);
                        setOrgDropdownOpen(false);
                      }}
                      className={cn(
                        'w-full px-3 py-2 text-left text-sm transition-colors',
                        organizationId === org.id
                          ? 'bg-[var(--kairo-cyan)]/10 text-[var(--kairo-cyan)]'
                          : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                      )}
                    >
                      {org.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Project Filter (only for users) - Custom Dropdown */}
          {viewType === 'users' && projectsList.length > 0 && (
            <div className="relative">
              <button
                onClick={() => {
                  setProjDropdownOpen(!projDropdownOpen);
                  setOrgDropdownOpen(false);
                }}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors min-w-[160px]',
                  projectId
                    ? 'border-[var(--kairo-cyan)] bg-[var(--kairo-cyan)]/10 text-[var(--kairo-cyan)]'
                    : 'border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                )}
              >
                <ProjectIcon />
                <span className="flex-1 text-left truncate">
                  {projectId
                    ? projectsList.find(p => p.id === projectId)?.name || t('filters.allProjects')
                    : t('filters.allProjects')
                  }
                </span>
                <ChevronDownIcon />
              </button>
              {projDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setProjDropdownOpen(false)}
                  />
                  <div className="absolute top-full left-0 mt-1 w-full min-w-[200px] bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg shadow-lg z-20 py-1 max-h-60 overflow-y-auto">
                    <button
                      onClick={() => {
                        setProjectId('');
                        setProjDropdownOpen(false);
                      }}
                      className={cn(
                        'w-full px-3 py-2 text-left text-sm transition-colors',
                        !projectId
                          ? 'bg-[var(--kairo-cyan)]/10 text-[var(--kairo-cyan)]'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                      )}
                    >
                      {t('filters.allProjects')}
                    </button>
                    {projectsList.map((proj) => (
                      <button
                        key={proj.id}
                        onClick={() => {
                          setProjectId(proj.id);
                          setProjDropdownOpen(false);
                        }}
                        className={cn(
                          'w-full px-3 py-2 text-left text-sm transition-colors',
                          projectId === proj.id
                            ? 'bg-[var(--kairo-cyan)]/10 text-[var(--kairo-cyan)]'
                            : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
                        )}
                      >
                        {proj.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Search */}
          <div className="flex-1 min-w-[200px] relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tCommon('buttons.search')}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-muted)]"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
              <SearchIcon />
            </div>
          </div>

          {/* Create Buttons */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleCreateOrg}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/10 text-blue-500 text-sm font-medium hover:bg-blue-500/20 transition-colors"
            >
              <PlusIcon />
              {t('organizations.new').replace('Nueva ', '')}
            </button>
            <button
              onClick={handleCreateProject}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-500/10 text-green-500 text-sm font-medium hover:bg-green-500/20 transition-colors"
            >
              <PlusIcon />
              {t('projects.new').replace('Nuevo ', '')}
            </button>
            <button
              onClick={handleCreateUser}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-500/10 text-purple-500 text-sm font-medium hover:bg-purple-500/20 transition-colors"
            >
              <PlusIcon />
              {t('users.new').replace('Nuevo ', '')}
            </button>
          </div>
        </div>
      </Card>

      {/* Data Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          {renderTable()}
        </div>
      </Card>

      {/* Modals */}
      <OrganizationModal
        isOpen={orgModalOpen}
        onClose={() => {
          setOrgModalOpen(false);
          setEditingOrg(null);
        }}
        onSuccess={fetchData}
        organization={editingOrg}
      />

      <ProjectModal
        isOpen={projectModalOpen}
        onClose={() => {
          setProjectModalOpen(false);
          setEditingProject(null);
        }}
        onSuccess={fetchData}
        project={editingProject}
        organizations={organizationsList}
        defaultOrganizationId={organizationId}
      />

      <UserModal
        isOpen={userModalOpen}
        onClose={() => {
          setUserModalOpen(false);
          setEditingUser(null);
        }}
        onSuccess={fetchData}
        user={editingUser}
        organizations={organizationsList}
        projects={allProjectsForModal}
      />

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeletingItem(null);
        }}
        onConfirm={handleConfirmDelete}
        title={
          deletingItem?.type === 'organization'
            ? t('organizations.delete')
            : deletingItem?.type === 'project'
            ? t('projects.delete')
            : t('users.delete')
        }
        message={
          deletingItem?.type === 'organization'
            ? t('organizations.confirmDelete')
            : deletingItem?.type === 'project'
            ? t('projects.confirmDelete')
            : t('users.confirmDelete')
        }
        itemName={deletingItem?.name}
      />

      <ProjectSettingsModal
        isOpen={settingsModalOpen}
        onClose={() => {
          setSettingsModalOpen(false);
          setSettingsProject(null);
        }}
        onSuccess={fetchData}
        project={settingsProject}
      />
    </div>
  );
}
