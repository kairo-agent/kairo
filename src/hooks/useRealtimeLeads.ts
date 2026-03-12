'use client';

// ============================================
// KAIRO - Realtime Leads Hook
// Supabase Realtime subscription for instant
// lead list updates (new leads, status/temp changes)
// ============================================

import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { leadsQueryKeys } from '@/hooks/useLeadsQuery';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ============================================
// Types
// ============================================

interface UseRealtimeLeadsOptions {
  /** Filter by specific project (when user selects a project) */
  projectId?: string;
  /** Filter by organization (when user views all projects in org) */
  organizationId?: string;
  /** Only subscribe when leads page is active */
  enabled?: boolean;
}

// ============================================
// Constants
// ============================================

/** Debounce window for batching rapid invalidations (ms) */
const INVALIDATION_DEBOUNCE_MS = 500;

// ============================================
// Hook Implementation
// ============================================

export function useRealtimeLeads({
  projectId,
  organizationId,
  enabled = true,
}: UseRealtimeLeadsOptions): void {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabaseRef = useRef(createClient());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Debounced invalidation of leads + stats queries.
   * When the webhook creates a lead, multiple rapid DB updates follow
   * (create lead -> assign agent -> AI responds -> update lastContactAt).
   * We batch all these into a single refetch after a 500ms quiet period.
   */
  const debouncedInvalidate = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      queryClient.invalidateQueries({ queryKey: leadsQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: leadsQueryKeys.stats() });
    }, INVALIDATION_DEBOUNCE_MS);
  }, [queryClient]);

  // Clean up channel helper
  const cleanup = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (channelRef.current) {
      supabaseRef.current.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Don't subscribe if disabled or no workspace context
    if (!enabled || (!projectId && !organizationId)) {
      cleanup();
      return;
    }

    // Clean up previous subscription before creating a new one
    cleanup();

    const supabase = supabaseRef.current;

    // Build a unique channel name based on the active filter scope
    const scope = projectId
      ? `project:${projectId}`
      : `org:${organizationId}`;
    const channelName = `leads:${scope}`;

    // Build the filter - Supabase Realtime supports filtering by a single column.
    // When a specific project is selected, filter server-side for efficiency.
    // When viewing all projects in an org, we subscribe to all leads changes
    // and let TanStack Query handle the correct data via refetch.
    const filter = projectId
      ? `projectId=eq.${projectId}`
      : undefined;

    // Common subscription config
    const insertConfig = {
      event: 'INSERT' as const,
      schema: 'public',
      table: 'leads',
      ...(filter ? { filter } : {}),
    };

    const updateConfig = {
      event: 'UPDATE' as const,
      schema: 'public',
      table: 'leads',
      ...(filter ? { filter } : {}),
    };

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', insertConfig, () => {
        console.log('[RT] New lead detected');
        debouncedInvalidate();
      })
      .on('postgres_changes', updateConfig, () => {
        console.log('[RT] Lead updated');
        debouncedInvalidate();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[RT] Subscribed to leads channel: ${channelName}`);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`[RT] Leads channel error: ${status}`);
        }
      });

    channelRef.current = channel;

    return () => {
      cleanup();
    };
  }, [projectId, organizationId, enabled, cleanup, debouncedInvalidate]);
}

export default useRealtimeLeads;
