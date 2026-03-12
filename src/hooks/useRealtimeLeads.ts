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

  useEffect(() => {
    // Don't subscribe if disabled or no workspace context
    if (!enabled || (!projectId && !organizationId)) {
      return;
    }

    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    const setup = async () => {
      try {
        const supabase = createClient();

        // Await auth session before subscribing — this ensures the Realtime
        // connection is established as an authenticated user so that RLS
        // policies on the leads table allow event delivery.
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled || !user) return;

        // Build a unique channel name based on the active filter scope
        const scope = projectId
          ? `project:${projectId}`
          : `org:${organizationId}`;
        const channelName = `leads:${scope}`;

        // Build the filter — Supabase Realtime supports filtering by a single
        // column. When a specific project is selected, filter server-side.
        // When viewing all projects in an org, subscribe without a filter and
        // let TanStack Query handle scoping via refetch.
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

        // UPDATE events: do NOT apply the projectId filter here.
        // With REPLICA IDENTITY DEFAULT (PostgreSQL default), the OLD record in
        // the WAL only carries the primary key. Supabase Realtime needs the full
        // OLD row to evaluate a non-PK filter like `projectId=eq.xxx` on UPDATE
        // events — without it the event is silently dropped.
        // The permanent fix is `ALTER TABLE leads REPLICA IDENTITY FULL;` in
        // Supabase SQL Editor, which makes this filter safe to restore.
        // Until then, subscribing without a filter means all projects in the org
        // trigger an invalidation, but TanStack Query scopes the actual refetch.
        const updateConfig = {
          event: 'UPDATE' as const,
          schema: 'public',
          table: 'leads',
        };

        channel = supabase
          .channel(channelName)
          .on('postgres_changes', insertConfig, () => {
            if (cancelled) return;
            console.log('[RT] New lead detected');
            debouncedInvalidate();
          })
          .on('postgres_changes', updateConfig, () => {
            if (cancelled) return;
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
      } catch (err) {
        console.warn('[RT] Failed to set up leads realtime:', err);
      }
    };

    setup();

    return () => {
      cancelled = true;

      // Clear any pending debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      // Remove the channel if it was created
      if (channelRef.current) {
        const supabase = createClient();
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [projectId, organizationId, enabled, debouncedInvalidate]);
}

export default useRealtimeLeads;
