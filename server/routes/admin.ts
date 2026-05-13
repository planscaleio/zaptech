import { Router, type Request, type Response, type NextFunction } from "express"
import jwt from "jsonwebtoken"
import { db } from "../db.js"

const router = Router()
const SECRET = process.env.AUTH_SECRET!

// ─── Auth middleware ───────────────────────────────────────────────────────────

function adminAuth(req: Request, res: Response, next: NextFunction) {
  const token = (req.headers.authorization ?? "").replace("Bearer ", "").trim()
  if (!token) return res.status(401).json({ error: "Token ausente" })
  try {
    const payload = jwt.verify(token, SECRET) as { type?: string }
    if (payload.type !== "admin") return res.status(403).json({ error: "Acesso restrito a administradores" })
    next()
  } catch {
    return res.status(401).json({ error: "Token inválido ou expirado" })
  }
}

router.use(adminAuth)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function companyHealth(c: {
  status: string
  currentUsers: number; maxUsers: number | null
  currentChats: number; maxChats: number | null
  trialEndsAt: Date | null
  nextBilling: Date | null
}): "good" | "warning" | "critical" {
  if (c.status === "INADIMPLENTE" || c.status === "SUSPENSA") return "critical"
  const now = Date.now()
  if (c.trialEndsAt && c.status === "TRIAL") {
    const diffDays = (c.trialEndsAt.getTime() - now) / 86400000
    if (diffDays < 0) return "critical"
    if (diffDays < 4) return "warning"
  }
  const userPct  = c.maxUsers  ? c.currentUsers  / c.maxUsers  : 0
  const chatPct  = c.maxChats  ? c.currentChats  / c.maxChats  : 0
  const maxPct   = Math.max(userPct, chatPct)
  if (maxPct >= 1)    return "critical"
  if (maxPct >= 0.85) return "warning"
  return "good"
}

function daysLeft(c: { status: string; trialEndsAt: Date | null; nextBilling: Date | null }): number {
  const ref = c.status === "TRIAL" ? c.trialEndsAt : c.nextBilling
  if (!ref) return 0
  return Math.round((ref.getTime() - Date.now()) / 86400000)
}

function fmtMrr(val: number) {
  return `R$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function fmtDate(d: Date | null | undefined) {
  if (!d) return "—"
  return new Intl.DateTimeFormat("pt-BR").format(d)
}

// ─── GET /api/admin/stats ─────────────────────────────────────────────────────

router.get("/stats", async (_req: Request, res: Response) => {
  const now = new Date()
  const in7 = new Date(now.getTime() + 7 * 86400000)

  const [
    companies,
    totalUsers,
    totalChats,
    delinquent,
    trialExpiring,
    mrrByPlan,
    recentCompanies,
  ] = await Promise.all([
    db.company.aggregate({ _sum: { mrr: true }, _count: { id: true } }),
    db.user.count(),
    db.company.aggregate({ _sum: { currentChats: true } }),
    db.company.count({ where: { status: "INADIMPLENTE" } }),
    db.company.count({ where: { status: "TRIAL", trialEndsAt: { lte: in7 } } }),
    db.company.groupBy({
      by: ["planId"],
      _sum: { mrr: true },
      _count: { id: true },
    }),
    db.company.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, createdAt: true, status: true },
    }),
  ])

  const planIds = mrrByPlan.map((r) => r.planId)
  const plans = await db.plan.findMany({
    where: { id: { in: planIds } },
    select: { id: true, name: true, color: true },
  })
  const planMap = Object.fromEntries(plans.map((p) => [p.id, p]))

  const totalMrr = Number(companies._sum.mrr ?? 0)
  const activeCompanies = await db.company.count({ where: { status: "ATIVA" } })

  const mrrRows = mrrByPlan.map((r) => ({
    plan:  planMap[r.planId]?.name  ?? "—",
    color: planMap[r.planId]?.color ?? "gray",
    value: Number(r._sum.mrr ?? 0),
    count: r._count.id,
    total: totalMrr,
  }))

  const recentActivity = recentCompanies.map((c) => ({
    action:  "Nova empresa criada",
    subject: c.name,
    time:    fmtDate(c.createdAt),
    type:    "new" as const,
  }))

  return res.json({
    totalMrr,
    totalMrrFmt:      fmtMrr(totalMrr),
    activeCompanies,
    totalCompanies:   companies._count.id,
    totalUsers,
    totalChats:       Number(totalChats._sum.currentChats ?? 0),
    delinquent,
    trialExpiring,
    mrrByPlan:        mrrRows,
    recentActivity,
  })
})

// ─── GET /api/admin/companies ─────────────────────────────────────────────────

router.get("/companies", async (req: Request, res: Response) => {
  const { q, status } = req.query as Record<string, string>

  const rows = await db.company.findMany({
    where: {
      ...(status ? { status: status as "ATIVA" | "TRIAL" | "INADIMPLENTE" | "SUSPENSA" } : {}),
      ...(q?.trim() ? { name: { contains: q.trim(), mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      plan: { select: { id: true, name: true, color: true, maxUsers: true, maxChats: true, maxAgents: true } },
    },
  })

  const result = rows.map((c) => ({
    id:          c.id,
    name:        c.name,
    slug:        c.slug,
    status:      c.status,
    plan:        c.plan.name,
    planId:      c.plan.id,
    planColor:   c.plan.color,
    mrr:         fmtMrr(Number(c.mrr)),
    mrrRaw:      Number(c.mrr),
    users:       c.currentUsers,
    maxUsers:    c.plan.maxUsers ?? 999,
    chats:       c.currentChats,
    maxChats:    c.plan.maxChats ?? 999,
    agents:      c.currentAgents,
    maxAgents:   c.plan.maxAgents ?? 999,
    owner:       c.ownerName ?? "—",
    email:       c.email    ?? "—",
    phone:       c.phone    ?? "—",
    cnpj:        c.cnpj     ?? "—",
    city:        c.city     ?? "—",
    createdAt:   fmtDate(c.createdAt),
    nextBilling: fmtDate(c.nextBilling),
    daysLeft:    daysLeft(c),
    health:      companyHealth({ ...c, maxUsers: c.plan.maxUsers, maxChats: c.plan.maxChats }),
  }))

  return res.json(result)
})

// ─── PATCH /api/admin/companies/:id ──────────────────────────────────────────

router.patch("/companies/:id", async (req: Request, res: Response) => {
  const { status, planId, mrr, nextBilling } = req.body ?? {}
  const validStatuses = ["ATIVA", "TRIAL", "INADIMPLENTE", "SUSPENSA"]

  const company = await db.company.update({
    where: { id: req.params.id },
    data: {
      ...(status && validStatuses.includes(status) ? { status } : {}),
      ...(planId ? { planId } : {}),
      ...(mrr !== undefined ? { mrr } : {}),
      ...(nextBilling ? { nextBilling: new Date(nextBilling) } : {}),
    },
    include: { plan: { select: { name: true, color: true, maxUsers: true, maxChats: true, maxAgents: true } } },
  })

  return res.json({
    id:          company.id,
    status:      company.status,
    plan:        company.plan.name,
    planColor:   company.plan.color,
    mrr:         fmtMrr(Number(company.mrr)),
    mrrRaw:      Number(company.mrr),
    nextBilling: fmtDate(company.nextBilling),
    daysLeft:    daysLeft(company),
    health:      companyHealth({ ...company, maxUsers: company.plan.maxUsers, maxChats: company.plan.maxChats }),
  })
})

// ─── GET /api/admin/plans ─────────────────────────────────────────────────────

router.get("/plans", async (_req: Request, res: Response) => {
  const plans = await db.plan.findMany({
    orderBy: { price: "asc" },
    include: {
      features: { orderBy: { sortOrder: "asc" } },
      extras:   true,
      _count:   { select: { companies: true } },
    },
  })

  const mrrByPlan = await db.company.groupBy({
    by: ["planId"],
    _sum: { mrr: true },
  })
  const mrrMap = Object.fromEntries(mrrByPlan.map((r) => [r.planId, Number(r._sum.mrr ?? 0)]))

  return res.json(plans.map((p) => ({
    id:          p.id,
    name:        p.name,
    slug:        p.slug,
    color:       p.color,
    price:       Number(p.price),
    billing:     p.billing,
    highlight:   p.highlight,
    description: p.description,
    maxUsers:    p.maxUsers,
    maxChats:    p.maxChats,
    maxAgents:   p.maxAgents,
    maxBoards:   p.maxBoards,
    companies:   p._count.companies,
    mrr:         mrrMap[p.id] ?? 0,
    features:    p.features,
    extras:      p.extras,
  })))
})

// ─── GET /api/admin/users ─────────────────────────────────────────────────────

router.get("/users", async (req: Request, res: Response) => {
  const { q } = req.query as Record<string, string>

  const users = await db.user.findMany({
    where: q?.trim() ? {
      OR: [
        { name:  { contains: q.trim(), mode: "insensitive" } },
        { email: { contains: q.trim(), mode: "insensitive" } },
        { company: { name: { contains: q.trim(), mode: "insensitive" } } },
      ],
    } : {},
    orderBy: { lastSeen: "desc" },
    take: 200,
    select: {
      id: true, name: true, email: true, role: true, status: true, lastSeen: true,
      company: { select: { name: true, plan: { select: { name: true, color: true } } } },
    },
  })

  function fmtLastSeen(d: Date | null) {
    if (!d) return "Nunca"
    const m = Math.floor((Date.now() - d.getTime()) / 60000)
    if (m < 2)  return "Agora"
    if (m < 60) return `${m}min`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h`
    return `${Math.floor(h / 24)}d`
  }

  return res.json(users.map((u) => ({
    id:        u.id,
    name:      u.name,
    email:     u.email,
    role:      u.role,
    status:    u.status,
    lastSeen:  fmtLastSeen(u.lastSeen),
    company:   u.company.name,
    plan:      u.company.plan.name,
    planColor: u.company.plan.color,
  })))
})

// ─── GET /api/admin/admin-users ───────────────────────────────────────────────

router.get("/admin-users", async (_req: Request, res: Response) => {
  const admins = await db.adminUser.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, lastSeen: true },
  })
  return res.json(admins)
})

// ─── GET /api/admin/platform-config ──────────────────────────────────────────

router.get("/platform-config", async (_req: Request, res: Response) => {
  const config = await db.platformConfig.findUnique({ where: { id: "singleton" } })
  return res.json(config ?? {})
})

// ─── GET /api/admin/invoices ──────────────────────────────────────────────────

router.get("/invoices", async (_req: Request, res: Response) => {
  const invoices = await db.invoice.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      company: { select: { name: true } },
      plan:    { select: { name: true } },
    },
  })

  return res.json(invoices.map((inv) => ({
    id:      inv.id,
    company: inv.company.name,
    plan:    inv.plan.name,
    amount:  fmtMrr(Number(inv.amount)),
    method:  inv.method ?? "—",
    date:    fmtDate(inv.paidAt ?? inv.dueDate),
    status:  inv.status === "PAGO" ? "Pago" : inv.status === "PENDENTE" ? "Pendente" : "Vencido",
  })))
})

export default router
