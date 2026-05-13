'use client';

import { Input } from '@/components/ui/Input';
import {
  MAX_HEADER_TITLE_LENGTH,
  MAX_HEADER_SUBTITLE_LENGTH,
  MAX_TEASER_LENGTH,
  type WebChatTexts,
} from '@/lib/types/webchat-config';

interface TextsFormProps {
  value: WebChatTexts;
  onChange: (value: WebChatTexts) => void;
}

export function TextsForm({ value, onChange }: TextsFormProps) {
  const update = <K extends keyof WebChatTexts>(key: K, val: WebChatTexts[K]) => {
    onChange({ ...value, [key]: val });
  };

  return (
    <div className="space-y-6">
      {/* Header titulo */}
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">Titulo del header</h4>
        <p className="text-xs text-[var(--text-tertiary)]">Texto principal del widget abierto. Max {MAX_HEADER_TITLE_LENGTH} caracteres.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <Input
            label="Espanol"
            value={value.headerTitleEs}
            onChange={(e) => update('headerTitleEs', e.target.value)}
            maxLength={MAX_HEADER_TITLE_LENGTH}
            showCounter={false}
          />
          <Input
            label="English"
            value={value.headerTitleEn}
            onChange={(e) => update('headerTitleEn', e.target.value)}
            maxLength={MAX_HEADER_TITLE_LENGTH}
            showCounter={false}
          />
        </div>
      </div>

      {/* Header subtitulo */}
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">Subtitulo del header</h4>
        <p className="text-xs text-[var(--text-tertiary)]">Texto secundario debajo del titulo. Max {MAX_HEADER_SUBTITLE_LENGTH} caracteres.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <Input
            label="Espanol"
            value={value.headerSubtitleEs}
            onChange={(e) => update('headerSubtitleEs', e.target.value)}
            maxLength={MAX_HEADER_SUBTITLE_LENGTH}
          />
          <Input
            label="English"
            value={value.headerSubtitleEn}
            onChange={(e) => update('headerSubtitleEn', e.target.value)}
            maxLength={MAX_HEADER_SUBTITLE_LENGTH}
          />
        </div>
      </div>

      {/* Teaser */}
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">Teaser (mensaje preview)</h4>
        <p className="text-xs text-[var(--text-tertiary)]">Burbuja de invitacion antes de abrir el widget. Max {MAX_TEASER_LENGTH} caracteres.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <Input
            label="Espanol"
            value={value.teaserTextEs}
            onChange={(e) => update('teaserTextEs', e.target.value)}
            maxLength={MAX_TEASER_LENGTH}
          />
          <Input
            label="English"
            value={value.teaserTextEn}
            onChange={(e) => update('teaserTextEn', e.target.value)}
            maxLength={MAX_TEASER_LENGTH}
          />
        </div>
      </div>
    </div>
  );
}
