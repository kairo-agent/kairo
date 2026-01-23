'use client';

// ============================================
// KAIRO - TanStack Query Provider
// React Query configuration optimized for Next.js
// ============================================

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

interface QueryProviderProps {
  children: ReactNode;
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is fresh for 30 seconds - no refetch during this window
        staleTime: 30 * 1000,
        // Cache stays in memory for 5 minutes after becoming unused
        gcTime: 5 * 60 * 1000,
        // Only retry once on failure
        retry: 1,
        // Disable automatic refetch on window focus to avoid unnecessary requests
        refetchOnWindowFocus: false,
        // Keep previous data while fetching new data (smooth transitions)
        placeholderData: (previousData: unknown) => previousData,
      },
    },
  });
}

// Browser: Create a single QueryClient instance that persists across renders
let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  // Server: Always create a new QueryClient
  if (typeof window === 'undefined') {
    return makeQueryClient();
  }

  // Browser: Create QueryClient once and reuse it
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

export function QueryProvider({ children }: QueryProviderProps) {
  // Use getQueryClient to ensure consistent client between server and browser
  const [queryClient] = useState(getQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
