import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

async function main() {
  const hash = await bcrypt.hash("zapvendas123", 12)
  await db.adminUser.update({ where: { email: "allan@zapvendas.com.br" }, data: { passwordHash: hash } })
  console.log("✓ AdminUser password set")
}

main().catch(console.error).finally(() => db.$disconnect())
