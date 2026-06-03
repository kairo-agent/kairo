/**
 * check-instructions.ts — Lectura GENERICA de las instrucciones/prompt de cualquier agente.
 *
 * Uso:
 *   npx tsx scripts/check-instructions.ts --agent <agentId>
 *
 * Muestra: description, systemInstructions, promptStructure, reEngagementConfig, formConfig.
 * Solo LECTURA. Reemplaza al viejo check-events-instructions.ts.
 *
 * NOTA (ver memoria FEEDBACK-AGENT-INFO-DUPLICATION): la misma data de negocio vive duplicada
 * en KB (agent_knowledge) Y en estos campos del agente. Al actualizar una, revisar la otra.
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv({ path: '.env' })
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function getArg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const agentId = getArg('agent')
  if (!agentId) {
    console.error('[!] Falta --agent <agentId>')
    process.exit(1)
  }

  const a = await prisma.aIAgent.findUnique({
    where: { id: agentId },
    select: {
      id: true,
      name: true,
      description: true,
      systemInstructions: true,
      promptStructure: true,
      reEngagementConfig: true,
      formConfig: true,
    },
  })
  if (!a) {
    console.log(`agent ${agentId} no encontrado`)
    await prisma.$disconnect()
    return
  }

  console.log(`Agent: ${a.name} (${a.id})`)
  console.log(`\n=== description ===\n${a.description ?? '(null)'}`)
  console.log(`\n=== systemInstructions ===\n${a.systemInstructions ?? '(null)'}`)
  console.log(`\n=== promptStructure ===\n${JSON.stringify(a.promptStructure, null, 2)}`)
  console.log(`\n=== reEngagementConfig ===\n${JSON.stringify(a.reEngagementConfig, null, 2)}`)
  console.log(`\n=== formConfig ===\n${JSON.stringify(a.formConfig, null, 2)}`)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
