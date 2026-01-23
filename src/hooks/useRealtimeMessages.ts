'use client';

// ============================================
// KAIRO - Realtime Messages Hook
// Supabase Realtime subscription para mensajes de chat
// ============================================

import { useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel, RealtimePostgresInsertPayload, RealtimePostgresUpdatePayload } from '@supabase/supabase-js';

// ============================================
// Types
// ============================================

/**
 * Estructura del mensaje recibido de Supabase Realtime
 * Debe coincidir con el modelo Message de Prisma
 */
export interface RealtimeMessage {
  id: string;
  conversationId: string;
  sender: 'lead' | 'ai' | 'human';
  content: string;
  createdAt: string;
  sentByUserId: string | null;
  whatsappMsgId: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: any; // Prisma.JsonValue - puede ser null, string, number, boolean, array u objeto
  isDelivered: boolean;
  deliveredAt: string | null;
  isRead: boolean;
  readAt: string | null;
}

/**
 * Payload que llega de Supabase Realtime para INSERT
 */
type MessageInsertPayload = RealtimePostgresInsertPayload<RealtimeMessage>;

/**
 * Payload que llega de Supabase Realtime para UPDATE
 */
type MessageUpdatePayload = RealtimePostgresUpdatePayload<RealtimeMessage>;

/**
 * Datos de actualización de estado de mensaje
 */
export interface MessageStatusUpdate {
  id: string;
  isDelivered: boolean;
  deliveredAt: string | null;
  isRead: boolean;
  readAt: string | null;
  whatsappMsgId: string | null;
}

/**
 * Opciones para el hook useRealtimeMessages
 */
export interface UseRealtimeMessagesOptions {
  /** ID de la conversación a escuchar */
  conversationId: string | null;
  /** Solo activar cuando está en modo Human (default: true) */
  enabled?: boolean;
  /** Callback cuando llega un nuevo mensaje */
  onNewMessage?: (message: RealtimeMessage) => void;
  /** Callback cuando un mensaje se actualiza (delivered/read status) */
  onMessageUpdate?: (update: MessageStatusUpdate) => void;
  /** Callback cuando hay error en la conexión */
  onError?: (error: Error) => void;
  /** Callback cuando el canal se conecta */
  onConnected?: () => void;
  /** Callback cuando el canal se desconecta */
  onDisconnected?: () => void;
}

/**
 * Estado de conexión del canal
 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Retorno del hook useRealtimeMessages
 */
export interface UseRealtimeMessagesReturn {
  /** Estado actual de la conexión */
  connectionStatus: ConnectionStatus;
  /** Función para reconectar manualmente */
  reconnect: () => void;
  /** Función para desconectar manualmente */
  disconnect: () => void;
}

// ============================================
// Hook Implementation
// ============================================

export function useRealtimeMessages({
  conversationId,
  enabled = true,
  onNewMessage,
  onMessageUpdate,
  onError,
  onConnected,
  onDisconnected,
}: UseRealtimeMessagesOptions): UseRealtimeMessagesReturn {
  // Referencias para evitar re-suscripciones innecesarias
  const channelRef = useRef<RealtimeChannel | null>(null);
  const connectionStatusRef = useRef<ConnectionStatus>('disconnected');
  const supabaseRef = useRef(createClient());

  // Guardar callbacks en refs para evitar dependencias en useEffect
  const onNewMessageRef = useRef(onNewMessage);
  const onMessageUpdateRef = useRef(onMessageUpdate);
  const onErrorRef = useRef(onError);
  const onConnectedRef = useRef(onConnected);
  const onDisconnectedRef = useRef(onDisconnected);

  // Actualizar refs cuando cambien los callbacks
  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
    onMessageUpdateRef.current = onMessageUpdate;
    onErrorRef.current = onError;
    onConnectedRef.current = onConnected;
    onDisconnectedRef.current = onDisconnected;
  }, [onNewMessage, onMessageUpdate, onError, onConnected, onDisconnected]);

  /**
   * Limpia la suscripción actual
   */
  const cleanup = useCallback(() => {
    if (channelRef.current) {
      console.log(`🔌 [Realtime] Desconectando canal: messages:${conversationId}`);
      supabaseRef.current.removeChannel(channelRef.current);
      channelRef.current = null;
      connectionStatusRef.current = 'disconnected';
      onDisconnectedRef.current?.();
    }
  }, [conversationId]);

  /**
   * Reconecta al canal (útil después de errores)
   */
  const reconnect = useCallback(() => {
    cleanup();
    // El useEffect se encargará de reconectar
  }, [cleanup]);

  /**
   * Desconecta manualmente del canal
   */
  const disconnect = useCallback(() => {
    cleanup();
  }, [cleanup]);

  // Efecto principal para manejar la suscripción
  useEffect(() => {
    // No suscribir si no hay conversationId o está deshabilitado
    if (!conversationId || !enabled) {
      cleanup();
      return;
    }

    // Si ya hay un canal activo para esta conversación, no crear otro
    if (channelRef.current) {
      return;
    }

    const supabase = supabaseRef.current;
    const channelName = `messages:${conversationId}`;

    console.log(`🔌 [Realtime] Conectando a canal: ${channelName}`);
    connectionStatusRef.current = 'connecting';

    // Crear canal con suscripción a cambios de PostgreSQL
    const channel = supabase
      .channel(channelName)
      // Escuchar nuevos mensajes (INSERT)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages', // Nombre de la tabla en PostgreSQL (Prisma usa @@map)
          filter: `conversationId=eq.${conversationId}`,
        },
        (payload: MessageInsertPayload) => {
          console.log('📨 [Realtime] Nuevo mensaje recibido:', payload.new.id);

          // Transformar el payload al tipo esperado
          const message: RealtimeMessage = {
            id: payload.new.id,
            conversationId: payload.new.conversationId,
            sender: payload.new.sender as 'lead' | 'ai' | 'human',
            content: payload.new.content,
            createdAt: payload.new.createdAt,
            sentByUserId: payload.new.sentByUserId,
            whatsappMsgId: payload.new.whatsappMsgId,
            metadata: payload.new.metadata,
            isDelivered: payload.new.isDelivered,
            deliveredAt: payload.new.deliveredAt,
            isRead: payload.new.isRead,
            readAt: payload.new.readAt,
          };

          // Llamar al callback con el nuevo mensaje
          onNewMessageRef.current?.(message);
        }
      )
      // Escuchar actualizaciones de estado (UPDATE) - delivered/read
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversationId=eq.${conversationId}`,
        },
        (payload: MessageUpdatePayload) => {
          // Solo procesar si cambió el estado de entrega/lectura
          const oldData = payload.old as Partial<RealtimeMessage>;
          const newData = payload.new;

          const deliveryChanged = oldData.isDelivered !== newData.isDelivered;
          const readChanged = oldData.isRead !== newData.isRead;
          const whatsappIdChanged = oldData.whatsappMsgId !== newData.whatsappMsgId;

          if (deliveryChanged || readChanged || whatsappIdChanged) {
            console.log(`📬 [Realtime] Estado actualizado: ${newData.id} - delivered: ${newData.isDelivered}, read: ${newData.isRead}`);

            const update: MessageStatusUpdate = {
              id: newData.id,
              isDelivered: newData.isDelivered,
              deliveredAt: newData.deliveredAt,
              isRead: newData.isRead,
              readAt: newData.readAt,
              whatsappMsgId: newData.whatsappMsgId,
            };

            onMessageUpdateRef.current?.(update);
          }
        }
      )
      .subscribe((status) => {
        console.log(`🔌 [Realtime] Estado del canal ${channelName}:`, status);

        switch (status) {
          case 'SUBSCRIBED':
            connectionStatusRef.current = 'connected';
            onConnectedRef.current?.();
            break;
          case 'CLOSED':
          case 'CHANNEL_ERROR':
            connectionStatusRef.current = status === 'CHANNEL_ERROR' ? 'error' : 'disconnected';
            if (status === 'CHANNEL_ERROR') {
              onErrorRef.current?.(new Error('Error en el canal de Realtime'));
            }
            onDisconnectedRef.current?.();
            break;
          case 'TIMED_OUT':
            connectionStatusRef.current = 'error';
            onErrorRef.current?.(new Error('Timeout en conexión Realtime'));
            break;
        }
      });

    channelRef.current = channel;

    // Cleanup al desmontar o cuando cambien las dependencias
    return () => {
      console.log(`🔌 [Realtime] Cleanup del canal: ${channelName}`);
      supabase.removeChannel(channel);
      channelRef.current = null;
      connectionStatusRef.current = 'disconnected';
    };
  }, [conversationId, enabled, cleanup]);

  return {
    connectionStatus: connectionStatusRef.current,
    reconnect,
    disconnect,
  };
}

export default useRealtimeMessages;
