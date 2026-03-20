/**
 * KAIRO - Agent Media Types
 *
 * Shared types for the agent media system (images, future: videos).
 * Extracted from 'use server' files per Rule 12.
 */

export interface AgentMediaEntry {
  id: string;
  title: string;
  description: string;
  mediaUrl: string;
  storagePath: string;
  mediaType: string;
  createdAt: string;
  updatedAt: string;
}

export interface MediaSearchResult {
  id: string;
  title: string;
  description: string;
  mediaUrl: string;
  similarity: number;
}

export const MAX_MEDIA_ITEMS = 20;
export const MAX_TITLE_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 1000;

// Fixed event media types (always sent, no RAG)
export type FixedEventType = 'first_contact' | 'reengagement_0' | 'reengagement_1' | 'reengagement_2';

export interface FixedEventMedia {
  id: string;
  title: string;
  mediaUrl: string;
}
