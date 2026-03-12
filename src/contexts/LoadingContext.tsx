'use client';

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

const LOADING_STORAGE_KEY = 'kairo-loading-state';
const MAX_LOADING_AGE = 10000;
const SAFETY_TIMEOUT = 8000;

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

function readPersistedLoading(): { isLoading: boolean; message: string } {
  try {
    const stored = localStorage.getItem(LOADING_STORAGE_KEY);
    if (stored) {
      const state = JSON.parse(stored);
      if (state.isLoading && (Date.now() - state.timestamp) < MAX_LOADING_AGE) {
        localStorage.removeItem(LOADING_STORAGE_KEY);
        return { isLoading: true, message: state.message || '' };
      }
      localStorage.removeItem(LOADING_STORAGE_KEY);
    }
  } catch {
    // Ignore
  }
  return { isLoading: false, message: '' };
}

export function LoadingProvider({ children }: LoadingProviderProps) {
  const [{ isLoading, message: loadingMessage }, setLoadingState] = useState(() => {
    if (typeof window === 'undefined') return { isLoading: false, message: '' };
    return readPersistedLoading();
  });
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSafetyTimeout = useCallback(() => {
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
  }, []);

  const showLoading = useCallback((message: string = '', persist: boolean = false) => {
    setLoadingState({ isLoading: true, message });
    clearSafetyTimeout();
    safetyTimeoutRef.current = setTimeout(() => {
      setLoadingState({ isLoading: false, message: '' });
      try { localStorage.removeItem(LOADING_STORAGE_KEY); } catch { /* ignore */ }
    }, SAFETY_TIMEOUT);

    if (persist) {
      try {
        localStorage.setItem(LOADING_STORAGE_KEY, JSON.stringify({
          isLoading: true,
          message,
          timestamp: Date.now(),
        }));
      } catch { /* ignore */ }
    }
  }, [clearSafetyTimeout]);

  const hideLoading = useCallback(() => {
    clearSafetyTimeout();
    setLoadingState({ isLoading: false, message: '' });
    try { localStorage.removeItem(LOADING_STORAGE_KEY); } catch { /* ignore */ }
  }, [clearSafetyTimeout]);

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
