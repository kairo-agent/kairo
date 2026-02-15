'use client';

// ============================================
// KAIRO - Lead Chat Component
// WhatsApp conversation with handoff support
// Con Supabase Realtime para mensajes en modo Human
// ============================================

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import imageCompression from 'browser-image-compression';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn, formatRelativeTime } from '@/lib/utils';
import {
  getLeadConversation,
  sendMessage,
  toggleHandoffMode,
  getLeadHandoffStatus,
  markMessagesAsRead,
  getLeadProjectId,
  type MessageForChat,
  type PaginatedConversation,
} from '@/lib/actions/messages';
import { useMediaUpload } from '@/hooks/useMediaUpload';
import { useRealtimeMessages, type RealtimeMessage, type MessageStatusUpdate } from '@/hooks/useRealtimeMessages';
import ChatInput, { type ChatAttachment, type ChatInputRef } from './ChatInput';

// Dynamic import for emoji picker (client-side only)
const EmojiPicker = dynamic(
  () => import('@emoji-mart/react').then((mod) => mod.default),
  { ssr: false, loading: () => null }
);

// ============================================
// Types
// ============================================

interface LeadChatProps {
  leadId: string;
  leadName: string;
  isOpen?: boolean;
}

// ============================================
// Icons
// ============================================

const RobotIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const UserIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const SpinnerIcon = ({ className }: { className?: string }) => (
  <svg className={cn('animate-spin', className)} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const LiveIcon = () => (
  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 8 8">
    <circle cx="4" cy="4" r="3" />
  </svg>
);

// ============================================
// Component
// ============================================

export function LeadChat({ leadId, leadName, isOpen = true }: LeadChatProps) {
  const t = useTranslations('leads');
  const tCommon = useTranslations('common');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<ChatInputRef>(null);
  const queryClient = useQueryClient();

  // Direct upload hook (bypasses Vercel 4.5MB limit)
  const { upload: uploadMedia, isUploading } = useMediaUpload();

  // ============================================
  // React Query - Infinite Query for messages
  // ============================================
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isRefetching,
    error: queryError,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['conversation', leadId],
    queryFn: async ({ pageParam }) => {
      return getLeadConversation(leadId, { cursor: pageParam, limit: 50 });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage?.pagination?.nextCursor ?? undefined,
    enabled: isOpen && !!leadId,
    staleTime: 30000, // 30 segundos
    gcTime: 5 * 60 * 1000, // 5 minutos
  });

  // Combinar mensajes de todas las páginas (orden cronológico)
  const allMessages = useMemo(() => {
    if (!data?.pages) return [];
    // Las páginas vienen con mensajes ordenados cronológicamente
    // Página 0 = mensajes más recientes, páginas siguientes = más antiguos
    // Necesitamos invertir el orden de páginas para que los más antiguos estén primero
    const reversedPages = [...data.pages].reverse();
    return reversedPages.flatMap(page => page?.conversation?.messages ?? []);
  }, [data?.pages]);

  // La conversación base (para ID, etc.)
  const conversation = data?.pages[0]?.conversation ?? null;

  // State (reducido - ya no necesitamos isLoading ni conversation como state)
  const [isSending, setIsSending] = useState(false);
  const [isTogglingHandoff, setIsTogglingHandoff] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [emojiData, setEmojiData] = useState<any>(null);
  const [handoffStatus, setHandoffStatus] = useState<{
    mode: 'ai' | 'human';
    handoffAt: Date | null;
    handoffUser: string | null;
  } | null>(null);
  const [error, setError] = useState('');
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  // IDs de mensajes ya procesados para evitar duplicados
  const processedMessageIds = useRef<Set<string>>(new Set());

  // Load emoji data on demand
  useEffect(() => {
    if (showEmojiPicker && !emojiData) {
      import('@emoji-mart/data').then((mod) => setEmojiData(mod.default));
    }
  }, [showEmojiPicker, emojiData]);

  // Close emoji picker on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  // ============================================
  // Supabase Realtime - Solo en modo Human
  // ============================================

  /**
   * Callback cuando llega un nuevo mensaje via Realtime
   * Se encarga de:
   * 1. Verificar que no sea duplicado
   * 2. Agregarlo al cache de React Query
   * 3. Hacer scroll al final
   * 4. Marcar como leído si es del lead
   */
  const handleRealtimeMessage = useCallback(
    (realtimeMsg: RealtimeMessage) => {
      // Evitar duplicados - verificar si ya procesamos este mensaje
      if (processedMessageIds.current.has(realtimeMsg.id)) {
        console.log(`[RT] Mensaje duplicado ignorado: ${realtimeMsg.id}`);
        return;
      }

      // Marcar como procesado
      processedMessageIds.current.add(realtimeMsg.id);

      console.log(`[RT] Procesando nuevo mensaje: ${realtimeMsg.id}`);

      // Transformar a MessageForChat (optimizado, sin campos grandes innecesarios)
      const newMessage: MessageForChat = {
        id: realtimeMsg.id,
        conversationId: realtimeMsg.conversationId,
        sender: realtimeMsg.sender,
        content: realtimeMsg.content,
        createdAt: new Date(realtimeMsg.createdAt),
        sentByUserId: realtimeMsg.sentByUserId,
        whatsappMsgId: realtimeMsg.whatsappMsgId,
        isDelivered: realtimeMsg.isDelivered,
        isRead: realtimeMsg.isRead,
        metadata: realtimeMsg.metadata ?? null,
        sentByUser: null, // No tenemos esta info en el payload de Realtime
      };

      // Agregar al cache de React Query (primera página = mensajes más recientes)
      queryClient.setQueryData(
        ['conversation', leadId],
        (oldData: { pages: PaginatedConversation[]; pageParams: (string | undefined)[] } | undefined) => {
          if (!oldData?.pages?.[0]?.conversation) return oldData;

          // Verificar que no exista ya en la primera página
          const firstPageMessages = oldData.pages[0].conversation.messages;
          const exists = firstPageMessages.some((m) => m.id === newMessage.id);
          if (exists) return oldData;

          // Agregar mensaje al final de la primera página (mensajes más recientes)
          const updatedFirstPage: PaginatedConversation = {
            ...oldData.pages[0],
            conversation: {
              ...oldData.pages[0].conversation,
              messages: [...firstPageMessages, newMessage],
            },
          };

          return {
            ...oldData,
            pages: [updatedFirstPage, ...oldData.pages.slice(1)],
          };
        }
      );

      // Si es mensaje del lead, marcarlo como leído automáticamente (fire-and-forget)
      if (realtimeMsg.sender === 'lead' && leadId) {
        markMessagesAsRead(leadId).catch(err => {
          console.error('[KAIRO] markMessagesAsRead failed:', err instanceof Error ? err.message : err);
        });
      }
    },
    [leadId, queryClient]
  );

  // Hook de Supabase Realtime
  const isHumanMode = handoffStatus?.mode === 'human';

  /**
   * Callback cuando un mensaje se actualiza (delivered/read status)
   */
  const handleMessageStatusUpdate = useCallback((update: MessageStatusUpdate) => {
    queryClient.setQueryData(
      ['conversation', leadId],
      (oldData: { pages: PaginatedConversation[]; pageParams: (string | undefined)[] } | undefined) => {
        if (!oldData?.pages) return oldData;

        // Actualizar el mensaje en todas las páginas
        const updatedPages = oldData.pages.map((page) => {
          if (!page?.conversation?.messages) return page;

          const updatedMessages = page.conversation.messages.map((msg) => {
            if (msg.id === update.id) {
              return {
                ...msg,
                isDelivered: update.isDelivered,
                deliveredAt: update.deliveredAt ? new Date(update.deliveredAt) : null,
                isRead: update.isRead,
                readAt: update.readAt ? new Date(update.readAt) : null,
                whatsappMsgId: update.whatsappMsgId,
              };
            }
            return msg;
          });

          return {
            ...page,
            conversation: {
              ...page.conversation,
              messages: updatedMessages,
            },
          };
        });

        return {
          ...oldData,
          pages: updatedPages,
        };
      }
    );
  }, [leadId, queryClient]);

  useRealtimeMessages({
    conversationId: conversation?.id || null,
    enabled: isHumanMode && isOpen && !!conversation?.id,
    onNewMessage: handleRealtimeMessage,
    onMessageUpdate: handleMessageStatusUpdate,
    onConnected: () => {
      console.log('[RT] Conectado al canal de mensajes');
      setIsRealtimeConnected(true);
    },
    onDisconnected: () => {
      console.log('[RT] Desconectado del canal de mensajes');
      setIsRealtimeConnected(false);
    },
    onError: (err) => {
      console.error('[RT] Error:', err);
      setIsRealtimeConnected(false);
    },
  });

  // Limpiar IDs procesados cuando cambia el lead
  useEffect(() => {
    processedMessageIds.current.clear();
  }, [leadId]);

  // Actualizar IDs procesados cuando se cargan mensajes
  useEffect(() => {
    if (allMessages.length > 0) {
      allMessages.forEach((msg) => {
        processedMessageIds.current.add(msg.id);
      });
    }
  }, [allMessages]);

  // Cargar handoff status separadamente (React Query maneja los mensajes)
  const loadHandoffStatus = useCallback(async () => {
    if (!leadId) return;
    try {
      const status = await getLeadHandoffStatus(leadId);
      setHandoffStatus(status);
    } catch (err) {
      console.error('Error loading handoff status:', err);
    }
  }, [leadId]);

  // Load handoff status on mount and when isOpen changes
  useEffect(() => {
    if (isOpen && leadId) {
      loadHandoffStatus();
    }
  }, [isOpen, leadId, loadHandoffStatus]);

  // Marcar mensajes como leídos cuando se carga la conversación (fire-and-forget)
  useEffect(() => {
    if (conversation && leadId) {
      markMessagesAsRead(leadId).catch(err => {
        console.error('[KAIRO] markMessagesAsRead failed:', err instanceof Error ? err.message : err);
      });
    }
  }, [conversation, leadId]);

  // Scroll to bottom when messages change (solo para mensajes nuevos, no al cargar antiguos)
  const prevMessagesLength = useRef(0);
  useEffect(() => {
    // Solo hacer scroll si hay más mensajes que antes (mensaje nuevo)
    if (allMessages.length > prevMessagesLength.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessagesLength.current = allMessages.length;
  }, [allMessages.length]);

  // Handler para refresh manual
  const handleRefresh = useCallback(() => {
    setError('');
    refetch();
    loadHandoffStatus();
  }, [refetch, loadHandoffStatus]);

  // Send message handler
  const handleSendMessage = async (message: string, attachment?: ChatAttachment | null) => {
    if ((!message.trim() && !attachment) || isSending) return;

    setIsSending(true);
    setError('');

    try {
      let content = message.trim();
      let mediaUrl: string | undefined;
      let mediaType: 'image' | 'video' | 'document' | undefined;

      // Handle attachment upload
      if (attachment?.file) {
        // Get projectId for upload
        const projectResult = await getLeadProjectId(leadId);
        if (!projectResult.success || !projectResult.projectId) {
          setError(projectResult.error || 'Error al obtener proyecto');
          setIsSending(false);
          return;
        }

        let fileToUpload = attachment.file;

        // Compress image if it's larger than 1MB
        if (attachment.type === 'image' && attachment.file.size > 1024 * 1024) {
          try {
            const compressionOptions = {
              maxSizeMB: 1,
              maxWidthOrHeight: 1920,
              useWebWorker: true,
            };
            fileToUpload = await imageCompression(attachment.file, compressionOptions);
            console.log(`[COMPRESS] Image: ${attachment.file.size} -> ${fileToUpload.size} bytes`);
          } catch (compressionError) {
            console.error('Error comprimiendo imagen:', compressionError);
            // Continue with original file if compression fails
          }
        }

        // Upload directly to Supabase (bypasses Vercel 4.5MB limit)
        // RLS policies verify ProjectMember access server-side
        const uploadResult = await uploadMedia(projectResult.projectId, fileToUpload);
        if (!uploadResult.success || !uploadResult.url) {
          setError(uploadResult.error || 'Error al subir archivo');
          setIsSending(false);
          return;
        }

        mediaUrl = uploadResult.url;
        mediaType = attachment.type === 'image' ? 'image'
          : attachment.type === 'video' ? 'video'
          : 'document';

        // Content for DB: lightweight reference
        const mediaLabel = attachment.type === 'image' ? 'Imagen'
          : attachment.type === 'video' ? 'Video'
          : 'Archivo';
        content = content
          ? `${content}\n[${mediaLabel}: ${attachment.name}]`
          : `[${mediaLabel}: ${attachment.name}]`;
      }

      // For documents: pass filename and original message as caption
      const filename = attachment?.type === 'file' ? attachment.name : undefined;
      // Caption = original user message (for WhatsApp media captions)
      // Only send caption if there's actual text (not just the file label)
      const caption = attachment && message.trim() ? message.trim() : undefined;
      const result = await sendMessage(leadId, content, mediaUrl, mediaType, filename, caption);

      if (result.success && result.message) {
        // Marcar como procesado para tracking interno
        processedMessageIds.current.add(result.message.id);

        // NO agregamos al estado local - Supabase Realtime lo traerá
        // Esto evita duplicación por race condition entre:
        // 1. Agregado local optimista
        // 2. Evento INSERT de Realtime
        console.log(`[SEND] Mensaje enviado, esperando Realtime: ${result.message.id}`);
      } else {
        setError(result.error || 'Error al enviar mensaje');
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Error al enviar mensaje');
    } finally {
      setIsSending(false);
    }
  };

  // Handle emoji selection
  const handleEmojiSelect = (emoji: { native: string }) => {
    if (chatInputRef.current) {
      chatInputRef.current.insertEmoji(emoji.native);
    }
    setShowEmojiPicker(false);
  };

  // Toggle handoff mode
  const handleToggleHandoff = async () => {
    if (isTogglingHandoff || !handoffStatus) return;

    const newMode = handoffStatus.mode === 'ai' ? 'human' : 'ai';
    setIsTogglingHandoff(true);
    setError('');

    try {
      const result = await toggleHandoffMode(leadId, newMode);

      if (result.success) {
        // Refresh status
        const status = await getLeadHandoffStatus(leadId);
        setHandoffStatus(status);
      } else {
        setError(result.error || 'Error al cambiar modo');
      }
    } catch (err) {
      console.error('Error toggling handoff:', err);
      setError('Error al cambiar modo');
    } finally {
      setIsTogglingHandoff(false);
    }
  };

  // Get sender display info
  // WhatsApp style: lead messages on LEFT, our messages (ai/human) on RIGHT
  const getSenderInfo = (message: MessageForChat) => {
    switch (message.sender) {
      case 'ai':
        return {
          name: 'IA',
          avatar: <RobotIcon />,
          bgColor: 'bg-purple-500',
          isRight: true, // Our AI agent - RIGHT side
        };
      case 'human':
        // Prioridad: 1) sentByUser (de BD), 2) handoffUser (de Realtime), 3) fallback
        const humanName = message.sentByUser
          ? `${message.sentByUser.firstName} ${message.sentByUser.lastName}`
          : handoffStatus?.handoffUser || 'Vendedor';
        return {
          name: humanName,
          avatar: <UserIcon />,
          bgColor: 'bg-blue-500',
          isRight: true, // Our human agent - RIGHT side
        };
      case 'lead':
      default:
        return {
          name: leadName,
          avatar: null,
          bgColor: 'bg-[var(--accent-primary)]',
          isRight: false, // Lead/client messages - LEFT side
        };
    }
  };

  // Sincronizar error de query con estado local
  useEffect(() => {
    if (queryError) {
      setError('Error al cargar conversación');
    }
  }, [queryError]);

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <SpinnerIcon className="w-6 h-6 text-[var(--accent-primary)]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Handoff Status Bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 bg-[var(--bg-tertiary)] rounded-t-lg border-b border-[var(--border-primary)]">
        <div className="flex items-center gap-2">
          <Badge
            variant="custom"
            customColor={isHumanMode ? '#3B82F6' : '#8B5CF6'}
            customBgColor={isHumanMode ? '#3B82F620' : '#8B5CF620'}
            size="sm"
          >
            {isHumanMode ? <UserIcon /> : <RobotIcon />}
            <span className="ml-1">
              {isHumanMode ? t('chat.humanMode') : t('chat.aiMode')}
            </span>
          </Badge>
          {isHumanMode && handoffStatus?.handoffUser && (
            <span className="text-xs text-[var(--text-tertiary)]">
              {handoffStatus.handoffUser}
            </span>
          )}
          {/* Indicador de conexión Realtime en modo Human */}
          {isHumanMode && (
            <div
              className={cn(
                'flex items-center gap-1 text-xs',
                isRealtimeConnected ? 'text-green-500' : 'text-yellow-500'
              )}
              title={isRealtimeConnected ? t('chat.realtimeConnected') : t('chat.realtimeConnecting')}
            >
              <LiveIcon />
              <span className="hidden sm:inline">
                {isRealtimeConnected ? 'Live' : '...'}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefetching}
            className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
            title={tCommon('buttons.refresh') || 'Refresh'}
          >
            {isRefetching ? <SpinnerIcon className="w-4 h-4" /> : <RefreshIcon />}
          </button>
          <Button
            variant={isHumanMode ? 'ghost' : 'primary'}
            size="sm"
            onClick={handleToggleHandoff}
            disabled={isTogglingHandoff}
            className="text-xs"
          >
            {isTogglingHandoff ? (
              <SpinnerIcon className="w-3 h-3" />
            ) : isHumanMode ? (
              t('chat.returnToAI')
            ) : (
              t('chat.takeControl')
            )}
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {/* Load More Button - al inicio de la lista de mensajes */}
        {hasNextPage && (
          <div className="flex justify-center py-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="text-xs"
            >
              {isFetchingNextPage ? (
                <SpinnerIcon className="w-4 h-4" />
              ) : (
                'Cargar mensajes anteriores'
              )}
            </Button>
          </div>
        )}

        {allMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mb-3">
              <RobotIcon />
            </div>
            <p className="text-sm text-[var(--text-tertiary)]">
              {t('chat.noMessages')}
            </p>
          </div>
        ) : (
          allMessages.map((message) => {
            const senderInfo = getSenderInfo(message);
            return (
              <div
                key={message.id}
                className={cn(
                  'flex',
                  senderInfo.isRight ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    'max-w-[85%] p-3 rounded-2xl',
                    senderInfo.isRight
                      ? 'bg-[#BFF7FF] text-[var(--kairo-midnight)] rounded-br-sm'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-bl-sm'
                  )}
                >
                  {/* Sender indicator for our messages (AI/Human) */}
                  {senderInfo.isRight && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className={cn(
                          'w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px]',
                          senderInfo.bgColor
                        )}
                      >
                        {senderInfo.avatar}
                      </span>
                      <span className="text-xs font-medium text-[var(--kairo-midnight)]/80">
                        {senderInfo.name}
                      </span>
                    </div>
                  )}
                  {/* Audio message: show badge + transcription */}
                  {(message.metadata as Record<string, unknown>)?.messageType === 'audio' ? (
                    <div>
                      <span className={cn(
                        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium mb-1',
                        senderInfo.isRight
                          ? 'bg-[var(--kairo-midnight)]/10 text-[var(--kairo-midnight)]/70'
                          : 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                      )}>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                        Audio
                      </span>
                      <p className="text-sm whitespace-pre-wrap">
                        {(message.metadata as Record<string, unknown>)?.transcription
                          ? String((message.metadata as Record<string, unknown>).transcription)
                          : message.content}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  )}
                  <p
                    className={cn(
                      'text-xs mt-1 flex items-center gap-1',
                      senderInfo.isRight
                        ? 'text-[var(--kairo-midnight)]/70'
                        : 'text-[var(--text-tertiary)]'
                    )}
                  >
                    <span>{formatRelativeTime(message.createdAt)}</span>
                    {/* WhatsApp-style delivery/read indicators for outgoing messages */}
                    {senderInfo.isRight && (
                      <span className="inline-flex items-center ml-1">
                        {message.isRead ? (
                          // Double check blue (read) - WhatsApp style
                          <svg width="18" height="12" viewBox="0 0 18 12" className="text-blue-500">
                            <path fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M1 6.5l3.5 4L12 2"/>
                            <path fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M6 6.5l3.5 4L17 2"/>
                          </svg>
                        ) : message.isDelivered ? (
                          // Double check gray (delivered)
                          <svg width="18" height="12" viewBox="0 0 18 12" className="text-gray-400">
                            <path fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M1 6.5l3.5 4L12 2"/>
                            <path fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M6 6.5l3.5 4L17 2"/>
                          </svg>
                        ) : message.whatsappMsgId ? (
                          // Single check gray (sent to WhatsApp)
                          <svg width="12" height="12" viewBox="0 0 12 12" className="text-gray-400">
                            <path fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M1 6.5l3.5 4L11 2"/>
                          </svg>
                        ) : (
                          // Clock icon (pending/sending)
                          <svg width="12" height="12" viewBox="0 0 12 12" className="text-gray-400">
                            <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                            <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" d="M6 3v3l2 1"/>
                          </svg>
                        )}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error message */}
      {error && (
        <div className="px-3 py-2 text-xs text-red-500 bg-red-50 dark:bg-red-950/30 border-t border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      {/* Message Input with Emoji Picker */}
      {isHumanMode && (
        <div className="flex-shrink-0 border-t border-[var(--border-primary)]">
          {/* Rich Chat Input */}
          <div className="p-3 bg-[var(--bg-secondary)] relative">
            {/* Emoji Picker - positioned above the emoji button */}
            {showEmojiPicker && emojiData && (
              <div
                ref={emojiPickerRef}
                className="absolute left-3 z-50 shadow-lg rounded-lg overflow-hidden"
                style={{
                  bottom: '56px',
                  maxHeight: '320px',
                }}
              >
                <EmojiPicker
                  data={emojiData}
                  onEmojiSelect={handleEmojiSelect}
                  theme="auto"
                  locale="es"
                  previewPosition="none"
                  skinTonePosition="none"
                  searchPosition="top"
                  navPosition="bottom"
                  maxFrequentRows={1}
                  perLine={7}
                  emojiButtonSize={32}
                  emojiSize={20}
                />
              </div>
            )}
            <ChatInput
              ref={chatInputRef}
              onSendMessage={handleSendMessage}
              onEmojiClick={() => setShowEmojiPicker(!showEmojiPicker)}
              disabled={isSending || isUploading}
              isSending={isSending || isUploading}
            />
          </div>
        </div>
      )}

      {/* AI Mode Notice */}
      {!isHumanMode && (
        <div className="px-3 py-2 text-xs text-center text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] border-t border-[var(--border-primary)]">
          {t('chat.aiModeNotice')}
        </div>
      )}
    </div>
  );
}

export default LeadChat;
