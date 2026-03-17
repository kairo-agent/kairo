/**
 * KAIRO - ReEngagement Message Generator
 *
 * Generates a natural, context-aware follow-up message using OpenAI
 * when a lead goes silent. Uses conversation history + admin-provided
 * prompt template to create a personalized re-engagement message.
 *
 * v2: Context-aware with attempt-based strategy differentiation.
 * - 1st attempt: Gentle reminder, reference pending topic
 * - 2nd attempt: Change angle, offer something different
 * - 3rd attempt: Last try, direct and concise
 */

import OpenAI from 'openai';

interface GenerateReEngagementParams {
  agentName: string;
  leadName: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  promptTemplate: string;
  systemInstructions: string | null;
  attemptNumber: number;        // 1-based: which reengagement attempt this is
  leadSummary: string | null;   // AI summary if available
}

/**
 * Build attempt-specific strategy instructions
 */
function getAttemptStrategy(attempt: number, agentName: string, leadName: string): string {
  switch (attempt) {
    case 1:
      return `ESTRATEGIA (1er seguimiento):
- Recordatorio suave y natural.
- Si habia un tema pendiente o pregunta sin responder, retomalo.
- Muestra continuidad con la conversacion anterior.`;

    case 2:
      return `ESTRATEGIA (2do seguimiento - CAMBIO DE ANGULO OBLIGATORIO):
- Ya se envio un seguimiento previo y ${leadName} no respondio. NO repitas el mismo enfoque.
- Cambia completamente de angulo: ofrece algo nuevo o diferente que no se haya mencionado.
- Ejemplos: si antes hablaste de precios, ahora menciona financiamiento. Si hablaste de ubicacion, ahora menciona fotos o visitas.
- Se mas directo y ofrece valor concreto.
- PROHIBIDO: repetir frases o ideas de mensajes anteriores de ${agentName}.`;

    default: // 3rd+
      return `ESTRATEGIA (ultimo seguimiento - MENSAJE FINAL):
- Este es el ULTIMO intento de contacto. Se breve, directo y respetuoso.
- Reconoce implicitamente que no ha respondido sin ser pasivo-agresivo.
- Ofrece una ultima propuesta de valor concreta o pregunta directa de si/no.
- Maximo 150 caracteres. Ejemplo de tono: "Si te interesa [tema], aqui estoy. Sin compromiso."`;
  }
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
      promptTemplate, systemInstructions,
      attemptNumber, leadSummary,
    } = params;

    // Build conversation context (last 6 messages)
    const recentHistory = conversationHistory.slice(-6);
    const historyText = recentHistory
      .map(m => `${m.role === 'user' ? leadName : agentName}: ${m.content}`)
      .join('\n');

    // Context section: use summary if available, otherwise rely on history
    const contextSection = leadSummary
      ? `RESUMEN DE LA CONVERSACION:\n${leadSummary}\n`
      : '';

    const attemptStrategy = getAttemptStrategy(attemptNumber, agentName, leadName);
    const maxChars = attemptNumber >= 3 ? 150 : 250;

    const systemPrompt = `Eres ${agentName}. Debes enviar un mensaje de seguimiento breve y natural para retomar la conversacion con ${leadName}.

${systemInstructions ? `CONTEXTO DE TU ROL:\n${systemInstructions.substring(0, 500)}\n` : ''}
${contextSection}${promptTemplate ? `INSTRUCCIONES DEL ADMINISTRADOR PARA EL SEGUIMIENTO:\n${promptTemplate}\n` : ''}
HISTORIAL RECIENTE:
${historyText}

INTENTO DE REENGAGEMENT: #${attemptNumber}
${attemptStrategy}

REGLAS ESTRICTAS:
- Maximo ${maxChars} caracteres.
- Se natural y amigable, como si retomaras la conversacion de forma genuina.
- No repitas lo que ya dijiste en mensajes anteriores (revisa el historial cuidadosamente).
- No menciones que es un mensaje automatico ni de seguimiento programado.
- No uses saludos genericos como "Hola, como estas?".
- Si la conversacion tenia un tema pendiente, retomalo naturalmente.`;

    const openai = new OpenAI({ apiKey: openaiApiKey });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: attemptNumber === 1 ? 0.5 : 0.7, // More creative on retries
      max_tokens: 150,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Genera el mensaje de seguimiento #${attemptNumber} para ${leadName}.` },
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
