/**
 * KAIRO - Agent Media Types
 *
 * Shared types for the agent media system (images + videos).
 * Extracted from 'use server' files per Rule 12.
 */

export interface AgentMediaEntry {
  id: string;
  title: string;
  description: string;
  mediaUrl: string;
  storagePath: string;
  mediaType: 'image' | 'video';
  createdAt: string;
  updatedAt: string;
}

export interface MediaSearchResult {
  id: string;
  title: string;
  description: string;
  mediaUrl: string;
  similarity: number;
  mediaType: 'image' | 'video';
}

export const MAX_MEDIA_ITEMS = 20; // images
export const MAX_VIDEO_ITEMS = 5; // videos
export const MAX_TITLE_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 1000;
export const MAX_VIDEO_SIZE_MB = 16; // WhatsApp MP4 limit

// Fixed event media types (always sent, no RAG)
// Images: first_contact, reengagement_0/1/2
// Videos: first_contact_video, reengagement_0/1/2_video
export type FixedEventType =
  | 'first_contact' | 'reengagement_0' | 'reengagement_1' | 'reengagement_2'
  | 'first_contact_video' | 'reengagement_0_video' | 'reengagement_1_video' | 'reengagement_2_video';

export type FixedVideoEventType = 'first_contact_video' | 'reengagement_0_video' | 'reengagement_1_video' | 'reengagement_2_video';

export interface FixedEventMedia {
  id: string;
  title: string;
  mediaUrl: string;
  mediaType?: 'image' | 'video';
}
