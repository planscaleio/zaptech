import { Router, Request, Response } from "express"
import { db } from "../db.js"
import { resolveAttendant, assignConversation } from "../lib/distributionEngine.js"
import { sendEmailReply } from "../lib/email-service.js"
import { saveBase64Attachment } from "../lib/media-storage.js"
import { resolveEvolutionInstanceId } from "../lib/evolution-instance.js"

const router = Router()

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
          attachments: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              type: true,
              fileName: true,
              mimeType: true,
              size: true,
              url: true,
              externalUrl: true,
            },
          },
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

// POST /conversations/:id/attachments — upload local de anexos antes do envio
router.post("/:id/attachments", async (req: Request, res: Response) => {
  const { id } = req.params
  const files = Array.isArray(req.body?.files) ? req.body.files : []

  if (files.length === 0) return res.status(400).json({ error: "Nenhum arquivo enviado" })
  if (files.length > 5) return res.status(400).json({ error: "Envie no máximo 5 arquivos por mensagem" })

  const conversation = await db.conversation.findUnique({
    where: { id },
    select: { id: true, companyId: true },
  })
  if (!conversation) return res.status(404).json({ error: "Conversa não encontrada" })

  try {
    const attachments = []
    for (const file of files) {
      const fileName = typeof file?.fileName === "string" ? file.fileName : "arquivo"
      const mimeType = typeof file?.mimeType === "string" ? file.mimeType : "application/octet-stream"
      const base64 = typeof file?.base64 === "string" ? file.base64 : ""
      if (!base64) return res.status(400).json({ error: "Arquivo inválido" })

      const saved = await saveBase64Attachment({
        companyId: conversation.companyId,
        conversationId: conversation.id,
        fileName,
        mimeType,
        base64,
      })

      const attachment = await db.messageAttachment.create({
        data: {
          companyId: conversation.companyId,
          conversationId: conversation.id,
          type: saved.type,
          fileName: saved.fileName,
          mimeType: saved.mimeType,
          size: saved.size,
          storagePath: saved.storagePath,
          url: saved.url,
          source: "LOCAL",
        },
        select: {
          id: true,
          type: true,
          fileName: true,
          mimeType: true,
          size: true,
          url: true,
        },
      })
      attachments.push(attachment)
    }

    return res.status(201).json({ attachments })
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Falha ao salvar anexo" })
  }
})

// POST /conversations/:id/reply — envia mensagem via Evolution API e persiste no banco
router.post("/:id/reply", async (req: Request, res: Response) => {
  const { id } = req.params
  const { text, clientRequestId, userId, authorName } = req.body ?? {}
  const attachmentIds = Array.isArray(req.body?.attachmentIds)
    ? req.body.attachmentIds.filter((value: unknown): value is string => typeof value === "string")
    : []

  if (!text?.trim() && attachmentIds.length === 0) {
    return res.status(400).json({ error: "text ou anexo é obrigatório" })
  }

  const conversation = await db.conversation.findUnique({
    where: { id },
    select: {
      id: true,
      companyId: true,
      channel: true,
      preview: true,
      emailAccountId: true,
      customer: { select: { phone: true, email: true } },
    },
  })

  if (!conversation) return res.status(404).json({ error: "Conversa não encontrada" })

  const attachments = attachmentIds.length > 0
    ? await db.messageAttachment.findMany({
        where: { id: { in: attachmentIds }, conversationId: id, messageId: null },
        orderBy: { createdAt: "asc" },
      })
    : []

  if (attachmentIds.length > 0 && attachments.length !== attachmentIds.length) {
    return res.status(400).json({ error: "Anexo inválido ou já enviado" })
  }

  if (attachments.some((attachment) => attachment.type === "AUDIO")) {
    return res.status(422).json({ error: "Envio de áudio fica para a próxima versão" })
  }

  if (conversation.channel === "EMAIL") {
    if (attachments.length > 0) return res.status(422).json({ error: "Anexos em e-mail ficam para a próxima versão" })
    if (!conversation.emailAccountId) return res.status(422).json({ error: "Conversa sem conta de e-mail vinculada" })
    if (!conversation.customer?.email) return res.status(422).json({ error: "Cliente sem e-mail cadastrado" })

    await sendEmailReply({
      emailAccountId: conversation.emailAccountId,
      to: conversation.customer.email,
      body: text.trim(),
      subject: conversation.preview?.split(":")[0] || "Re: Atendimento",
    })

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
    return res.status(201).json({ sent: true, message })
  }

  if (!conversation.customer?.phone) return res.status(422).json({ error: "Cliente sem telefone cadastrado" })

  const instanceId = await resolveEvolutionInstanceId(conversation.companyId)

  if (attachments.length > 0) {
    const queued = []
    for (let index = 0; index < attachments.length; index++) {
      const attachment = attachments[index]
      const caption = index === 0 ? text?.trim() || null : null
      const outbound = await db.outboundMessage.create({
        data: {
          companyId:       conversation.companyId,
          conversationId:  id,
          instanceId,
          recipientPhone:  conversation.customer.phone,
          messageType:     attachment.type.toLowerCase(),
          body:            caption,
          status:          "QUEUED",
          createdByUserId: userId ?? null,
          clientRequestId: clientRequestId ? `${clientRequestId}:${attachment.id}` : null,
          payload: {
            attachmentId: attachment.id,
            type: attachment.type,
            fileName: attachment.fileName,
            mimeType: attachment.mimeType,
            storagePath: attachment.storagePath,
            url: attachment.url,
          },
        },
      })
      queued.push(outbound.id)
    }
    return res.status(202).json({ queued: true, outboundMessageIds: queued })
  }

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
