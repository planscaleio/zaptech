import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

async function main() {
  const company = await db.company.findUnique({ where: { slug: "zapvendas-demo" } })
  if (!company) throw new Error("Rode tsx prisma/seed-company.ts primeiro")

  // ── Usuários da empresa (User) ─────────────────────────────────────────────
  const companyUsers = [
    { email: "owner@zapvendas.com.br",     name: "Owner Demo",     role: "OWNER"     as const, password: "Owner@123"     },
    { email: "admin@zapvendas.com.br",     name: "Admin Demo",     role: "ADMIN"     as const, password: "Admin@123"     },
    { email: "gestor@zapvendas.com.br",    name: "Gestor Demo",    role: "GESTOR"    as const, password: "Gestor@123"    },
    { email: "atendente@zapvendas.com.br", name: "Atendente Demo", role: "ATENDENTE" as const, password: "Atendente@123" },
  ]

  for (const u of companyUsers) {
    const passwordHash = await bcrypt.hash(u.password, 12)
    const created = await db.user.upsert({
      where: { email_companyId: { email: u.email, companyId: company.id } },
      update: { passwordHash, name: u.name, role: u.role },
      create: { companyId: company.id, name: u.name, email: u.email, role: u.role, status: "ATIVO", passwordHash },
    })
    console.log(`✓ User [${created.role}]: ${created.email}  →  senha: ${u.password}`)
  }

  // ── Admins da plataforma (AdminUser) ───────────────────────────────────────
  const adminUsers = [
    { email: "superadmin@zapvendas.com.br", name: "Super Admin",  role: "SUPER_ADMIN" as const, password: "SuperAdmin@123"  },
    { email: "financeiro@zapvendas.com.br", name: "Financeiro",   role: "FINANCEIRO"  as const, password: "Financeiro@123"  },
  ]

  for (const a of adminUsers) {
    const passwordHash = await bcrypt.hash(a.password, 12)
    await db.adminUser.upsert({
      where: { email: a.email },
      update: { passwordHash, name: a.name, role: a.role },
      create: { name: a.name, email: a.email, role: a.role, passwordHash },
    })
    console.log(`✓ AdminUser [${a.role}]: ${a.email}  →  senha: ${a.password}`)
  }

  console.log("\n🌱 seed-user concluído.")
}

main().catch(console.error).finally(() => db.$disconnect())
