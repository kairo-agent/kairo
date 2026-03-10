'use client';

import { useEffect } from 'react';
import { useLocale } from 'next-intl';

/**
 * Client component that saves the current URL before redirecting to login.
 * This preserves query params (e.g. ?leadId=xxx) for post-login deep-linking,
 * which server-side redirect() cannot do in Next.js layouts.
 */
export default function AuthRedirect() {
  const locale = useLocale();

  useEffect(() => {
    // Save the full URL (including query params) for post-login redirect
    const fullUrl = window.location.pathname + window.location.search;
    if (fullUrl && fullUrl !== `/${locale}/login`) {
      sessionStorage.setItem('kairo-redirect-after-login', fullUrl);
    }
    // Navigate to login
    window.location.href = `/${locale}/login`;
  }, [locale]);

  // Show nothing while redirecting
  return null;
}
