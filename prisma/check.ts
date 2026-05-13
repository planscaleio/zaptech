import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

async function main() {
  const customers = await db.customer.findMany({ select: { id: true, name: true, phone: true, status: true } })
  const conversations = await db.conversation.findMany({ select: { id: true, preview: true, status: true, channel: true } })
  const messages = await db.message.findMany({ select: { authorName: true, role: true, text: true } })
  const connectors = await db.connector.findMany({ select: { name: true, status: true, details: true } })

  console.log("\n── Customers ──────────────────────────")
  console.log(customers.length ? customers : "(vazio)")
  console.log("\n── Conversations ──────────────────────")
  console.log(conversations.length ? conversations : "(vazio)")
  console.log("\n── Messages ───────────────────────────")
  console.log(messages.length ? messages : "(vazio)")
  console.log("\n── Connectors ─────────────────────────")
  console.log(connectors.length ? connectors : "(vazio)")
}

main().catch(console.error).finally(() => db.$disconnect())
