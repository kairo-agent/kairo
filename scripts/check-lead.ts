/**
 * check-lead.ts — Inspecciona un lead concreto: datos, formData y la conversacion completa.
 * Util para debug ("¿que respondio el agente a este lead?", "¿que capturo el formulario?").
 *
 * Uso:
 *   npx tsx scripts/check-lead.ts --lead <leadId>
 *
 * Solo LECTURA. Reemplaza al viejo check-marcos2.ts (que tenia el lead id hardcodeado).
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
  const leadId = getArg('lead')
  if (!leadId) {
    console.error('[!] Falta --lead <leadId>')
    process.exit(1)
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      status: true,
      temperature: true,
      source: true,
      channel: true,
      archivedAt: true,
      createdAt: true,
      formData: { select: { fieldData: true } },
      conversation: {
        select: {
          messages: {
            orderBy: { createdAt: 'asc' },
            select: { sender: true, content: true, createdAt: true },
          },
        },
      },
    },
  })

  if (!lead) {
    console.log(`Lead ${leadId} no encontrado`)
    await prisma.$disconnect()
    return
  }

  console.log(`=== Lead ${lead.id} ===`)
  console.log(`name:        ${JSON.stringify(lead.firstName)} ${JSON.stringify(lead.lastName)}`)
  console.log(`email/phone: ${lead.email ?? '(null)'} / ${lead.phone ?? '(null)'}`)
  console.log(`status:      ${lead.status}   temperature: ${lead.temperature}`)
  console.log(`source:      ${lead.source}   channel: ${lead.channel}`)
  console.log(`archived:    ${lead.archivedAt ? lead.archivedAt.toISOString() : 'no'}`)
  console.log(`created:     ${lead.createdAt.toISOString()}`)
  console.log(`\nformData: ${JSON.stringify(lead.formData, null, 2)}`)

  const messages = lead.conversation?.messages ?? []
  console.log(`\n=== Messages (${messages.length}) ===`)
  messages.forEach((m, i) => {
    console.log(`\n[${i}] ${m.createdAt.toISOString()} ${m.sender}:`)
    console.log(m.content)
  })

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
