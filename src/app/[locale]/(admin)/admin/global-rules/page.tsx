'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState, useRef } from 'react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  getGlobalRules,
  createGlobalRule,
  updateGlobalRule,
  deleteGlobalRule,
  toggleGlobalRule,
  type GlobalRule,
} from '@/lib/actions/global-rules';

// ============================================
// Icons
// ============================================

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const XIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const EditIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const ShieldIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

// ============================================
// Component
// ============================================

export default function GlobalRulesPage() {
  const t = useTranslations('admin.globalRules');

  const [rules, setRules] = useState<GlobalRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRule, setNewRule] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLInputElement>(null);

  // Fetch rules on mount
  useEffect(() => {
    fetchRules();
  }, []);

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingId && editRef.current) {
      editRef.current.focus();
    }
  }, [editingId]);

  async function fetchRules() {
    setLoading(true);
    const result = await getGlobalRules();
    if (result.success && result.data) {
      setRules(result.data);
    }
    setLoading(false);
  }

  async function handleAdd() {
    if (!newRule.trim() || saving) return;
    setSaving(true);
    const result = await createGlobalRule(newRule);
    if (result.success && result.data) {
      setRules(prev => [...prev, result.data!]);
      setNewRule('');
      inputRef.current?.focus();
    }
    setSaving(false);
  }

  async function handleUpdate(id: string) {
    if (!editingContent.trim() || saving) return;
    setSaving(true);
    const result = await updateGlobalRule(id, editingContent);
    if (result.success && result.data) {
      setRules(prev => prev.map(r => r.id === id ? result.data! : r));
      setEditingId(null);
      setEditingContent('');
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm(t('confirmDelete'))) return;
    const result = await deleteGlobalRule(id);
    if (result.success) {
      setRules(prev => prev.filter(r => r.id !== id));
    }
  }

  async function handleToggle(id: string) {
    const result = await toggleGlobalRule(id);
    if (result.success && result.data) {
      setRules(prev => prev.map(r => r.id === id ? result.data! : r));
    }
  }

  function startEditing(rule: GlobalRule) {
    setEditingId(rule.id);
    setEditingContent(rule.content);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditingContent('');
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-[var(--kairo-cyan)]/10 text-[var(--accent-text)]">
          <ShieldIcon />
        </div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          {t('title')}
        </h1>
      </div>
      <p className="text-sm text-[var(--text-secondary)] mb-6 ml-12">
        {t('description')}
      </p>

      {/* Add rule input */}
      <Card className="p-4 mb-6">
        <div className="flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={newRule}
            onChange={(e) => setNewRule(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder={t('placeholder')}
            maxLength={500}
            className="flex-1 px-4 py-2.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--kairo-cyan)]/50 focus:border-[var(--kairo-cyan)]"
          />
          <button
            onClick={handleAdd}
            disabled={!newRule.trim() || saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--kairo-cyan)] text-white text-sm font-medium hover:bg-[var(--kairo-cyan)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <PlusIcon />
            {t('add')}
          </button>
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-xs text-[var(--text-muted)]">
            {rules.length} {rules.length === 1 ? 'regla' : 'reglas'}
          </span>
        </div>
      </Card>

      {/* Rules list */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[var(--text-secondary)]">
            Cargando...
          </div>
        ) : rules.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-secondary)]">
            {t('empty')}
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-primary)]">
            {rules.map((rule, index) => (
              <div
                key={rule.id}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 group',
                  !rule.isActive && 'opacity-50'
                )}
              >
                {/* Order number */}
                <span className={cn(
                  'flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                  rule.isActive
                    ? 'bg-[var(--kairo-cyan)]/10 text-[var(--accent-text)]'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                )}>
                  {index + 1}
                </span>

                {/* Content or edit input */}
                {editingId === rule.id ? (
                  <div className="flex-1 flex gap-2">
                    <input
                      ref={editRef}
                      type="text"
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdate(rule.id);
                        if (e.key === 'Escape') cancelEditing();
                      }}
                      maxLength={500}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-[var(--kairo-cyan)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--kairo-cyan)]/50"
                    />
                    <button
                      onClick={() => handleUpdate(rule.id)}
                      disabled={saving || !editingContent.trim()}
                      className="p-1.5 rounded-lg text-green-500 hover:bg-green-500/10 transition-colors disabled:opacity-50"
                    >
                      <CheckIcon />
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                    >
                      <XIcon />
                    </button>
                  </div>
                ) : (
                  <span className="flex-1 text-sm text-[var(--text-primary)]">
                    {rule.content}
                  </span>
                )}

                {/* Actions (visible on hover or always on mobile) */}
                {editingId !== rule.id && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity sm:opacity-100">
                    {/* Toggle active */}
                    <button
                      onClick={() => handleToggle(rule.id)}
                      className={cn(
                        'px-2 py-1 rounded text-xs font-medium transition-colors',
                        rule.isActive
                          ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                          : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]/80'
                      )}
                    >
                      {rule.isActive ? t('active') : t('inactive')}
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => startEditing(rule)}
                      className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                    >
                      <EditIcon />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
