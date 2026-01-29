/**
 * Text Chunking Utility
 *
 * Splits long texts into smaller chunks suitable for embedding generation.
 * Uses semantic-aware splitting to maintain context between chunks.
 *
 * @see docs/RAG-AGENTS.md for chunking strategy details
 */

export interface ChunkOptions {
  /** Maximum characters per chunk (default: 1000) */
  maxChunkSize?: number;
  /** Overlap between chunks in characters (default: 200) */
  overlap?: number;
  /** Minimum chunk size to keep (default: 100) */
  minChunkSize?: number;
}

export interface TextChunk {
  /** The chunk text */
  text: string;
  /** Zero-based index of this chunk */
  index: number;
  /** Character offset in original text */
  startOffset: number;
  /** Character offset end in original text */
  endOffset: number;
}

/**
 * Splits text into overlapping chunks for embedding
 *
 * Strategy:
 * 1. First tries to split on paragraph boundaries (\n\n)
 * 2. If paragraph is too long, splits on sentence boundaries (. ! ?)
 * 3. If sentence is too long, splits on word boundaries
 * 4. Adds overlap between chunks for context continuity
 *
 * @param text - The text to chunk
 * @param options - Chunking configuration
 * @returns Array of text chunks with metadata
 */
export function chunkText(
  text: string,
  options: ChunkOptions = {}
): TextChunk[] {
  const { maxChunkSize = 1000, overlap = 200, minChunkSize = 100 } = options;

  // Normalize whitespace
  const normalizedText = text.trim().replace(/\r\n/g, '\n');

  if (normalizedText.length <= maxChunkSize) {
    return [
      {
        text: normalizedText,
        index: 0,
        startOffset: 0,
        endOffset: normalizedText.length,
      },
    ];
  }

  const chunks: TextChunk[] = [];
  let currentPosition = 0;
  let chunkIndex = 0;

  while (currentPosition < normalizedText.length) {
    // Calculate end position for this chunk
    let endPosition = Math.min(
      currentPosition + maxChunkSize,
      normalizedText.length
    );

    // If we're not at the end, try to find a good break point
    if (endPosition < normalizedText.length) {
      const chunk = normalizedText.slice(currentPosition, endPosition);

      // Try to break at paragraph
      const paragraphBreak = chunk.lastIndexOf('\n\n');
      if (paragraphBreak > maxChunkSize * 0.3) {
        endPosition = currentPosition + paragraphBreak + 2;
      } else {
        // Try to break at sentence
        const sentenceBreak = findLastSentenceBreak(chunk);
        if (sentenceBreak > maxChunkSize * 0.3) {
          endPosition = currentPosition + sentenceBreak;
        } else {
          // Try to break at word
          const wordBreak = chunk.lastIndexOf(' ');
          if (wordBreak > maxChunkSize * 0.5) {
            endPosition = currentPosition + wordBreak;
          }
        }
      }
    }

    const chunkText = normalizedText.slice(currentPosition, endPosition).trim();

    // Only add chunk if it meets minimum size
    if (chunkText.length >= minChunkSize) {
      chunks.push({
        text: chunkText,
        index: chunkIndex++,
        startOffset: currentPosition,
        endOffset: endPosition,
      });
    }

    // Move position, accounting for overlap
    const nextPosition = endPosition - overlap;
    currentPosition = nextPosition > currentPosition ? nextPosition : endPosition;
  }

  return chunks;
}

/**
 * Finds the last sentence break in a text
 * Looks for . ! ? followed by space or end of text
 */
function findLastSentenceBreak(text: string): number {
  // Match sentence endings: period, exclamation, question mark
  // followed by space or end of string
  const sentenceEnders = /[.!?](?:\s|$)/g;
  let lastMatch = -1;
  let match;

  while ((match = sentenceEnders.exec(text)) !== null) {
    lastMatch = match.index + 1; // Include the punctuation
  }

  return lastMatch;
}

/**
 * Estimates token count from text
 * Rough estimate: ~4 characters per token for English/Spanish
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Prepares text for embedding by cleaning and normalizing
 */
export function prepareTextForEmbedding(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/\n{3,}/g, '\n\n') // Max 2 newlines
    .slice(0, 8000); // OpenAI max input is ~8191 tokens
}
