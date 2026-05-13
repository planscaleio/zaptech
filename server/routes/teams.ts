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
