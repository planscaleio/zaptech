import { Router, Request, Response } from "express"
import { db } from "../db.js"
import { resolveAttendant, assignConversation } from "../lib/distributionEngine.js"
import { sendEmailReply } from "../lib/email-service.js"
import { saveBase64Attachment } from "../lib/media-storage.js"
import { resolveEvolutionInstanceId } from "../lib/evolution-instance.js"
import { requireAuth } from "../middleware/auth.js"

const router = Router()

router.use(requireAuth)

// GET /conversations/unread-count?companyId=&channel=  — must be before /:id routes
router.get("/unread-count", async (req: Request, res: Response) => {
  const { companyId, channel } = req.query
  if (!companyId || typeof companyId !== "string")
    return res.status(400).json({ error: "companyId é obrigatório" })

  const allowedChannels = ["WHATSAPP", "INSTAGRAM", "SITE", "EMAIL", "TELEFONE", "WEBHOOK"] as const
  const channelFilter = channel && typeof channel === "string" && (allowedChannels as readonly string[]).includes(channel)
    ? String(channel)
    : null

  if (channelFilter) {
    const result = await db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::int AS count
      FROM "Conversation" c
      WHERE c."companyId" = ${companyId}
        AND c."channel" = ${channelFilter}
        AND c.status NOT IN ('ARQUIVADO', 'PARA_EXCLUIR', 'ENCERRADO', 'RESOLVIDO')
        AND EXISTS (
          SELECT 1 FROM "Message" m
          WHERE m."conversationId" = c.id
            AND m.role = 'CLIENTE'
            AND m."createdAt" > COALESCE(c."lastReadAt", '1970-01-01'::timestamptz)
        )
    `
    return res.json({ count: Number(result[0]?.count ?? 0) })
  }

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

// GET /conversations?companyId=&channel=&teamId=&archived=
router.get("/", async (req: Request, res: Response) => {
  const { companyId, channel, teamId } = req.query
  if (!companyId || typeof companyId !== "string") {
    return res.status(400).json({ error: "companyId é obrigatório" })
  }
  const allowedChannels = ["WHATSAPP", "INSTAGRAM", "SITE", "EMAIL", "TELEFONE", "WEBHOOK"] as const
  type ChannelParam = typeof allowedChannels[number]
  if (channel && (typeof channel !== "string" || !(allowedChannels as readonly string[]).includes(channel))) {
    return res.status(400).json({ error: "channel inválido" })
  }
  const requestedChannel = channel ? channel as ChannelParam : null
  const requestedTeamId = teamId && typeof teamId === "string" ? teamId : null

  // Visibility filter based on user role
  const currentUser = req.user
  const isManager = currentUser?.type === "user" && ["OWNER", "ADMIN", "GESTOR"].includes(currentUser.role ?? "")

  let visibilityFilter: Record<string, unknown> = {}
  if (!isManager && currentUser?.sub) {
    const userTeamIds = await db.salesTeamMember.findMany({
      where: { userId: currentUser.sub },
      select: { teamId: true },
    }).then((r) => r.map((m) => m.teamId))

    visibilityFilter = {
      OR: [
        { attendantId: currentUser.sub },
        { attendantId: null, teamId: { in: userTeamIds.length > 0 ? userTeamIds : ["__none__"] } },
      ],
    }
  }

  const conversations = await db.conversation.findMany({
    where: {
      companyId,
      ...(requestedChannel ? { channel: requestedChannel } : {}),
      ...(requestedTeamId ? { teamId: requestedTeamId } : {}),
      ...visibilityFilter,
    },
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
      attendantId: true,
      teamId: true,
      lastReadAt: true,
      customer: {
        select: { id: true, name: true, phone: true, email: true, status: true, aiScore: true, isVip: true },
      },
      tags: {
        select: { tag: { select: { id: true, name: true, color: true } } },
      },
    },
  })

  const convIds = conversations.map((c) => c.id)
  const unreadRows = convIds.length > 0
    ? await db.$queryRaw<{ id: string }[]>`
        SELECT c.id
        FROM "Conversation" c
        WHERE c.id = ANY(${convIds}::text[])
          AND EXISTS (
            SELECT 1 FROM "Message" m
            WHERE m."conversationId" = c.id
              AND m.role = 'CLIENTE'
              AND m."createdAt" > COALESCE(c."lastReadAt", '1970-01-01'::timestamptz)
          )
      `
    : []
  const unreadSet = new Set(unreadRows.map((r) => r.id))

  return res.json(conversations.map((c) => ({
    ...c,
    tags: c.tags.map((t) => t.tag),
    hasUnread: unreadSet.has(c.id),
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
      attendantId: true,
      teamId: true,
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
  let targetTeamId: string | null = null

  if (!targetUserId) {
    const resolution = await resolveAttendant(conv.id, conv.companyId)
    targetUserId = resolution.userId
    targetTeamId = resolution.teamId
  }

  if (!targetUserId || targetUserId === "__EXISTING_OWNER__") {
    // If no attendant but a team was resolved, set teamId on conversation
    if (targetTeamId) {
      await db.conversation.update({ where: { id: conv.id }, data: { teamId: targetTeamId } })
    }
    return res.json({ ok: true, attendantId: null, teamId: targetTeamId, message: "Sem atendente disponível — conversa na fila" })
  }

  await assignConversation(conv.id, targetUserId, conv.companyId, targetTeamId)
  return res.json({ ok: true, attendantId: targetUserId, teamId: targetTeamId })
})

// POST /conversations/:id/transfer  { mode, targetId, note?, authorName? }
router.post("/:id/transfer", async (req: Request, res: Response) => {
  const conv = await db.conversation.findUnique({
    where: { id: req.params.id },
    select: { id: true, companyId: true, channel: true, emailAccountId: true, customer: { select: { phone: true, email: true } } },
  })
  if (!conv) return res.status(404).json({ error: "Conversa não encontrada" })

  const { mode, targetId, note, authorName } = req.body ?? {}
  if (!mode || !targetId) return res.status(400).json({ error: "mode e targetId são obrigatórios" })
  if (mode !== "user" && mode !== "team") return res.status(400).json({ error: "mode deve ser 'user' ou 'team'" })

  let resolvedUserId: string | null = null
  let targetName: string

  if (mode === "user") {
    const user = await db.user.findFirst({ where: { id: targetId, companyId: conv.companyId }, select: { id: true, name: true } })
    if (!user) return res.status(404).json({ error: "Usuário não encontrado nesta empresa" })
    resolvedUserId = user.id
    targetName = user.name
  } else {
    const team = await db.salesTeam.findUnique({ where: { id: targetId }, select: { name: true } })
    if (!team) return res.status(404).json({ error: "Time não encontrado" })
    targetName = team.name
  }

  const company = await db.company.findUnique({
    where: { id: conv.companyId },
    select: { transferMessageUser: true, transferMessageTeam: true },
  })

  const tplUser = company?.transferMessageUser ?? "Você será atendido por {nome}."
  const tplTeam = company?.transferMessageTeam ?? "Você foi transferido para nossa equipe de {nome}."
  const clientText = mode === "user"
    ? tplUser.replace("{nome}", targetName)
    : tplTeam.replace("{nome}", targetName)

  // Update conversation
  if (mode === "user") {
    await assignConversation(conv.id, resolvedUserId!, conv.companyId)
  } else {
    await db.conversation.update({ where: { id: conv.id }, data: { attendantId: null, teamId: targetId } })
  }

  // System message (internal note)
  const safeAuthor = authorName?.trim() || "Sistema"
  await db.message.create({
    data: {
      conversationId: conv.id,
      authorName: safeAuthor,
      role: "SISTEMA",
      text: note?.trim()
        ? `Conversa transferida para ${targetName}. Nota: ${note.trim()}`
        : `Conversa transferida para ${targetName}.`,
      align: "left",
    },
  })

  // Send message to client
  if (conv.channel === "EMAIL" && conv.emailAccountId) {
    const msg = await db.message.create({
      data: {
        conversationId: conv.id,
        authorName: safeAuthor,
        role: "ATENDENTE",
        text: clientText,
        align: "right",
      },
    })
    await sendEmailReply(conv.id, msg.id, clientText)
  } else if (conv.channel !== "TELEFONE" && conv.channel !== "WEBHOOK" && conv.customer?.phone) {
    const instanceId = await resolveEvolutionInstanceId(conv.companyId)
    if (instanceId) {
      await db.outboundMessage.create({
        data: {
          companyId: conv.companyId,
          conversationId: conv.id,
          instanceId,
          recipientPhone: conv.customer.phone,
          messageType: "text",
          body: clientText,
          status: "QUEUED",
        },
      })
    }
  }

  await db.conversation.update({
    where: { id: conv.id },
    data: { preview: clientText.slice(0, 80), lastMessageAt: new Date() },
  })

  return res.json({ ok: true, attendantId: resolvedUserId })
})

export default router
