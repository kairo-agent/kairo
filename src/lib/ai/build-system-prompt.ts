/**
 * KAIRO - System Prompt Builder
 *
 * Replicates the system prompt that was previously assembled in n8n.
 * Combines: agent identity, systemInstructions, RAG knowledge,
 * conversation history, lead summary, and date/time context.
 *
 * @see docs/RAG-AGENTS.md section "System Prompt n8n (Actualizado)"
 */

// ============================================
// Types
// ============================================

export interface SystemPromptParams {
  agentName: string;
  companyName: string;
  systemInstructions: string | null;
  ragResults: Array<{ content: string; title: string | null; similarity: number }>;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  leadSummary: string | null;
  leadName: string;
  currentDate: string;
  currentTime: string;
  messageCount: number;
  summaryThreshold: number;
}

// ============================================
// Builder
// ============================================

export function buildSystemPrompt(params: SystemPromptParams): string {
  const parts: string[] = [];

  // --- Agent identity ---
  parts.push(
    `Eres ${params.agentName}, y trabajas en ${params.companyName}.`
  );

  // --- System instructions (configurable per agent in KAIRO UI) ---
  if (params.systemInstructions) {
    parts.push(params.systemInstructions);
  }

  // --- RAG knowledge (if any results found) ---
  if (params.ragResults.length > 0) {
    const knowledge = params.ragResults
      .map(r => r.content)
      .join('\n\n');
    parts.push(`TU CONOCIMIENTO:\n${knowledge}`);
  }

  // --- Lead summary (accumulated context from previous conversations) ---
  if (params.leadSummary) {
    parts.push(`CONTEXTO PREVIO DEL LEAD:\n${params.leadSummary}`);
  }

  // --- Conversation history (last 8 messages) ---
  if (params.conversationHistory.length > 0) {
    const history = params.conversationHistory
      .map(m => `${m.role === 'user' ? 'Lead' : 'Tu'}: ${m.content}`)
      .join('\n');
    parts.push(`HISTORIAL DE CONVERSACION:\n${history}`);
  }

  // --- Date/time context ---
  parts.push(
    `Fecha actual: ${params.currentDate}, hora: ${params.currentTime}`
  );

  // --- Response instruction ---
  parts.push(
    `Responde de manera natural y breve al usuario "${params.leadName}". Si no tienes informacion especifica, responde de forma amigable usando tu nombre.`
  );

  // --- Summary generation instruction (if threshold met) ---
  if (params.messageCount >= params.summaryThreshold) {
    parts.push(
      `Al final de tu respuesta, si detectas informacion relevante del lead (intereses, necesidades, datos de contacto), incluyela en el marcador de temperatura.`
    );
  }

  return parts.join('\n\n');
}
