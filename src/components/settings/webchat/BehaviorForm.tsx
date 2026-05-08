'use client';

import { cn } from '@/lib/utils';
import type { WebChatBehavior } from '@/lib/types/webchat-config';

interface BehaviorFormProps {
  value: WebChatBehavior;
  onChange: (value: WebChatBehavior) => void;
}

export function BehaviorForm({ value, onChange }: BehaviorFormProps) {
  const update = <K extends keyof WebChatBehavior>(key: K, val: WebChatBehavior[K]) => {
    onChange({ ...value, [key]: val });
  };

  return (
    <div className="space-y-5">
      {/* Auto-open delay */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
          Auto-abrir despues de (segundos)
        </label>
        <input
          type="number"
          min={0}
          max={60}
          value={value.autoOpenDelay}
          onChange={(e) => update('autoOpenDelay', Math.max(0, Math.min(60, Number(e.target.value) || 0)))}
          className="w-full sm:w-40 rounded-lg bg-[var(--bg-input)] text-[var(--text-primary)] text-sm border border-[var(--border-primary)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
        />
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
          0 = nunca abrir automaticamente. Maximo 60 segundos.
        </p>
      </div>

      {/* Sound enabled */}
      <div className="flex items-start justify-between gap-4 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] p-3">
        <div className="flex-1">
          <h4 className="text-sm font-medium text-[var(--text-primary)]">Sonido al recibir mensajes</h4>
          <p className="mt-1 text-xs text-[var(--text-tertiary)]">
            Reproduce un beep suave cuando llega una respuesta del agente IA.
          </p>
        </div>
        <button
          type="button"
          onClick={() => update('soundEnabled', !value.soundEnabled)}
          className={cn(
            'relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0',
            value.soundEnabled ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-secondary)]'
          )}
          aria-label="Toggle sonido"
        >
          <div
            className={cn(
              'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200',
              value.soundEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'
            )}
          />
        </button>
      </div>

      {/* Session timeout */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
          Tiempo de sesion (horas)
        </label>
        <input
          type="number"
          min={1}
          max={24}
          value={value.sessionTimeoutHours}
          onChange={(e) => update('sessionTimeoutHours', Math.max(1, Math.min(24, Number(e.target.value) || 1)))}
          className="w-full sm:w-40 rounded-lg bg-[var(--bg-input)] text-[var(--text-primary)] text-sm border border-[var(--border-primary)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
        />
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
          Despues de este tiempo sin actividad, la conversacion se cierra y al volver se inicia una nueva. Rango 1-24h.
        </p>
      </div>
    </div>
  );
}
