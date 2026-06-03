/**
 * update-kb.example.ts — TEMPLATE para escribir KB estructurada (pricing/faqs) de un agente.
 *
 * Estos scripts SIEMPRE llevan contenido especifico del job, asi que el patron es:
 *   1. Copia este archivo:  scripts/update-kb.example.ts -> scripts/_tmp-update-kb.ts
 *   2. Edita la ZONA DE EDICION de abajo (IDs + payload pricing/faqs).
 *   3. Corre:  npx tsx scripts/_tmp-update-kb.ts
 *   4. Verifica con:  npx tsx scripts/check-kb.ts --agent <AGENT_ID> --project <PROJECT_ID>
 *   5. Borra el _tmp.
 *
 * El RPC insert_agent_knowledge auto-borra la fila existente de la misma category antes de insertar
 * (upsert por category). Genera el embedding con text-embedding-3-small.
 *
 * IMPORTANTE (memoria FEEDBACK-AGENT-INFO-DUPLICATION): la misma data vive tambien en
 * systemInstructions/promptStructure/reEngagementConfig del agente. Si cambias precios/fechas aqui,
 * actualiza tambien las instrucciones con update-instructions.example.ts, o el agente se contradice.
 *
 * El contenido de ejemplo abajo es el evento E&Z "Despertar de Conciencia" (referencia real).
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv({ path: '.env' })

import { PrismaClient } from '@prisma/client'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { decryptSecret } from '../src/lib/crypto/secrets'
import { faqsSchema, composeFaqsText, type FAQsData } from '../src/lib/knowledge/faqs'
import { pricingSchema, composePricingText, type PricingData } from '../src/lib/knowledge/pricing'

const prisma = new PrismaClient()

// ============================ ZONA DE EDICION ============================
const AGENT_ID = 'cmp1txhr200011tjkaliyvfft' // <-- EDITAR
const PROJECT_ID = 'cmkavbcgv000g34q2pdt99kzu' // <-- EDITAR
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000' // placeholder created_by

const newPricing: PricingData = {
  currency: 'USD',
  items: [
    { name: 'Evento — precio anticipado', price: '499', description: 'Inversion total por persona.' },
    { name: 'Evento — precio regular', price: '599', description: 'Inversion total por persona.' },
  ],
  notes: 'Inscripcion cierra el 10 de Junio de 2026. Pago por transferencia tras recibir foto del documento.',
}

const newFaqs: FAQsData = {
  items: [
    { question: '¿Cuando es el evento?', answer: 'Sábado 13 de Junio de 2026.' },
    { question: '¿Cuanto cuesta?', answer: '$499 hasta el 4 de Junio; $599 del 5 al 10 de Junio.' },
  ],
}
// ========================== FIN ZONA DE EDICION ==========================

async function getOpenAiKey(projectId: string): Promise<string> {
  // Prefiere el secret cifrado del proyecto; cae a OPENAI_API_KEY env si la key de cifrado local
  // difiere (el modelo de embedding es agnostico al proyecto, asi que la fuente no cambia semantica).
  try {
    const secret = await prisma.projectSecret.findUnique({
      where: { projectId_key: { projectId, key: 'openai_api_key' } },
    })
    if (secret) {
      return decryptSecret({ encryptedValue: secret.encryptedValue, iv: secret.iv, authTag: secret.authTag })
    }
  } catch (e) {
    console.warn('[warn] decrypt fallo, usando OPENAI_API_KEY env:', (e as Error).message)
  }
  const envKey = process.env.OPENAI_API_KEY
  if (!envKey) throw new Error('No hay OpenAI key usable (project secret + OPENAI_API_KEY ausentes)')
  return envKey
}

async function upsertCategory(opts: {
  supabase: ReturnType<typeof createSupabaseClient>
  openai: OpenAI
  category: 'pricing' | 'faqs'
  composedText: string
  structuredData: Record<string, unknown>
}) {
  const { supabase, openai, category, composedText, structuredData } = opts

  console.log(`\n[${category}] generando embedding (len=${composedText.length})...`)
  const emb = await openai.embeddings.create({ model: 'text-embedding-3-small', input: composedText.trim() })
  const embeddingStr = `[${emb.data[0].embedding.join(',')}]`
  const title = category === 'pricing' ? 'Pricing' : 'FAQs'

  console.log(`[${category}] insert_agent_knowledge RPC (auto-borra fila previa de la misma category)...`)
  const { data, error } = await supabase.rpc('insert_agent_knowledge', {
    p_project_id: PROJECT_ID,
    p_agent_id: AGENT_ID,
    p_title: title,
    p_content: composedText,
    p_source: 'structured',
    p_source_url: null,
    p_metadata: {},
    p_chunk_index: 0,
    p_embedding: embeddingStr,
    p_created_by: SYSTEM_USER_ID,
    p_category: category,
    p_structured_data: structuredData,
  })
  if (error) {
    console.error(`[${category}] RPC error:`, error)
    throw new Error(`Fallo upsert ${category}: ${error.message}`)
  }
  const newId = Array.isArray(data) ? data[0]?.id : (data as { id?: string } | null)?.id
  console.log(`[${category}] OK — id: ${newId}`)
  return newId
}

async function main() {
  console.log('Validando con zod schemas...')
  const parsedPricing = pricingSchema.parse(newPricing)
  const parsedFaqs = faqsSchema.parse(newFaqs)
  const pricingText = composePricingText(parsedPricing)
  const faqsText = composeFaqsText(parsedFaqs)

  console.log('\n--- pricing texto compuesto ---\n' + pricingText)
  console.log('\n--- faqs texto compuesto ---\n' + faqsText)

  const openai = new OpenAI({ apiKey: await getOpenAiKey(PROJECT_ID) })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Faltan credenciales admin de Supabase')
  const supabase = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  await upsertCategory({ supabase, openai, category: 'pricing', composedText: pricingText, structuredData: parsedPricing as unknown as Record<string, unknown> })
  await upsertCategory({ supabase, openai, category: 'faqs', composedText: faqsText, structuredData: parsedFaqs as unknown as Record<string, unknown> })

  await prisma.$disconnect()
  console.log('\nDONE.')
}

main().catch(async (e) => {
  console.error('\nFAILED:', e)
  await prisma.$disconnect()
  process.exit(1)
})
