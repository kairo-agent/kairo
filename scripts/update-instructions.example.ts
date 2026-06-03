/**
 * update-instructions.example.ts — TEMPLATE para actualizar las instrucciones de un agente
 * mediante reemplazos EXACTOS de texto (find/replace seguro, no regex).
 *
 * Patron de uso:
 *   1. Copia:  scripts/update-instructions.example.ts -> scripts/_tmp-update-instructions.ts
 *   2. Edita la ZONA DE EDICION (AGENT_ID + REPLACEMENTS). Saca primero el texto exacto con:
 *        npx tsx scripts/check-instructions.ts --agent <AGENT_ID>
 *   3. Corre:  npx tsx scripts/_tmp-update-instructions.ts
 *   4. Borra el _tmp.
 *
 * Cubre los 3 lugares donde vive el texto del prompt:
 *   - systemInstructions (string)
 *   - promptStructure.additionalInstructions (string dentro de JSON)
 *   - reEngagementConfig.{promptTemplate, attempt1Instructions, attempt2Instructions}
 *
 * Cada reemplazo es EXACTO: si el `from` no existe, se loguea como "missed" y se omite (no rompe).
 * Al final re-lee y avisa si quedo alguna cadena vieja.
 *
 * IMPORTANTE (memoria FEEDBACK-AGENT-INFO-DUPLICATION): si cambias precios/fechas aqui, revisa que
 * la KB estructurada (update-kb.example.ts) tambien quede consistente, o el agente se contradice.
 *
 * Los REPLACEMENTS de ejemplo abajo son del evento E&Z (cambio de fechas Junio 2026, referencia real).
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv({ path: '.env' })
import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

// ============================ ZONA DE EDICION ============================
const AGENT_ID = 'cmp1txhr200011tjkaliyvfft' // <-- EDITAR

type Replacement = { from: string; to: string; label: string }
const REPLACEMENTS: Replacement[] = [
  { label: 'fecha del evento', from: 'del 6-7 de Junio de 2026', to: 'del 13 de Junio de 2026' },
  { label: 'cierre de inscripcion', from: 'Fecha de cierre de inscripción: 4 de Junio de 2026.', to: 'Fecha de cierre de inscripción: 10 de Junio de 2026.' },
  // ... agrega los reemplazos exactos que necesites
]
// ========================== FIN ZONA DE EDICION ==========================

function applyReplacements(input: string): { out: string; applied: string[]; missed: string[] } {
  let out = input
  const applied: string[] = []
  const missed: string[] = []
  for (const r of REPLACEMENTS) {
    if (out.includes(r.from)) {
      out = out.split(r.from).join(r.to)
      applied.push(r.label)
    } else {
      missed.push(r.label)
    }
  }
  return { out, applied, missed }
}

async function main() {
  const a = await prisma.aIAgent.findUnique({
    where: { id: AGENT_ID },
    select: { systemInstructions: true, promptStructure: true, reEngagementConfig: true },
  })
  if (!a) throw new Error('Agente no encontrado')

  // 1. systemInstructions (string raw)
  const sysRes = applyReplacements(a.systemInstructions ?? '')
  console.log('=== systemInstructions ===')
  console.log(`  applied (${sysRes.applied.length}): ${sysRes.applied.join(', ')}`)
  if (sysRes.missed.length) console.log(`  missed/na (${sysRes.missed.length}): ${sysRes.missed.join(', ')}`)

  // 2. promptStructure.additionalInstructions (string dentro de JSON)
  const ps = (a.promptStructure as Record<string, unknown>) || {}
  const addInstr = typeof ps.additionalInstructions === 'string' ? ps.additionalInstructions : ''
  const psRes = applyReplacements(addInstr)
  console.log('\n=== promptStructure.additionalInstructions ===')
  console.log(`  applied (${psRes.applied.length}): ${psRes.applied.join(', ')}`)
  if (psRes.missed.length) console.log(`  missed/na (${psRes.missed.length}): ${psRes.missed.join(', ')}`)
  const newPromptStructure = { ...ps, additionalInstructions: psRes.out }

  // 3. reEngagementConfig (3 campos string)
  const re = (a.reEngagementConfig as Record<string, unknown>) || {}
  const reFields = ['promptTemplate', 'attempt1Instructions', 'attempt2Instructions'] as const
  const newReEng: Record<string, unknown> = { ...re }
  console.log('\n=== reEngagementConfig ===')
  for (const f of reFields) {
    const val = typeof re[f] === 'string' ? (re[f] as string) : ''
    const r = applyReplacements(val)
    newReEng[f] = r.out
    console.log(`  ${f}: applied ${r.applied.length} reemplazo(s)`)
  }

  await prisma.aIAgent.update({
    where: { id: AGENT_ID },
    data: {
      systemInstructions: sysRes.out,
      promptStructure: newPromptStructure as unknown as Prisma.InputJsonValue,
      reEngagementConfig: newReEng as unknown as Prisma.InputJsonValue,
    },
  })

  console.log('\nGuardado. Re-leyendo para verificar...')
  const after = await prisma.aIAgent.findUnique({
    where: { id: AGENT_ID },
    select: { systemInstructions: true, promptStructure: true, reEngagementConfig: true },
  })
  const allText =
    (after?.systemInstructions ?? '') + '\n' +
    JSON.stringify(after?.promptStructure ?? {}) + '\n' +
    JSON.stringify(after?.reEngagementConfig ?? {})
  const stillThere = REPLACEMENTS.filter((r) => allText.includes(r.from))
  if (stillThere.length === 0) {
    console.log('OK — ninguna cadena vieja quedo en el agente.')
  } else {
    console.log('[!] Quedaron cadenas viejas:')
    for (const r of stillThere) console.log(`  - ${r.label}: "${r.from}"`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('FAILED:', e)
  await prisma.$disconnect()
  process.exit(1)
})
