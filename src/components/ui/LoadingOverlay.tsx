'use client';

// ============================================
// KAIRO - Loading Overlay Component
// Global loading modal with logo animations
// Supports light/dark themes
// ============================================

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useTheme } from '@/contexts/ThemeContext';
import { useLoading } from '@/contexts/LoadingContext';
import { cn } from '@/lib/utils';

export function LoadingOverlay() {
  const { isLoading, loadingMessage } = useLoading();
  const { theme } = useTheme();
  const [dots, setDots] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  // Animate dots
  useEffect(() => {
    if (!isLoading) return;

    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 400);

    return () => clearInterval(interval);
  }, [isLoading]);

  // Handle mount/unmount animation
  useEffect(() => {
    if (isLoading) {
      setShouldRender(true);
      // Small delay to trigger CSS transition
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
      // Wait for fade out animation before unmounting
      const timeout = setTimeout(() => {
        setShouldRender(false);
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [isLoading]);

  if (!shouldRender) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-[9999] flex items-center justify-center',
        'transition-all duration-300 ease-out',
        isVisible ? 'opacity-100' : 'opacity-0'
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Loading"
    >
      {/* Backdrop with blur */}
      <div
        className={cn(
          'absolute inset-0',
          'backdrop-blur-md',
          theme === 'dark'
            ? 'bg-[#0B1220]/80'
            : 'bg-white/80'
        )}
      />

      {/* Content container */}
      <div
        className={cn(
          'relative z-10 flex flex-col items-center gap-6',
          'transition-transform duration-300 ease-out',
          isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        )}
      >
        {/* Logo container with glow effect */}
        <div className="relative">
          {/* Glow effect - outer */}
          <div
            className={cn(
              'absolute inset-0 rounded-full',
              'animate-loading-glow-outer',
              theme === 'dark'
                ? 'bg-[#00E5FF]/20'
                : 'bg-[#00E5FF]/15'
            )}
            style={{
              width: '140px',
              height: '140px',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              filter: 'blur(20px)',
            }}
          />

          {/* Glow effect - inner */}
          <div
            className={cn(
              'absolute inset-0 rounded-full',
              'animate-loading-glow-inner',
              theme === 'dark'
                ? 'bg-[#00E5FF]/30'
                : 'bg-[#00E5FF]/20'
            )}
            style={{
              width: '100px',
              height: '100px',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              filter: 'blur(10px)',
            }}
          />

          {/* Logo with pulse animation */}
          <div className="relative w-24 h-24 animate-loading-pulse">
            <Image
              src={theme === 'dark' ? '/images/logo-main.png' : '/images/logo-oscuro.png'}
              alt="KAIRO"
              fill
              sizes="96px"
              priority
              style={{ objectFit: 'contain' }}
            />
          </div>

          {/* Shimmer overlay */}
          <div
            className={cn(
              'absolute inset-0 overflow-hidden rounded-lg',
              'animate-loading-shimmer'
            )}
          >
            <div
              className={cn(
                'absolute inset-0',
                'bg-gradient-to-r from-transparent via-white/20 to-transparent',
                '-translate-x-full'
              )}
              style={{
                animation: 'shimmer 2s infinite',
              }}
            />
          </div>
        </div>

        {/* Loading text */}
        <div className="flex flex-col items-center gap-2">
          {loadingMessage && (
            <p
              className={cn(
                'text-sm font-medium',
                theme === 'dark'
                  ? 'text-white/80'
                  : 'text-[#0B1220]/80'
              )}
            >
              {loadingMessage}
            </p>
          )}

          {/* Animated dots indicator */}
          <div className="flex items-center gap-1.5">
            <div
              className={cn(
                'w-2 h-2 rounded-full animate-loading-dot-1',
                theme === 'dark' ? 'bg-[#00E5FF]' : 'bg-[#00E5FF]'
              )}
            />
            <div
              className={cn(
                'w-2 h-2 rounded-full animate-loading-dot-2',
                theme === 'dark' ? 'bg-[#00E5FF]' : 'bg-[#00E5FF]'
              )}
            />
            <div
              className={cn(
                'w-2 h-2 rounded-full animate-loading-dot-3',
                theme === 'dark' ? 'bg-[#00E5FF]' : 'bg-[#00E5FF]'
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoadingOverlay;
