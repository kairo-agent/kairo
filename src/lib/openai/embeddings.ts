/**
 * OpenAI Embeddings Helper
 *
 * Generates vector embeddings using OpenAI's text-embedding-3-small model.
 * Used for RAG (Retrieval Augmented Generation) in AI agents.
 *
 * @see docs/RAG-AGENTS.md for architecture details
 */

import OpenAI from 'openai';
import { getProjectSecret } from '@/lib/actions/secrets';

// OpenAI embedding model - 1536 dimensions
export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 1536;

/**
 * Generates embeddings for a single text using OpenAI
 *
 * @param text - The text to generate embeddings for
 * @param projectId - Project ID to get the OpenAI API key
 * @returns Array of 1536 floats representing the embedding
 */
export async function generateEmbedding(
  text: string,
  projectId: string
): Promise<number[]> {
  const apiKey = await getProjectSecret(projectId, 'openai_api_key');

  if (!apiKey) {
    throw new Error('OpenAI API key not configured for this project');
  }

  const openai = new OpenAI({ apiKey });

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.trim(),
  });

  return response.data[0].embedding;
}

/**
 * Generates embeddings for multiple texts in batch
 * More efficient than calling generateEmbedding multiple times
 *
 * @param texts - Array of texts to generate embeddings for
 * @param projectId - Project ID to get the OpenAI API key
 * @returns Array of embeddings (each 1536 floats)
 */
export async function generateEmbeddings(
  texts: string[],
  projectId: string
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const apiKey = await getProjectSecret(projectId, 'openai_api_key');

  if (!apiKey) {
    throw new Error('OpenAI API key not configured for this project');
  }

  const openai = new OpenAI({ apiKey });

  // OpenAI allows up to 2048 inputs per request
  const batchSize = 100;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize).map((t) => t.trim());

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    });

    // Sort by index to maintain order
    const sortedData = response.data.sort((a, b) => a.index - b.index);
    allEmbeddings.push(...sortedData.map((d) => d.embedding));
  }

  return allEmbeddings;
}

/**
 * Formats an embedding array for PostgreSQL vector type
 *
 * @param embedding - Array of floats
 * @returns String in format [0.1,0.2,...] for pgvector
 */
export function formatEmbeddingForPg(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}
