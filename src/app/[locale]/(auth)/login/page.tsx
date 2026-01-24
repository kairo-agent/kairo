'use client';

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import { Link, useRouter, usePathname } from '@/i18n/routing';
import { useTheme } from '@/contexts/ThemeContext';
import { useModal } from '@/contexts/ModalContext';
import { useLoading } from '@/contexts/LoadingContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { signIn } from '@/lib/actions/auth';

// Numero de pulsos simultaneos
const NUM_PULSES = 8;

// Tipo para un pulso individual
interface Pulse {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  key: number; // Para forzar re-render con nueva posicion
}

// Generar posicion aleatoria para un pulso (evitando el centro donde esta el login)
const generateRandomPulse = (id: number, key: number): Pulse => {
  // Generar posicion aleatoria, evitando el area central (25-75% en ambos ejes)
  let x: number, y: number;
  const rand = Math.random();

  if (rand < 0.5) {
    // Lado izquierdo o derecho
    x = Math.random() < 0.5 ? Math.random() * 20 : 80 + Math.random() * 20;
    y = Math.random() * 100;
  } else {
    // Arriba o abajo
    x = Math.random() * 100;
    y = Math.random() < 0.5 ? Math.random() * 25 : 75 + Math.random() * 25;
  }

  return {
    id,
    x,
    y,
    size: 80 + Math.random() * 100, // tamano entre 80-180px
    duration: 6 + Math.random() * 4, // duracion entre 6-10s (mas lento)
    delay: Math.random() * 3, // delay inicial aleatorio 0-3s
    key,
  };
};

export default function LoginPage() {
  const { theme, toggleTheme } = useTheme();
  const { showError } = useModal();
  const { showLoading } = useLoading();
  const t = useTranslations('login');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  // Funcion para cambiar el idioma
  const switchLocale = (newLocale: 'es' | 'en') => {
    if (newLocale !== locale) {
      router.replace(pathname, { locale: newLocale });
    }
  };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  // Estado para los pulsos con posiciones aleatorias
  const [pulses, setPulses] = useState<Pulse[]>([]);
  const [keyCounter, setKeyCounter] = useState(NUM_PULSES);

  // Inicializar pulsos con posiciones aleatorias
  useEffect(() => {
    const initialPulses = Array.from({ length: NUM_PULSES }, (_, i) =>
      generateRandomPulse(i, i)
    );
    setPulses(initialPulses);
  }, []);

  // Regenerar un pulso en nueva posicion cuando termina su animacion
  const handlePulseEnd = useCallback((pulseId: number) => {
    setKeyCounter(prev => prev + 1);
    setPulses(prev => prev.map(p =>
      p.id === pulseId ? generateRandomPulse(pulseId, keyCounter + 1) : p
    ));
  }, [keyCounter]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      newErrors.email = t('errors.emailRequired');
    } else if (!validateEmail(email)) {
      newErrors.email = t('errors.emailInvalid');
    }

    if (!password.trim()) {
      newErrors.password = t('errors.passwordRequired');
    } else if (password.length < 6) {
      newErrors.password = t('errors.passwordMinLength');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const result = await signIn(email, password);

      if (result.success && result.redirectTo) {
        // Determine redirect destination
        let finalRedirect = result.redirectTo;

        // For super_admin: check if org is already selected in localStorage
        if (result.user?.systemRole === 'super_admin') {
          const savedOrg = localStorage.getItem('kairo-selected-org');
          if (savedOrg) {
            // Already has org selected, go directly to leads
            finalRedirect = '/leads';
          }
          // Otherwise, redirectTo is already /select-workspace
        }

        // Show loading overlay and redirect immediately
        showLoading(t('success.message'), true);
        router.push(finalRedirect as '/select-workspace' | '/leads');
      } else if (result.error) {
        // Use the error code to get translated message
        const errorMessage = t(`errors.${result.error}`);
        showError(t('error.title'), errorMessage);
      }
    } catch {
      showError(t('error.title'), t('errors.server_error'));
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const EyeIcon = () => (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  );

  const EyeOffIcon = () => (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
      />
    </svg>
  );

  const EmailIcon = () => (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  );

  const LockIcon = () => (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  );

  const ThemeToggleIcon = () => (
    <svg
      className="w-5 h-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      {theme === 'light' ? (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
        />
      ) : (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
        />
      )}
    </svg>
  );

  return (
    <div
      className="min-h-screen w-full flex flex-col relative overflow-hidden"
      style={{
        backgroundColor: theme === 'light'
          ? 'rgba(0, 229, 255, 0.2)'
          : 'var(--bg-primary)',
      }}
    >
      {/* Fondo animado con pulsos de leads */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Gradiente base sutil - luz central detras de la caja */}
        <div
          className="absolute inset-0"
          style={{
            background: theme === 'light'
              ? 'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.85) 0%, transparent 60%)'
              : 'radial-gradient(ellipse at center, rgba(0, 229, 255, 0.1) 0%, transparent 70%)',
          }}
        />

        {/* Pulsos de leads - Posiciones aleatorias, animacion elegante */}
        {pulses.map((pulse) => (
          <div
            key={pulse.key}
            className="absolute"
            style={{
              left: `${pulse.x}%`,
              top: `${pulse.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {/* Anillo exterior que se expande suavemente */}
            <div
              className="absolute rounded-full"
              style={{
                width: pulse.size,
                height: pulse.size,
                left: -pulse.size / 2,
                top: -pulse.size / 2,
                opacity: 0,
                transform: 'scale(0)',
                background: theme === 'light'
                  ? 'radial-gradient(circle, rgba(11, 18, 32, 0.15) 0%, rgba(11, 18, 32, 0.05) 40%, transparent 70%)'
                  : 'radial-gradient(circle, rgba(0, 229, 255, 0.18) 0%, rgba(0, 229, 255, 0.06) 40%, transparent 70%)',
                animation: `leadPulseGlow ${pulse.duration}s ease-in-out forwards`,
                animationDelay: `${pulse.delay}s`,
              }}
              onAnimationEnd={() => handlePulseEnd(pulse.id)}
            />
            {/* Nucleo del pulso - mas sutil */}
            <div
              className="absolute rounded-full"
              style={{
                width: pulse.size * 0.25,
                height: pulse.size * 0.25,
                left: -pulse.size * 0.125,
                top: -pulse.size * 0.125,
                opacity: 0,
                transform: 'scale(0)',
                background: theme === 'light'
                  ? 'radial-gradient(circle, rgba(11, 18, 32, 0.25) 0%, rgba(11, 18, 32, 0.08) 50%, transparent 70%)'
                  : 'radial-gradient(circle, rgba(0, 229, 255, 0.35) 0%, rgba(0, 229, 255, 0.12) 50%, transparent 70%)',
                animation: `leadPulse ${pulse.duration}s ease-in-out forwards`,
                animationDelay: `${pulse.delay}s`,
              }}
            />
          </div>
        ))}

        {/* Patron de puntos sutil (grid de fondo) */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: theme === 'light'
              ? 'radial-gradient(circle, rgba(11, 18, 32, 0.06) 1px, transparent 1px)'
              : 'radial-gradient(circle, rgba(0, 229, 255, 0.12) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            opacity: 0.5,
          }}
        />
      </div>

      {/* Controles superiores - Selector de idioma y toggle de tema */}
      <div className="absolute top-4 right-4 z-10 sm:top-6 sm:right-6 flex items-center gap-2">
        {/* Selector de idioma ES/EN */}
        <div className="flex items-center rounded-lg bg-[var(--bg-card)] border border-[var(--border-primary)] shadow-sm overflow-hidden">
          <button
            onClick={() => switchLocale('es')}
            className={`px-3 py-2 text-sm font-medium transition-all duration-200 ${
              locale === 'es'
                ? 'bg-[var(--kairo-cyan)] text-[var(--kairo-midnight)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
            }`}
            aria-label={t('ariaLabels.changeLanguage', { language: t('language.spanish') })}
            aria-pressed={locale === 'es'}
          >
            {t('language.es')}
          </button>
          <div className="w-px h-5 bg-[var(--border-primary)]" />
          <button
            onClick={() => switchLocale('en')}
            className={`px-3 py-2 text-sm font-medium transition-all duration-200 ${
              locale === 'en'
                ? 'bg-[var(--kairo-cyan)] text-[var(--kairo-midnight)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'
            }`}
            aria-label={t('ariaLabels.changeLanguage', { language: t('language.english') })}
            aria-pressed={locale === 'en'}
          >
            {t('language.en')}
          </button>
        </div>

        {/* Toggle de tema */}
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-all duration-200 shadow-sm"
          aria-label={t('ariaLabels.toggleTheme', { theme: theme === 'light' ? 'oscuro' : 'claro' })}
        >
          <ThemeToggleIcon />
        </button>
      </div>

      {/* Contenido principal */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:px-6 lg:px-8 relative z-0">
        <div className="w-full max-w-md animate-fade-in">
          {/* Card del formulario - Fondo oscuro (midnight en light, gray en dark) */}
          <div className="bg-[var(--login-card-bg)] rounded-2xl border border-[var(--kairo-gray)] shadow-2xl p-6 sm:p-8">
            {/* Logo principal (blanco) sobre fondo oscuro */}
            <div className="flex justify-center mb-6">
              <div className="relative h-12 w-35">
                <Image
                  src="/images/logo-main.png"
                  alt="KAIRO Logo"
                  fill
                  sizes="140px"
                  priority
                  style={{ objectFit: 'contain' }}
                />
              </div>
            </div>

            {/* Mensaje de bienvenida */}
            <div className="text-center mb-8">
              <h1 className="text-xl sm:text-2xl font-semibold text-white mb-2">
                {t('title')}
              </h1>
              <p className="text-sm text-gray-400">
                {t('subtitle')}
              </p>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Campo Email */}
              <Input
                type="email"
                label={t('emailLabel')}
                placeholder={t('emailPlaceholder')}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) {
                    setErrors((prev) => ({ ...prev, email: undefined }));
                  }
                }}
                error={errors.email}
                leftIcon={<EmailIcon />}
                disabled={isLoading}
                autoComplete="email"
                size="lg"
              />

              {/* Campo Password */}
              <Input
                type={showPassword ? 'text' : 'password'}
                label={t('passwordLabel')}
                placeholder={t('passwordPlaceholder')}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) {
                    setErrors((prev) => ({ ...prev, password: undefined }));
                  }
                }}
                error={errors.password}
                leftIcon={<LockIcon />}
                rightIcon={
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="focus:outline-none hover:text-[var(--text-primary)] transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? t('ariaLabels.hidePassword') : t('ariaLabels.showPassword')}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                }
                disabled={isLoading}
                autoComplete="current-password"
                size="lg"
              />

              {/* Link Olvidaste contrasena */}
              <div className="flex justify-end">
                <Link
                  href="/forgot-password"
                  className="text-sm text-[var(--kairo-cyan)] hover:text-cyan-300 transition-colors font-medium"
                >
                  {t('forgotPassword')}
                </Link>
              </div>

              {/* Boton Submit */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                isLoading={isLoading}
              >
                {isLoading ? tCommon('buttons.loading') : t('loginButton')}
              </Button>
            </form>

            {/* Separador y Link a registro - OCULTO temporalmente
                Solo super_admin puede crear cuentas por ahora.
                Para habilitar registro público, descomentar este bloque.
            */}
            {/*
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-600" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-[var(--kairo-midnight)] text-gray-500">
                  o
                </span>
              </div>
            </div>

            <p className="text-center text-sm text-gray-400">
              {t('noAccount')}{' '}
              <Link
                href="/register"
                className="text-[var(--kairo-cyan)] hover:text-cyan-300 transition-colors font-medium"
              >
                {t('createAccount')}
              </Link>
            </p>
            */}
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-[var(--text-tertiary)] mt-6">
            {t('termsText')}{' '}
            <Link href="/terms" className="underline hover:text-[var(--text-secondary)]">
              {t('terms')}
            </Link>{' '}
            {t('and')}{' '}
            <Link href="/privacy" className="underline hover:text-[var(--text-secondary)]">
              {t('privacy')}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
