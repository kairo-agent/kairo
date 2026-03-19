/**
 * KAIRO - ReEngagement Message Generator
 *
 * Generates a natural, context-aware follow-up message using OpenAI
 * when a lead goes silent. Uses conversation history + admin-provided
 * instructions to create a personalized re-engagement message.
 *
 * v2: Context-aware with configurable multi-attempt strategy.
 * - Initial: uses promptTemplate
 * - Attempt 1: uses attempt1Instructions (angle change)
 * - Attempt 2: uses attempt2Instructions (final follow-up)
 *
 * Anti-spam: follow-up attempts only fire if lead responded to previous message.
 */

import OpenAI from 'openai';

interface GenerateReEngagementParams {
  agentName: string;
  leadName: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  promptTemplate: string;              // For initial reengagement
  attemptInstructions: string | null;  // For follow-up attempts (configurable)
  systemInstructions: string | null;
  attemptNumber: number;               // 0 = initial, 1 = follow-up 1, 2 = follow-up 2
  leadSummary: string | null;
  mediaItems?: Array<{ title: string; description: string }>;  // Available images
}

/**
 * Generate a re-engagement message using OpenAI GPT-4o-mini.
 * Returns a short, natural follow-up message based on conversation context.
 */
export async function generateReEngagementMessage(
  openaiApiKey: string,
  params: GenerateReEngagementParams
): Promise<string | null> {
  try {
    const {
      agentName, leadName, conversationHistory,
      promptTemplate, attemptInstructions,
      systemInstructions, attemptNumber, leadSummary,
      mediaItems,
    } = params;

    // Build conversation context (last 6 messages)
    const recentHistory = conversationHistory.slice(-6);
    const historyText = recentHistory
      .map(m => `${m.role === 'user' ? leadName : agentName}: ${m.content}`)
      .join('\n');

    // Context section: use summary if available
    const contextSection = leadSummary
      ? `RESUMEN DE LA CONVERSACION:\n${leadSummary}\n`
      : '';

    // Determine which instructions to use
    const isFollowUp = attemptNumber > 0;
    const instructions = isFollowUp && attemptInstructions
      ? attemptInstructions
      : promptTemplate;

    const followUpContext = isFollowUp
      ? `\nCONTEXTO IMPORTANTE: Este es el seguimiento #${attemptNumber} despues de que ${leadName} respondio a un mensaje anterior y volvio a guardar silencio. Ya se enviaron mensajes de seguimiento previos que estan en el historial. DEBES usar un enfoque DIFERENTE al de los mensajes anteriores.\n`
      : '';

    const maxChars = attemptNumber >= 2 ? 150 : 250;

    // Build media section if images are available
    let mediaSection = '';
    if (mediaItems && mediaItems.length > 0) {
      const mediaList = mediaItems.map((m, i) => `[MEDIA-${i + 1}] ${m.title} - ${m.description}`).join('\n');
      mediaSection = `\n=== IMAGENES DISPONIBLES ===\n${mediaList}\nPara enviar imagenes SOLO usa marcadores [MEDIA-X]. NO uses enlaces, URLs ni formato markdown. NO inventes nombres de imagenes.\n=== FIN IMAGENES DISPONIBLES ===\n`;
    }

    const systemPrompt = `Eres ${agentName}. Debes enviar un mensaje de seguimiento breve y natural para retomar la conversacion con ${leadName}.

${systemInstructions ? `CONTEXTO DE TU ROL:\n${systemInstructions.substring(0, 500)}\n` : ''}
${contextSection}INSTRUCCIONES PARA ESTE MENSAJE:
${instructions}
${followUpContext}${mediaSection}
HISTORIAL RECIENTE:
${historyText}

REGLAS ESTRICTAS:
- Maximo ${maxChars} caracteres (sin contar marcadores [MEDIA-X]).
- Se natural y amigable, como si retomaras la conversacion de forma genuina.
- No repitas lo que ya dijiste en mensajes anteriores (revisa el historial cuidadosamente).
- No menciones que es un mensaje automatico ni de seguimiento programado.
- No uses saludos genericos como "Hola, como estas?".
- Si la conversacion tenia un tema pendiente, retomalo naturalmente.
- Si incluyes una imagen, integra el marcador [MEDIA-X] de forma natural en el mensaje.`;

    const openai = new OpenAI({ apiKey: openaiApiKey });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: isFollowUp ? 0.7 : 0.5, // More creative on follow-ups
      max_tokens: 150,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Genera el mensaje de seguimiento para ${leadName}.` },
      ],
    });

    const message = response.choices[0]?.message?.content?.trim();
    if (!message) {
      console.error('[ReEngagement] Empty response from OpenAI');
      return null;
    }

    return message;
  } catch (error) {
    console.error('[ReEngagement] Failed to generate message:', error);
    return null;
  }
}
