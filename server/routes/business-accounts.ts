import { Router, Request, Response } from "express"
import { db } from "../db.js"

const router = Router()

// GET /business-accounts?companyId=&q=&status=&industry=
router.get("/", async (req: Request, res: Response) => {
  const { companyId, q, status, industry } = req.query
  if (!companyId || typeof companyId !== "string") {
    return res.status(400).json({ error: "companyId é obrigatório" })
  }

  const where: Record<string, unknown> = { companyId }
  if (status   && typeof status   === "string") where.status   = status
  if (industry && typeof industry === "string") where.industry = industry
  if (q && typeof q === "string" && q.trim()) {
    const t = q.trim()
    where.OR = [
      { name: { contains: t, mode: "insensitive" } },
      { cnpj: { contains: t } },
      { email: { contains: t, mode: "insensitive" } },
      { city:  { contains: t, mode: "insensitive" } },
    ]
  }

  const accounts = await db.businessAccount.findMany({
    where: where as any,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, name: true, cnpj: true, industry: true,
      size: true, status: true, city: true, state: true,
      value: true, createdAt: true, updatedAt: true,
      _count: { select: { contacts: true } },
    },
  })

  return res.json(accounts)
})

// POST /business-accounts
router.post("/", async (req: Request, res: Response) => {
  const { companyId, name, cnpj, website, phone, email, city, state,
          industry, size, status, value, ltv, notes } = req.body
  if (!companyId || !name?.trim()) {
    return res.status(400).json({ error: "companyId e name são obrigatórios" })
  }

  const account = await db.businessAccount.create({
    data: {
      companyId,
      name: name.trim(),
      cnpj:     cnpj     || null,
      website:  website  || null,
      phone:    phone    || null,
      email:    email    || null,
      city:     city     || null,
      state:    state    || null,
      industry: industry || null,
      size:     size     || null,
      status:   status   || "Prospect",
      value:    value    ? Number(value)  : null,
      ltv:      ltv      ? Number(ltv)    : null,
      notes:    notes    || null,
    },
  })

  return res.status(201).json(account)
})

// GET /business-accounts/:id
router.get("/:id", async (req: Request, res: Response) => {
  const { id } = req.params

  const account = await db.businessAccount.findUnique({
    where: { id },
    include: {
      contacts: {
        select: {
          id: true, name: true, phone: true, email: true,
          status: true, stage: true, aiScore: true,
          lastContactAt: true, isVip: true,
          kanbanCards: {
            select: {
              id: true, name: true, priority: true, score: true,
              value: true, expectedCloseAt: true,
              column: { select: { id: true, name: true, board: { select: { id: true, name: true } } } },
            },
          },
        },
        orderBy: { lastContactAt: "desc" },
      },
    },
  })

  if (!account) return res.status(404).json({ error: "Empresa não encontrada" })

  // Aggregate conversations & support tickets from all contacts
  const contactIds = account.contacts.map((c) => c.id)

  const [recentConversations, supportTickets] = await Promise.all([
    contactIds.length === 0 ? [] : db.conversation.findMany({
      where: {
        customerId: { in: contactIds },
        lastMessageAt: { gte: new Date(Date.now() - 48 * 3_600_000) },
      },
      select: {
        id: true, channel: true, status: true, preview: true,
        lastMessageAt: true, createdAt: true,
        customer: { select: { id: true, name: true } },
      },
      orderBy: { lastMessageAt: "desc" },
      take: 20,
    }),
    db.supportTicket.findMany({
      where: {
        companyId: account.companyId,
        status: { notIn: ["Resolvido"] },
        customer: { in: account.contacts.map((c) => c.name) },
      },
      select: {
        id: true, code: true, title: true, status: true,
        priority: true, slaState: true, slaDueAt: true,
        customer: true, createdAt: true,
      },
      take: 20,
    }),
  ])

  // Aggregate kanban cards from all contacts
  const kanbanCards = account.contacts.flatMap((c) =>
    c.kanbanCards.map((card) => ({ ...card, contactName: c.name, contactId: c.id }))
  )

  return res.json({
    ...account,
    kanbanCards,
    recentConversations,
    supportTickets,
  })
})

// PATCH /business-accounts/:id
router.patch("/:id", async (req: Request, res: Response) => {
  const { id } = req.params
  const allowed = ["name","cnpj","website","phone","email","city","state",
                   "industry","size","status","value","ltv","notes"]

  const data: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in req.body) {
      const v = req.body[key]
      if (key === "value" || key === "ltv") {
        data[key] = v === "" || v == null ? null : Number(v)
      } else {
        data[key] = v === "" ? null : v
      }
    }
  }

  const account = await db.businessAccount.update({ where: { id }, data })
  return res.json(account)
})

// DELETE /business-accounts/:id (soft delete)
router.delete("/:id", async (req: Request, res: Response) => {
  const { id } = req.params
  await db.businessAccount.update({ where: { id }, data: { status: "Inativa" } })
  return res.json({ ok: true })
})

// POST /business-accounts/:id/contacts/:customerId — link contact
router.post("/:id/contacts/:customerId", async (req: Request, res: Response) => {
  const { id, customerId } = req.params
  await db.customer.update({
    where: { id: customerId },
    data: { businessAccountId: id },
  })
  return res.json({ ok: true })
})

// DELETE /business-accounts/:id/contacts/:customerId — unlink contact
router.delete("/:id/contacts/:customerId", async (req: Request, res: Response) => {
  const { customerId } = req.params
  await db.customer.update({
    where: { id: customerId },
    data: { businessAccountId: null },
  })
  return res.json({ ok: true })
})

export default router
