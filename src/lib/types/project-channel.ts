/**
 * Tipos compartidos para ProjectChannel — Fase 2.
 *
 * Vive aqui (no en project-channels.ts) porque ese archivo es 'use server'
 * y solo puede exportar funciones async (regla KAIRO).
 */

export interface ProjectChannelInfo {
  exists: boolean;
  provisioned: boolean;
  enabled: boolean;
  publicKey: string | null;
  config: Record<string, unknown>;
}
