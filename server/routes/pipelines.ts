import { Router, Request, Response } from "express"
import { db } from "../db.js"

const router = Router()

const CARD_SELECT = {
  id: true,
  name: true,
  description: true,
  initials: true,
  priority: true,
  dots: true,
  score: true,
  scoreBreakdown: true,
  value: true,
  expectedCloseAt: true,
  contactName: true,
  contactEmail: true,
  contactPhone: true,
  assignedUserId: true,
  closeType: true,
  closeReason: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { id: true, name: true, phone: true, email: true, stage: true, aiScore: true, isVip: true } },
  assignedUser: { select: { id: true, name: true, avatarUrl: true } },
}

const ACTIVITY_SELECT = {
  id: true,
  type: true,
  title: true,
  content: true,
  doneAt: true,
  authorName: true,
  createdAt: true,
}

// GET /pipelines?companyId=
router.get("/", async (req: Request, res: Response) => {
  const { companyId } = req.query
  if (!companyId || typeof companyId !== "string") {
    return res.status(400).json({ error: "companyId é obrigatório" })
  }
  const boards = await db.kanbanBoard.findMany({
    where: { companyId },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true, name: true, sortOrder: true,
      columns: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, sortOrder: true, color: true, probability: true, slaHours: true },
      },
    },
  })
  return res.json(boards)
})

// POST /pipelines/ai-suggest  — gera sugestão de pipeline via IA
router.post("/ai-suggest", async (req: Request, res: Response) => {
  const { description } = req.body ?? {}
  if (!description?.trim()) {
    return res.status(400).json({ error: "description é obrigatório" })
  }

  const OLLAMA_BASE  = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"
  const OLLAMA_MODEL = process.env.OLLAMA_MODEL    ?? "gemma4:latest"

  const prompt = `Você é um especialista em CRM e processos comerciais. Com base na descrição abaixo, crie um pipeline de vendas ideal com etapas bem definidas.

Descrição do pipeline: "${description.trim()}"

Retorne APENAS um JSON válido (sem markdown, sem texto extra) neste formato exato:
{
  "name": "Nome do pipeline",
  "rationale": "Explicação curta de 1-2 frases sobre a estrutura proposta",
  "columns": [
    {
      "name": "Nome da etapa",
      "color": "#hexcolor",
      "description": "O que acontece nesta etapa",
      "sla_days": número_de_dias_ou_null,
      "sla_label": "Ex: 2 dias" ou null
    }
  ]
}

Regras:
- Entre 4 e 7 etapas
- Cores hexadecimais variadas e representativas (use: #6366f1 roxo, #8b5cf6 violeta, #ec4899 rosa, #f43f5e vermelho, #f97316 laranja, #eab308 amarelo, #22c55e verde, #14b8a6 teal, #06b6d4 ciano, #3b82f6 azul)
- SLA em dias quando fizer sentido (null se não se aplica)
- Etapas em português brasileiro
- Nomes de etapas curtos (máx 20 caracteres)`

  try {
    const ollamaRes = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
    })
    if (!ollamaRes.ok) throw new Error("Ollama indisponível")
    const ollamaData = await ollamaRes.json() as { response: string }

    // Extract JSON from response (may have surrounding text)
    const raw = ollamaData.response.trim()
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("Resposta inválida da IA")
    const parsed = JSON.parse(jsonMatch[0])
    return res.json(parsed)
  } catch (err) {
    return res.status(502).json({ error: "Não foi possível gerar sugestão. Verifique se o Ollama está ativo." })
  }
})

// POST /pipelines/boards  — cria novo board com colunas
router.post("/boards", async (req: Request, res: Response) => {
  const { companyId, name, columns } = req.body ?? {}
  if (!companyId || !name?.trim()) {
    return res.status(400).json({ error: "companyId e name são obrigatórios" })
  }
  const lastBoard = await db.kanbanBoard.findFirst({
    where: { companyId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true },
  })
  const board = await db.kanbanBoard.create({
    data: {
      companyId,
      name: name.trim(),
      sortOrder: (lastBoard?.sortOrder ?? 0) + 1,
      columns: {
        create: (Array.isArray(columns) ? columns : []).map(
          (c: { name: string; color: string; sortOrder: number; probability?: number; slaHours?: number }, i: number) => ({
            name: c.name,
            color: c.color ?? "#6366f1",
            sortOrder: c.sortOrder ?? i,
            probability: c.probability ?? null,
            slaHours: c.slaHours ?? null,
          })
        ),
      },
    },
    select: {
      id: true, name: true, sortOrder: true,
      columns: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, sortOrder: true, color: true, probability: true, slaHours: true },
      },
    },
  })
  return res.status(201).json(board)
})

// DELETE /pipelines/boards/:boardId
router.delete("/boards/:boardId", async (req: Request, res: Response) => {
  await db.kanbanBoard.delete({ where: { id: req.params.boardId } })
  return res.json({ ok: true })
})

// PATCH /pipelines/boards/:boardId  — renomeia board
router.patch("/boards/:boardId", async (req: Request, res: Response) => {
  const { name } = req.body ?? {}
  if (!name?.trim()) return res.status(400).json({ error: "name é obrigatório" })
  const board = await db.kanbanBoard.update({
    where: { id: req.params.boardId },
    data: { name: name.trim() },
    select: { id: true, name: true },
  })
  return res.json(board)
})

// GET /pipelines/:boardId?companyId=
router.get("/:boardId", async (req: Request, res: Response) => {
  const { companyId } = req.query
  const { boardId } = req.params
  if (!companyId || typeof companyId !== "string") {
    return res.status(400).json({ error: "companyId é obrigatório" })
  }
  const board = await db.kanbanBoard.findFirst({
    where: { id: boardId, companyId },
    select: {
      id: true, name: true,
      columns: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true, name: true, color: true, sortOrder: true, probability: true, slaHours: true,
          cards: { orderBy: { createdAt: "asc" }, select: CARD_SELECT },
        },
      },
    },
  })
  if (!board) return res.status(404).json({ error: "Board não encontrado" })
  return res.json(board)
})

// GET /pipelines/cards/:cardId  — card completo com atividades
router.get("/cards/:cardId", async (req: Request, res: Response) => {
  const card = await db.kanbanCard.findUnique({
    where: { id: req.params.cardId },
    select: {
      ...CARD_SELECT,
      activities: { orderBy: { createdAt: "desc" }, select: ACTIVITY_SELECT },
    },
  })
  if (!card) return res.status(404).json({ error: "Card não encontrado" })
  return res.json(card)
})

// POST /pipelines/opportunity
router.post("/opportunity", async (req: Request, res: Response) => {
  const { companyId, customerId, conversationId, pipelineId, columnId, name, description } = req.body ?? {}
  if (!companyId || !customerId || !pipelineId) {
    return res.status(400).json({ error: "companyId, customerId e pipelineId são obrigatórios" })
  }
  let targetColumnId = columnId
  if (!targetColumnId) {
    const firstColumn = await db.kanbanColumn.findFirst({
      where: { boardId: pipelineId }, orderBy: { sortOrder: "asc" }, select: { id: true },
    })
    if (!firstColumn) return res.status(404).json({ error: "Pipeline sem colunas" })
    targetColumnId = firstColumn.id
  }
  const column = await db.kanbanColumn.findFirst({
    where: { id: targetColumnId, boardId: pipelineId, board: { companyId } },
    select: { id: true, name: true },
  })
  if (!column) return res.status(404).json({ error: "Coluna não encontrada" })
  const customer = await db.customer.findUnique({ where: { id: customerId }, select: { id: true, name: true } })
  if (!customer) return res.status(404).json({ error: "Cliente não encontrado" })
  const cardName = name?.trim() || customer.name
  const card = await db.kanbanCard.create({
    data: {
      columnId: targetColumnId,
      customerId,
      name: cardName,
      description: description?.trim() || (conversationId ? `Originado da conversa #${conversationId.slice(-6)}` : null),
      initials: cardName.split(" ").filter(Boolean).slice(0, 2).map((w: string) => w[0].toUpperCase()).join(""),
      priority: "MEDIA",
    },
    select: {
      ...CARD_SELECT,
      column: { select: { id: true, name: true, board: { select: { id: true, name: true } } } },
    },
  })
  return res.status(201).json(card)
})

// PATCH /pipelines/columns/:columnId  — atualiza propriedades da coluna (probability, slaHours, name, color)
router.patch("/columns/:columnId", async (req: Request, res: Response) => {
  const { columnId } = req.params
  const { name, color, probability, slaHours } = req.body ?? {}
  const data: Record<string, unknown> = {}
  if (name != null)        data.name = name
  if (color != null)       data.color = color
  if (probability != null) data.probability = probability === "" ? null : Number(probability)
  if (slaHours != null)    data.slaHours = slaHours === "" ? null : Number(slaHours)

  const col = await db.kanbanColumn.update({
    where: { id: columnId },
    data,
    select: { id: true, name: true, color: true, sortOrder: true, probability: true, slaHours: true },
  })
  return res.json(col)
})

// PATCH /pipelines/cards/:cardId
router.patch("/cards/:cardId", async (req: Request, res: Response) => {
  const { cardId } = req.params
  const {
    columnId, name, description, priority, score, value, expectedCloseAt,
    contactName, contactEmail, contactPhone,
    assignedUserId, closeType, closeReason,
  } = req.body ?? {}
  const data: Record<string, unknown> = {}
  if (columnId)               data.columnId = columnId
  if (name != null)           data.name = name
  if (description != null)    data.description = description
  if (priority != null)       data.priority = priority
  if (score != null)          data.score = score
  if (value != null)          data.value = value === "" ? null : value
  if (expectedCloseAt != null) data.expectedCloseAt = expectedCloseAt === "" ? null : new Date(expectedCloseAt)
  if (contactName != null)    data.contactName = contactName
  if (contactEmail != null)   data.contactEmail = contactEmail
  if (contactPhone != null)   data.contactPhone = contactPhone
  if (assignedUserId != null) data.assignedUserId = assignedUserId === "" ? null : assignedUserId
  if (closeType != null)      data.closeType = closeType === "" ? null : closeType
  if (closeReason != null)    data.closeReason = closeReason === "" ? null : closeReason

  const card = await db.kanbanCard.update({ where: { id: cardId }, data, select: CARD_SELECT })
  return res.json(card)
})

// DELETE /pipelines/cards/:cardId
router.delete("/cards/:cardId", async (req: Request, res: Response) => {
  await db.kanbanCard.delete({ where: { id: req.params.cardId } })
  return res.json({ ok: true })
})

// POST /pipelines/cards/:cardId/activities
router.post("/cards/:cardId/activities", async (req: Request, res: Response) => {
  const { cardId } = req.params
  const { type, title, content, authorName, doneAt } = req.body ?? {}
  if (!content?.trim()) return res.status(400).json({ error: "content é obrigatório" })
  const activity = await db.kanbanActivity.create({
    data: {
      cardId,
      type: type ?? "NOTA",
      title: title?.trim() || null,
      content: content.trim(),
      authorName: authorName?.trim() || "Vendedor",
      doneAt: doneAt ? new Date(doneAt) : null,
    },
    select: ACTIVITY_SELECT,
  })
  return res.status(201).json(activity)
})

// DELETE /pipelines/activities/:activityId
router.delete("/activities/:activityId", async (req: Request, res: Response) => {
  await db.kanbanActivity.delete({ where: { id: req.params.activityId } })
  return res.json({ ok: true })
})

// POST /pipelines/cards/:cardId/compute-score
// Multi-factor lead scoring model (0–100)
router.post("/cards/:cardId/compute-score", async (req: Request, res: Response) => {
  const { cardId } = req.params

  const card = await db.kanbanCard.findUnique({
    where: { id: cardId },
    include: {
      activities: { orderBy: { createdAt: "desc" } },
      column: {
        include: {
          board: { include: { columns: { orderBy: { sortOrder: "asc" } } } },
        },
      },
      customer: {
        include: {
          conversations: {
            orderBy: { lastMessageAt: "desc" },
            take: 5,
            include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
          },
        },
      },
    },
  })

  if (!card) return res.status(404).json({ error: "Card não encontrado" })

  // ── Factor 1: Pipeline stage position (0–25 pts)
  const allColumns = card.column.board.columns
  const stageIndex = allColumns.findIndex((c) => c.id === card.column.id)
  const stageTotal = allColumns.length
  const stagePts = stageTotal > 1 ? Math.round((stageIndex / (stageTotal - 1)) * 25) : 0

  // ── Factor 2: Deal value (0–20 pts)
  let valuePts = 0
  if (card.value) {
    const v = Number(card.value)
    if (v >= 50000)      valuePts = 20
    else if (v >= 20000) valuePts = 16
    else if (v >= 10000) valuePts = 12
    else if (v >= 5000)  valuePts = 8
    else if (v >= 1000)  valuePts = 4
    else                 valuePts = 2
  }

  // ── Factor 3: Activity engagement (0–20 pts)
  const actCount = card.activities.length
  const actPts = Math.min(20, actCount * 3)

  // ── Factor 4: Activity recency (0–15 pts)
  let recencyPts = 0
  if (card.activities.length > 0) {
    const lastAct = new Date(card.activities[0].createdAt)
    const daysSince = (Date.now() - lastAct.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSince <= 1)       recencyPts = 15
    else if (daysSince <= 3)  recencyPts = 12
    else if (daysSince <= 7)  recencyPts = 8
    else if (daysSince <= 14) recencyPts = 4
    else                      recencyPts = 1
  } else {
    const daysSinceCreated = (Date.now() - new Date(card.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    recencyPts = daysSinceCreated <= 2 ? 8 : daysSinceCreated <= 7 ? 4 : 0
  }

  // ── Factor 5: Profile completeness (0–10 pts)
  let profilePts = 0
  if (card.value)        profilePts += 2
  if (card.expectedCloseAt) profilePts += 2
  if (card.contactName)  profilePts += 2
  if (card.contactEmail) profilePts += 2
  if (card.contactPhone) profilePts += 2

  // ── Factor 6: Priority weight (0–5 pts)
  const priorityPts = card.priority === "ALTA" ? 5 : card.priority === "MEDIA" ? 3 : 1

  // ── Factor 7: Customer AI score (0–5 pts)
  let customerAiPts = 0
  if (card.customer?.aiScore) {
    customerAiPts = Math.round((card.customer.aiScore / 100) * 5)
  }

  const total = Math.min(100, stagePts + valuePts + actPts + recencyPts + profilePts + priorityPts + customerAiPts)

  const breakdown = {
    stagePts,
    valuePts,
    actPts,
    recencyPts,
    profilePts,
    priorityPts,
    customerAiPts,
    total,
    computed: new Date().toISOString(),
  }

  const updated = await db.kanbanCard.update({
    where: { id: cardId },
    data: { score: total, scoreBreakdown: breakdown },
    select: CARD_SELECT,
  })

  return res.json({ ...updated, breakdown })
})

export default router
