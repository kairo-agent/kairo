'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';

export default function DashboardOverviewPage() {
  const tNav = useTranslations('navigation');
  const tLeads = useTranslations('leads');

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">
          Bienvenido a KAIRO
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Resumen de tu actividad y metricas clave
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#3B82F6"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--text-primary)]">0</p>
              <p className="text-xs text-[var(--text-secondary)]">
                {tLeads('stats.total')} {tNav('leads').toLowerCase()}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#10B981"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--text-primary)]">0</p>
              <p className="text-xs text-[var(--text-secondary)]">
                {tNav('leads')} {tLeads('status.won').toLowerCase()}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#F59E0B"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--text-primary)]">0</p>
              <p className="text-xs text-[var(--text-secondary)]">{tNav('conversations')}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#00E5FF"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <circle cx="12" cy="5" r="2" />
                <path d="M12 7v4" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--text-primary)]">0</p>
              <p className="text-xs text-[var(--text-secondary)]">{tNav('agents')} activos</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main content placeholder */}
      <Card className="p-8">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--accent-primary-light)] flex items-center justify-center mb-4">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--accent-primary)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
            {tNav('dashboard')} en construccion
          </h3>
          <p className="text-sm text-[var(--text-secondary)] max-w-md">
            Aqui veras graficas, metricas y un resumen de tu actividad. Por ahora, navega a la
            seccion de {tNav('leads')} para comenzar a gestionar tus prospectos.
          </p>
        </div>
      </Card>
    </div>
  );
}
