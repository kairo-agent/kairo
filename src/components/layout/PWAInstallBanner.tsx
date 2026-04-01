'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

const DISMISS_KEY = 'kairo-pwa-dismiss';
const COOLDOWN_DAYS = 10;

type Platform = 'android' | 'ios' | null;

function detectPlatform(): Platform {
  if (typeof window === 'undefined') return null;
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  return null;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in window.navigator && (window.navigator as unknown as { standalone: boolean }).standalone === true);
}

function isDismissed(): boolean {
  try {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (!dismissed) return false;
    const timestamp = parseInt(dismissed, 10);
    const daysPassed = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
    return daysPassed < COOLDOWN_DAYS;
  } catch {
    return false;
  }
}

export default function PWAInstallBanner() {
  const t = useTranslations('pwa');
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<Platform>(null);
  const [closing, setClosing] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const plat = detectPlatform();
    if (!plat || isStandalone() || isDismissed()) return;
    setPlatform(plat);

    if (plat === 'android') {
      const handler = (e: Event) => {
        e.preventDefault();
        deferredPromptRef.current = e as BeforeInstallPromptEvent;
        setVisible(true);
      };
      window.addEventListener('beforeinstallprompt', handler);
      // Show banner after short delay even without beforeinstallprompt (some browsers)
      const timer = setTimeout(() => setVisible(true), 3000);
      return () => {
        window.removeEventListener('beforeinstallprompt', handler);
        clearTimeout(timer);
      };
    }

    // iOS: show after short delay
    if (plat === 'ios') {
      const timer = setTimeout(() => setVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setVisible(false);
      try { localStorage.setItem(DISMISS_KEY, Date.now().toString()); } catch {}
    }, 300);
  }, []);

  const handleInstall = useCallback(async () => {
    if (platform === 'android' && deferredPromptRef.current) {
      deferredPromptRef.current.prompt();
      const result = await deferredPromptRef.current.userChoice;
      if (result.outcome === 'accepted') {
        setVisible(false);
      }
      deferredPromptRef.current = null;
    }
    // iOS: dismiss is the action (instructions shown in banner)
    if (platform === 'ios') {
      handleDismiss();
    }
  }, [platform, handleDismiss]);

  if (!visible || !platform) return null;

  const banner = (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        left: 0,
        right: 0,
        zIndex: 9999,
        transition: 'opacity 0.3s, transform 0.3s',
        animation: closing ? undefined : 'pwa-slide-up 0.4s ease-out',
        opacity: closing ? 0 : 1,
        transform: closing ? 'translateY(100%)' : 'translateY(0)',
        width: '100%',
        maxWidth: '90%',
        marginLeft: 'auto',
        marginRight: 'auto',
      }}
    >
      <div style={{ borderRadius: 12, backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', padding: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.65)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <img src="/icon-192.png" alt="KAIRO" style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0 }} />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#78350F', margin: 0 }}>KAIRO</p>
                <p style={{ fontSize: 12, color: '#92400E', margin: '2px 0 0' }}>
                  {t('subtitle')}
                </p>
              </div>
              <button
                onClick={handleDismiss}
                style={{ padding: 4, marginTop: -4, marginRight: -4, background: 'none', border: 'none', color: '#D97706', cursor: 'pointer' }}
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {platform === 'ios' && (
              <p style={{ fontSize: 12, color: '#92400E', marginTop: 8, lineHeight: 1.5 }}>
                {t('iosInstructions')}
              </p>
            )}

            <button
              onClick={handleInstall}
              style={{
                marginTop: 12,
                width: '100%',
                padding: '10px 16px',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                backgroundColor: '#F59E0B',
                color: '#000',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {platform === 'android' ? t('install') : t('understood')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(banner, document.body);
}

// Type for beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
