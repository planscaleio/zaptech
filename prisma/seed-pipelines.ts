import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter })

const PIPELINES = [
  {
    name: "Pipeline Comercial",
    sortOrder: 0,
    columns: ["Prospecção", "Qualificação", "Proposta", "Negociação", "Fechado"],
  },
  {
    name: "Pós-venda",
    sortOrder: 1,
    columns: ["Onboarding", "Implantação", "Em uso", "Renovação"],
  },
]

async function main() {
  const company = await db.company.findUnique({ where: { slug: "zapvendas-demo" } })
  if (!company) throw new Error("Rode npm run db:seed:company primeiro")

  for (const p of PIPELINES) {
    const existing = await db.kanbanBoard.findFirst({
      where: { companyId: company.id, name: p.name },
    })
    if (existing) {
      console.log(`  já existe: ${p.name}`)
      continue
    }
    await db.kanbanBoard.create({
      data: {
        companyId: company.id,
        name: p.name,
        sortOrder: p.sortOrder,
        columns: {
          create: p.columns.map((name, i) => ({ name, sortOrder: i })),
        },
      },
    })
    console.log(`✓ Pipeline criado: ${p.name}`)
  }

  console.log("\n🌱 Pipelines seed concluído.")
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
