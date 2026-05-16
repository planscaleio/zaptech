import { Router, Request, Response } from "express"
import { db } from "../db.js"

const router = Router()

// ─── Users available for team assignment ─────────────────────────────────────

// GET /teams/users?companyId=
router.get("/users", async (req: Request, res: Response) => {
  const { companyId } = req.query
  if (!companyId || typeof companyId !== "string")
    return res.status(400).json({ error: "companyId é obrigatório" })

  const users = await db.user.findMany({
    where: { companyId, status: "ATIVO", role: { in: ["ATENDENTE", "GESTOR", "ADMIN", "OWNER"] } },
    select: { id: true, name: true, email: true, role: true, avatarUrl: true },
    orderBy: { name: "asc" },
  })
  return res.json(users)
})

// GET /teams/my?companyId=&userId= — teams a specific user belongs to
router.get("/my", async (req: Request, res: Response) => {
  const { companyId, userId } = req.query
  if (!companyId || typeof companyId !== "string" || !userId || typeof userId !== "string")
    return res.status(400).json({ error: "companyId e userId são obrigatórios" })

  const memberships = await db.salesTeamMember.findMany({
    where: { userId, team: { companyId } },
    select: { team: { select: { id: true, name: true } } },
    orderBy: { team: { name: "asc" } },
  })
  return res.json(memberships.map((m) => m.team))
})

// ─── Connectors (WhatsApp instances) ─────────────────────────────────────────

// GET /teams/connectors?companyId=
router.get("/connectors", async (req: Request, res: Response) => {
  const { companyId } = req.query
  if (!companyId || typeof companyId !== "string")
    return res.status(400).json({ error: "companyId é obrigatório" })

  const connectors = await db.connector.findMany({
    where: { companyId },
    select: { id: true, name: true, type: true, status: true },
    orderBy: { name: "asc" },
  })
  return res.json(connectors)
})

// ─── Distribution rules ───────────────────────────────────────────────────────

// GET /teams/rules?companyId=
router.get("/rules", async (req: Request, res: Response) => {
  const { companyId } = req.query
  if (!companyId || typeof companyId !== "string")
    return res.status(400).json({ error: "companyId é obrigatório" })

  const rules = await db.distributionRule.findMany({
    where: { companyId },
    orderBy: { priority: "asc" },
    select: {
      id: true, name: true, priority: true, active: true,
      conditions: true, actionType: true, strategy: true, fallback: true,
      targetTeamId: true, targetUserId: true,
      targetTeam: { select: { id: true, name: true } },
      targetUser: { select: { id: true, name: true } },
      triggerCount: true, lastTriggeredAt: true,
      createdAt: true, updatedAt: true,
    },
  })
  return res.json(rules)
})

// POST /teams/rules
router.post("/rules", async (req: Request, res: Response) => {
  const { companyId, name, conditions, actionType, targetTeamId, targetUserId, strategy, fallback } = req.body ?? {}
  if (!companyId || !name || !actionType)
    return res.status(400).json({ error: "companyId, name e actionType são obrigatórios" })

  // Assign next priority (max + 1)
  const last = await db.distributionRule.findFirst({
    where: { companyId },
    orderBy: { priority: "desc" },
    select: { priority: true },
  })
  const priority = (last?.priority ?? -1) + 1

  const rule = await db.distributionRule.create({
    data: {
      companyId, name, priority,
      conditions: conditions ?? [],
      actionType,
      targetTeamId: targetTeamId ?? null,
      targetUserId: targetUserId ?? null,
      strategy: strategy ?? "ROUND_ROBIN",
      fallback: fallback ?? "QUEUE",
    },
    select: {
      id: true, name: true, priority: true, active: true,
      conditions: true, actionType: true, strategy: true, fallback: true,
      targetTeamId: true, targetUserId: true,
      targetTeam: { select: { id: true, name: true } },
      targetUser: { select: { id: true, name: true } },
    },
  })
  return res.json(rule)
})

// PUT /teams/rules/reorder  { ids: string[] }  — must be before /:id
router.put("/rules/reorder", async (req: Request, res: Response) => {
  const { ids } = req.body ?? {}
  if (!Array.isArray(ids)) return res.status(400).json({ error: "ids deve ser um array" })

  await Promise.all(
    ids.map((id: string, index: number) =>
      db.distributionRule.update({ where: { id }, data: { priority: index } }),
    ),
  )
  return res.json({ ok: true })
})

// PUT /teams/rules/:id
router.put("/rules/:id", async (req: Request, res: Response) => {
  const { name, conditions, actionType, targetTeamId, targetUserId, strategy, fallback } = req.body ?? {}
  const rule = await db.distributionRule.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(conditions !== undefined && { conditions }),
      ...(actionType !== undefined && { actionType }),
      ...(targetTeamId !== undefined && { targetTeamId }),
      ...(targetUserId !== undefined && { targetUserId }),
      ...(strategy !== undefined && { strategy }),
      ...(fallback !== undefined && { fallback }),
    },
    select: {
      id: true, name: true, priority: true, active: true,
      conditions: true, actionType: true, strategy: true, fallback: true,
      targetTeamId: true, targetUserId: true,
      targetTeam: { select: { id: true, name: true } },
      targetUser: { select: { id: true, name: true } },
    },
  })
  return res.json(rule)
})

// PATCH /teams/rules/:id/toggle
router.patch("/rules/:id/toggle", async (req: Request, res: Response) => {
  const existing = await db.distributionRule.findUnique({
    where: { id: req.params.id },
    select: { active: true },
  })
  if (!existing) return res.status(404).json({ error: "Regra não encontrada" })

  const rule = await db.distributionRule.update({
    where: { id: req.params.id },
    data: { active: !existing.active },
    select: { id: true, active: true },
  })
  return res.json(rule)
})

// DELETE /teams/rules/:id
router.delete("/rules/:id", async (req: Request, res: Response) => {
  await db.distributionRule.delete({ where: { id: req.params.id } })
  return res.json({ ok: true })
})

// ─── Goals report ─────────────────────────────────────────────────────────────

// GET /teams/goals-report?companyId=&month=&year=
router.get("/goals-report", async (req: Request, res: Response) => {
  const { companyId, month, year } = req.query
  if (!companyId || typeof companyId !== "string")
    return res.status(400).json({ error: "companyId é obrigatório" })

  const now = new Date()
  const m = month ? Number(month) : now.getMonth() + 1
  const y = year ? Number(year) : now.getFullYear()
  const start = new Date(y, m - 1, 1)
  const end = new Date(y, m, 1)

  const teams = await db.salesTeam.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, targetValue: true,
      manager: { select: { id: true, name: true } },
      members: {
        select: {
          id: true, role: true, leadCount: true, userId: true,
          user: { select: { id: true, name: true, role: true, avatarUrl: true } },
        },
        orderBy: { leadCount: "desc" },
      },
    },
  })

  if (teams.length === 0) return res.json([])

  const teamIds = teams.map((t) => t.id)

  // Aggregate conversation metrics per team for the month
  const rows = await db.$queryRaw<
    { teamId: string; pipelineAtivo: number; receitaFechada: number; totalConversas: number; conversasFechadas: number }[]
  >`
    SELECT
      c."teamId" AS "teamId",
      COALESCE(SUM(CASE WHEN c.status NOT IN ('ENCERRADO','RESOLVIDO','ARQUIVADO','PARA_EXCLUIR') THEN c."leadValue" ELSE 0 END), 0) AS "pipelineAtivo",
      COALESCE(SUM(CASE WHEN c.status IN ('ENCERRADO','RESOLVIDO') THEN c."leadValue" ELSE 0 END), 0) AS "receitaFechada",
      COUNT(*) AS "totalConversas",
      COUNT(CASE WHEN c.status IN ('ENCERRADO','RESOLVIDO') THEN 1 END) AS "conversasFechadas"
    FROM "Conversation" c
    WHERE c."teamId" = ANY(${teamIds}::text[])
      AND c."createdAt" >= ${start}
      AND c."createdAt" < ${end}
    GROUP BY c."teamId"
  `

  const metricsMap = new Map(rows.map((r) => [r.teamId, r]))

  // Per-member closed conversation counts
  const memberIds = teams.flatMap((t) => t.members.map((m) => m.userId))
  const memberRows = memberIds.length > 0
    ? await db.$queryRaw<{ attendantId: string; closed: bigint }[]>`
        SELECT c."attendantId", COUNT(*) AS closed
        FROM "Conversation" c
        WHERE c."attendantId" = ANY(${memberIds}::text[])
          AND c."teamId" = ANY(${teamIds}::text[])
          AND c.status IN ('ENCERRADO','RESOLVIDO')
          AND c."createdAt" >= ${start}
          AND c."createdAt" < ${end}
        GROUP BY c."attendantId"
      `
    : []
  const memberClosedMap = new Map(memberRows.map((r) => [r.attendantId, Number(r.closed)]))

  // Build response and update denormalized fields
  const result = teams.map((team) => {
    const m = metricsMap.get(team.id)
    const pipelineAtivo = Number(m?.pipelineAtivo ?? 0)
    const receitaFechada = Number(m?.receitaFechada ?? 0)
    const totalConversas = Number(m?.totalConversas ?? 0)
    const conversasFechadas = Number(m?.conversasFechadas ?? 0)
    const taxaConversao = totalConversas > 0 ? (conversasFechadas / totalConversas) * 100 : 0
    const target = Number(team.targetValue ?? 0)
    const percentMeta = target > 0 ? ((pipelineAtivo + receitaFechada) / target) * 100 : 0

    return {
      id: team.id,
      name: team.name,
      targetValue: team.targetValue,
      manager: team.manager,
      pipelineAtivo,
      receitaFechada,
      totalConversas,
      conversasFechadas,
      taxaConversao,
      percentMeta,
      members: team.members.map((mb) => ({
        ...mb,
        closedCount: memberClosedMap.get(mb.userId) ?? 0,
      })),
    }
  })

  // Update denormalized fields in background
  for (const team of result) {
    db.salesTeam.update({
      where: { id: team.id },
      data: {
        pipelineValue: team.pipelineAtivo + team.receitaFechada,
        conversionRate: team.taxaConversao,
      },
    }).catch(() => {})
  }

  return res.json(result)
})

// ─── Teams CRUD ───────────────────────────────────────────────────────────────

// GET /teams?companyId=
router.get("/", async (req: Request, res: Response) => {
  const { companyId } = req.query
  if (!companyId || typeof companyId !== "string")
    return res.status(400).json({ error: "companyId é obrigatório" })

  const teams = await db.salesTeam.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, targetValue: true, pipelineValue: true, conversionRate: true,
      manager: { select: { id: true, name: true } },
      channels: { select: { channel: true } },
      members: {
        select: {
          id: true, role: true, leadCount: true, revenueValue: true,
          user: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } },
        },
        orderBy: { leadCount: "desc" },
      },
    },
  })
  return res.json(teams)
})

// POST /teams
router.post("/", async (req: Request, res: Response) => {
  const { companyId, name, managerId, targetValue, channels } = req.body ?? {}
  if (!companyId || !name)
    return res.status(400).json({ error: "companyId e name são obrigatórios" })

  const team = await db.salesTeam.create({
    data: {
      companyId, name,
      managerId: managerId ?? null,
      targetValue: targetValue ? Number(targetValue) : null,
      channels: channels?.length
        ? { create: channels.map((c: string) => ({ channel: c })) }
        : undefined,
    },
    select: {
      id: true, name: true, targetValue: true, managerId: true,
      manager: { select: { id: true, name: true } },
      channels: { select: { channel: true } },
      members: { select: { id: true } },
    },
  })
  return res.json(team)
})

// PUT /teams/:id
router.put("/:id", async (req: Request, res: Response) => {
  const { name, managerId, targetValue, channels } = req.body ?? {}

  // Replace channels if provided
  if (channels !== undefined) {
    await db.salesTeamChannel.deleteMany({ where: { teamId: req.params.id } })
  }

  const team = await db.salesTeam.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(managerId !== undefined && { managerId }),
      ...(targetValue !== undefined && { targetValue: targetValue ? Number(targetValue) : null }),
      ...(channels !== undefined && {
        channels: { create: channels.map((c: string) => ({ channel: c })) },
      }),
    },
    select: {
      id: true, name: true, targetValue: true,
      manager: { select: { id: true, name: true } },
      channels: { select: { channel: true } },
    },
  })
  return res.json(team)
})

// DELETE /teams/:id
router.delete("/:id", async (req: Request, res: Response) => {
  await db.salesTeam.delete({ where: { id: req.params.id } })
  return res.json({ ok: true })
})

// ─── Team members ─────────────────────────────────────────────────────────────

// POST /teams/:id/members  { userId, role? }
router.post("/:id/members", async (req: Request, res: Response) => {
  const { userId, role } = req.body ?? {}
  if (!userId) return res.status(400).json({ error: "userId é obrigatório" })

  const member = await db.salesTeamMember.upsert({
    where: { teamId_userId: { teamId: req.params.id, userId } },
    create: { teamId: req.params.id, userId, role: role ?? null },
    update: { role: role ?? undefined },
    select: {
      id: true, role: true, leadCount: true, revenueValue: true,
      user: { select: { id: true, name: true, email: true, role: true } },
    },
  })
  return res.json(member)
})

// DELETE /teams/:id/members/:userId
router.delete("/:id/members/:userId", async (req: Request, res: Response) => {
  await db.salesTeamMember.deleteMany({
    where: { teamId: req.params.id, userId: req.params.userId },
  })
  return res.json({ ok: true })
})

export default router
