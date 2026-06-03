/**
 * check-kb.ts — Lectura GENERICA de la Knowledge Base (agent_knowledge) de cualquier agente.
 *
 * Uso:
 *   npx tsx scripts/check-kb.ts --org <orgId>                  # descubre agentes de la org y muestra su KB
 *   npx tsx scripts/check-kb.ts --agent <agentId> --project <projectId>   # KB de un agente concreto
 *   npx tsx scripts/check-kb.ts --org <orgId> --match event    # filtra agentes cuyo nombre matchea /event/i
 *
 * Solo LECTURA. No modifica nada. Reemplaza a los viejos diagnose-kb.ts + check-events-kb.ts.
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

type KbRow = {
  id: string
  title: string | null
  category: string | null
  source: string
  chunk_index: number
  content: string
  structured_data: unknown
  created_at: Date
  updated_at: Date
}

async function dumpAgentKb(agentId: string, projectId: string, agentLabel: string) {
  const rows = await prisma.$queryRawUnsafe<KbRow[]>(
    `SELECT id, title, category, source, chunk_index, content, structured_data, created_at, updated_at
     FROM agent_knowledge
     WHERE agent_id = $1 AND project_id = $2
     ORDER BY COALESCE(category, 'zzz'), title NULLS LAST, chunk_index ASC`,
    agentId,
    projectId
  )

  console.log(`\n=== KB de ${agentLabel} — ${rows.length} filas ===`)

  const byCategory: Record<string, KbRow[]> = {}
  for (const r of rows) {
    const key = r.category || '(free_text)'
    ;(byCategory[key] ||= []).push(r)
  }

  for (const [cat, list] of Object.entries(byCategory)) {
    console.log(`\n--- CATEGORY: ${cat} (${list.length}) ---`)
    for (const r of list) {
      console.log(`\n  > id=${r.id}`)
      console.log(`    title:       ${r.title ?? '(null)'}`)
      console.log(`    source:      ${r.source}   chunk_index: ${r.chunk_index}`)
      console.log(`    updated_at:  ${r.updated_at.toISOString()}`)
      if (r.structured_data) {
        console.log(`    structured_data:`)
        console.log(JSON.stringify(r.structured_data, null, 2).split('\n').map((l) => '      ' + l).join('\n'))
      }
      console.log(`    content:`)
      console.log(r.content.split('\n').map((l) => '      ' + l).join('\n'))
    }
  }
}

async function main() {
  const orgId = getArg('org')
  const agentId = getArg('agent')
  const projectId = getArg('project')
  const match = getArg('match')

  const dbHost = (process.env.DATABASE_URL || '').match(/@([^/?]+)/)?.[1] ?? '(unknown)'
  console.log(`DB host: ${dbHost}`)
  console.log(`SUPABASE URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`)

  if (agentId && projectId) {
    await dumpAgentKb(agentId, projectId, `agent ${agentId}`)
    await prisma.$disconnect()
    return
  }

  if (!orgId) {
    console.error('\n[!] Faltan argumentos. Usa --org <id>  O  --agent <id> --project <id>.')
    await prisma.$disconnect()
    process.exit(1)
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true, name: true, slug: true,
      projects: {
        select: {
          id: true, name: true, slug: true,
          aiAgents: { select: { id: true, name: true, type: true, isActive: true } },
        },
      },
    },
  })
  if (!org) {
    console.log(`\n[!] Organization ${orgId} no encontrada`)
    await prisma.$disconnect()
    return
  }

  console.log(`\n=== Organization: ${org.name} (${org.id}, slug=${org.slug}) ===`)
  const matchRe = match ? new RegExp(match, 'i') : null
  let dumped = 0
  for (const p of org.projects) {
    console.log(`\n[Project] ${p.name} (id=${p.id}, slug=${p.slug})`)
    for (const a of p.aiAgents) {
      const flag = a.isActive ? '*ACTIVE*' : 'inactive'
      console.log(`  - Agent "${a.name}" [${a.type}] ${flag} (id=${a.id})`)
      if (!matchRe || matchRe.test(a.name)) {
        await dumpAgentKb(a.id, p.id, `"${a.name}" (${a.id})`)
        dumped++
      }
    }
  }
  if (matchRe && dumped === 0) console.log(`\n[!] Ningun agente matchea /${match}/i en esta org.`)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
