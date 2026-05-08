'use client';

import { Input } from '@/components/ui/Input';
import { HexColorField } from './HexColorField';
import type { WebChatAppearance, WebChatPosition, WebChatBubbleShape } from '@/lib/types/webchat-config';

interface AppearanceFormProps {
  value: WebChatAppearance;
  onChange: (value: WebChatAppearance) => void;
}

export function AppearanceForm({ value, onChange }: AppearanceFormProps) {
  const update = <K extends keyof WebChatAppearance>(key: K, val: WebChatAppearance[K]) => {
    onChange({ ...value, [key]: val });
  };

  return (
    <div className="space-y-6">
      {/* Posicion + forma */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Posicion</label>
          <select
            value={value.position}
            onChange={(e) => update('position', e.target.value as WebChatPosition)}
            className="w-full rounded-lg bg-[var(--bg-input)] text-[var(--text-primary)] text-sm border border-[var(--border-primary)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
          >
            <option value="bottom-right">Inferior derecha</option>
            <option value="bottom-left">Inferior izquierda</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">Forma del boton</label>
          <select
            value={value.bubbleShape}
            onChange={(e) => update('bubbleShape', e.target.value as WebChatBubbleShape)}
            className="w-full rounded-lg bg-[var(--bg-input)] text-[var(--text-primary)] text-sm border border-[var(--border-primary)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
          >
            <option value="circle">Circulo</option>
            <option value="square">Cuadrado redondeado</option>
          </select>
        </div>
      </div>

      {/* Colores */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">Colores</h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <HexColorField label="Color del boton" value={value.bubbleColor} onChange={(v) => update('bubbleColor', v)} />
          <HexColorField label="Fondo del header" value={value.headerBgColor} onChange={(v) => update('headerBgColor', v)} />
          <HexColorField label="Texto del header" value={value.headerTextColor} onChange={(v) => update('headerTextColor', v)} />
          <HexColorField label="Fondo burbuja visitante" value={value.visitorBubbleBg} onChange={(v) => update('visitorBubbleBg', v)} />
          <HexColorField label="Texto burbuja visitante" value={value.visitorBubbleText} onChange={(v) => update('visitorBubbleText', v)} />
          <HexColorField label="Fondo burbuja IA" value={value.aiBubbleBg} onChange={(v) => update('aiBubbleBg', v)} />
          <HexColorField label="Texto burbuja IA" value={value.aiBubbleText} onChange={(v) => update('aiBubbleText', v)} />
        </div>
      </div>

      {/* Logo */}
      <div>
        <Input
          label="URL del logo (opcional)"
          type="url"
          value={value.logoUrl ?? ''}
          onChange={(e) => update('logoUrl', e.target.value.trim() === '' ? null : e.target.value.trim())}
          placeholder="https://miempresa.com/logo.png"
          helperText="Mostrado en el header del widget. Recomendado 64x64px PNG/SVG. TODO Fase 4: upload directo a Supabase Storage."
        />
      </div>
    </div>
  );
}
