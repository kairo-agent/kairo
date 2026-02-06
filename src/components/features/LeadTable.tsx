'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Lead,
  LeadStatus,
  LEAD_STATUS_CONFIG,
  LEAD_TEMPERATURE_CONFIG,
  LEAD_CHANNEL_CONFIG,
} from '@/types';
import { cn, formatCurrency, formatRelativeTime } from '@/lib/utils';

// ============================================
// SVG Icons
// ============================================

const CheckIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);

const ChevronUpIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const EyeIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const ChevronDownSmallIcon = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const UsersIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const XIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

// ============================================
// Types
// ============================================

type SortField = 'name' | 'businessName' | 'status' | 'temperature' | 'estimatedValue' | 'lastContactAt';
type SortDirection = 'asc' | 'desc';

interface LeadTableProps {
  leads: Lead[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onLeadClick: (lead: Lead) => void;
  onStatusChange: (lead: Lead, status: LeadStatus) => void;
}

// ============================================
// Checkbox Component
// ============================================

interface CheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  className?: string;
}

function Checkbox({ checked, indeterminate = false, onChange, className }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className={cn(
        'w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-150',
        checked || indeterminate
          ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)] text-[var(--kairo-midnight)]'
          : 'border-[var(--border-secondary)] bg-transparent hover:border-[var(--accent-primary)]',
        className
      )}
    >
      {checked && <CheckIcon />}
      {indeterminate && !checked && (
        <div className="w-2 h-0.5 bg-[var(--kairo-midnight)] rounded-full" />
      )}
    </button>
  );
}

// ============================================
// Sortable Header Component
// ============================================

interface SortableHeaderProps {
  label: string;
  field: SortField;
  currentSort: SortField | null;
  direction: SortDirection;
  onSort: (field: SortField) => void;
  className?: string;
}

function SortableHeader({ label, field, currentSort, direction, onSort, className }: SortableHeaderProps) {
  const isActive = currentSort === field;

  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className={cn(
        'flex items-center gap-1 text-left font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors',
        isActive && 'text-[var(--accent-primary)]',
        className
      )}
    >
      <span>{label}</span>
      <span className={cn('transition-opacity', isActive ? 'opacity-100' : 'opacity-0')}>
        {direction === 'asc' ? <ChevronUpIcon /> : <ChevronDownIcon />}
      </span>
    </button>
  );
}

// ============================================
// Status Dropdown Component
// ============================================

interface StatusDropdownProps {
  lead: Lead;
  onStatusChange: (lead: Lead, status: LeadStatus) => void;
}

function StatusDropdown({ lead, onStatusChange }: StatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const statusConfig = LEAD_STATUS_CONFIG[lead.status];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-1 hover:opacity-80 transition-opacity"
      >
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: statusConfig.color }}
        />
        <ChevronDownSmallIcon />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-36 bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg shadow-lg overflow-hidden z-30">
          <div className="py-1">
            {Object.entries(LEAD_STATUS_CONFIG).map(([status, config]) => (
              <button
                key={status}
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange(lead, status as LeadStatus);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-[var(--bg-tertiary)] transition-colors',
                  lead.status === status && 'bg-[var(--bg-tertiary)]'
                )}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: config.color }}
                />
                <span className="text-[var(--text-primary)]">{config.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Batch Actions Bar Component
// ============================================

interface BatchActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onChangeStatus: () => void;
  onAssignAgent: () => void;
  onDelete: () => void;
}

function BatchActionsBar({
  selectedCount,
  onClearSelection,
  onChangeStatus,
  onAssignAgent,
  onDelete,
}: BatchActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
      <div className="flex items-center gap-3 px-4 py-3 bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl shadow-xl">
        {/* Selection count */}
        <div className="flex items-center gap-2 pr-3 border-r border-[var(--border-primary)]">
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {selectedCount} seleccionado{selectedCount > 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={onClearSelection}
            className="p-1 rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors"
            title="Limpiar seleccion"
          >
            <XIcon />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onChangeStatus}
            className="text-xs"
          >
            <RefreshIcon />
            <span className="hidden sm:inline">Cambiar estado</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onAssignAgent}
            className="text-xs"
          >
            <UsersIcon />
            <span className="hidden sm:inline">Asignar agente</span>
          </Button>

          <Button
            variant="danger"
            size="sm"
            onClick={onDelete}
            className="text-xs"
          >
            <TrashIcon />
            <span className="hidden sm:inline">Eliminar</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main LeadTable Component
// ============================================

export function LeadTable({
  leads,
  selectedIds,
  onSelectionChange,
  onLeadClick,
  onStatusChange,
}: LeadTableProps) {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Derived state
  const allSelected = leads.length > 0 && selectedIds.length === leads.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < leads.length;

  // Sort leads
  const sortedLeads = useMemo(() => {
    if (!sortField) return leads;

    return [...leads].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
          break;
        case 'businessName':
          comparison = (a.businessName || '').localeCompare(b.businessName || '');
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'temperature':
          const tempOrder = { hot: 3, warm: 2, cold: 1 };
          comparison = (tempOrder[a.temperature] || 0) - (tempOrder[b.temperature] || 0);
          break;
        case 'estimatedValue':
          comparison = (a.estimatedValue || 0) - (b.estimatedValue || 0);
          break;
        case 'lastContactAt':
          const dateA = a.lastContactAt ? new Date(a.lastContactAt).getTime() : 0;
          const dateB = b.lastContactAt ? new Date(b.lastContactAt).getTime() : 0;
          comparison = dateA - dateB;
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [leads, sortField, sortDirection]);

  // Handlers
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = () => {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(leads.map(lead => lead.id));
    }
  };

  const handleSelectRow = (leadId: string) => {
    if (selectedIds.includes(leadId)) {
      onSelectionChange(selectedIds.filter(id => id !== leadId));
    } else {
      onSelectionChange([...selectedIds, leadId]);
    }
  };

  const handleRowClick = (lead: Lead, e: React.MouseEvent) => {
    // If clicking on action elements, don't trigger row selection
    if ((e.target as HTMLElement).closest('[data-action]')) {
      return;
    }
    handleSelectRow(lead.id);
  };

  // Batch action handlers (can be customized by parent)
  const handleBatchChangeStatus = () => {
    // This would typically open a modal - implement as needed
    console.log('Batch change status for:', selectedIds);
  };

  const handleBatchAssignAgent = () => {
    // This would typically open a modal - implement as needed
    console.log('Batch assign agent for:', selectedIds);
  };

  const handleBatchDelete = () => {
    // This would typically open a confirmation modal - implement as needed
    console.log('Batch delete:', selectedIds);
  };

  return (
    <div className="relative">
      {/* Table Container with horizontal scroll on mobile */}
      <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)]">
        <table className="w-full min-w-[800px]">
          {/* Table Header */}
          <thead className="sticky top-0 z-10 bg-[var(--bg-tertiary)]">
            <tr>
              {/* Checkbox column */}
              <th className="w-12 px-4 py-3 text-left">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={handleSelectAll}
                />
              </th>

              {/* Name - sticky on mobile */}
              <th className="px-4 py-3 text-left sticky left-0 bg-[var(--bg-tertiary)] z-20 min-w-[180px]">
                <SortableHeader
                  label="Nombre"
                  field="name"
                  currentSort={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </th>

              {/* Business - hidden on mobile */}
              <th className="px-4 py-3 text-left hidden md:table-cell">
                <SortableHeader
                  label="Empresa"
                  field="businessName"
                  currentSort={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </th>

              {/* Status */}
              <th className="px-4 py-3 text-left">
                <SortableHeader
                  label="Estado"
                  field="status"
                  currentSort={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </th>

              {/* Potential */}
              <th className="px-4 py-3 text-left">
                <SortableHeader
                  label="Potencial"
                  field="temperature"
                  currentSort={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </th>

              {/* Channel - hidden on mobile */}
              <th className="px-4 py-3 text-left hidden md:table-cell">
                <span className="font-medium text-[var(--text-secondary)]">Canal</span>
              </th>

              {/* Value */}
              <th className="px-4 py-3 text-left">
                <SortableHeader
                  label="Valor"
                  field="estimatedValue"
                  currentSort={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </th>

              {/* Last Contact */}
              <th className="px-4 py-3 text-left hidden lg:table-cell">
                <SortableHeader
                  label="Ultimo contacto"
                  field="lastContactAt"
                  currentSort={sortField}
                  direction={sortDirection}
                  onSort={handleSort}
                />
              </th>

              {/* Actions */}
              <th className="w-24 px-4 py-3 text-center">
                <span className="font-medium text-[var(--text-secondary)]">Acciones</span>
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-[var(--border-primary)]">
            {sortedLeads.map((lead, index) => {
              const isSelected = selectedIds.includes(lead.id);
              const statusConfig = LEAD_STATUS_CONFIG[lead.status];
              const temperatureConfig = LEAD_TEMPERATURE_CONFIG[lead.temperature];
              const channelConfig = LEAD_CHANNEL_CONFIG[lead.channel];
              const fullName = `${lead.firstName} ${lead.lastName}`.trim();

              return (
                <tr
                  key={lead.id}
                  onClick={(e) => handleRowClick(lead, e)}
                  className={cn(
                    'cursor-pointer transition-colors',
                    // Zebra striping
                    index % 2 === 0 ? 'bg-[var(--bg-card)]' : 'bg-[var(--bg-secondary)]/30',
                    // Hover state
                    'hover:bg-[var(--accent-primary-light)]',
                    // Selected state
                    isSelected && 'bg-[var(--accent-primary-light)] hover:bg-[var(--accent-primary-light)]'
                  )}
                >
                  {/* Checkbox */}
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={isSelected}
                      onChange={() => handleSelectRow(lead.id)}
                    />
                  </td>

                  {/* Name - sticky on mobile */}
                  <td className={cn(
                    'px-4 py-3 sticky left-0 z-10',
                    index % 2 === 0 ? 'bg-[var(--bg-card)]' : 'bg-[var(--bg-secondary)]/30',
                    isSelected && 'bg-[var(--accent-primary-light)]'
                  )}>
                    <div className="min-w-[150px]">
                      <div className="font-medium text-[var(--text-primary)] truncate">
                        {fullName}
                      </div>
                      {/* Show business on mobile as subtitle */}
                      {lead.businessName && (
                        <div className="text-xs text-[var(--text-secondary)] truncate md:hidden">
                          {lead.businessName}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Business - hidden on mobile */}
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-sm text-[var(--text-secondary)] truncate block max-w-[150px]">
                      {lead.businessName || '-'}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {lead.archivedAt && (
                        <Badge
                          variant="custom"
                          customColor="#9CA3AF"
                          customBgColor="rgba(156, 163, 175, 0.15)"
                          size="sm"
                        >
                          Archivado
                        </Badge>
                      )}
                      <Badge
                        variant="custom"
                        customColor={statusConfig.color}
                        customBgColor={statusConfig.bgColor}
                        size="sm"
                      >
                        {statusConfig.label}
                      </Badge>
                    </div>
                  </td>

                  {/* Temperature */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm" role="img" aria-label={temperatureConfig.label}>
                        {temperatureConfig.icon}
                      </span>
                      <span
                        className="text-xs font-medium hidden sm:inline"
                        style={{ color: temperatureConfig.color }}
                      >
                        {temperatureConfig.label}
                      </span>
                    </div>
                  </td>

                  {/* Channel - hidden on mobile */}
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm" role="img" aria-label={channelConfig.label}>
                        {channelConfig.icon}
                      </span>
                      <span className="text-xs text-[var(--text-secondary)] hidden lg:inline">
                        {channelConfig.label}
                      </span>
                    </div>
                  </td>

                  {/* Value */}
                  <td className="px-4 py-3">
                    <span className={cn(
                      'text-sm font-medium',
                      lead.estimatedValue && lead.estimatedValue > 0
                        ? 'text-emerald-500'
                        : 'text-[var(--text-tertiary)]'
                    )}>
                      {lead.estimatedValue && lead.estimatedValue > 0
                        ? formatCurrency(lead.estimatedValue)
                        : '-'}
                    </span>
                  </td>

                  {/* Last Contact - hidden on mobile */}
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-[var(--text-secondary)]">
                      {lead.lastContactAt
                        ? formatRelativeTime(lead.lastContactAt)
                        : '-'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3" data-action="true">
                    <div className="flex items-center justify-center gap-2">
                      {/* View button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onLeadClick(lead);
                        }}
                        className="p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                        title="Ver detalles"
                      >
                        <EyeIcon />
                      </button>

                      {/* Status change dropdown */}
                      <StatusDropdown lead={lead} onStatusChange={onStatusChange} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Empty state */}
        {leads.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-[var(--text-secondary)]">No hay leads para mostrar</p>
          </div>
        )}
      </div>

      {/* Batch Actions Bar */}
      <BatchActionsBar
        selectedCount={selectedIds.length}
        onClearSelection={() => onSelectionChange([])}
        onChangeStatus={handleBatchChangeStatus}
        onAssignAgent={handleBatchAssignAgent}
        onDelete={handleBatchDelete}
      />
    </div>
  );
}

// Export type for external use
export type { LeadTableProps };
