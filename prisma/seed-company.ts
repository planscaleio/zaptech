import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter })

async function main() {
  const plan = await db.plan.findUnique({ where: { slug: "growth" } })
  if (!plan) throw new Error("Rode npm run db:seed primeiro")

  const company = await db.company.upsert({
    where: { slug: "zapvendas-demo" },
    update: {},
    create: {
      name: "ZapVendas Demo",
      slug: "zapvendas-demo",
      status: "ATIVA",
      planId: plan.id,
      ownerName: "Allan Torres",
      email: "allan@zapvendas.com.br",
    },
  })
  console.log(`✓ Company: ${company.name} (${company.id})`)

  // Connector para mapear a instância Evolution
  await db.connector.upsert({
    where: { companyId_name: { companyId: company.id, name: "zappragma" } },
    update: {},
    create: {
      companyId: company.id,
      name: "zappragma",
      type: "CANAL",
      status: "DESCONECTADO",
      details: "Instância Evolution API",
    },
  })
  console.log("✓ Connector: zappragma")
  console.log("\n🌱 Company seed concluído.")
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
