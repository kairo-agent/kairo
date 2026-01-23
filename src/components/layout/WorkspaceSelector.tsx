'use client';

// ============================================
// KAIRO - Workspace Selector Component
// Organization and Project dropdowns for sidebar
// ============================================

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useLoading } from '@/contexts/LoadingContext';
import { getOrganizations, getProjects } from '@/lib/actions/workspace';
import { cn } from '@/lib/utils';

// Icons
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

const BuildingIcon = () => (
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
    width="16"
    height="16"
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

interface DropdownProps {
  label: string;
  icon: React.ReactNode;
  value: string;
  options: Array<{ id: string; name: string }>;
  onChange: (id: string | null) => void;
  placeholder: string;
  allOption?: string;
  disabled?: boolean;
  isLoading?: boolean;
}

function Dropdown({
  label,
  icon,
  value,
  options,
  onChange,
  placeholder,
  allOption,
  disabled,
  isLoading,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.id === value);
  const displayValue = selectedOption?.name || (value === 'all' ? allOption : placeholder);

  return (
    <div ref={dropdownRef} className="relative">
      <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1 px-1">
        {label}
      </label>
      <button
        type="button"
        disabled={disabled || isLoading}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 rounded-lg',
          'bg-[var(--bg-tertiary)] border border-[var(--border-primary)]',
          'text-sm text-left',
          'transition-all duration-200',
          disabled || isLoading
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:border-[var(--accent-primary)] cursor-pointer',
          isOpen && 'border-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)]'
        )}
      >
        <span className="text-[var(--text-tertiary)]">{icon}</span>
        <span
          className={cn(
            'flex-1 truncate',
            selectedOption || value === 'all'
              ? 'text-[var(--text-primary)]'
              : 'text-[var(--text-tertiary)]'
          )}
        >
          {isLoading ? '...' : displayValue}
        </span>
        <span
          className={cn(
            'text-[var(--text-tertiary)] transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        >
          <ChevronDownIcon />
        </span>
      </button>

      {/* Dropdown menu */}
      {isOpen && !disabled && !isLoading && (
        <div
          className={cn(
            'absolute top-full left-0 right-0 mt-1 z-50',
            'bg-[var(--bg-secondary)] border border-[var(--border-primary)]',
            'rounded-lg shadow-lg overflow-hidden',
            'max-h-48 overflow-y-auto'
          )}
        >
          {/* All option */}
          {allOption && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setIsOpen(false);
              }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2',
                'text-sm text-left',
                'transition-colors duration-150',
                value === 'all' || !value
                  ? 'bg-[var(--accent-primary-light)] text-[var(--accent-primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              )}
            >
              <span className="flex-1">{allOption}</span>
              {(value === 'all' || !value) && <CheckIcon />}
            </button>
          )}

          {/* Options */}
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                onChange(option.id);
                setIsOpen(false);
              }}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2',
                'text-sm text-left',
                'transition-colors duration-150',
                value === option.id
                  ? 'bg-[var(--accent-primary-light)] text-[var(--accent-primary)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              )}
            >
              <span className="flex-1 truncate">{option.name}</span>
              {value === option.id && <CheckIcon />}
            </button>
          ))}

          {/* Empty state */}
          {options.length === 0 && !allOption && (
            <div className="px-3 py-2 text-sm text-[var(--text-tertiary)] text-center">
              Sin opciones
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function WorkspaceSelector() {
  const t = useTranslations('workspace');
  const tCommon = useTranslations('common');
  const { showLoading, hideLoading } = useLoading();
  const {
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
  } = useWorkspace();

  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  // Fetch organizations on mount (only if not already loaded from server)
  useEffect(() => {
    async function fetchOrganizations() {
      // Skip fetch if organizations are already loaded (from server-side prefetch)
      if (organizations.length > 0) {
        setIsLoading(false);
        // If no org selected but we have orgs, select the first one
        if (!selectedOrganization && organizations.length > 0) {
          setSelectedOrganization(organizations[0]);
        }
        return;
      }

      setIsLoading(true);
      try {
        const orgs = await getOrganizations();
        setOrganizations(orgs);

        // If no org selected but we have orgs, select the first one
        if (!selectedOrganization && orgs.length > 0) {
          setSelectedOrganization(orgs[0]);
        }
      } catch (error) {
        console.error('Error fetching organizations:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrganizations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch projects when organization changes
  useEffect(() => {
    async function fetchProjects() {
      if (!selectedOrganization) {
        setProjects([]);
        return;
      }

      setIsLoadingProjects(true);
      try {
        const projs = await getProjects(selectedOrganization.id);
        setProjects(projs);
      } catch (error) {
        console.error('Error fetching projects:', error);
      } finally {
        setIsLoadingProjects(false);
      }
    }

    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrganization?.id]);

  const handleOrganizationChange = (id: string | null) => {
    if (!id) return; // Organization is required
    const org = organizations.find((o) => o.id === id);
    if (org) {
      showLoading(tCommon('messages.loading'));
      setSelectedOrganization(org);
      // Loading will be hidden by the page when data is loaded
    }
  };

  const handleProjectChange = (id: string | null) => {
    showLoading(tCommon('messages.loading'));
    if (!id) {
      setSelectedProject(null); // "All projects"
    } else {
      const project = projects.find((p) => p.id === id);
      if (project) {
        setSelectedProject(project);
      }
    }
    // Loading will be hidden by the page when data is loaded
  };

  // Don't render if no organizations
  if (!isLoading && organizations.length === 0) {
    return null;
  }

  return (
    <div className="px-3 py-3 space-y-3 border-b border-[var(--border-primary)]">
      {/* Organization Selector */}
      <Dropdown
        label={t('organization')}
        icon={<BuildingIcon />}
        value={selectedOrganization?.id || ''}
        options={organizations}
        onChange={handleOrganizationChange}
        placeholder={t('selectOrganization')}
        isLoading={isLoading}
      />

      {/* Project Selector */}
      <Dropdown
        label={t('project')}
        icon={<FolderIcon />}
        value={selectedProject?.id || 'all'}
        options={projects}
        onChange={handleProjectChange}
        placeholder={t('selectProject')}
        allOption={t('allProjects')}
        disabled={!selectedOrganization}
        isLoading={isLoadingProjects}
      />
    </div>
  );
}

export default WorkspaceSelector;
