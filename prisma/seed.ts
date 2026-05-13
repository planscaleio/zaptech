import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { seedDemo } from "./seed-demo"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  // ── PlatformConfig (singleton) ─────────────────────────────────────────────
  await prisma.platformConfig.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      name: "ZapVendas",
      domain: "app.zapvendas.com.br",
      supportEmail: "suporte@zapvendas.com.br",
      timezone: "America/Sao_Paulo",
      gateway: "Stripe",
      currency: "BRL",
      trialDays: 14,
      trialWarnDays: 3,
      invoiceOverdueDays: 3,
      chatUsageThreshold: 90,
    },
  })

  // ── Plans ──────────────────────────────────────────────────────────────────
  const plans = [
    {
      slug: "starter",
      name: "Starter",
      color: "gray",
      price: 297,
      billing: "MENSAL" as const,
      highlight: false,
      description: "Para times pequenos começando com automação.",
      maxUsers: 3,
      maxChats: 500,
      maxAgents: 1,
      maxBoards: 1,
      features: [
        { label: "Usuários", value: "3", included: true, sortOrder: 0 },
        { label: "Chats/mês", value: "500", included: true, sortOrder: 1 },
        { label: "Agentes IA", value: "1", included: true, sortOrder: 2 },
        { label: "Quadros kanban", value: "1", included: true, sortOrder: 3 },
        { label: "Transmissões", value: "—", included: false, sortOrder: 4 },
        { label: "API de webhooks", value: "—", included: false, sortOrder: 5 },
        { label: "Relatórios avançados", value: "—", included: false, sortOrder: 6 },
        { label: "Suporte prioritário", value: "—", included: false, sortOrder: 7 },
      ],
      extras: [
        { label: "Usuário adicional", price: "R$ 49/mês", unitPriceCents: 4900, unitType: "user" },
        { label: "1.000 chats extras", price: "R$ 79/mês", unitPriceCents: 7900, unitType: "1000_chats" },
      ],
    },
    {
      slug: "growth",
      name: "Growth",
      color: "blue",
      price: 897,
      billing: "MENSAL" as const,
      highlight: false,
      description: "Para equipes em crescimento que precisam de escala.",
      maxUsers: 10,
      maxChats: 2000,
      maxAgents: 3,
      maxBoards: 5,
      features: [
        { label: "Usuários", value: "10", included: true, sortOrder: 0 },
        { label: "Chats/mês", value: "2.000", included: true, sortOrder: 1 },
        { label: "Agentes IA", value: "3", included: true, sortOrder: 2 },
        { label: "Quadros kanban", value: "5", included: true, sortOrder: 3 },
        { label: "Transmissões", value: "Ilimitadas", included: true, sortOrder: 4 },
        { label: "API de webhooks", value: "Incluído", included: true, sortOrder: 5 },
        { label: "Relatórios avançados", value: "—", included: false, sortOrder: 6 },
        { label: "Suporte prioritário", value: "—", included: false, sortOrder: 7 },
      ],
      extras: [
        { label: "Usuário adicional", price: "R$ 39/mês", unitPriceCents: 3900, unitType: "user" },
        { label: "1.000 chats extras", price: "R$ 59/mês", unitPriceCents: 5900, unitType: "1000_chats" },
      ],
    },
    {
      slug: "scale",
      name: "Scale",
      color: "purple",
      price: 1990,
      billing: "MENSAL" as const,
      highlight: true,
      description: "Para operações maduras que exigem performance e controle.",
      maxUsers: 20,
      maxChats: 5000,
      maxAgents: 5,
      maxBoards: null, // unlimited
      features: [
        { label: "Usuários", value: "20", included: true, sortOrder: 0 },
        { label: "Chats/mês", value: "5.000", included: true, sortOrder: 1 },
        { label: "Agentes IA", value: "5", included: true, sortOrder: 2 },
        { label: "Quadros kanban", value: "Ilimitados", included: true, sortOrder: 3 },
        { label: "Transmissões", value: "Ilimitadas", included: true, sortOrder: 4 },
        { label: "API de webhooks", value: "Incluído", included: true, sortOrder: 5 },
        { label: "Relatórios avançados", value: "Incluído", included: true, sortOrder: 6 },
        { label: "Suporte prioritário", value: "—", included: false, sortOrder: 7 },
      ],
      extras: [
        { label: "Usuário adicional", price: "R$ 29/mês", unitPriceCents: 2900, unitType: "user" },
        { label: "1.000 chats extras", price: "R$ 39/mês", unitPriceCents: 3900, unitType: "1000_chats" },
      ],
    },
    {
      slug: "enterprise",
      name: "Enterprise",
      color: "amber",
      price: 0,
      billing: "NEGOCIADO" as const,
      highlight: false,
      description: "Contratos personalizados para grandes operações.",
      maxUsers: null,
      maxChats: null,
      maxAgents: null,
      maxBoards: null,
      features: [
        { label: "Usuários", value: "Ilimitados", included: true, sortOrder: 0 },
        { label: "Chats/mês", value: "Ilimitados", included: true, sortOrder: 1 },
        { label: "Agentes IA", value: "Ilimitados", included: true, sortOrder: 2 },
        { label: "Quadros kanban", value: "Ilimitados", included: true, sortOrder: 3 },
        { label: "Transmissões", value: "Ilimitadas", included: true, sortOrder: 4 },
        { label: "API de webhooks", value: "Incluído", included: true, sortOrder: 5 },
        { label: "Relatórios avançados", value: "Incluído", included: true, sortOrder: 6 },
        { label: "Suporte prioritário", value: "Incluído", included: true, sortOrder: 7 },
      ],
      extras: [
        { label: "SLA dedicado", price: "Incluído", unitPriceCents: 0, unitType: "custom" },
        { label: "Infraestrutura isolada", price: "Sob consulta", unitPriceCents: 0, unitType: "custom" },
      ],
    },
  ]

  for (const plan of plans) {
    const { features, extras, ...planData } = plan
    const created = await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: { ...planData },
      create: { ...planData },
    })

    // Recreate features and extras on each seed run
    await prisma.planFeature.deleteMany({ where: { planId: created.id } })
    await prisma.planExtra.deleteMany({ where: { planId: created.id } })

    await prisma.planFeature.createMany({
      data: features.map((f) => ({ ...f, planId: created.id })),
    })

    await prisma.planExtra.createMany({
      data: extras.map((e) => ({ ...e, planId: created.id })),
    })

    console.log(`✓ Plan seeded: ${plan.name}`)
  }

  await seedDemo(prisma)

  console.log("✓ Planos e conta demo seeded.")
  console.log("\n🌱 Seed concluído.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
