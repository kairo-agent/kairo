'use client';

/**
 * ProjectSettingsModal - Configuración de proyecto
 *
 * Permite configurar:
 * - Agentes de IA asignados al proyecto (CRUD completo)
 * - Credenciales de WhatsApp (encriptadas)
 * - URL de webhook n8n
 */

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  getProjectSecretsStatus,
  setProjectSecrets,
  getProjectSecretForUser,
  type SecretKey
} from '@/lib/actions/secrets';
import {
  getProjectAgents,
  createAgent,
  updateAgent,
  deleteAgent,
  toggleAgentStatus,
  type AIAgentType,
  type AIAgentData
} from '@/lib/actions/agents';

interface Project {
  id: string;
  name: string;
  slug: string;
  n8nWebhookUrl?: string | null;
  whatsappPhoneNumber?: string | null;
}

interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  project: Project | null;
}

// ============================================
// Icons
// ============================================

const BotIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const WhatsAppIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
  </svg>
);

const WebhookIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const XCircleIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const EyeIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const EyeOffIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const PencilIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const UserIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const CopyIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

// ============================================
// Agent Type Config
// ============================================

const agentTypeConfig: Record<AIAgentType, { icon: string; color: string }> = {
  sales: { icon: '💼', color: 'bg-blue-500/20 text-blue-400' },
  support: { icon: '🎧', color: 'bg-green-500/20 text-green-400' },
  qualification: { icon: '📊', color: 'bg-purple-500/20 text-purple-400' },
  appointment: { icon: '📅', color: 'bg-orange-500/20 text-orange-400' }
};

// ============================================
// Main Component
// ============================================

export default function ProjectSettingsModal({
  isOpen,
  onClose,
  onSuccess,
  project,
}: ProjectSettingsModalProps) {
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');

  // Tabs
  const [activeTab, setActiveTab] = useState<'agents' | 'whatsapp' | 'webhooks'>('agents');

  // Agents state
  const [agents, setAgents] = useState<AIAgentData[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [showAgentForm, setShowAgentForm] = useState(false);
  const [editingAgent, setEditingAgent] = useState<AIAgentData | null>(null);
  const [deletingAgent, setDeletingAgent] = useState<AIAgentData | null>(null);

  // Agent form
  const [agentName, setAgentName] = useState('');
  const [agentType, setAgentType] = useState<AIAgentType>('sales');
  const [agentDescription, setAgentDescription] = useState('');
  const [agentAvatarUrl, setAgentAvatarUrl] = useState('');

  // WhatsApp form
  const [whatsappToken, setWhatsappToken] = useState('');
  const [whatsappPhoneNumberId, setWhatsappPhoneNumberId] = useState('');
  const [whatsappBusinessAccountId, setWhatsappBusinessAccountId] = useState('');

  // Reveal secrets with timer (15 seconds)
  const [revealedSecrets, setRevealedSecrets] = useState<Record<SecretKey, string | null>>({
    whatsapp_access_token: null,
    whatsapp_phone_number_id: null,
    whatsapp_business_account_id: null,
    openai_api_key: null,
    anthropic_api_key: null,
  });
  const [revealTimers, setRevealTimers] = useState<Record<SecretKey, number>>({
    whatsapp_access_token: 0,
    whatsapp_phone_number_id: 0,
    whatsapp_business_account_id: 0,
    openai_api_key: 0,
    anthropic_api_key: 0,
  });
  const [loadingReveal, setLoadingReveal] = useState<SecretKey | null>(null);
  const [copiedSecret, setCopiedSecret] = useState<SecretKey | null>(null);

  // Webhook form
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState('');

  // Secrets status
  const [secretsStatus, setSecretsStatus] = useState<Record<SecretKey, boolean>>({
    whatsapp_access_token: false,
    whatsapp_phone_number_id: false,
    whatsapp_business_account_id: false,
    openai_api_key: false,
    anthropic_api_key: false,
  });

  // State
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Load data on mount
  useEffect(() => {
    if (isOpen && project?.id) {
      loadAgents();
      loadSecretsStatus();
      setN8nWebhookUrl(project.n8nWebhookUrl || '');
    }
  }, [isOpen, project?.id]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      resetAgentForm();
      setError('');
      setSuccessMessage('');
    }
  }, [isOpen]);

  // ============================================
  // Data Loading
  // ============================================

  const loadAgents = async () => {
    if (!project?.id) return;

    setLoadingAgents(true);
    try {
      const result = await getProjectAgents(project.id);
      if (result.success && result.agents) {
        setAgents(result.agents);
      }
    } catch (err) {
      console.error('Error loading agents:', err);
    } finally {
      setLoadingAgents(false);
    }
  };

  const loadSecretsStatus = async () => {
    if (!project?.id) return;

    setLoading(true);
    try {
      const result = await getProjectSecretsStatus(project.id);
      if (result.success) {
        setSecretsStatus(result.configured);
      }
    } catch (err) {
      console.error('Error loading secrets status:', err);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // Agent Handlers
  // ============================================

  const resetAgentForm = () => {
    setAgentName('');
    setAgentType('sales');
    setAgentDescription('');
    setAgentAvatarUrl('');
    setShowAgentForm(false);
    setEditingAgent(null);
    setDeletingAgent(null);
  };

  const handleEditAgent = (agent: AIAgentData) => {
    setEditingAgent(agent);
    setAgentName(agent.name);
    setAgentType(agent.type);
    setAgentDescription(agent.description || '');
    setAgentAvatarUrl(agent.avatarUrl || '');
    setShowAgentForm(true);
  };

  const handleSaveAgent = async () => {
    if (!project?.id || !agentName.trim()) return;

    setSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      if (editingAgent) {
        // Update existing agent
        const result = await updateAgent(editingAgent.id, {
          name: agentName.trim(),
          type: agentType,
          description: agentDescription.trim() || undefined,
          avatarUrl: agentAvatarUrl.trim() || undefined
        });

        if (result.success) {
          setSuccessMessage(t('agentSettings.updateSuccess'));
          await loadAgents();
          resetAgentForm();
          onSuccess();
        } else {
          setError(result.error || t('messages.error'));
        }
      } else {
        // Create new agent
        const result = await createAgent({
          projectId: project.id,
          name: agentName.trim(),
          type: agentType,
          description: agentDescription.trim() || undefined,
          avatarUrl: agentAvatarUrl.trim() || undefined
        });

        if (result.success) {
          setSuccessMessage(t('agentSettings.createSuccess'));
          await loadAgents();
          resetAgentForm();
          onSuccess();
        } else {
          if (result.error?.includes('already exists')) {
            setError(t('agentSettings.duplicateName'));
          } else {
            setError(result.error || t('messages.error'));
          }
        }
      }
    } catch (err) {
      console.error('Error saving agent:', err);
      setError(t('messages.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAgent = async () => {
    if (!deletingAgent) return;

    setSaving(true);
    setError('');

    try {
      const result = await deleteAgent(deletingAgent.id);

      if (result.success) {
        setSuccessMessage(t('agentSettings.deleteSuccess'));
        await loadAgents();
        setDeletingAgent(null);
        onSuccess();
      } else {
        if (result.error?.includes('assigned leads')) {
          const count = deletingAgent._count?.assignedLeads || 0;
          setError(t('agentSettings.cannotDeleteHasLeads', { count }));
        } else {
          setError(result.error || t('messages.error'));
        }
      }
    } catch (err) {
      console.error('Error deleting agent:', err);
      setError(t('messages.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAgentStatus = async (agent: AIAgentData) => {
    try {
      const result = await toggleAgentStatus(agent.id);
      if (result.success) {
        await loadAgents();
        onSuccess();
      }
    } catch (err) {
      console.error('Error toggling agent status:', err);
    }
  };

  // ============================================
  // WhatsApp Handlers
  // ============================================

  const handleRevealSecret = async (key: SecretKey) => {
    if (!project?.id || loadingReveal) return;

    // If already revealed, just hide it
    if (revealedSecrets[key]) {
      setRevealedSecrets(prev => ({ ...prev, [key]: null }));
      setRevealTimers(prev => ({ ...prev, [key]: 0 }));
      return;
    }

    setLoadingReveal(key);
    try {
      const result = await getProjectSecretForUser(project.id, key);
      if (result.success && result.value) {
        setRevealedSecrets(prev => ({ ...prev, [key]: result.value || null }));

        // Start 15 second countdown
        let timeLeft = 15;
        setRevealTimers(prev => ({ ...prev, [key]: timeLeft }));

        const interval = setInterval(() => {
          timeLeft -= 1;
          setRevealTimers(prev => ({ ...prev, [key]: timeLeft }));

          if (timeLeft <= 0) {
            clearInterval(interval);
            setRevealedSecrets(prev => ({ ...prev, [key]: null }));
            setRevealTimers(prev => ({ ...prev, [key]: 0 }));
          }
        }, 1000);
      } else {
        setError(result.error || t('settings.revealFailed'));
      }
    } catch (err) {
      console.error('Error revealing secret:', err);
      setError(t('settings.revealFailed'));
    } finally {
      setLoadingReveal(null);
    }
  };

  const handleCopySecret = async (key: SecretKey) => {
    const value = revealedSecrets[key];
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopiedSecret(key);
      setTimeout(() => setCopiedSecret(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleSaveWhatsApp = async () => {
    if (!project?.id) return;

    setSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      const secrets: Partial<Record<SecretKey, string>> = {};

      if (whatsappToken.trim()) {
        secrets.whatsapp_access_token = whatsappToken.trim();
      }
      if (whatsappPhoneNumberId.trim()) {
        secrets.whatsapp_phone_number_id = whatsappPhoneNumberId.trim();
      }
      if (whatsappBusinessAccountId.trim()) {
        secrets.whatsapp_business_account_id = whatsappBusinessAccountId.trim();
      }

      if (Object.keys(secrets).length === 0) {
        setError(t('settings.noChanges'));
        setSaving(false);
        return;
      }

      const result = await setProjectSecrets(project.id, secrets);

      if (result.success) {
        setSuccessMessage(t('settings.savedSuccessfully'));
        setWhatsappToken('');
        setWhatsappPhoneNumberId('');
        setWhatsappBusinessAccountId('');
        await loadSecretsStatus();
        onSuccess();
      } else {
        setError(result.error || t('settings.saveFailed'));
      }
    } catch (err) {
      console.error('Error saving WhatsApp config:', err);
      setError(t('settings.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // Webhook Handlers
  // ============================================

  const handleSaveWebhooks = async () => {
    if (!project?.id) return;

    setSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      // TODO: Save n8n webhook URL to project (not encrypted, just regular field)
      setSuccessMessage(t('settings.savedSuccessfully'));
      onSuccess();
    } catch (err) {
      console.error('Error saving webhooks:', err);
      setError(t('settings.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // Render Helpers
  // ============================================

  const tabs = [
    { id: 'agents' as const, label: t('settings.agents'), icon: <BotIcon /> },
    { id: 'whatsapp' as const, label: 'WhatsApp', icon: <WhatsAppIcon /> },
    { id: 'webhooks' as const, label: 'Webhooks', icon: <WebhookIcon /> },
  ];

  const renderSecretStatus = (key: SecretKey, label: string) => (
    <div className="flex items-center gap-2 text-sm">
      {secretsStatus[key] ? (
        <>
          <CheckCircleIcon />
          <span className="text-green-500">{label}: {t('settings.configured')}</span>
        </>
      ) : (
        <>
          <XCircleIcon />
          <span className="text-[var(--text-muted)]">{label}: {t('settings.notConfigured')}</span>
        </>
      )}
    </div>
  );

  const renderAgentForm = () => (
    <div className="space-y-4 p-4 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
      <h4 className="font-medium text-[var(--text-primary)]">
        {editingAgent ? t('agentSettings.editAgent') : t('agentSettings.newAgent')}
      </h4>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
          {t('agentSettings.name')} *
        </label>
        <input
          type="text"
          value={agentName}
          onChange={(e) => setAgentName(e.target.value)}
          placeholder={t('agentSettings.namePlaceholder')}
          className="w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm"
        />
      </div>

      {/* Type */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
          {t('agentSettings.type')} *
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(['sales', 'support', 'qualification', 'appointment'] as AIAgentType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setAgentType(type)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors',
                agentType === type
                  ? 'border-[var(--kairo-cyan)] bg-[var(--kairo-cyan)]/10 text-[var(--kairo-cyan)]'
                  : 'border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]'
              )}
            >
              <span>{agentTypeConfig[type].icon}</span>
              <span>{t(`agentSettings.agentTypes.${type}`)}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          {t(`agentSettings.agentTypeDescriptions.${agentType}`)}
        </p>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
          {t('agentSettings.description')}
        </label>
        <textarea
          value={agentDescription}
          onChange={(e) => setAgentDescription(e.target.value)}
          placeholder={t('agentSettings.descriptionPlaceholder')}
          rows={2}
          className="w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm resize-none"
        />
      </div>

      {/* Avatar URL */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
          {t('agentSettings.avatarUrl')}
        </label>
        <input
          type="url"
          value={agentAvatarUrl}
          onChange={(e) => setAgentAvatarUrl(e.target.value)}
          placeholder="https://..."
          className="w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSaveAgent}
          disabled={saving || !agentName.trim()}
          className="flex-1 py-2 rounded-lg bg-[var(--kairo-cyan)] text-white font-medium hover:bg-[var(--kairo-cyan)]/90 transition-colors disabled:opacity-50"
        >
          {saving ? tCommon('buttons.saving') : tCommon('buttons.save')}
        </button>
        <button
          onClick={resetAgentForm}
          disabled={saving}
          className="px-4 py-2 rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          {tCommon('buttons.cancel')}
        </button>
      </div>
    </div>
  );

  const renderAgentCard = (agent: AIAgentData) => (
    <div
      key={agent.id}
      className={cn(
        'p-4 rounded-lg border transition-colors',
        agent.isActive
          ? 'bg-[var(--bg-secondary)] border-[var(--border-primary)]'
          : 'bg-[var(--bg-tertiary)] border-[var(--border-secondary)] opacity-60'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center text-lg',
            agentTypeConfig[agent.type].color
          )}>
            {agent.avatarUrl ? (
              <img src={agent.avatarUrl} alt={agent.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              agentTypeConfig[agent.type].icon
            )}
          </div>

          {/* Info */}
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-[var(--text-primary)]">{agent.name}</h4>
              <span className={cn(
                'text-xs px-2 py-0.5 rounded-full',
                agent.isActive
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-gray-500/20 text-gray-400'
              )}>
                {agent.isActive ? t('agentSettings.active') : t('agentSettings.inactive')}
              </span>
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              {t(`agentSettings.agentTypes.${agent.type}`)}
              {agent._count?.assignedLeads ? ` • ${agent._count.assignedLeads} leads` : ''}
            </p>
            {agent.description && (
              <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-1">
                {agent.description}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleToggleAgentStatus(agent)}
            className={cn(
              'p-2 rounded-lg transition-colors',
              agent.isActive
                ? 'text-green-400 hover:bg-green-500/10'
                : 'text-gray-400 hover:bg-gray-500/10'
            )}
            title={agent.isActive ? t('agentSettings.inactive') : t('agentSettings.active')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={agent.isActive ? "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" : "M5 13l4 4L19 7"} />
            </svg>
          </button>
          <button
            onClick={() => handleEditAgent(agent)}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
            title={tCommon('buttons.edit')}
          >
            <PencilIcon />
          </button>
          <button
            onClick={() => setDeletingAgent(agent)}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title={tCommon('buttons.delete')}
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t('settings.title')}: ${project?.name || ''}`}
      size="lg"
    >
      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex border-b border-[var(--border-primary)]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setError('');
                setSuccessMessage('');
                resetAgentForm();
              }}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-[var(--kairo-cyan)] text-[var(--kairo-cyan)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 text-red-500 text-sm">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="p-3 rounded-lg bg-green-500/10 text-green-500 text-sm">
            {successMessage}
          </div>
        )}

        {/* Delete Confirmation */}
        {deletingAgent && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 space-y-3">
            <p className="text-sm text-[var(--text-primary)]">
              {t('agentSettings.confirmDelete')}
            </p>
            <p className="text-sm text-[var(--text-muted)]">
              Agente: <strong>{deletingAgent.name}</strong>
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDeleteAgent}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {saving ? tCommon('buttons.loading') : tCommon('buttons.delete')}
              </button>
              <button
                onClick={() => setDeletingAgent(null)}
                disabled={saving}
                className="px-4 py-2 rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)] text-sm hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                {tCommon('buttons.cancel')}
              </button>
            </div>
          </div>
        )}

        {/* Tab Content: Agents */}
        {activeTab === 'agents' && !deletingAgent && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">
              {t('settings.agentsDescription')}
            </p>

            {/* New Agent Button */}
            {!showAgentForm && (
              <button
                onClick={() => setShowAgentForm(true)}
                className="w-full py-3 rounded-lg border-2 border-dashed border-[var(--border-primary)] text-[var(--text-muted)] hover:border-[var(--kairo-cyan)] hover:text-[var(--kairo-cyan)] transition-colors flex items-center justify-center gap-2"
              >
                <PlusIcon />
                {t('agentSettings.newAgent')}
              </button>
            )}

            {/* Agent Form */}
            {showAgentForm && renderAgentForm()}

            {/* Agents List */}
            {loadingAgents ? (
              <div className="py-8 text-center text-[var(--text-muted)]">
                {tCommon('buttons.loading')}
              </div>
            ) : agents.length === 0 ? (
              <div className="py-8 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-2xl">
                  🤖
                </div>
                <h4 className="text-[var(--text-primary)] font-medium mb-1">
                  {t('agentSettings.noAgents')}
                </h4>
                <p className="text-sm text-[var(--text-muted)]">
                  {t('agentSettings.noAgentsMessage')}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {agents.map(renderAgentCard)}
              </div>
            )}
          </div>
        )}

        {/* Tab Content: WhatsApp */}
        {activeTab === 'whatsapp' && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">
              {t('settings.whatsappDescription')}
            </p>

            {/* Current Status */}
            <div className="p-4 rounded-lg bg-[var(--bg-tertiary)] space-y-2">
              <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2">
                {t('settings.currentStatus')}
              </h4>
              {renderSecretStatus('whatsapp_access_token', 'Access Token')}
              {renderSecretStatus('whatsapp_phone_number_id', 'Phone Number ID')}
              {renderSecretStatus('whatsapp_business_account_id', 'Business Account ID')}
            </div>

            {/* Form */}
            <div className="space-y-4">
              {/* Access Token */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                  WhatsApp Access Token
                  {secretsStatus.whatsapp_access_token && (
                    <span className="ml-2 text-xs text-green-500 font-normal">✓ {t('settings.configured')}</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={whatsappToken}
                    onChange={(e) => setWhatsappToken(e.target.value)}
                    placeholder={
                      revealedSecrets.whatsapp_access_token
                        ? revealedSecrets.whatsapp_access_token
                        : secretsStatus.whatsapp_access_token
                          ? t('settings.keepCurrent')
                          : t('settings.enterToken')
                    }
                    className="w-full px-3 py-2 pr-24 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm"
                  />
                  {secretsStatus.whatsapp_access_token && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {/* Copy button - only when revealed */}
                      {revealedSecrets.whatsapp_access_token && (
                        <button
                          type="button"
                          onClick={() => handleCopySecret('whatsapp_access_token')}
                          className={cn(
                            'p-1 rounded transition-colors',
                            copiedSecret === 'whatsapp_access_token'
                              ? 'text-green-500'
                              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                          )}
                          title={copiedSecret === 'whatsapp_access_token' ? t('settings.copied') : t('settings.copySecret')}
                        >
                          {copiedSecret === 'whatsapp_access_token' ? <CheckIcon /> : <CopyIcon />}
                        </button>
                      )}
                      {/* Reveal button */}
                      <button
                        type="button"
                        onClick={() => handleRevealSecret('whatsapp_access_token')}
                        disabled={loadingReveal === 'whatsapp_access_token'}
                        className={cn(
                          'p-1 flex items-center gap-1 text-xs rounded transition-colors',
                          revealedSecrets.whatsapp_access_token
                            ? 'text-[var(--kairo-cyan)]'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                        )}
                        title={revealedSecrets.whatsapp_access_token ? t('settings.hideSecret') : t('settings.revealSecret')}
                      >
                        {loadingReveal === 'whatsapp_access_token' ? (
                          <span className="animate-pulse">...</span>
                        ) : revealedSecrets.whatsapp_access_token ? (
                          <>
                            <EyeOffIcon />
                            <span className="text-xs font-medium">{revealTimers.whatsapp_access_token}s</span>
                          </>
                        ) : (
                          <EyeIcon />
                        )}
                      </button>
                    </div>
                  )}
                </div>
                {secretsStatus.whatsapp_access_token && !revealedSecrets.whatsapp_access_token && (
                  <p className="text-xs text-[var(--text-muted)] mt-1">{t('settings.leaveEmptyToKeep')}</p>
                )}
              </div>

              {/* Phone Number ID */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                  Phone Number ID
                  {secretsStatus.whatsapp_phone_number_id && (
                    <span className="ml-2 text-xs text-green-500 font-normal">✓ {t('settings.configured')}</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={whatsappPhoneNumberId}
                    onChange={(e) => setWhatsappPhoneNumberId(e.target.value)}
                    placeholder={
                      revealedSecrets.whatsapp_phone_number_id
                        ? revealedSecrets.whatsapp_phone_number_id
                        : secretsStatus.whatsapp_phone_number_id
                          ? t('settings.keepCurrent')
                          : t('settings.enterPhoneNumberId')
                    }
                    className="w-full px-3 py-2 pr-24 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm"
                  />
                  {secretsStatus.whatsapp_phone_number_id && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {/* Copy button - only when revealed */}
                      {revealedSecrets.whatsapp_phone_number_id && (
                        <button
                          type="button"
                          onClick={() => handleCopySecret('whatsapp_phone_number_id')}
                          className={cn(
                            'p-1 rounded transition-colors',
                            copiedSecret === 'whatsapp_phone_number_id'
                              ? 'text-green-500'
                              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                          )}
                          title={copiedSecret === 'whatsapp_phone_number_id' ? t('settings.copied') : t('settings.copySecret')}
                        >
                          {copiedSecret === 'whatsapp_phone_number_id' ? <CheckIcon /> : <CopyIcon />}
                        </button>
                      )}
                      {/* Reveal button */}
                      <button
                        type="button"
                        onClick={() => handleRevealSecret('whatsapp_phone_number_id')}
                        disabled={loadingReveal === 'whatsapp_phone_number_id'}
                        className={cn(
                          'p-1 flex items-center gap-1 text-xs rounded transition-colors',
                          revealedSecrets.whatsapp_phone_number_id
                            ? 'text-[var(--kairo-cyan)]'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                        )}
                        title={revealedSecrets.whatsapp_phone_number_id ? t('settings.hideSecret') : t('settings.revealSecret')}
                      >
                        {loadingReveal === 'whatsapp_phone_number_id' ? (
                          <span className="animate-pulse">...</span>
                        ) : revealedSecrets.whatsapp_phone_number_id ? (
                          <>
                            <EyeOffIcon />
                            <span className="text-xs font-medium">{revealTimers.whatsapp_phone_number_id}s</span>
                          </>
                        ) : (
                          <EyeIcon />
                        )}
                      </button>
                    </div>
                  )}
                </div>
                {secretsStatus.whatsapp_phone_number_id && !revealedSecrets.whatsapp_phone_number_id && (
                  <p className="text-xs text-[var(--text-muted)] mt-1">{t('settings.leaveEmptyToKeep')}</p>
                )}
              </div>

              {/* Business Account ID */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                  Business Account ID
                  {secretsStatus.whatsapp_business_account_id && (
                    <span className="ml-2 text-xs text-green-500 font-normal">✓ {t('settings.configured')}</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={whatsappBusinessAccountId}
                    onChange={(e) => setWhatsappBusinessAccountId(e.target.value)}
                    placeholder={
                      revealedSecrets.whatsapp_business_account_id
                        ? revealedSecrets.whatsapp_business_account_id
                        : secretsStatus.whatsapp_business_account_id
                          ? t('settings.keepCurrent')
                          : t('settings.enterBusinessAccountId')
                    }
                    className="w-full px-3 py-2 pr-24 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm"
                  />
                  {secretsStatus.whatsapp_business_account_id && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {/* Copy button - only when revealed */}
                      {revealedSecrets.whatsapp_business_account_id && (
                        <button
                          type="button"
                          onClick={() => handleCopySecret('whatsapp_business_account_id')}
                          className={cn(
                            'p-1 rounded transition-colors',
                            copiedSecret === 'whatsapp_business_account_id'
                              ? 'text-green-500'
                              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                          )}
                          title={copiedSecret === 'whatsapp_business_account_id' ? t('settings.copied') : t('settings.copySecret')}
                        >
                          {copiedSecret === 'whatsapp_business_account_id' ? <CheckIcon /> : <CopyIcon />}
                        </button>
                      )}
                      {/* Reveal button */}
                      <button
                        type="button"
                        onClick={() => handleRevealSecret('whatsapp_business_account_id')}
                        disabled={loadingReveal === 'whatsapp_business_account_id'}
                        className={cn(
                          'p-1 flex items-center gap-1 text-xs rounded transition-colors',
                          revealedSecrets.whatsapp_business_account_id
                            ? 'text-[var(--kairo-cyan)]'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                        )}
                        title={revealedSecrets.whatsapp_business_account_id ? t('settings.hideSecret') : t('settings.revealSecret')}
                      >
                        {loadingReveal === 'whatsapp_business_account_id' ? (
                          <span className="animate-pulse">...</span>
                        ) : revealedSecrets.whatsapp_business_account_id ? (
                          <>
                            <EyeOffIcon />
                            <span className="text-xs font-medium">{revealTimers.whatsapp_business_account_id}s</span>
                          </>
                        ) : (
                          <EyeIcon />
                        )}
                      </button>
                    </div>
                  )}
                </div>
                {secretsStatus.whatsapp_business_account_id && !revealedSecrets.whatsapp_business_account_id && (
                  <p className="text-xs text-[var(--text-muted)] mt-1">{t('settings.leaveEmptyToKeep')}</p>
                )}
              </div>

              <button
                onClick={handleSaveWhatsApp}
                disabled={saving}
                className="w-full py-2 rounded-lg bg-[var(--kairo-cyan)] text-white font-medium hover:bg-[var(--kairo-cyan)]/90 transition-colors disabled:opacity-50"
              >
                {saving ? tCommon('buttons.saving') : tCommon('buttons.save')}
              </button>
            </div>
          </div>
        )}

        {/* Tab Content: Webhooks */}
        {activeTab === 'webhooks' && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">
              {t('settings.webhooksDescription')}
            </p>

            {/* n8n Webhook URL */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
                n8n Webhook URL
              </label>
              <input
                type="url"
                value={n8nWebhookUrl}
                onChange={(e) => setN8nWebhookUrl(e.target.value)}
                placeholder="https://n8n.example.com/webhook/..."
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-sm"
              />
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {t('settings.webhookUrlHelp')}
              </p>
            </div>

            <button
              onClick={handleSaveWebhooks}
              disabled={saving}
              className="w-full py-2 rounded-lg bg-[var(--kairo-cyan)] text-white font-medium hover:bg-[var(--kairo-cyan)]/90 transition-colors disabled:opacity-50"
            >
              {saving ? tCommon('buttons.saving') : tCommon('buttons.save')}
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t border-[var(--border-primary)]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            {tCommon('buttons.close')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
