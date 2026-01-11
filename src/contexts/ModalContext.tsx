'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { ModalConfig } from '@/types';

interface ModalContextValue {
  modal: ModalConfig | null;
  showModal: (config: Omit<ModalConfig, 'isOpen'>) => void;
  showSuccess: (title: string, message: string) => void;
  showError: (title: string, message: string) => void;
  showWarning: (title: string, message: string) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextValue | undefined>(undefined);

interface ModalProviderProps {
  children: ReactNode;
}

export function ModalProvider({ children }: ModalProviderProps) {
  const [modal, setModal] = useState<ModalConfig | null>(null);

  const showModal = useCallback((config: Omit<ModalConfig, 'isOpen'>) => {
    setModal({ ...config, isOpen: true });
  }, []);

  const showSuccess = useCallback((title: string, message: string) => {
    setModal({ isOpen: true, type: 'success', title, message });
  }, []);

  const showError = useCallback((title: string, message: string) => {
    setModal({ isOpen: true, type: 'error', title, message });
  }, []);

  const showWarning = useCallback((title: string, message: string) => {
    setModal({ isOpen: true, type: 'warning', title, message });
  }, []);

  const showConfirm = useCallback((title: string, message: string, onConfirm: () => void) => {
    setModal({ isOpen: true, type: 'confirm', title, message, onConfirm });
  }, []);

  const closeModal = useCallback(() => {
    setModal(null);
  }, []);

  return (
    <ModalContext.Provider
      value={{ modal, showModal, showSuccess, showError, showWarning, showConfirm, closeModal }}
    >
      {children}
    </ModalContext.Provider>
  );
}

export function useModal(): ModalContextValue {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}
