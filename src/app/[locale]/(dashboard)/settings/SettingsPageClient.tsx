'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { cn } from '@/lib/utils';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal, AlertModal } from '@/components/ui/Modal';
import { getProjectAgents, saveAgentInstructions, getAgentInstructions } from '@/lib/actions/agents';
import { getAllStructuredKnowledge, upsertStructuredKnowledge, addAgentKnowledge, listAgentKnowledge, deleteAgentKnowledge } from '@/lib/actions/knowledge';
import type { PromptStructure, TemperatureCriteria } from '@/lib/knowledge/prompt-builder';
import { EMPTY_PROMPT_STRUCTURE } from '@/lib/knowledge/prompt-builder';
import type { AIAgentData } from '@/lib/actions/agents';
import type { KnowledgeEntry } from '@/lib/actions/knowledge';
import { BusinessHoursForm } from '@/components/knowledge/BusinessHoursForm';
import { FAQsForm } from '@/components/knowledge/FAQsForm';
import { PricingForm } from '@/components/knowledge/PricingForm';
import { LocationContactForm } from '@/components/knowledge/LocationContactForm';
import { PoliciesForm } from '@/components/knowledge/PoliciesForm';
import { getActiveGlobalRules } from '@/lib/actions/global-rules';
import { FlameIcon, SunIcon, SnowflakeIcon } from '@/components/icons/LeadIcons';
import { ExpandableTextarea } from '@/components/ui/ExpandableTextarea';
import { toast } from 'sonner';
import { DEFAULT_BUSINESS_HOURS, type BusinessHoursData } from '@/lib/knowledge/business-hours';
import { DEFAULT_FAQS, type FAQsData } from '@/lib/knowledge/faqs';
import { DEFAULT_PRICING, type PricingData } from '@/lib/knowledge/pricing';
import { DEFAULT_LOCATION_CONTACT, type LocationContactData } from '@/lib/knowledge/location-contact';
import { DEFAULT_POLICIES, type PoliciesData } from '@/lib/knowledge/policies';

// ============================================
// SVG Icons
// ============================================

const ClockIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-5 h-5', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const HelpCircleIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-5 h-5', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const DollarSignIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-5 h-5', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const MapPinIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-5 h-5', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const ShieldIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-5 h-5', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const PencilIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-4 h-4', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const CopyIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-4 h-4', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const TrashIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-4 h-4', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const PlusIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-4 h-4', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-4 h-4', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-4 h-4', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const XIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-4 h-4', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const GripVerticalIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-4 h-4', className)} fill="currentColor" viewBox="0 0 24 24">
    <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
    <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
    <circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
  </svg>
);

const DatabaseIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-5 h-5', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
  </svg>
);

const BotIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-5 h-5', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const FolderIcon = ({ className }: { className?: string }) => (
  <svg className={cn('w-16 h-16', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

// ============================================
// Types
// ============================================

type SettingsTab = 'instructions' | 'knowledge';
type KnowledgeModal = 'business_hours' | 'faqs' | 'pricing' | 'location_contact' | 'policies' | 'add_knowledge' | null;

interface StructuredKnowledgeMap {
  business_hours?: Record<string, unknown>;
  faqs?: Record<string, unknown>;
  pricing?: Record<string, unknown>;
  location_contact?: Record<string, unknown>;
  policies?: Record<string, unknown>;
}

// ============================================
// Main Component
// ============================================

export default function SettingsPageClient() {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const { selectedProject } = useWorkspace();

  // Agent state
  const [agents, setAgents] = useState<AIAgentData[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AIAgentData | null>(null);
  const [loadingAgents, setLoadingAgents] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<SettingsTab>('instructions');

  // Instructions state
  const [instructions, setInstructions] = useState<PromptStructure>({ ...EMPTY_PROMPT_STRUCTURE });
  const [originalInstructions, setOriginalInstructions] = useState<PromptStructure>({ ...EMPTY_PROMPT_STRUCTURE });
  const [savingInstructions, setSavingInstructions] = useState(false);
  const [loadingInstructions, setLoadingInstructions] = useState(false);

  // Rules editing state
  const [newRule, setNewRule] = useState('');
  const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);
  const [editingRuleText, setEditingRuleText] = useState('');

  // Additional instructions collapsible
  const [additionalOpen, setAdditionalOpen] = useState(false);

  // Global rules (read-only, fetched from admin)
  const [globalRules, setGlobalRules] = useState<string[]>([]);

  // Knowledge state
  const [structuredKnowledge, setStructuredKnowledge] = useState<StructuredKnowledgeMap>({});
  const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeEntry[]>([]);
  const [loadingKnowledge, setLoadingKnowledge] = useState(false);
  const [activeModal, setActiveModal] = useState<KnowledgeModal>(null);
  const [savingKnowledge, setSavingKnowledge] = useState(false);

  // Add knowledge modal state
  const [newKnowledgeTitle, setNewKnowledgeTitle] = useState('');
  const [newKnowledgeContent, setNewKnowledgeContent] = useState('');

  // Confirm clear rules dialog
  const [showClearRulesConfirm, setShowClearRulesConfirm] = useState(false);

  // Confirm delete knowledge entry
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);

  // Edit knowledge entry
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  // Track if we have unsaved changes
  const hasUnsavedChanges = JSON.stringify(instructions) !== JSON.stringify(originalInstructions);

  // Ref for new rule input
  const newRuleInputRef = useRef<HTMLInputElement>(null);

  // ============================================
  // Data Loading
  // ============================================

  const loadAgents = useCallback(async () => {
    if (!selectedProject) return;
    setLoadingAgents(true);
    try {
      const result = await getProjectAgents(selectedProject.id);
      if (result.success && result.agents) {
        setAgents(result.agents);
        // Auto-select active agent, or first one
        const active = result.agents.find((a) => a.isActive) || result.agents[0] || null;
        setSelectedAgent(active);
        return active;
      }
    } catch {
      toast.error(tCommon('messages.error'));
    } finally {
      setLoadingAgents(false);
    }
    return null;
  }, [selectedProject, tCommon]);

  const loadInstructions = useCallback(async () => {
    if (!selectedAgent) return;
    setLoadingInstructions(true);
    try {
      const result = await getAgentInstructions(selectedAgent.id);
      if (result.success && result.data) {
        const ps = result.data.promptStructure;
        if (ps) {
          setInstructions(ps);
          setOriginalInstructions(ps);
          if (ps.additionalInstructions) {
            setAdditionalOpen(true);
          }
        } else {
          // No structured data yet, start fresh with default name 'Kaira'
          const fresh = { ...EMPTY_PROMPT_STRUCTURE };
          setInstructions(fresh);
          setOriginalInstructions(fresh);
        }
      }
    } catch {
      toast.error(tCommon('messages.error'));
    } finally {
      setLoadingInstructions(false);
    }
  }, [selectedAgent, tCommon]);

  const loadKnowledge = useCallback(async () => {
    if (!selectedAgent || !selectedProject) return;
    setLoadingKnowledge(true);
    try {
      const [structuredResult, entriesResult] = await Promise.all([
        getAllStructuredKnowledge(selectedAgent.id, selectedProject.id),
        listAgentKnowledge(selectedAgent.id, selectedProject.id),
      ]);

      if (structuredResult.success && structuredResult.data) {
        const map: StructuredKnowledgeMap = {};
        for (const entry of structuredResult.data) {
          if (entry.category && entry.structuredData) {
            map[entry.category as keyof StructuredKnowledgeMap] = entry.structuredData;
          }
        }
        setStructuredKnowledge(map);
      }

      if (entriesResult.success && entriesResult.data) {
        // Filter out structured entries from free-text list
        const freeText = entriesResult.data.filter(
          (e) => e.source === 'manual' || e.source === 'file' || e.source === 'url' || e.source === 'api'
        );
        setKnowledgeEntries(freeText);
      }
    } catch {
      toast.error(tCommon('messages.error'));
    } finally {
      setLoadingKnowledge(false);
    }
  }, [selectedAgent, selectedProject, tCommon]);

  // Tracks the agent ID whose data was prefetched during initial load,
  // so the agent-change useEffect skips the redundant fetch.
  const prefetchedAgentId = useRef<string | null>(null);

  // Unified initial load: agents + global rules in parallel,
  // then immediately load instructions + knowledge for the active agent
  // without waiting for a React re-render cycle (eliminates waterfall).
  useEffect(() => {
    if (!selectedProject) {
      setAgents([]);
      setSelectedAgent(null);
      prefetchedAgentId.current = null;
      return;
    }
    const loadAll = async () => {
      // Phase 1: agents + global rules in parallel
      const [agent] = await Promise.all([
        loadAgents(),
        getActiveGlobalRules().then(setGlobalRules).catch(() => setGlobalRules([])),
      ]);
      // Phase 2: instructions + knowledge in parallel (no re-render needed)
      if (agent) {
        prefetchedAgentId.current = agent.id;
        setLoadingInstructions(true);
        setLoadingKnowledge(true);
        const loadInstructionsForAgent = async () => {
          try {
            const result = await getAgentInstructions(agent.id);
            if (result.success && result.data) {
              const ps = result.data.promptStructure;
              if (ps) {
                setInstructions(ps);
                setOriginalInstructions(ps);
                if (ps.additionalInstructions) {
                  setAdditionalOpen(true);
                }
              } else {
                const fresh = { ...EMPTY_PROMPT_STRUCTURE };
                setInstructions(fresh);
                setOriginalInstructions(fresh);
              }
            }
          } catch {
            toast.error(tCommon('messages.error'));
          } finally {
            setLoadingInstructions(false);
          }
        };
        const loadKnowledgeForAgent = async () => {
          try {
            const [structuredResult, entriesResult] = await Promise.all([
              getAllStructuredKnowledge(agent.id, selectedProject.id),
              listAgentKnowledge(agent.id, selectedProject.id),
            ]);
            if (structuredResult.success && structuredResult.data) {
              const map: StructuredKnowledgeMap = {};
              for (const entry of structuredResult.data) {
                if (entry.category && entry.structuredData) {
                  map[entry.category as keyof StructuredKnowledgeMap] = entry.structuredData;
                }
              }
              setStructuredKnowledge(map);
            }
            if (entriesResult.success && entriesResult.data) {
              const freeText = entriesResult.data.filter(
                (e) => e.source === 'manual' || e.source === 'file' || e.source === 'url' || e.source === 'api'
              );
              setKnowledgeEntries(freeText);
            }
          } catch {
            toast.error(tCommon('messages.error'));
          } finally {
            setLoadingKnowledge(false);
          }
        };
        await Promise.all([loadInstructionsForAgent(), loadKnowledgeForAgent()]);
      }
    };
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject]);

  // Load data when agent changes (user manually switches agent after initial load).
  // Skips if this agent's data was already prefetched in the unified initial load.
  useEffect(() => {
    if (selectedAgent && prefetchedAgentId.current === selectedAgent.id) {
      // Data already loaded by the initial load - clear the flag and skip
      prefetchedAgentId.current = null;
      return;
    }
    if (selectedAgent) {
      loadInstructions();
      loadKnowledge();
    } else {
      setInstructions({ ...EMPTY_PROMPT_STRUCTURE });
      setOriginalInstructions({ ...EMPTY_PROMPT_STRUCTURE });
      setStructuredKnowledge({});
      setKnowledgeEntries([]);
    }
  }, [selectedAgent, loadInstructions, loadKnowledge]);

  // ============================================
  // Instructions Handlers
  // ============================================

  const handleSaveInstructions = async () => {
    if (!selectedAgent) return;
    setSavingInstructions(true);
    try {
      const result = await saveAgentInstructions(selectedAgent.id, instructions);
      if (result.success) {
        setOriginalInstructions({ ...instructions });
        toast.success(t('instructions.saveSuccess'));
      } else {
        toast.error(result.error || t('instructions.saveError'));
      }
    } catch {
      toast.error(t('instructions.saveError'));
    } finally {
      setSavingInstructions(false);
    }
  };

  const handleAddRule = () => {
    const trimmed = newRule.trim();
    if (!trimmed || instructions.rules.length >= 50) return;
    setInstructions((prev) => ({ ...prev, rules: [...prev.rules, trimmed] }));
    setNewRule('');
    newRuleInputRef.current?.focus();
  };

  const handleDeleteRule = (index: number) => {
    setInstructions((prev) => ({
      ...prev,
      rules: prev.rules.filter((_, i) => i !== index),
    }));
  };

  const handleDuplicateRule = (index: number) => {
    if (instructions.rules.length >= 50) return;
    setInstructions((prev) => ({
      ...prev,
      rules: [...prev.rules.slice(0, index + 1), prev.rules[index], ...prev.rules.slice(index + 1)],
    }));
  };

  const handleReorderRules = (oldIndex: number, newIndex: number) => {
    setInstructions((prev) => ({
      ...prev,
      rules: arrayMove(prev.rules, oldIndex, newIndex),
    }));
  };

  const handleEditRuleSave = () => {
    if (editingRuleIndex === null) return;
    const trimmed = editingRuleText.trim();
    if (!trimmed) return;
    setInstructions((prev) => ({
      ...prev,
      rules: prev.rules.map((r, i) => (i === editingRuleIndex ? trimmed : r)),
    }));
    setEditingRuleIndex(null);
    setEditingRuleText('');
  };

  const handleClearAllRules = () => {
    setInstructions((prev) => ({ ...prev, rules: [] }));
    setShowClearRulesConfirm(false);
  };

  // ============================================
  // Knowledge Handlers
  // ============================================

  const handleStructuredKnowledgeSave = async (
    category: string,
    data: Record<string, unknown>,
  ) => {
    if (!selectedAgent || !selectedProject) return;
    setSavingKnowledge(true);
    try {
      const result = await upsertStructuredKnowledge({
        agentId: selectedAgent.id,
        projectId: selectedProject.id,
        category: category as 'business_hours' | 'faqs' | 'pricing' | 'location_contact' | 'policies',
        structuredData: data,
      });
      if (result.success) {
        setStructuredKnowledge((prev) => ({ ...prev, [category]: data }));
        setActiveModal(null);
        toast.success(t('knowledge.saveSuccess'));
      } else {
        toast.error(result.error || t('knowledge.saveError'));
      }
    } catch {
      toast.error(t('knowledge.saveError'));
    } finally {
      setSavingKnowledge(false);
    }
  };

  // handleAddFreeKnowledge merged into handleSaveKnowledge (supports both add and edit)

  const handleEditKnowledgeEntry = (entry: KnowledgeEntry) => {
    setEditingEntryId(entry.id);
    setNewKnowledgeTitle(entry.title || '');
    setNewKnowledgeContent(entry.content);
    setActiveModal('add_knowledge');
  };

  const handleSaveKnowledge = async () => {
    if (!selectedAgent || !selectedProject || !newKnowledgeContent.trim()) return;
    setSavingKnowledge(true);
    try {
      // If editing, delete old entry first
      if (editingEntryId) {
        const deleteResult = await deleteAgentKnowledge(editingEntryId, selectedProject.id);
        if (!deleteResult.success) {
          toast.error(deleteResult.error || t('knowledge.saveError'));
          return;
        }
      }

      const result = await addAgentKnowledge({
        agentId: selectedAgent.id,
        projectId: selectedProject.id,
        title: newKnowledgeTitle.trim() || undefined,
        content: newKnowledgeContent.trim(),
        source: 'manual',
      });
      if (result.success) {
        setActiveModal(null);
        setNewKnowledgeTitle('');
        setNewKnowledgeContent('');
        setEditingEntryId(null);
        toast.success(t('knowledge.saveSuccess'));
        loadKnowledge();
      } else {
        toast.error(result.error || t('knowledge.saveError'));
      }
    } catch {
      toast.error(t('knowledge.saveError'));
    } finally {
      setSavingKnowledge(false);
    }
  };

  const handleDeleteKnowledgeEntry = async () => {
    if (!deletingEntryId || !selectedProject) return;
    try {
      const result = await deleteAgentKnowledge(deletingEntryId, selectedProject.id);
      if (result.success) {
        setKnowledgeEntries((prev) => prev.filter((e) => e.id !== deletingEntryId));
        toast.success(t('knowledge.deleteSuccess'));
      } else {
        toast.error(result.error || t('knowledge.deleteError'));
      }
    } catch {
      toast.error(t('knowledge.deleteError'));
    } finally {
      setDeletingEntryId(null);
    }
  };

  // ============================================
  // Render: No project selected
  // ============================================

  if (!selectedProject) {
    return (
      <div className="flex-1 p-4 sm:p-6 lg:p-8">
        <div>
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FolderIcon className="text-[var(--text-tertiary)] mb-4" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{t('noProject')}</h2>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // Render: Loading agents
  // ============================================

  if (loadingAgents) {
    return (
      <div className="flex-1 p-4 sm:p-6 lg:p-8">
        <div>
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-primary)]" />
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // Render: No agents
  // ============================================

  if (agents.length === 0) {
    return (
      <div className="flex-1 p-4 sm:p-6 lg:p-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">{t('title')}</h1>
          <p className="text-sm text-[var(--text-secondary)] mb-8">{t('subtitle')}</p>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BotIcon className="w-12 h-12 text-[var(--text-tertiary)] mb-4" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{t('noAgents')}</h2>
            <p className="text-sm text-[var(--text-secondary)] max-w-md">{t('noAgentsMessage')}</p>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // Knowledge section cards config
  // ============================================

  const knowledgeSections: Array<{
    key: string;
    icon: React.ReactNode;
    titleKey: string;
    descKey: string;
    modal: KnowledgeModal;
  }> = [
    { key: 'business_hours', icon: <ClockIcon className="w-5 h-5 text-[var(--accent-primary)]" />, titleKey: 'knowledge.businessHours', descKey: 'knowledge.businessHoursDesc', modal: 'business_hours' },
    { key: 'faqs', icon: <HelpCircleIcon className="w-5 h-5 text-[var(--accent-primary)]" />, titleKey: 'knowledge.faqs', descKey: 'knowledge.faqsDesc', modal: 'faqs' },
    { key: 'pricing', icon: <DollarSignIcon className="w-5 h-5 text-[var(--accent-primary)]" />, titleKey: 'knowledge.pricing', descKey: 'knowledge.pricingDesc', modal: 'pricing' },
    { key: 'location_contact', icon: <MapPinIcon className="w-5 h-5 text-[var(--accent-primary)]" />, titleKey: 'knowledge.location', descKey: 'knowledge.locationDesc', modal: 'location_contact' },
    { key: 'policies', icon: <ShieldIcon className="w-5 h-5 text-[var(--accent-primary)]" />, titleKey: 'knowledge.policies', descKey: 'knowledge.policiesDesc', modal: 'policies' },
  ];

  // ============================================
  // Main Render
  // ============================================

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8">
      <div>
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">{t('title')}</h1>
          <p className="text-sm text-[var(--text-secondary)]">{t('subtitle')}</p>
        </div>

        {/* Agent Selector */}
        {agents.length > 1 ? (
          <div className="mb-6">
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              {t('selectAgent')}
            </label>
            <div className="flex flex-wrap gap-2">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border',
                    selectedAgent?.id === agent.id
                      ? 'bg-[var(--accent-primary)] text-[var(--kairo-midnight)] border-[var(--accent-primary)]'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-primary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]'
                  )}
                >
                  <span className="flex items-center gap-2">
                    <BotIcon className="w-4 h-4" />
                    {agent.name}
                    {agent.isActive && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-green-500/10 text-green-600 dark:text-green-400">
                        {t('activeAgent')}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          selectedAgent && (
            <div className="mb-6 flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
                <BotIcon className="w-4 h-4 text-[var(--accent-primary)]" />
                <span className="text-sm font-medium text-[var(--text-primary)]">{selectedAgent.name}</span>
                {selectedAgent.isActive && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-green-500/10 text-green-600 dark:text-green-400">
                    {t('activeAgent')}
                  </span>
                )}
              </div>
            </div>
          )
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-[var(--border-primary)]">
          {(['instructions', 'knowledge'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium transition-all duration-200 border-b-2 -mb-[1px]',
                activeTab === tab
                  ? 'text-[var(--accent-primary)] border-[var(--accent-primary)]'
                  : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)] hover:border-[var(--border-primary)]'
              )}
            >
              {t(`tabs.${tab}`)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'instructions' && (
          <InstructionsTab
            t={t}
            tCommon={tCommon}
            instructions={instructions}
            setInstructions={setInstructions}
            loading={loadingInstructions}
            saving={savingInstructions}
            hasUnsavedChanges={hasUnsavedChanges}
            onSave={handleSaveInstructions}
            newRule={newRule}
            setNewRule={setNewRule}
            newRuleInputRef={newRuleInputRef}
            onAddRule={handleAddRule}
            onDeleteRule={handleDeleteRule}
            onDuplicateRule={handleDuplicateRule}
            onReorderRules={handleReorderRules}
            editingRuleIndex={editingRuleIndex}
            editingRuleText={editingRuleText}
            onStartEditRule={(i) => {
              setEditingRuleIndex(i);
              setEditingRuleText(instructions.rules[i]);
            }}
            onEditRuleSave={handleEditRuleSave}
            onCancelEditRule={() => {
              setEditingRuleIndex(null);
              setEditingRuleText('');
            }}
            setEditingRuleText={setEditingRuleText}
            onClearAllRules={() => setShowClearRulesConfirm(true)}
            globalRules={globalRules}
            additionalOpen={additionalOpen}
            setAdditionalOpen={setAdditionalOpen}
          />
        )}

        {activeTab === 'knowledge' && (
          <KnowledgeTab
            t={t}
            tCommon={tCommon}
            sections={knowledgeSections}
            structuredKnowledge={structuredKnowledge}
            knowledgeEntries={knowledgeEntries}
            loading={loadingKnowledge}
            onOpenModal={setActiveModal}
            onDeleteEntry={setDeletingEntryId}
            onEditEntry={handleEditKnowledgeEntry}
          />
        )}
      </div>

      {/* Knowledge Modals */}
      {activeModal === 'business_hours' && (
        <Modal isOpen onClose={() => setActiveModal(null)} title={t('businessHoursForm.title')} size="2xl">
          <BusinessHoursForm
            data={(structuredKnowledge.business_hours as unknown as BusinessHoursData) || DEFAULT_BUSINESS_HOURS}
            isSaving={savingKnowledge}
            onSave={async (data) => {
              await handleStructuredKnowledgeSave('business_hours', data as unknown as Record<string, unknown>);
            }}
            onCancel={() => setActiveModal(null)}
          />
        </Modal>
      )}

      {activeModal === 'faqs' && (
        <Modal isOpen onClose={() => setActiveModal(null)} title={t('faqsForm.title')} size="2xl">
          <FAQsForm
            data={(structuredKnowledge.faqs as unknown as FAQsData) || DEFAULT_FAQS}
            isSaving={savingKnowledge}
            onSave={async (data) => {
              await handleStructuredKnowledgeSave('faqs', data as unknown as Record<string, unknown>);
            }}
            onCancel={() => setActiveModal(null)}
          />
        </Modal>
      )}

      {activeModal === 'pricing' && (
        <Modal isOpen onClose={() => setActiveModal(null)} title={t('pricingForm.title')} size="2xl">
          <PricingForm
            data={(structuredKnowledge.pricing as unknown as PricingData) || DEFAULT_PRICING}
            isSaving={savingKnowledge}
            onSave={async (data) => {
              await handleStructuredKnowledgeSave('pricing', data as unknown as Record<string, unknown>);
            }}
            onCancel={() => setActiveModal(null)}
          />
        </Modal>
      )}

      {activeModal === 'location_contact' && (
        <Modal isOpen onClose={() => setActiveModal(null)} title={t('locationForm.title')} size="2xl">
          <LocationContactForm
            data={(structuredKnowledge.location_contact as unknown as LocationContactData) || DEFAULT_LOCATION_CONTACT}
            isSaving={savingKnowledge}
            onSave={async (data) => {
              await handleStructuredKnowledgeSave('location_contact', data as unknown as Record<string, unknown>);
            }}
            onCancel={() => setActiveModal(null)}
          />
        </Modal>
      )}

      {activeModal === 'policies' && (
        <Modal isOpen onClose={() => setActiveModal(null)} title={t('policiesForm.title')} size="2xl">
          <PoliciesForm
            data={(structuredKnowledge.policies as unknown as PoliciesData) || DEFAULT_POLICIES}
            isSaving={savingKnowledge}
            onSave={async (data) => {
              await handleStructuredKnowledgeSave('policies', data as unknown as Record<string, unknown>);
            }}
            onCancel={() => setActiveModal(null)}
          />
        </Modal>
      )}

      {/* Add/Edit Free Knowledge Modal */}
      {activeModal === 'add_knowledge' && (
        <Modal
          isOpen
          onClose={() => {
            setActiveModal(null);
            setEditingEntryId(null);
            setNewKnowledgeTitle('');
            setNewKnowledgeContent('');
          }}
          title={editingEntryId ? t('knowledge.editKnowledge') : t('knowledge.addKnowledge')}
          size="lg"
        >
          <div className="space-y-4">
            <Input
              label={t('knowledge.titleLabel')}
              value={newKnowledgeTitle}
              onChange={(e) => setNewKnowledgeTitle(e.target.value)}
              placeholder={t('knowledge.titlePlaceholder')}
              maxLength={200}
            />
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                {t('knowledge.contentLabel')}
              </label>
              <ExpandableTextarea
                value={newKnowledgeContent}
                onChange={setNewKnowledgeContent}
                placeholder={t('knowledge.contentPlaceholder')}
                rows={10}
                modalTitle={t('knowledge.contentLabel')}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => {
                setActiveModal(null);
                setEditingEntryId(null);
                setNewKnowledgeTitle('');
                setNewKnowledgeContent('');
              }}>
                {tCommon('buttons.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveKnowledge}
                isLoading={savingKnowledge}
                disabled={!newKnowledgeContent.trim()}
              >
                {savingKnowledge ? t('knowledge.processing') : tCommon('buttons.save')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Clear rules confirm */}
      <AlertModal
        isOpen={showClearRulesConfirm}
        onClose={() => setShowClearRulesConfirm(false)}
        type="confirm"
        title={t('instructions.clearAllRulesConfirm')}
        message={t('instructions.clearAllRulesMessage')}
        onConfirm={handleClearAllRules}
      />

      {/* Delete knowledge entry confirm */}
      <AlertModal
        isOpen={!!deletingEntryId}
        onClose={() => setDeletingEntryId(null)}
        type="confirm"
        title={t('knowledge.deleteEntryConfirm')}
        message={t('knowledge.deleteEntryMessage')}
        onConfirm={handleDeleteKnowledgeEntry}
      />
    </div>
  );
}

// ============================================
// Temperature Criteria Section
// ============================================

function TemperatureCriteriaLevel({
  label,
  help,
  placeholder,
  colorClass,
  icon,
  criteria,
  onChange,
}: {
  label: string;
  help: string;
  placeholder: string;
  colorClass: string;
  icon: React.ReactNode;
  criteria: string[];
  onChange: (criteria: string[]) => void;
}) {
  const [newCriteria, setNewCriteria] = useState('');

  const handleAdd = () => {
    const trimmed = newCriteria.trim();
    if (!trimmed || criteria.length >= 20) return;
    onChange([...criteria, trimmed]);
    setNewCriteria('');
  };

  return (
    <div className="rounded-lg border border-[var(--border-primary)] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-2">
          <span className={colorClass}>{icon}</span>
          <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>
          <span className="text-xs text-[var(--text-tertiary)]">({criteria.length})</span>
        </div>
        <p className="text-xs text-[var(--text-tertiary)] mt-0.5 ml-[24px]">{help}</p>
      </div>
      <div className="p-3 space-y-2">
        {/* Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newCriteria}
            onChange={(e) => setNewCriteria(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
            placeholder={placeholder}
            maxLength={300}
            className="flex-1 px-3 py-1.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-input)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent placeholder:text-[var(--text-tertiary)]"
          />
          <button
            onClick={handleAdd}
            disabled={!newCriteria.trim() || criteria.length >= 20}
            className="px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)] text-sm hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PlusIcon />
          </button>
        </div>
        {/* List */}
        {criteria.length > 0 && (
          <div className="space-y-1">
            {criteria.map((c, i) => (
              <div key={i} className="flex items-center gap-2 group px-2 py-1.5 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors">
                <span className="text-xs text-[var(--text-tertiary)] w-4 text-center">{i + 1}</span>
                <span className="flex-1 text-sm text-[var(--text-primary)]">{c}</span>
                <button
                  onClick={() => onChange(criteria.filter((_, idx) => idx !== i))}
                  className="p-1 text-[var(--text-tertiary)] hover:text-[var(--status-lost)] opacity-0 group-hover:opacity-100 transition-all"
                >
                  <XIcon />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TemperatureCriteriaSection({
  t,
  criteria,
  onChange,
}: {
  t: ReturnType<typeof useTranslations>;
  criteria: TemperatureCriteria;
  onChange: (criteria: TemperatureCriteria) => void;
}) {
  const totalCriteria = criteria.hot.length + criteria.warm.length + criteria.cold.length;

  return (
    <div>
      <label className="block text-sm font-medium text-[var(--text-primary)]">
        {t('instructions.temperature')}
      </label>
      <p className="text-xs text-[var(--text-tertiary)]">{t('instructions.temperatureHelp')}</p>

      <div className="space-y-3 mt-3">
        <TemperatureCriteriaLevel
          label={t('instructions.temperatureHot')}
          help={t('instructions.temperatureHotHelp')}
          placeholder={t('instructions.temperatureHotPlaceholder')}
          colorClass="text-red-500"
          icon={<FlameIcon className="w-4 h-4" />}
          criteria={criteria.hot}
          onChange={(hot) => onChange({ ...criteria, hot })}
        />
        <TemperatureCriteriaLevel
          label={t('instructions.temperatureWarm')}
          help={t('instructions.temperatureWarmHelp')}
          placeholder={t('instructions.temperatureWarmPlaceholder')}
          colorClass="text-amber-500"
          icon={<SunIcon className="w-4 h-4" />}
          criteria={criteria.warm}
          onChange={(warm) => onChange({ ...criteria, warm })}
        />
        <TemperatureCriteriaLevel
          label={t('instructions.temperatureCold')}
          help={t('instructions.temperatureColdHelp')}
          placeholder={t('instructions.temperatureColdPlaceholder')}
          colorClass="text-blue-400"
          icon={<SnowflakeIcon className="w-4 h-4" />}
          criteria={criteria.cold}
          onChange={(cold) => onChange({ ...criteria, cold })}
        />
        {totalCriteria === 0 && (
          <p className="text-xs text-[var(--text-tertiary)] text-center py-2">
            {t('instructions.temperatureNoCriteria')}
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================
// Instructions Tab
// ============================================

interface InstructionsTabProps {
  t: ReturnType<typeof useTranslations>;
  tCommon: ReturnType<typeof useTranslations>;
  instructions: PromptStructure;
  setInstructions: React.Dispatch<React.SetStateAction<PromptStructure>>;
  loading: boolean;
  saving: boolean;
  hasUnsavedChanges: boolean;
  onSave: () => void;
  newRule: string;
  setNewRule: (v: string) => void;
  newRuleInputRef: React.RefObject<HTMLInputElement | null>;
  onAddRule: () => void;
  onDeleteRule: (i: number) => void;
  onDuplicateRule: (i: number) => void;
  onReorderRules: (oldIndex: number, newIndex: number) => void;
  editingRuleIndex: number | null;
  editingRuleText: string;
  onStartEditRule: (i: number) => void;
  onEditRuleSave: () => void;
  onCancelEditRule: () => void;
  setEditingRuleText: (v: string) => void;
  onClearAllRules: () => void;
  globalRules: string[];
  additionalOpen: boolean;
  setAdditionalOpen: (v: boolean) => void;
}

// ============================================
// Sortable Rule Item (for drag & drop)
// ============================================

function SortableRuleItem({
  id,
  index,
  rule,
  editingRuleIndex,
  editingRuleText,
  setEditingRuleText,
  onStartEditRule,
  onEditRuleSave,
  onCancelEditRule,
  onDuplicateRule,
  onDeleteRule,
  t,
}: {
  id: string;
  index: number;
  rule: string;
  editingRuleIndex: number | null;
  editingRuleText: string;
  setEditingRuleText: (v: string) => void;
  onStartEditRule: (i: number) => void;
  onEditRuleSave: () => void;
  onCancelEditRule: () => void;
  onDuplicateRule: (i: number) => void;
  onDeleteRule: (i: number) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-start gap-2 p-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] group',
        isDragging && 'opacity-50 shadow-lg z-10'
      )}
    >
      {editingRuleIndex === index ? (
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            value={editingRuleText}
            onChange={(e) => setEditingRuleText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onEditRuleSave();
              if (e.key === 'Escape') onCancelEditRule();
            }}
            maxLength={500}
            className="flex-1 px-2 py-1 rounded border border-[var(--accent-primary)] bg-[var(--bg-input)] text-[var(--text-primary)] text-sm focus:outline-none"
            autoFocus
          />
          <button
            onClick={onEditRuleSave}
            className="p-1 text-green-500 hover:bg-green-500/10 rounded transition-colors"
            title="Save"
          >
            <CheckIcon />
          </button>
          <button
            onClick={onCancelEditRule}
            className="p-1 text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] rounded transition-colors"
            title="Cancel"
          >
            <XIcon />
          </button>
        </div>
      ) : (
        <>
          {/* Drag handle */}
          <button
            {...attributes}
            {...listeners}
            className="flex-shrink-0 mt-0.5 p-0.5 cursor-grab active:cursor-grabbing text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] touch-none"
            tabIndex={-1}
          >
            <GripVerticalIcon className="w-3.5 h-3.5" />
          </button>
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] text-xs flex items-center justify-center font-medium mt-0.5">
            {index + 1}
          </span>
          <p className="flex-1 text-sm text-[var(--text-primary)] leading-relaxed">{rule}</p>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={() => onStartEditRule(index)}
              className="p-1 text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-tertiary)] rounded transition-colors"
              title={t('instructions.editRule')}
            >
              <PencilIcon />
            </button>
            <button
              onClick={() => onDuplicateRule(index)}
              className="p-1 text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-tertiary)] rounded transition-colors"
              title={t('instructions.duplicateRule')}
            >
              <CopyIcon />
            </button>
            <button
              onClick={() => onDeleteRule(index)}
              className="p-1 text-[var(--text-tertiary)] hover:text-[var(--status-lost)] hover:bg-red-500/10 rounded transition-colors"
              title={t('instructions.deleteRule')}
            >
              <TrashIcon />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================
// Instructions Tab
// ============================================

function InstructionsTab({
  t,
  tCommon,
  instructions,
  setInstructions,
  loading,
  saving,
  hasUnsavedChanges,
  onSave,
  newRule,
  setNewRule,
  newRuleInputRef,
  onAddRule,
  onDeleteRule,
  onDuplicateRule,
  onReorderRules,
  editingRuleIndex,
  editingRuleText,
  onStartEditRule,
  onEditRuleSave,
  onCancelEditRule,
  setEditingRuleText,
  onClearAllRules,
  globalRules,
  additionalOpen,
  setAdditionalOpen,
}: InstructionsTabProps) {
  const [globalRulesOpen, setGlobalRulesOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(true);
  const [temperatureOpen, setTemperatureOpen] = useState(false);
  const [personalityOpen, setPersonalityOpen] = useState(false);

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Stable IDs for sortable items
  const ruleIds = useMemo(
    () => instructions.rules.map((_, i) => `rule-${i}`),
    [instructions.rules]
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = ruleIds.indexOf(active.id as string);
      const newIndex = ruleIds.indexOf(over.id as string);
      onReorderRules(oldIndex, newIndex);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--accent-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Agent Name */}
      <div>
        <Input
          label={t('instructions.agentName')}
          value={instructions.agentName}
          onChange={(e) => setInstructions((prev) => ({ ...prev, agentName: e.target.value }))}
          placeholder={t('instructions.agentNamePlaceholder')}
          maxLength={100}
          helperText={t('instructions.agentNameHelp')}
        />
      </div>

      {/* Role */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
          {t('instructions.role')}
        </label>
        <ExpandableTextarea
          value={instructions.role}
          onChange={(val) => setInstructions((prev) => ({ ...prev, role: val }))}
          placeholder={t('instructions.rolePlaceholder')}
          maxLength={1000}
          rows={4}
          modalTitle={t('instructions.role')}
        />
        <div className="flex justify-between mt-1">
          <p className="text-xs text-[var(--text-tertiary)]">{t('instructions.roleHelp')}</p>
          <p className="text-xs text-[var(--text-tertiary)]">{instructions.role.length}/1000</p>
        </div>
      </div>

      {/* Global Rules (read-only, collapsible) */}
      {globalRules.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setGlobalRulesOpen(!globalRulesOpen)}
            className="w-full flex items-center justify-between py-2 group"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-[var(--kairo-cyan)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {t('instructions.globalRules')}
              </span>
              <span className="text-xs text-[var(--kairo-cyan)] bg-[var(--kairo-cyan)]/10 px-2 py-0.5 rounded-full">
                {t('instructions.globalRulesCount', { count: globalRules.length.toString() })}
              </span>
            </div>
            <svg
              className={cn(
                'w-4 h-4 text-[var(--text-tertiary)] transition-transform duration-200',
                globalRulesOpen && 'rotate-180'
              )}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {globalRulesOpen && (
            <div className="mt-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)]/50 overflow-hidden">
              <div className="divide-y divide-[var(--border-primary)]">
                {globalRules.map((rule, index) => (
                  <div key={index} className="flex items-start gap-3 px-4 py-2.5">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-[var(--kairo-cyan)]/10 text-[var(--kairo-cyan)] mt-0.5">
                      {index + 1}
                    </span>
                    <span className="text-sm text-[var(--text-secondary)]">{rule}</span>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2 border-t border-[var(--border-primary)] bg-[var(--bg-tertiary)]">
                <p className="text-xs text-[var(--text-tertiary)]">
                  {t('instructions.globalRulesReadonly')}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rules (collapsible) */}
      <div className="border border-[var(--border-primary)] rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setRulesOpen(!rulesOpen)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
        >
          <div className="flex items-center gap-2">
            <span>{t('instructions.rules')}</span>
            {instructions.rules.length > 0 && (
              <span className="text-xs text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 px-2 py-0.5 rounded-full">
                {instructions.rules.length}
              </span>
            )}
          </div>
          <ChevronDownIcon
            className={cn(
              'w-4 h-4 text-[var(--text-tertiary)] transition-transform duration-200',
              rulesOpen && 'rotate-180'
            )}
          />
        </button>
        {rulesOpen && (
          <div className="px-4 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[var(--text-tertiary)]">{t('instructions.rulesHelp')}</p>
              {instructions.rules.length > 0 && (
                <button
                  onClick={onClearAllRules}
                  className="hidden sm:inline-flex items-center gap-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--status-lost)] transition-colors"
                >
                  <TrashIcon className="w-3 h-3" />
                  {t('instructions.clearAllRules')}
                </button>
              )}
            </div>

            {/* Add rule input */}
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  ref={newRuleInputRef}
                  type="text"
                  value={newRule}
                  onChange={(e) => setNewRule(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onAddRule();
                    }
                  }}
                  placeholder={t('instructions.rulePlaceholder')}
                  maxLength={500}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-input)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent placeholder:text-[var(--text-tertiary)]"
                />
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={onAddRule}
                disabled={!newRule.trim() || instructions.rules.length >= 50}
                className="shrink-0"
              >
                <PlusIcon className="w-4 h-4" />
                <span className="hidden sm:inline">{t('instructions.addRule')}</span>
              </Button>
            </div>

            {/* Rules list (sortable) */}
            {instructions.rules.length === 0 ? (
              <p className="text-sm text-[var(--text-tertiary)] py-4 text-center border border-dashed border-[var(--border-primary)] rounded-lg">
                {t('instructions.noRules')}
              </p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={ruleIds} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {instructions.rules.map((rule, index) => (
                      <SortableRuleItem
                        key={ruleIds[index]}
                        id={ruleIds[index]}
                        index={index}
                        rule={rule}
                        editingRuleIndex={editingRuleIndex}
                        editingRuleText={editingRuleText}
                        setEditingRuleText={setEditingRuleText}
                        onStartEditRule={onStartEditRule}
                        onEditRuleSave={onEditRuleSave}
                        onCancelEditRule={onCancelEditRule}
                        onDuplicateRule={onDuplicateRule}
                        onDeleteRule={onDeleteRule}
                        t={t}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
            {instructions.rules.length > 0 && (
              <p className="text-xs text-[var(--text-tertiary)]">
                {instructions.rules.length}/50 {t('instructions.maxRules').toLowerCase()}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Temperature Criteria (collapsible) */}
      <div className="border border-[var(--border-primary)] rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setTemperatureOpen(!temperatureOpen)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
        >
          <span>{t('instructions.temperature')}</span>
          <ChevronDownIcon
            className={cn(
              'w-4 h-4 text-[var(--text-tertiary)] transition-transform duration-200',
              temperatureOpen && 'rotate-180'
            )}
          />
        </button>
        {temperatureOpen && (
          <div className="px-4 pb-4">
            <TemperatureCriteriaSection
              t={t}
              criteria={instructions.temperatureCriteria || { hot: [], warm: [], cold: [] }}
              onChange={(criteria) => setInstructions((prev) => ({ ...prev, temperatureCriteria: criteria }))}
            />
          </div>
        )}
      </div>

      {/* Personality (collapsible) */}
      <div className="border border-[var(--border-primary)] rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setPersonalityOpen(!personalityOpen)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
        >
          <span>{t('instructions.personality')}</span>
          <ChevronDownIcon
            className={cn(
              'w-4 h-4 text-[var(--text-tertiary)] transition-transform duration-200',
              personalityOpen && 'rotate-180'
            )}
          />
        </button>
        {personalityOpen && (
          <div className="px-4 pb-4">
            <ExpandableTextarea
              value={instructions.personality}
              onChange={(val) => setInstructions((prev) => ({ ...prev, personality: val }))}
              placeholder={t('instructions.personalityPlaceholder')}
              maxLength={1000}
              rows={3}
              modalTitle={t('instructions.personality')}
            />
            <div className="flex justify-between mt-1">
              <p className="text-xs text-[var(--text-tertiary)]">{t('instructions.personalityHelp')}</p>
              <p className="text-xs text-[var(--text-tertiary)]">{instructions.personality.length}/1000</p>
            </div>
          </div>
        )}
      </div>

      {/* Additional Instructions (collapsible) */}
      <div className="border border-[var(--border-primary)] rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setAdditionalOpen(!additionalOpen)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
        >
          <span>{t('instructions.additional')}</span>
          <ChevronDownIcon
            className={cn(
              'w-4 h-4 text-[var(--text-tertiary)] transition-transform duration-200',
              additionalOpen && 'rotate-180'
            )}
          />
        </button>
        {additionalOpen && (
          <div className="px-4 pb-4">
            <ExpandableTextarea
              value={instructions.additionalInstructions}
              onChange={(val) =>
                setInstructions((prev) => ({ ...prev, additionalInstructions: val }))
              }
              placeholder={t('instructions.additionalPlaceholder')}
              maxLength={2000}
              rows={5}
              modalTitle={t('instructions.additional')}
            />
            <div className="flex justify-between mt-1">
              <p className="text-xs text-[var(--text-tertiary)]">{t('instructions.additionalHelp')}</p>
              <p className="text-xs text-[var(--text-tertiary)]">
                {instructions.additionalInstructions.length}/2000
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="flex items-center justify-between pt-4 border-t border-[var(--border-primary)]">
        <div>
          {hasUnsavedChanges && (
            <p className="text-xs text-amber-500 font-medium">{t('instructions.unsavedChanges')}</p>
          )}
        </div>
        <Button variant="primary" onClick={onSave} isLoading={saving} disabled={!hasUnsavedChanges}>
          {tCommon('buttons.save')}
        </Button>
      </div>
    </div>
  );
}

// ============================================
// Knowledge Tab
// ============================================

interface KnowledgeTabProps {
  t: ReturnType<typeof useTranslations>;
  tCommon: ReturnType<typeof useTranslations>;
  sections: Array<{
    key: string;
    icon: React.ReactNode;
    titleKey: string;
    descKey: string;
    modal: KnowledgeModal;
  }>;
  structuredKnowledge: StructuredKnowledgeMap;
  knowledgeEntries: KnowledgeEntry[];
  loading: boolean;
  onOpenModal: (modal: KnowledgeModal) => void;
  onDeleteEntry: (id: string) => void;
  onEditEntry: (entry: KnowledgeEntry) => void;
}

function KnowledgeTab({
  t,
  tCommon,
  sections,
  structuredKnowledge,
  knowledgeEntries,
  loading,
  onOpenModal,
  onDeleteEntry,
  onEditEntry,
}: KnowledgeTabProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--accent-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Structured Knowledge */}
      <div>
        <h3 className="text-base font-semibold text-[var(--text-primary)] mb-1">
          {t('knowledge.structured')}
        </h3>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          {t('knowledge.structuredDescription')}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sections.map((section) => {
            const isConfigured = !!structuredKnowledge[section.key as keyof StructuredKnowledgeMap];
            return (
              <Card
                key={section.key}
                hover
                padding="md"
                onClick={() => onOpenModal(section.modal)}
                className="group"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center">
                    {section.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                        {t(section.titleKey)}
                      </h4>
                      <span
                        className={cn(
                          'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium',
                          isConfigured
                            ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                            : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
                        )}
                      >
                        {isConfigured ? t('knowledge.configured') : t('knowledge.notConfigured')}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                      {t(section.descKey)}
                    </p>
                  </div>
                  <button
                    className="flex-shrink-0 p-1.5 rounded-md text-[var(--text-tertiary)] group-hover:text-[var(--accent-primary)] transition-colors"
                    aria-label={t('knowledge.editSection')}
                  >
                    <PencilIcon />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Free-text Knowledge (RAG) */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <DatabaseIcon className="w-5 h-5 text-[var(--accent-primary)]" />
            {t('knowledge.freeText')}
          </h3>
          <Button variant="secondary" size="sm" onClick={() => onOpenModal('add_knowledge')}>
            <PlusIcon className="w-4 h-4" />
            {t('knowledge.addKnowledge')}
          </Button>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-4">{t('knowledge.freeTextDesc')}</p>

        {knowledgeEntries.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-[var(--border-primary)] rounded-lg">
            <DatabaseIcon className="w-8 h-8 text-[var(--text-tertiary)] mx-auto mb-2" />
            <p className="text-sm text-[var(--text-tertiary)]">{t('knowledge.noEntries')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {knowledgeEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] group"
              >
                <div className="flex-1 min-w-0">
                  {entry.title && (
                    <h4 className="text-sm font-medium text-[var(--text-primary)] mb-0.5">
                      {entry.title}
                    </h4>
                  )}
                  <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{entry.content}</p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">
                    {entry.source} - {new Date(entry.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex-shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    onClick={() => onEditEntry(entry)}
                    className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 transition-colors"
                    title={t('knowledge.editEntry')}
                  >
                    <PencilIcon />
                  </button>
                  <button
                    onClick={() => onDeleteEntry(entry.id)}
                    className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--status-lost)] hover:bg-red-500/10 transition-colors"
                    title={t('knowledge.deleteEntry')}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
