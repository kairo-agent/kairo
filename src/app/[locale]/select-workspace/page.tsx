'use client';

// ============================================
// KAIRO - Select Workspace Page
// Post-login workspace selection for super_admin
// ============================================

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { getOrganizations, getProjects } from '@/lib/actions/workspace';
import { cn } from '@/lib/utils';
import Image from 'next/image';

// Types
interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface Project {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
}

// Icons
const BuildingIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <path d="M9 22v-4h6v4" />
    <path d="M8 6h.01" />
    <path d="M16 6h.01" />
    <path d="M8 10h.01" />
    <path d="M16 10h.01" />
    <path d="M8 14h.01" />
    <path d="M16 14h.01" />
  </svg>
);

const FolderIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const CheckIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const SunIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

// Storage keys
const STORAGE_KEY_ORG = 'kairo-selected-org';
const STORAGE_KEY_PROJECT = 'kairo-selected-project';

function SelectWorkspaceContent() {
  const t = useTranslations('selectWorkspace');
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  // State
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [allProjects, setAllProjects] = useState(false);

  const [isLoadingOrgs, setIsLoadingOrgs] = useState(true);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);

  // Fetch organizations on mount
  useEffect(() => {
    async function fetchOrgs() {
      setIsLoadingOrgs(true);
      try {
        const orgs = await getOrganizations();
        setOrganizations(orgs);
      } catch (error) {
        console.error('Error fetching organizations:', error);
      } finally {
        setIsLoadingOrgs(false);
      }
    }
    fetchOrgs();
  }, []);

  // Fetch projects when org changes
  useEffect(() => {
    async function fetchProjects() {
      if (!selectedOrg) {
        setProjects([]);
        return;
      }

      setIsLoadingProjects(true);
      try {
        const projs = await getProjects(selectedOrg.id);
        setProjects(projs);
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setIsLoadingProjects(false);
      }
    }
    fetchProjects();
  }, [selectedOrg]);

  // Handle org selection
  const handleOrgSelect = (org: Organization) => {
    setSelectedOrg(org);
    setSelectedProject(null);
    setAllProjects(false);
    setOrgDropdownOpen(false);
  };

  // Handle project selection
  const handleProjectSelect = (project: Project | null) => {
    if (project === null) {
      setAllProjects(true);
      setSelectedProject(null);
    } else {
      setAllProjects(false);
      setSelectedProject(project);
    }
    setProjectDropdownOpen(false);
  };

  // Handle continue
  const handleContinue = () => {
    if (!selectedOrg) return;

    setIsSubmitting(true);

    // Save to localStorage
    localStorage.setItem(STORAGE_KEY_ORG, JSON.stringify(selectedOrg));

    if (selectedProject) {
      localStorage.setItem(STORAGE_KEY_PROJECT, JSON.stringify(selectedProject));
    } else {
      localStorage.removeItem(STORAGE_KEY_PROJECT);
    }

    // Navigate to dashboard
    router.push('/leads');
  };

  const canContinue = selectedOrg && (selectedProject || allProjects);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
      {/* Header with logo and theme toggle */}
      <header className="p-6 flex justify-between items-center">
        <div className="h-10">
          <Image
            src={theme === 'dark' ? '/images/logo-oscuro.png' : '/images/logo-main.png'}
            alt="KAIRO"
            width={120}
            height={40}
            className="h-full w-auto object-contain"
            priority
          />
        </div>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors text-[var(--text-secondary)]"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl p-8 shadow-lg">
            {/* Title */}
            <div className="text-center mb-8">
              <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-2">
                {t('title')}
              </h1>
              <p className="text-[var(--text-secondary)]">{t('subtitle')}</p>
            </div>

            {/* Organization Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                {t('organizationLabel')}
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
                  disabled={isLoadingOrgs}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl',
                    'bg-[var(--bg-tertiary)] border border-[var(--border-primary)]',
                    'text-left transition-all duration-200',
                    'hover:border-[var(--accent-primary)]',
                    orgDropdownOpen && 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/20'
                  )}
                >
                  <span className="text-[var(--accent-primary)]">
                    <BuildingIcon />
                  </span>
                  <span
                    className={cn(
                      'flex-1',
                      selectedOrg ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'
                    )}
                  >
                    {isLoadingOrgs
                      ? t('loading')
                      : selectedOrg?.name || t('organizationPlaceholder')}
                  </span>
                  <span
                    className={cn(
                      'text-[var(--text-tertiary)] transition-transform duration-200',
                      orgDropdownOpen && 'rotate-180'
                    )}
                  >
                    <ChevronDownIcon />
                  </span>
                </button>

                {/* Org Dropdown */}
                {orgDropdownOpen && !isLoadingOrgs && (
                  <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                    {organizations.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-[var(--text-tertiary)] text-center">
                        {t('noOrganizations')}
                      </div>
                    ) : (
                      organizations.map((org) => (
                        <button
                          key={org.id}
                          type="button"
                          onClick={() => handleOrgSelect(org)}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-3',
                            'text-left transition-colors duration-150',
                            selectedOrg?.id === org.id
                              ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                          )}
                        >
                          <span className="flex-1">{org.name}</span>
                          {selectedOrg?.id === org.id && <CheckIcon />}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Project Selector */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                {t('projectLabel')}
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => selectedOrg && setProjectDropdownOpen(!projectDropdownOpen)}
                  disabled={!selectedOrg || isLoadingProjects}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl',
                    'bg-[var(--bg-tertiary)] border border-[var(--border-primary)]',
                    'text-left transition-all duration-200',
                    !selectedOrg || isLoadingProjects
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:border-[var(--accent-primary)]',
                    projectDropdownOpen && 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/20'
                  )}
                >
                  <span className="text-[var(--accent-primary)]">
                    <FolderIcon />
                  </span>
                  <span
                    className={cn(
                      'flex-1',
                      selectedProject || allProjects
                        ? 'text-[var(--text-primary)]'
                        : 'text-[var(--text-tertiary)]'
                    )}
                  >
                    {isLoadingProjects
                      ? t('loading')
                      : !selectedOrg
                        ? t('selectOrgFirst')
                        : allProjects
                          ? t('allProjectsOption')
                          : selectedProject?.name || t('projectPlaceholder')}
                  </span>
                  <span
                    className={cn(
                      'text-[var(--text-tertiary)] transition-transform duration-200',
                      projectDropdownOpen && 'rotate-180'
                    )}
                  >
                    <ChevronDownIcon />
                  </span>
                </button>

                {/* Project Dropdown */}
                {projectDropdownOpen && selectedOrg && !isLoadingProjects && (
                  <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
                    {/* All Projects option */}
                    <button
                      type="button"
                      onClick={() => handleProjectSelect(null)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-3',
                        'text-left transition-colors duration-150',
                        allProjects
                          ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                      )}
                    >
                      <span className="flex-1 font-medium">{t('allProjectsOption')}</span>
                      {allProjects && <CheckIcon />}
                    </button>

                    {/* Divider */}
                    {projects.length > 0 && (
                      <div className="border-t border-[var(--border-primary)]" />
                    )}

                    {/* Individual projects */}
                    {projects.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-[var(--text-tertiary)] text-center">
                        {t('noProjects')}
                      </div>
                    ) : (
                      projects.map((project) => (
                        <button
                          key={project.id}
                          type="button"
                          onClick={() => handleProjectSelect(project)}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-3',
                            'text-left transition-colors duration-150',
                            selectedProject?.id === project.id
                              ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                          )}
                        >
                          <span className="flex-1">{project.name}</span>
                          {selectedProject?.id === project.id && <CheckIcon />}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Continue Button */}
            <button
              onClick={handleContinue}
              disabled={!canContinue || isSubmitting}
              className={cn(
                'w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl',
                'font-medium transition-all duration-200',
                canContinue && !isSubmitting
                  ? 'bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)]'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] cursor-not-allowed'
              )}
            >
              {isSubmitting ? (
                t('loading')
              ) : (
                <>
                  {t('continueButton')}
                  <ArrowRightIcon />
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function SelectWorkspacePage() {
  return (
    <ThemeProvider defaultTheme="light">
      <SelectWorkspaceContent />
    </ThemeProvider>
  );
}
