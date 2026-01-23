'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// Types for organization and project selection
export interface WorkspaceOrganization {
  id: string;
  name: string;
  slug: string;
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
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

const STORAGE_KEY_ORG = 'kairo-selected-org';
const STORAGE_KEY_PROJECT = 'kairo-selected-project';

interface WorkspaceProviderProps {
  children: ReactNode;
  initialOrganizations?: WorkspaceOrganization[];
  initialProjects?: WorkspaceProject[];
}

export function WorkspaceProvider({
  children,
  initialOrganizations = [],
  initialProjects = [],
}: WorkspaceProviderProps) {
  const [selectedOrganization, setSelectedOrganizationState] = useState<WorkspaceOrganization | null>(null);
  const [selectedProject, setSelectedProjectState] = useState<WorkspaceProject | null>(null);
  const [organizations, setOrganizations] = useState<WorkspaceOrganization[]>(initialOrganizations);
  const [projects, setProjects] = useState<WorkspaceProject[]>(initialProjects);
  // If we have initial data, we're not loading
  const [isLoading, setIsLoading] = useState(initialOrganizations.length === 0);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedOrg = localStorage.getItem(STORAGE_KEY_ORG);
        const savedProject = localStorage.getItem(STORAGE_KEY_PROJECT);

        if (savedOrg) {
          setSelectedOrganizationState(JSON.parse(savedOrg));
        }
        if (savedProject) {
          setSelectedProjectState(JSON.parse(savedProject));
        }
      } catch (error) {
        console.error('Error loading workspace from localStorage:', error);
      }
      setIsInitialized(true);
    }
  }, []);

  // Save to localStorage when selections change
  useEffect(() => {
    if (!isInitialized) return;

    if (typeof window !== 'undefined') {
      try {
        if (selectedOrganization) {
          localStorage.setItem(STORAGE_KEY_ORG, JSON.stringify(selectedOrganization));
        } else {
          localStorage.removeItem(STORAGE_KEY_ORG);
        }
      } catch (error) {
        console.error('Error saving org to localStorage:', error);
      }
    }
  }, [selectedOrganization, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;

    if (typeof window !== 'undefined') {
      try {
        if (selectedProject) {
          localStorage.setItem(STORAGE_KEY_PROJECT, JSON.stringify(selectedProject));
        } else {
          localStorage.removeItem(STORAGE_KEY_PROJECT);
        }
      } catch (error) {
        console.error('Error saving project to localStorage:', error);
      }
    }
  }, [selectedProject, isInitialized]);

  // When organization changes, reset project selection
  const setSelectedOrganization = useCallback((org: WorkspaceOrganization | null) => {
    setSelectedOrganizationState(org);
    // Reset project when org changes
    setSelectedProjectState(null);
    setProjects([]);
  }, []);

  const setSelectedProject = useCallback((project: WorkspaceProject | null) => {
    setSelectedProjectState(project);
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
