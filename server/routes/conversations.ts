import { Router, Request, Response } from "express"
import { db } from "../db.js"
import { resolveAttendant, assignConversation } from "../lib/distributionEngine.js"

const router = Router()

const EVOLUTION_BASE = process.env.EVOLUTION_BASE_URL!
const EVOLUTION_KEY  = process.env.EVOLUTION_API_KEY!
const EVOLUTION_INST = process.env.EVOLUTION_INSTANCE_NAME!

// GET /conversations/unread-count?companyId=  — must be before /:id routes
router.get("/unread-count", async (req: Request, res: Response) => {
  const { companyId } = req.query
  if (!companyId || typeof companyId !== "string")
    return res.status(400).json({ error: "companyId é obrigatório" })

  const result = await db.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::int AS count
    FROM "Conversation" c
    WHERE c."companyId" = ${companyId}
      AND c.status NOT IN ('ARQUIVADO', 'PARA_EXCLUIR', 'ENCERRADO', 'RESOLVIDO')
      AND EXISTS (
        SELECT 1 FROM "Message" m
        WHERE m."conversationId" = c.id
          AND m.role = 'CLIENTE'
          AND m."createdAt" > COALESCE(c."lastReadAt", '1970-01-01'::timestamptz)
      )
  `
  return res.json({ count: Number(result[0]?.count ?? 0) })
})

// GET /conversations?companyId=
router.get("/", async (req: Request, res: Response) => {
  const { companyId, channel } = req.query
  if (!companyId || typeof companyId !== "string") {
    return res.status(400).json({ error: "companyId é obrigatório" })
  }
  const allowedChannels = ["WHATSAPP", "INSTAGRAM", "SITE", "EMAIL", "TELEFONE", "WEBHOOK"] as const
  type ChannelParam = typeof allowedChannels[number]
  if (channel && (typeof channel !== "string" || !(allowedChannels as readonly string[]).includes(channel))) {
    return res.status(400).json({ error: "channel inválido" })
  }
  const requestedChannel = channel ? channel as ChannelParam : null

  const conversations = await db.conversation.findMany({
    where: { companyId, ...(requestedChannel ? { channel: requestedChannel } : {}) },
    orderBy: { lastMessageAt: "desc" },
    take: 50,
    select: {
      id: true,
      preview: true,
      status: true,
      channel: true,
      lastMessageAt: true,
      createdAt: true,
      leadValue: true,
      aiReason: true,
      nextAction: true,
      tone: true,
      customer: {
        select: { id: true, name: true, phone: true, email: true, status: true, aiScore: true, isVip: true },
      },
      tags: {
        select: { tag: { select: { id: true, name: true, color: true } } },
      },
    },
  })

  return res.json(conversations.map((c) => ({
    ...c,
    tags: c.tags.map((t) => t.tag),
  })))
})

// GET /conversations/:id/messages
router.get("/:id/messages", async (req: Request, res: Response) => {
  const { id } = req.params

  const conversation = await db.conversation.findUnique({
    where: { id },
    select: {
      id: true,
      preview: true,
      status: true,
      channel: true,
      lastMessageAt: true,
      leadValue: true,
      aiReason: true,
      nextAction: true,
      tone: true,
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          status: true,
          stage: true,
          source: true,
          value: true,
          aiScore: true,
          isVip: true,
          aiSentiment: true,
          aiRisk: true,
          aiNextBestAction: true,
          aiFindings: { select: { id: true, text: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          authorName: true,
          role: true,
          text: true,
          align: true,
          isAiGenerated: true,
          createdAt: true,
        },
      },
      tags: {
        select: { tag: { select: { id: true, name: true, color: true } } },
      },
    },
  })

  if (!conversation) return res.status(404).json({ error: "Conversa não encontrada" })

  return res.json({
    ...conversation,
    tags: conversation.tags.map((t) => t.tag),
  })
})

// POST /conversations/:id/reply — envia mensagem via Evolution API e persiste no banco
router.post("/:id/reply", async (req: Request, res: Response) => {
  const { id } = req.params
  const { text, clientRequestId, userId, authorName } = req.body ?? {}

  if (!text?.trim()) {
    return res.status(400).json({ error: "text é obrigatório" })
  }

  const conversation = await db.conversation.findUnique({
    where: { id },
    select: {
      id: true,
      companyId: true,
      channel: true,
      customer: { select: { phone: true, email: true } },
    },
  })

  if (!conversation) return res.status(404).json({ error: "Conversa não encontrada" })

  if (conversation.channel === "EMAIL") {
    const now = new Date()
    const message = await db.message.create({
      data: {
        conversationId: id,
        authorName: authorName?.trim() || "Atendente",
        role: "ATENDENTE",
        text: text.trim(),
        align: "right",
      },
      select: {
        id: true,
        authorName: true,
        role: true,
        text: true,
        align: true,
        isAiGenerated: true,
        createdAt: true,
      },
    })
    await db.conversation.update({
      where: { id },
      data: {
        preview: text.trim().slice(0, 240),
        lastMessageAt: now,
        status: "AGUARDANDO",
      },
    })
    return res.status(201).json({ local: true, message })
  }

  if (!conversation.customer?.phone) return res.status(422).json({ error: "Cliente sem telefone cadastrado" })

  // Resolve instanceId pelo conector ativo da empresa
  const connector = await db.connector.findFirst({
    where: { companyId: conversation.companyId, type: "CANAL", status: "CONECTADO" },
    select: { name: true },
  })
  const instanceId = connector?.name ?? process.env.EVOLUTION_INSTANCE_NAME ?? "default"

  // Enfileira — o outbound-sender.worker fará o envio com retry
  const outbound = await db.outboundMessage.upsert({
    where:  { clientRequestId: clientRequestId ?? `__noidm_${Date.now()}_${Math.random()}` },
    update: {},
    create: {
      companyId:       conversation.companyId,
      conversationId:  id,
      instanceId,
      recipientPhone:  conversation.customer.phone,
      body:            text.trim(),
      status:          "QUEUED",
      createdByUserId: userId ?? null,
      clientRequestId: clientRequestId ?? null,
    },
  })

  return res.status(202).json({ queued: true, outboundMessageId: outbound.id })
})

// PATCH /conversations/:id/read — marca conversa como lida (atualiza lastReadAt)
router.patch("/:id/read", async (req: Request, res: Response) => {
  await db.conversation.update({
    where: { id: req.params.id },
    data:  { lastReadAt: new Date() },
  })
  return res.json({ ok: true })
})

// PATCH /conversations/:id/status  { status, role }
// role vem do JWT/localStorage — validado aqui para PARA_EXCLUIR e DELETE
const CAN_ARCHIVE   = ["OWNER", "ADMIN", "GESTOR", "ATENDENTE"]
const CAN_FLAG_DEL  = ["OWNER", "ADMIN", "GESTOR"]
const CAN_DELETE    = ["OWNER", "ADMIN"]

router.patch("/:id/status", async (req: Request, res: Response) => {
  const { id } = req.params
  const { status, role } = req.body ?? {}

  const allowed = ["ARQUIVADO", "PARA_EXCLUIR", "EM_ANALISE", "ENCERRADO", "RESOLVIDO", "AGUARDANDO", "ALTA_INTENCAO"]
  if (!status || !allowed.includes(status)) {
    return res.status(400).json({ error: "Status inválido" })
  }

  // Permission checks
  if (status === "PARA_EXCLUIR" && !CAN_FLAG_DEL.includes(role)) {
    return res.status(403).json({ error: "Apenas gestores podem marcar para exclusão" })
  }
  if (status === "ARQUIVADO" && !CAN_ARCHIVE.includes(role)) {
    return res.status(403).json({ error: "Sem permissão para arquivar" })
  }

  const conversation = await db.conversation.findUnique({ where: { id }, select: { id: true } })
  if (!conversation) return res.status(404).json({ error: "Conversa não encontrada" })

  const updated = await db.conversation.update({
    where: { id },
    data: { status },
    select: { id: true, status: true },
  })

  return res.json(updated)
})

// DELETE /conversations/:id  — apenas OWNER/ADMIN
router.delete("/:id", async (req: Request, res: Response) => {
  const { role } = req.body ?? {}
  if (!CAN_DELETE.includes(role)) {
    return res.status(403).json({ error: "Apenas administradores podem excluir conversas" })
  }
  await db.conversation.delete({ where: { id: req.params.id } })
  return res.json({ ok: true })
})

// POST /conversations/:id/assign  { userId?: string }
// If userId provided → assign directly. If not → run distribution rules.
router.post("/:id/assign", async (req: Request, res: Response) => {
  const conv = await db.conversation.findUnique({
    where: { id: req.params.id },
    select: { id: true, companyId: true },
  })
  if (!conv) return res.status(404).json({ error: "Conversa não encontrada" })

  const { userId } = req.body ?? {}
  let targetUserId: string | null = userId ?? null

  if (!targetUserId) {
    targetUserId = await resolveAttendant(conv.id, conv.companyId)
  }

  if (!targetUserId || targetUserId === "__EXISTING_OWNER__") {
    return res.json({ ok: true, attendantId: null, message: "Sem atendente disponível — conversa na fila" })
  }

  await assignConversation(conv.id, targetUserId, conv.companyId)
  return res.json({ ok: true, attendantId: targetUserId })
})

export default router
