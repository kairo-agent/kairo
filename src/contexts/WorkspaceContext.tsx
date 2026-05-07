'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

// Types for organization and project selection
export interface WorkspaceOrganization {
  id: string;
  name: string;
  slug: string;
  defaultTimezone: string;
}

export interface WorkspaceProject {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
}

interface WorkspaceContextType {
  // Current selections
  selectedOrganization: WorkspaceOrganization | null;
  selectedProject: WorkspaceProject | null; // null means "All projects"

  // Available options
  organizations: WorkspaceOrganization[];
  projects: WorkspaceProject[]; // Projects for selected organization

  // Actions
  setSelectedOrganization: (org: WorkspaceOrganization | null) => void;
  setSelectedProject: (project: WorkspaceProject | null) => void;
  setOrganizations: (orgs: WorkspaceOrganization[]) => void;
  setProjects: (projects: WorkspaceProject[]) => void;

  // Loading state
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  /**
   * `true` cuando el provider ya monto en cliente y leyo localStorage.
   * Componentes que ramifican entre empty-state y contenido segun
   * `selectedProject` deben esperar `mounted` para evitar mostrar el
   * empty-state durante el flash inicial post-hidratacion.
   */
  mounted: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const STORAGE_KEY_ORG = 'kairo-selected-org';
const STORAGE_KEY_PROJECT = 'kairo-selected-project';

interface WorkspaceProviderProps {
  children: ReactNode;
  initialOrganizations?: WorkspaceOrganization[];
  initialProjects?: WorkspaceProject[];
}

function readStoredWorkspace(): {
  org: WorkspaceOrganization | null;
  project: WorkspaceProject | null;
} {
  try {
    const savedOrg = localStorage.getItem(STORAGE_KEY_ORG);
    const savedProject = localStorage.getItem(STORAGE_KEY_PROJECT);
    return {
      org: savedOrg ? JSON.parse(savedOrg) : null,
      project: savedProject ? JSON.parse(savedProject) : null,
    };
  } catch {
    return { org: null, project: null };
  }
}

export function WorkspaceProvider({
  children,
  initialOrganizations = [],
  initialProjects = [],
}: WorkspaceProviderProps) {
  // Server y primer render cliente arrancan en null para evitar hydration mismatch.
  // Lectura de localStorage diferida a useEffect post-mount.
  const [selectedOrganization, setSelectedOrganizationState] = useState<WorkspaceOrganization | null>(null);
  const [selectedProject, setSelectedProjectState] = useState<WorkspaceProject | null>(null);
  const [mounted, setMounted] = useState(false);
  const [organizations, setOrganizations] = useState<WorkspaceOrganization[]>(initialOrganizations);
  const [projects, setProjects] = useState<WorkspaceProject[]>(initialProjects);
  const [isLoading, setIsLoading] = useState(initialOrganizations.length === 0);

  // Mount: lee localStorage y aplica si existe valor guardado
  useEffect(() => {
    const stored = readStoredWorkspace();
    if (stored.org) setSelectedOrganizationState(stored.org);
    if (stored.project) setSelectedProjectState(stored.project);
    setMounted(true);
  }, []);

  const setSelectedOrganization = useCallback((org: WorkspaceOrganization | null) => {
    setSelectedOrganizationState(org);
    setSelectedProjectState(null);
    setProjects([]);
    try {
      if (org) {
        localStorage.setItem(STORAGE_KEY_ORG, JSON.stringify(org));
      } else {
        localStorage.removeItem(STORAGE_KEY_ORG);
      }
      localStorage.removeItem(STORAGE_KEY_PROJECT);
    } catch { /* ignore */ }
  }, []);

  const setSelectedProject = useCallback((project: WorkspaceProject | null) => {
    setSelectedProjectState(project);
    try {
      if (project) {
        localStorage.setItem(STORAGE_KEY_PROJECT, JSON.stringify(project));
      } else {
        localStorage.removeItem(STORAGE_KEY_PROJECT);
      }
    } catch { /* ignore */ }
  }, []);

  const value: WorkspaceContextType = {
    selectedOrganization,
    selectedProject,
    organizations,
    projects,
    setSelectedOrganization,
    setSelectedProject,
    setOrganizations,
    setProjects,
    isLoading,
    setIsLoading,
    mounted,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}

// Safe version that returns null when outside WorkspaceProvider (e.g., admin layout)
export function useWorkspaceOptional() {
  return useContext(WorkspaceContext) ?? null;
}
