// ============================================
// KAIRO - Fake Data Seed Script (Testing Only)
// Creates Organization, Project, AI Agents, and 100 Leads
// ============================================

import { PrismaClient, SystemRole, ProjectRole, LeadStatus, LeadTemperature, LeadSource, LeadChannel, LeadType, AIAgentType, CurrencyCode, ProjectPlan } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

// ============================================
// CONFIGURATION
// ============================================

const ORG_CONFIG = {
  name: 'Leon33',
  slug: 'leon33',
  description: 'Organización de desarrollo y testing',
};

const PROJECT_CONFIG = {
  name: 'Disruptivo',
  slug: 'disruptivo',
  description: 'Proyecto principal de leads con IA',
  plan: ProjectPlan.professional,
};

// AI Agents (from original KAIRO design)
const AI_AGENTS = [
  {
    name: 'Luna',
    type: AIAgentType.sales,
    description: 'Agente de ventas especializado en cierre de deals',
    avatarUrl: null,
  },
  {
    name: 'Atlas',
    type: AIAgentType.support,
    description: 'Agente de soporte técnico y atención al cliente',
    avatarUrl: null,
  },
  {
    name: 'Nova',
    type: AIAgentType.qualification,
    description: 'Agente de calificación y scoring de leads',
    avatarUrl: null,
  },
  {
    name: 'Orion',
    type: AIAgentType.appointment,
    description: 'Agente de agendamiento de citas y reuniones',
    avatarUrl: null,
  },
];

// Peruvian names for realistic data
const FIRST_NAMES = [
  'Carlos', 'María', 'José', 'Ana', 'Luis', 'Rosa', 'Juan', 'Carmen', 'Miguel', 'Patricia',
  'Jorge', 'Elizabeth', 'Ricardo', 'Claudia', 'Fernando', 'Sofía', 'Alberto', 'Valentina', 'Andrés', 'Lucía',
  'Pedro', 'Alejandra', 'Diego', 'Gabriela', 'Martín', 'Isabella', 'Roberto', 'Camila', 'Eduardo', 'Natalia',
  'Sergio', 'Daniela', 'Javier', 'Mariana', 'Óscar', 'Andrea', 'Raúl', 'Paula', 'Guillermo', 'Diana',
];

const LAST_NAMES = [
  'García', 'Rodríguez', 'López', 'Martínez', 'González', 'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Flores',
  'Rivera', 'Gómez', 'Díaz', 'Hernández', 'Reyes', 'Morales', 'Cruz', 'Ortiz', 'Gutiérrez', 'Mendoza',
  'Vargas', 'Castillo', 'Jiménez', 'Rojas', 'Medina', 'Aguilar', 'Vega', 'Castro', 'Ramos', 'Ruiz',
  'Silva', 'Delgado', 'Paredes', 'Salazar', 'Fernández', 'Chávez', 'Espinoza', 'Quispe', 'Huamán', 'Arias',
];

const BUSINESS_NAMES = [
  'TechSolutions SAC', 'Inversiones Lima', 'Grupo Andino', 'Digital Factory', 'Innovatech Perú',
  'Comercial El Sol', 'Constructora Norte', 'Servicios Globales', 'Importaciones del Sur', 'Agroindustrial SAC',
  'Consultora Ejecutiva', 'Transportes Lima', 'Distribuidora Central', 'Alimentos del Valle', 'Textiles Arequipa',
  'Minera San Martín', 'Farmacia Salud', 'Restaurante Fusión', 'Hotel Costa Verde', 'Clínica San Pedro',
  'Educación Plus', 'Seguros Protección', 'Inmobiliaria Centro', 'Automotriz Perú', 'Energía Limpia',
  null, null, null, // Some leads without business
];

const POSITIONS = [
  'Gerente General', 'Director Comercial', 'Jefe de Ventas', 'Gerente de Marketing', 'CEO',
  'CFO', 'CTO', 'Director de Operaciones', 'Gerente de Compras', 'Jefe de TI',
  'Coordinador de Proyectos', 'Analista de Negocios', 'Asistente Ejecutivo', 'Consultor Senior', 'Emprendedor',
  null, null, // Some without position
];

const PIPELINE_STAGES = ['inbox', 'contacted', 'meeting', 'proposal', 'negotiation', 'closed'];

const TAGS = [
  'vip', 'urgente', 'referido', 'empresa-grande', 'pyme', 'startup',
  'b2b', 'b2c', 'recurrente', 'nuevo', 'tech', 'retail',
];

// ============================================
// UTILITY FUNCTIONS
// ============================================

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomElements<T>(arr: T[], min: number, max: number): T[] {
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function randomDate(startDays: number, endDays: number): Date {
  const now = new Date();
  const start = new Date(now.getTime() - startDays * 24 * 60 * 60 * 1000);
  const end = new Date(now.getTime() - endDays * 24 * 60 * 60 * 1000);
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomPhone(): string {
  const prefix = randomElement(['9', '9', '9', '01']); // Mostly mobile
  if (prefix === '01') {
    return `01${Math.floor(Math.random() * 9000000 + 1000000)}`;
  }
  return `${prefix}${Math.floor(Math.random() * 90000000 + 10000000)}`;
}

function randomEmail(firstName: string, lastName: string): string {
  const domains = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'empresa.pe', 'corporativo.com.pe'];
  const normalized = `${firstName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}.${lastName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`;
  return `${normalized}@${randomElement(domains)}`;
}

function randomValue(): Decimal | null {
  if (Math.random() < 0.3) return null; // 30% without value
  const values = [500, 1000, 1500, 2000, 2500, 3000, 5000, 7500, 10000, 15000, 20000, 25000, 30000, 50000, 75000, 100000];
  return new Decimal(randomElement(values));
}

// ============================================
// MAIN SEED FUNCTION
// ============================================

async function main() {
  console.log('🚀 Starting KAIRO fake data seed...\n');

  // Get super_admin user (must exist from previous seed)
  const superAdmin = await prisma.user.findFirst({
    where: { systemRole: SystemRole.super_admin },
  });

  if (!superAdmin) {
    throw new Error('Super admin not found. Run `npx prisma db seed` first.');
  }

  console.log(`✅ Found super admin: ${superAdmin.email}\n`);

  // ============================================
  // 1. Create Organization
  // ============================================
  console.log('📁 Creating organization...');

  let organization = await prisma.organization.findUnique({
    where: { slug: ORG_CONFIG.slug },
  });

  if (organization) {
    console.log(`   Organization "${ORG_CONFIG.name}" already exists, skipping...`);
  } else {
    organization = await prisma.organization.create({
      data: {
        name: ORG_CONFIG.name,
        slug: ORG_CONFIG.slug,
        description: ORG_CONFIG.description,
        isActive: true,
        // Timezone & Locale defaults for Peru
        defaultTimezone: 'America/Lima',
        defaultLocale: 'es-PE',
      },
    });
    console.log(`   ✅ Created organization: ${organization.name}`);
  }

  // Add super_admin as org owner
  const existingOrgMember = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: superAdmin.id,
      },
    },
  });

  if (!existingOrgMember) {
    await prisma.organizationMember.create({
      data: {
        organizationId: organization.id,
        userId: superAdmin.id,
        isOwner: true,
      },
    });
    console.log(`   ✅ Added ${superAdmin.firstName} as org owner`);
  }

  // ============================================
  // 2. Create Project
  // ============================================
  console.log('\n📂 Creating project...');

  let project = await prisma.project.findFirst({
    where: {
      organizationId: organization.id,
      slug: PROJECT_CONFIG.slug,
    },
  });

  if (project) {
    console.log(`   Project "${PROJECT_CONFIG.name}" already exists, skipping...`);
  } else {
    project = await prisma.project.create({
      data: {
        organizationId: organization.id,
        name: PROJECT_CONFIG.name,
        slug: PROJECT_CONFIG.slug,
        description: PROJECT_CONFIG.description,
        plan: PROJECT_CONFIG.plan,
        defaultCurrency: CurrencyCode.PEN,
        supportedCurrencies: [CurrencyCode.PEN, CurrencyCode.USD],
        isActive: true,
      },
    });
    console.log(`   ✅ Created project: ${project.name}`);
  }

  // Add super_admin as project admin
  const existingProjectMember = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId: project.id,
        userId: superAdmin.id,
      },
    },
  });

  if (!existingProjectMember) {
    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        userId: superAdmin.id,
        role: ProjectRole.admin,
      },
    });
    console.log(`   ✅ Added ${superAdmin.firstName} as project admin`);
  }

  // ============================================
  // 3. Create AI Agents
  // ============================================
  console.log('\n🤖 Creating AI agents...');

  const createdAgents: { id: string; name: string }[] = [];

  for (const agentData of AI_AGENTS) {
    let agent = await prisma.aIAgent.findFirst({
      where: {
        projectId: project.id,
        name: agentData.name,
      },
    });

    if (agent) {
      console.log(`   Agent "${agentData.name}" already exists, skipping...`);
      createdAgents.push({ id: agent.id, name: agent.name });
    } else {
      agent = await prisma.aIAgent.create({
        data: {
          projectId: project.id,
          name: agentData.name,
          type: agentData.type,
          description: agentData.description,
          avatarUrl: agentData.avatarUrl,
          isActive: true,
          stats: {
            totalConversations: Math.floor(Math.random() * 500) + 50,
            totalLeadsGenerated: Math.floor(Math.random() * 200) + 20,
            averageResponseTime: Math.floor(Math.random() * 30) + 5,
            satisfactionScore: Math.floor(Math.random() * 20) + 80,
          },
        },
      });
      console.log(`   ✅ Created agent: ${agent.name} (${agent.type})`);
      createdAgents.push({ id: agent.id, name: agent.name });
    }
  }

  // ============================================
  // 4. Create 100 Leads
  // ============================================
  console.log('\n👥 Creating 100 leads...');

  // Check existing leads count
  const existingLeadsCount = await prisma.lead.count({
    where: { projectId: project.id },
  });

  if (existingLeadsCount >= 100) {
    console.log(`   Already have ${existingLeadsCount} leads, skipping...`);
  } else {
    const leadsToCreate = 100 - existingLeadsCount;
    console.log(`   Creating ${leadsToCreate} new leads...`);

    const statuses = Object.values(LeadStatus);
    const temperatures = Object.values(LeadTemperature);
    const sources = Object.values(LeadSource);
    const channels = Object.values(LeadChannel);
    const types = Object.values(LeadType);

    for (let i = 0; i < leadsToCreate; i++) {
      const firstName = randomElement(FIRST_NAMES);
      const lastName = randomElement(LAST_NAMES);
      const createdAt = randomDate(365, 0); // Up to 1 year ago
      const lastContactAt = Math.random() > 0.3 ? randomDate(Math.floor((new Date().getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000)), 0) : null;
      const nextFollowUpAt = Math.random() > 0.5 ? randomDate(-30, -1) : null; // Future date

      // Weight status distribution
      const statusWeights: LeadStatus[] = [
        ...Array(25).fill(LeadStatus.new),
        ...Array(20).fill(LeadStatus.contacted),
        ...Array(15).fill(LeadStatus.qualified),
        ...Array(15).fill(LeadStatus.proposal),
        ...Array(10).fill(LeadStatus.negotiation),
        ...Array(10).fill(LeadStatus.won),
        ...Array(5).fill(LeadStatus.lost),
      ];

      // Weight temperature distribution
      const tempWeights: LeadTemperature[] = [
        ...Array(40).fill(LeadTemperature.cold),
        ...Array(35).fill(LeadTemperature.warm),
        ...Array(25).fill(LeadTemperature.hot),
      ];

      const status = randomElement(statusWeights);
      const temperature = randomElement(tempWeights);
      const type = Math.random() > 0.3 ? LeadType.ai_agent : LeadType.manual;
      const assignedAgent = type === LeadType.ai_agent ? randomElement(createdAgents) : null;

      await prisma.lead.create({
        data: {
          projectId: project.id,
          firstName,
          lastName,
          email: Math.random() > 0.1 ? randomEmail(firstName, lastName) : null,
          phone: Math.random() > 0.05 ? randomPhone() : null,
          businessName: randomElement(BUSINESS_NAMES),
          position: randomElement(POSITIONS),
          status,
          temperature,
          source: randomElement(sources),
          channel: randomElement(channels),
          type,
          assignedAgentId: assignedAgent?.id || null,
          assignedUserId: Math.random() > 0.7 ? superAdmin.id : null,
          pipelineStage: randomElement(PIPELINE_STAGES),
          estimatedValue: randomValue(),
          currency: Math.random() > 0.8 ? CurrencyCode.USD : CurrencyCode.PEN,
          tags: randomElements(TAGS, 0, 3),
          lastContactAt,
          nextFollowUpAt,
          createdAt,
          updatedAt: createdAt,
        },
      });

      if ((i + 1) % 20 === 0) {
        console.log(`   Created ${i + 1}/${leadsToCreate} leads...`);
      }
    }

    console.log(`   ✅ Created ${leadsToCreate} leads successfully!`);
  }

  // ============================================
  // 5. Summary
  // ============================================
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 SEED SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const finalLeadsCount = await prisma.lead.count({ where: { projectId: project.id } });
  const agentsCount = await prisma.aIAgent.count({ where: { projectId: project.id } });

  const statusCounts = await prisma.lead.groupBy({
    by: ['status'],
    where: { projectId: project.id },
    _count: true,
  });

  console.log(`   Organization: ${organization.name}`);
  console.log(`   Project:      ${project.name}`);
  console.log(`   AI Agents:    ${agentsCount}`);
  console.log(`   Total Leads:  ${finalLeadsCount}`);
  console.log('\n   Lead Status Distribution:');
  for (const sc of statusCounts) {
    console.log(`     - ${sc.status}: ${sc._count}`);
  }

  console.log('\n✅ Fake data seed completed!\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
