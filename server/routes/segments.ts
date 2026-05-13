import { Router, Request, Response } from "express"
import { Prisma } from "@prisma/client"
import { db } from "../db.js"

const router = Router()

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SegmentFilter {
  field: string
  operator: string
  value: string | number
}

// ─── Build Prisma WHERE from filters ─────────────────────────────────────────

export function buildWhere(companyId: string, filters: SegmentFilter[]): Prisma.CustomerWhereInput {
  const AND: Prisma.CustomerWhereInput[] = [{ companyId }]

  for (const f of filters) {
    const { field, operator, value } = f

    switch (field) {
      case "status":
        AND.push({ status: { equals: value as string } } as Prisma.CustomerWhereInput)
        break
      case "stage":
        AND.push({ stage: { equals: value as string } } as Prisma.CustomerWhereInput)
        break
      case "source":
        AND.push({ source: { equals: value as string } } as Prisma.CustomerWhereInput)
        break
      case "aiSentiment":
        AND.push({ aiSentiment: { equals: value as string } } as Prisma.CustomerWhereInput)
        break
      case "aiRisk":
        AND.push({ aiRisk: { equals: value as string } } as Prisma.CustomerWhereInput)
        break
      case "aiScore": {
        const n = Number(value)
        if (operator === "gte") AND.push({ aiScore: { gte: n } })
        else if (operator === "lte") AND.push({ aiScore: { lte: n } })
        else if (operator === "eq") AND.push({ aiScore: { equals: n } })
        break
      }
      case "value": {
        const n = Number(value)
        if (operator === "gte") AND.push({ value: { gte: n } })
        else if (operator === "lte") AND.push({ value: { lte: n } })
        break
      }
      case "lastContactAt": {
        const days = Number(value)
        const since = new Date(Date.now() - days * 86400000)
        if (operator === "last_days") AND.push({ lastContactAt: { gte: since } })
        else if (operator === "older_days") AND.push({ lastContactAt: { lt: since } })
        break
      }
      case "createdAt": {
        const days = Number(value)
        const since = new Date(Date.now() - days * 86400000)
        if (operator === "last_days") AND.push({ createdAt: { gte: since } })
        break
      }
      case "hasEmail":
        if (value === "true") AND.push({ email: { not: null } })
        else AND.push({ email: null })
        break
      case "hasPhone":
        if (value === "true") AND.push({ phone: { not: null } })
        else AND.push({ phone: null })
        break
      case "isVip":
        AND.push({ isVip: value === "true" })
        break
      case "isArchived":
        if (value === "true") {
          AND.push({ status: { in: ["INATIVO", "PERDIDO"] as any } })
        } else {
          AND.push({ status: { notIn: ["INATIVO", "PERDIDO"] as any } })
        }
        break
      case "cardScore": {
        const n = Number(value)
        if (operator === "gte") AND.push({ kanbanCards: { some: { score: { gte: n } } } })
        else if (operator === "lte") AND.push({ kanbanCards: { some: { score: { lte: n } } } })
        break
      }
      case "cardValue": {
        const n = Number(value)
        if (operator === "gte") AND.push({ kanbanCards: { some: { value: { gte: n } } } })
        else if (operator === "lte") AND.push({ kanbanCards: { some: { value: { lte: n } } } })
        break
      }
    }
  }

  return { AND }
}

// ─── Sync segment members ─────────────────────────────────────────────────────

async function syncSegmentMembers(segmentId: string, companyId: string, filters: SegmentFilter[]) {
  const where = buildWhere(companyId, filters)
  const matched = await db.customer.findMany({ where, select: { id: true } })
  const matchedIds = matched.map((c) => c.id)

  // Replace all members
  await db.$transaction([
    db.segmentCustomer.deleteMany({ where: { segmentId } }),
    db.segmentCustomer.createMany({
      data: matchedIds.map((customerId) => ({ segmentId, customerId })),
      skipDuplicates: true,
    }),
  ])

  return matchedIds.length
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEGMENT_SELECT = {
  id: true,
  name: true,
  criteria: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { customers: true } },
}

function parseCriteria(raw: string | null): SegmentFilter[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /segments?companyId=
router.get("/", async (req: Request, res: Response) => {
  const { companyId } = req.query
  if (!companyId || typeof companyId !== "string") {
    return res.status(400).json({ error: "companyId é obrigatório" })
  }
  const segments = await db.segment.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
    select: SEGMENT_SELECT,
  })
  return res.json(segments.map(({ _count, criteria, ...s }) => ({
    ...s,
    criteria,
    filters: parseCriteria(criteria),
    customerCount: _count.customers,
  })))
})

// POST /segments
router.post("/", async (req: Request, res: Response) => {
  const { companyId, name, filters } = req.body ?? {}
  if (!companyId || !name?.trim()) {
    return res.status(400).json({ error: "companyId e name são obrigatórios" })
  }
  const existing = await db.segment.findUnique({
    where: { companyId_name: { companyId, name: name.trim() } },
  })
  if (existing) return res.status(409).json({ error: "Já existe um segmento com este nome" })

  const safeFilters: SegmentFilter[] = Array.isArray(filters) ? filters : []
  const criteriaJson = safeFilters.length > 0 ? JSON.stringify(safeFilters) : null

  const segment = await db.segment.create({
    data: { companyId, name: name.trim(), criteria: criteriaJson },
    select: SEGMENT_SELECT,
  })

  let customerCount = 0
  if (safeFilters.length > 0) {
    customerCount = await syncSegmentMembers(segment.id, companyId, safeFilters)
  }

  return res.status(201).json({ ...segment, filters: safeFilters, customerCount })
})

// PATCH /segments/:id  — update name / filters and re-sync
router.patch("/:id", async (req: Request, res: Response) => {
  const { name, filters, companyId } = req.body ?? {}
  const data: Record<string, unknown> = {}
  if (name?.trim()) data.name = name.trim()

  const safeFilters: SegmentFilter[] = Array.isArray(filters) ? filters : []
  data.criteria = safeFilters.length > 0 ? JSON.stringify(safeFilters) : null

  const segment = await db.segment.update({
    where: { id: req.params.id },
    data,
    select: SEGMENT_SELECT,
  })

  let customerCount = 0
  if (companyId && safeFilters.length > 0) {
    customerCount = await syncSegmentMembers(segment.id, companyId, safeFilters)
  } else if (safeFilters.length === 0) {
    await db.segmentCustomer.deleteMany({ where: { segmentId: segment.id } })
  } else {
    // companyId not provided — just get current count
    const cnt = await db.segmentCustomer.count({ where: { segmentId: segment.id } })
    customerCount = cnt
  }

  return res.json({ ...segment, filters: safeFilters, customerCount })
})

// DELETE /segments/:id
router.delete("/:id", async (req: Request, res: Response) => {
  await db.segment.delete({ where: { id: req.params.id } })
  return res.json({ ok: true })
})

// GET /segments/:id/customers
router.get("/:id/customers", async (req: Request, res: Response) => {
  const { id } = req.params
  const { search } = req.query

  const links = await db.segmentCustomer.findMany({
    where: {
      segmentId: id,
      ...(search && typeof search === "string" && search.trim()
        ? { customer: { name: { contains: search.trim(), mode: "insensitive" } } }
        : {}),
    },
    orderBy: { customer: { name: "asc" } },
    select: {
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          status: true,
          stage: true,
          aiScore: true,
          lastContactAt: true,
          value: true,
          segmentLinks: { select: { segment: { select: { id: true, name: true } } } },
        },
      },
    },
  })
  return res.json(links.map((l) => ({
    ...l.customer,
    segments: l.customer.segmentLinks.map((sl) => sl.segment),
  })))
})

// POST /segments/:id/preview  — preview without saving
router.post("/:id/preview", async (req: Request, res: Response) => {
  const { companyId, filters } = req.body ?? {}
  if (!companyId || !Array.isArray(filters)) {
    return res.status(400).json({ error: "companyId e filters são obrigatórios" })
  }
  const where = buildWhere(companyId, filters as SegmentFilter[])
  const [count, sample] = await Promise.all([
    db.customer.count({ where }),
    db.customer.findMany({
      where,
      take: 5,
      orderBy: { lastContactAt: "desc" },
      select: { id: true, name: true, status: true, aiScore: true, phone: true },
    }),
  ])
  return res.json({ count, sample })
})

export default router
