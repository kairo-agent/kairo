'use client';

import { type ReactNode } from 'react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ModalProvider } from '@/contexts/ModalContext';
import { AlertModal } from '@/components/ui/Modal';
import { useModal } from '@/contexts/ModalContext';

interface AuthLayoutProps {
  children: ReactNode;
}

function ModalRenderer() {
  const { modal, closeModal } = useModal();

  if (!modal) return null;

  return (
    <AlertModal
      isOpen={modal.isOpen}
      onClose={closeModal}
      type={modal.type}
      title={modal.title}
      message={modal.message}
      onConfirm={modal.onConfirm}
    />
  );
}

function AuthLayoutContent({ children }: AuthLayoutProps) {
  return (
    <>
      {children}
      <ModalRenderer />
    </>
  );
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <ThemeProvider>
      <ModalProvider>
        <AuthLayoutContent>{children}</AuthLayoutContent>
      </ModalProvider>
    </ThemeProvider>
  );
}
