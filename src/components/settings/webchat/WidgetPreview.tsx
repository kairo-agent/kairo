'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { WebChatConfig } from '@/lib/types/webchat-config';

interface WidgetPreviewProps {
  config: WebChatConfig;
  locale: 'es' | 'en';
}

/**
 * Preview estatica del widget. Renderizada inline (no iframe) usando los
 * mismos colores/textos que el bundle real consumira en Fase 3.5.
 *
 * TODO Fase 3.5: reemplazar por iframe que cargue el bundle del widget con
 * `data-preview="true"` para que NO envie mensajes reales.
 */
export function WidgetPreview({ config, locale }: WidgetPreviewProps) {
  const [open, setOpen] = useState(true);
  const { appearance, texts, starterQuestions } = config;

  const headerTitle = locale === 'en' ? texts.headerTitleEn : texts.headerTitleEs;
  const headerSubtitle = locale === 'en' ? texts.headerSubtitleEn : texts.headerSubtitleEs;
  const teaser = locale === 'en' ? texts.teaserTextEn : texts.teaserTextEs;

  const isRight = appearance.position === 'bottom-right';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[var(--text-tertiary)]">
          Preview interactiva (no envia mensajes). TODO Fase 3.5: cargar bundle real con data-preview=&quot;true&quot;.
        </p>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-xs font-medium text-[var(--accent-text)] hover:underline"
        >
          {open ? 'Cerrar widget' : 'Abrir widget'}
        </button>
      </div>

      {/* Stage simulando una pagina web */}
      <div
        className="relative h-[480px] w-full overflow-hidden rounded-lg border border-[var(--border-primary)]"
        style={{
          background:
            'repeating-linear-gradient(45deg, var(--bg-tertiary) 0 8px, var(--bg-secondary) 8px 16px)',
        }}
      >
        {/* Mock content */}
        <div className="absolute inset-0 flex items-center justify-center text-xs text-[var(--text-tertiary)]">
          <span className="rounded bg-[var(--bg-secondary)] px-2 py-1">tu sitio web</span>
        </div>

        {/* Widget closed: bubble + teaser */}
        {!open && (
          <div className={cn('absolute bottom-4 flex flex-col items-end gap-2', isRight ? 'right-4 items-end' : 'left-4 items-start')}>
            {teaser && (
              <div
                className={cn(
                  'max-w-[220px] rounded-lg px-3 py-2 text-xs shadow-md',
                  isRight ? 'rounded-br-none' : 'rounded-bl-none'
                )}
                style={{
                  backgroundColor: appearance.headerBgColor,
                  color: appearance.headerTextColor,
                }}
              >
                {teaser}
              </div>
            )}
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={cn(
                'flex h-14 w-14 items-center justify-center shadow-lg transition-transform hover:scale-105',
                appearance.bubbleShape === 'circle' ? 'rounded-full' : 'rounded-2xl'
              )}
              style={{ backgroundColor: appearance.bubbleColor }}
              aria-label="Abrir widget"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke={appearance.headerTextColor} strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>
          </div>
        )}

        {/* Widget open: chat panel */}
        {open && (
          <div
            className={cn(
              'absolute bottom-4 flex h-[420px] w-[320px] flex-col overflow-hidden rounded-2xl shadow-2xl',
              isRight ? 'right-4' : 'left-4'
            )}
            style={{ backgroundColor: '#FFFFFF' }}
          >
            {/* Header */}
            <div
              className="flex items-center gap-3 px-4 py-3"
              style={{ backgroundColor: appearance.headerBgColor, color: appearance.headerTextColor }}
            >
              {appearance.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={appearance.logoUrl} alt="logo" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: appearance.bubbleColor }}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke={appearance.headerBgColor} strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold truncate">{headerTitle || 'Sin titulo'}</h4>
                {headerSubtitle && <p className="text-xs opacity-80 truncate">{headerSubtitle}</p>}
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Messages area */}
            <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3" style={{ backgroundColor: '#FAFAFA' }}>
              <div
                className="max-w-[80%] rounded-2xl rounded-bl-sm px-3 py-2 text-xs"
                style={{ backgroundColor: appearance.aiBubbleBg, color: appearance.aiBubbleText }}
              >
                {locale === 'en' ? 'Hi! How can I help you today?' : '¡Hola! ¿En que puedo ayudarte hoy?'}
              </div>
              <div className="flex justify-end">
                <div
                  className="max-w-[80%] rounded-2xl rounded-br-sm px-3 py-2 text-xs"
                  style={{ backgroundColor: appearance.visitorBubbleBg, color: appearance.visitorBubbleText }}
                >
                  {locale === 'en' ? 'Hi, I have a question' : 'Hola, tengo una consulta'}
                </div>
              </div>

              {/* Starter questions */}
              {starterQuestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {starterQuestions.map((q, idx) => {
                    const text = locale === 'en' ? q.textEn : q.textEs;
                    if (!text) return null;
                    return (
                      <button
                        key={idx}
                        type="button"
                        className="rounded-full border px-2.5 py-1 text-[11px] transition-colors hover:opacity-80"
                        style={{ borderColor: appearance.bubbleColor, color: appearance.headerBgColor }}
                      >
                        {text}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-gray-200 px-3 py-2" style={{ backgroundColor: '#FFFFFF' }}>
              <div className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5">
                <span className="flex-1 text-xs text-gray-400">
                  {locale === 'en' ? 'Type a message...' : 'Escribe un mensaje...'}
                </span>
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full"
                  style={{ backgroundColor: appearance.bubbleColor }}
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke={appearance.headerBgColor} strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
