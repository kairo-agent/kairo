/**
 * KAIRO - ReEngagement Message Generator
 *
 * Generates a natural, context-aware follow-up message using OpenAI
 * when a lead goes silent. Uses conversation history + admin-provided
 * prompt template to create a personalized re-engagement message.
 */

import OpenAI from 'openai';

interface GenerateReEngagementParams {
  agentName: string;
  leadName: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  promptTemplate: string;
  systemInstructions: string | null;
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
    const { agentName, leadName, conversationHistory, promptTemplate, systemInstructions } = params;

    // Build conversation context (last 6 messages)
    const recentHistory = conversationHistory.slice(-6);
    const historyText = recentHistory
      .map(m => `${m.role === 'user' ? leadName : agentName}: ${m.content}`)
      .join('\n');

    const systemPrompt = `Eres ${agentName}. Debes enviar un mensaje de seguimiento breve y natural para retomar la conversacion con ${leadName}.

${systemInstructions ? `CONTEXTO DE TU ROL:\n${systemInstructions.substring(0, 500)}\n` : ''}
${promptTemplate ? `INSTRUCCIONES DEL ADMINISTRADOR PARA EL SEGUIMIENTO:\n${promptTemplate}\n` : ''}
HISTORIAL RECIENTE:
${historyText}

REGLAS ESTRICTAS:
- Maximo 250 caracteres.
- Se natural y amigable, como si retomaras la conversacion de forma genuina.
- No repitas lo que ya dijiste en mensajes anteriores.
- No menciones que es un mensaje automatico ni de seguimiento programado.
- Referencia algo especifico de la conversacion anterior para mostrar continuidad.
- No uses saludos genericos como "Hola, como estas?".
- Si la conversacion tenia un tema pendiente, retomalo naturalmente.`;

    const openai = new OpenAI({ apiKey: openaiApiKey });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.5,
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
