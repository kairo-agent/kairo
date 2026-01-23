'use client';

// ============================================
// KAIRO - Loading Context
// Global loading state for overlay animations
// Supports persistence across page reloads
// ============================================

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

const LOADING_STORAGE_KEY = 'kairo-loading-state';

interface LoadingState {
  isLoading: boolean;
  message: string;
  timestamp: number;
}

interface LoadingContextType {
  isLoading: boolean;
  loadingMessage: string;
  showLoading: (message?: string, persist?: boolean) => void;
  hideLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

interface LoadingProviderProps {
  children: ReactNode;
}

// Helper to check if loading state is still valid (max 10 seconds)
function isValidLoadingState(state: LoadingState | null): boolean {
  if (!state) return false;
  const now = Date.now();
  const maxAge = 10000; // 10 seconds max
  return state.isLoading && (now - state.timestamp) < maxAge;
}

export function LoadingProvider({ children }: LoadingProviderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  // Check for persisted loading state on mount
  useEffect(() => {
    let wasPersistedLoading = false;

    try {
      const stored = localStorage.getItem(LOADING_STORAGE_KEY);
      if (stored) {
        const state: LoadingState = JSON.parse(stored);
        if (isValidLoadingState(state)) {
          setIsLoading(true);
          setLoadingMessage(state.message);
          wasPersistedLoading = true;
        } else {
          // Clear expired state
          localStorage.removeItem(LOADING_STORAGE_KEY);
        }
      }
    } catch {
      // Ignore errors
    }

    // If we restored a persisted loading state, hide it after page loads
    // Use requestAnimationFrame + setTimeout to ensure DOM is ready
    if (wasPersistedLoading) {
      const hideAfterLoad = () => {
        // Small delay to allow page content to render
        setTimeout(() => {
          setIsLoading(false);
          setLoadingMessage('');
          try {
            localStorage.removeItem(LOADING_STORAGE_KEY);
          } catch {
            // Ignore
          }
        }, 300);
      };

      // Wait for next frame to ensure content is painted
      requestAnimationFrame(() => {
        requestAnimationFrame(hideAfterLoad);
      });
    }
  }, []);

  const showLoading = useCallback((message: string = '', persist: boolean = false) => {
    setLoadingMessage(message);
    setIsLoading(true);

    // Persist to localStorage if needed (for page reloads)
    if (persist) {
      try {
        const state: LoadingState = {
          isLoading: true,
          message,
          timestamp: Date.now(),
        };
        localStorage.setItem(LOADING_STORAGE_KEY, JSON.stringify(state));
      } catch {
        // Ignore errors
      }
    }
  }, []);

  const hideLoading = useCallback(() => {
    setIsLoading(false);
    setLoadingMessage('');

    // Clear persisted state
    try {
      localStorage.removeItem(LOADING_STORAGE_KEY);
    } catch {
      // Ignore errors
    }
  }, []);

  return (
    <LoadingContext.Provider
      value={{
        isLoading,
        loadingMessage,
        showLoading,
        hideLoading,
      }}
    >
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
}
