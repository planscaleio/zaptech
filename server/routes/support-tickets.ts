import { Router, Request, Response } from "express"
import { db } from "../db.js"

const router = Router()

function computeSlaState(slaDueAt: Date): string {
  const diff = slaDueAt.getTime() - Date.now()
  if (diff < 0) return "Vencido"
  if (diff < 2 * 3_600_000) return "Em risco"
  return "No prazo"
}

function serializeTicket(ticket: any) {
  return {
    ...ticket,
    slaDueAt: ticket.slaDueAt.toISOString(),
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    slaState: computeSlaState(ticket.slaDueAt),
    activity: ticket.activity.map((a: any) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
  }
}

router.get("/", async (req: Request, res: Response) => {
  const { companyId, status, priority, team, q } = req.query
  if (!companyId || typeof companyId !== "string") {
    return res.status(400).json({ error: "companyId é obrigatório" })
  }

  const where: Record<string, unknown> = { companyId }
  if (status && typeof status === "string" && status !== "Todos") where.status = status
  if (priority && typeof priority === "string") where.priority = priority
  if (team && typeof team === "string") where.team = team
  if (q && typeof q === "string" && q.trim()) {
    const term = q.trim()
    where.OR = [
      { title: { contains: term, mode: "insensitive" } },
      { customer: { contains: term, mode: "insensitive" } },
      { contact: { contains: term, mode: "insensitive" } },
      { code: { contains: term, mode: "insensitive" } },
      { team: { contains: term, mode: "insensitive" } },
      { assignee: { contains: term, mode: "insensitive" } },
      { summary: { contains: term, mode: "insensitive" } },
    ]
  }

  const tickets = await db.supportTicket.findMany({
    where: where as any,
    orderBy: [{ createdAt: "desc" }],
    include: { activity: { orderBy: { createdAt: "asc" } } },
  })

  return res.json(tickets.map(serializeTicket))
})

router.post("/", async (req: Request, res: Response) => {
  const { companyId, title, customer, contact, channel, category, priority, team, assignee, slaDueAt, summary, conversationId } = req.body ?? {}
  if (!companyId || !title?.trim() || !customer?.trim()) {
    return res.status(400).json({ error: "companyId, title e customer são obrigatórios" })
  }

  const last = await db.supportTicket.findFirst({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    select: { code: true },
  })
  const lastNum = last ? Number(last.code.replace("SUP-", "")) : 1000
  const code = `SUP-${lastNum + 1}`

  const due = slaDueAt ? new Date(slaDueAt) : new Date(Date.now() + 24 * 3_600_000)

  const ticket = await db.supportTicket.create({
    data: {
      companyId,
      code,
      title: title.trim(),
      customer: customer.trim(),
      contact: contact?.trim() ?? "",
      channel: channel ?? "WhatsApp",
      conversationId: conversationId ?? null,
      category: category ?? "Técnico",
      priority: priority ?? "Média",
      status: "Novo",
      team: team ?? "Suporte N1",
      assignee: assignee?.trim() || null,
      slaState: computeSlaState(due),
      slaDueAt: due,
      summary: summary?.trim() || null,
      tags: [],
    },
    include: { activity: true },
  })

  return res.status(201).json(serializeTicket(ticket))
})

router.patch("/:id", async (req: Request, res: Response) => {
  const id = String(req.params.id)
  const existing = await db.supportTicket.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return res.status(404).json({ error: "Ticket não encontrado" })

  const data: Record<string, unknown> = {}
  const { status, priority, team, assignee, category, summary, slaDueAt } = req.body ?? {}
  if (status !== undefined) data.status = status
  if (priority !== undefined) data.priority = priority
  if (team !== undefined) data.team = team
  if (assignee !== undefined) data.assignee = assignee?.trim() || null
  if (category !== undefined) data.category = category
  if (summary !== undefined) data.summary = summary?.trim() || null
  if (slaDueAt !== undefined) {
    const due = new Date(slaDueAt)
    data.slaDueAt = due
    data.slaState = computeSlaState(due)
  }

  if (Object.keys(data).length === 0) return res.status(400).json({ error: "Nenhum campo para atualizar" })

  const ticket = await db.supportTicket.update({
    where: { id },
    data,
    include: { activity: { orderBy: { createdAt: "asc" } } },
  })
  return res.json(serializeTicket(ticket))
})

router.post("/:id/activity", async (req: Request, res: Response) => {
  const id = String(req.params.id)
  const { authorName, text } = req.body ?? {}
  if (!authorName?.trim() || !text?.trim()) {
    return res.status(400).json({ error: "authorName e text são obrigatórios" })
  }

  const existing = await db.supportTicket.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return res.status(404).json({ error: "Ticket não encontrado" })

  await db.supportTicketActivity.create({
    data: { ticketId: id, authorName: authorName.trim(), text: text.trim() },
  })

  await db.supportTicket.update({ where: { id }, data: { updatedAt: new Date() } })

  const ticket = await db.supportTicket.findUnique({
    where: { id },
    include: { activity: { orderBy: { createdAt: "asc" } } },
  })
  return res.json(serializeTicket(ticket))
})

export default router
