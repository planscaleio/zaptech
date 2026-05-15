/**
 * inbound-processor.worker
 *
 * Reads InboundMessage rows with status=PENDING and processes each one:
 * upserts Customer + Conversation, creates Message. Runs every 5 seconds.
 *
 * Trigger: cron (5s) | manual | event:inbound.created
 */

import { db } from "../db.js"
import { runWorker, type WorkerContext } from "./runner.js"
import { jidToPhone, extractText, mediaPlaceholder, calcNextAttempt } from "../utils/evolution.js"
import { resolveAttendant, assignConversation } from "../lib/distributionEngine.js"
import { attachmentKindFromMime, normalizeMimeType, saveBase64Attachment, saveRemoteAttachment } from "../lib/media-storage.js"
import { fetchEvolutionMediaBase64 } from "../lib/evolution-media.js"

const BATCH_SIZE   = 50
const MAX_ATTEMPTS = 5

const TEXT_TYPES = new Set(["conversation", "extendedTextMessage"])

interface EvoMessage {
  key?: { remoteJid?: string; fromMe?: boolean; id?: string }
  message?: Record<string, unknown>
  messageType?: string
  pushName?: string
  messageTimestamp?: number
}

function mediaNodeForType(message: Record<string, unknown> | undefined, messageType: string) {
  if (!message) return null
  const node = message[messageType]
  return node && typeof node === "object" ? node as Record<string, unknown> : null
}

function extractMediaAttachment(msg: EvoMessage, msgType: string) {
  const supported = new Set(["imageMessage", "audioMessage", "documentMessage", "videoMessage"])
  if (!supported.has(msgType)) return null

  const media = mediaNodeForType(msg.message, msgType)
  if (!media) return null

  const mimeType = typeof media.mimetype === "string"
    ? normalizeMimeType(media.mimetype)
    : msgType === "audioMessage"
    ? "audio/ogg"
    : "application/octet-stream"
  const remoteUrl = typeof media.url === "string" ? media.url : null
  const fileName =
    (typeof media.fileName === "string" && media.fileName) ||
    (typeof media.title === "string" && media.title) ||
    `${msgType.replace("Message", "")}-${msg.key?.id ?? Date.now()}`
  const rawSize = media.fileLength
  const size = typeof rawSize === "number" ? rawSize : typeof rawSize === "string" ? Number(rawSize) : null

  return {
    type: attachmentKindFromMime(mimeType),
    fileName,
    mimeType,
    size: Number.isFinite(size) ? Number(size) : null,
    remoteUrl,
    metadata: {
      waMessageId: msg.key?.id ?? null,
      media,
    },
  }
}

async function processInbound(inbound: {
  id: string
  companyId: string
  instanceId: string
  senderPhone: string
  messageType: string
  payload: unknown
}) {
  const msg        = inbound.payload as EvoMessage
  const pushName   = msg.pushName ?? inbound.senderPhone
  const msgType    = inbound.messageType
  const timestamp  = msg.messageTimestamp
    ? new Date(Number(msg.messageTimestamp) * 1000)
    : new Date()

  const rawText = extractText(msg.message)
  const text    = rawText || (TEXT_TYPES.has(msgType) ? "" : mediaPlaceholder(msgType))

  const { convId, messageId, isNew } = await db.$transaction(async (tx) => {
    // 1. Upsert Customer
    const existing = await tx.customer.findFirst({
      where: { companyId: inbound.companyId, phone: inbound.senderPhone },
      select: { id: true },
    })

    const customer = existing
      ? await tx.customer.update({
          where: { id: existing.id },
          data: { name: pushName || inbound.senderPhone, lastContactAt: timestamp },
        })
      : await tx.customer.create({
          data: {
            companyId: inbound.companyId,
            name: pushName || inbound.senderPhone,
            phone: inbound.senderPhone,
            status: "EM_ANALISE",
            stage: "QUALIFICACAO",
            lastContactAt: timestamp,
          },
        })

    // 2. Upsert Conversation (reuse open one, else create)
    const existingConv = await tx.conversation.findFirst({
      where: {
        companyId: inbound.companyId,
        customerId: customer.id,
        status: { notIn: ["ENCERRADO", "ARQUIVADO", "PARA_EXCLUIR"] },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    })

    const conversation = existingConv
      ? await tx.conversation.update({
          where: { id: existingConv.id },
          data: { preview: text.slice(0, 200) || msgType, lastMessageAt: timestamp, status: "EM_ANALISE" },
        })
      : await tx.conversation.create({
          data: {
            companyId: inbound.companyId,
            customerId: customer.id,
            channel: "WHATSAPP",
            status: "EM_ANALISE",
            preview: text.slice(0, 200) || msgType,
            lastMessageAt: timestamp,
          },
        })

    // 3. Create Message
    const message = await tx.message.create({
      data: {
        conversationId: conversation.id,
        authorName: pushName || inbound.senderPhone,
        role: "CLIENTE",
        text: text || mediaPlaceholder(msgType),
        isAiGenerated: false,
        align: "left",
        createdAt: timestamp,
      },
      select: { id: true },
    })

    return { convId: conversation.id, messageId: message.id, isNew: !existingConv }
  })

  const mediaAttachment = extractMediaAttachment(msg, msgType)
  if (mediaAttachment) {
    try {
      const base64 = await fetchEvolutionMediaBase64(inbound.instanceId, msg)
      const downloadMethod = base64 ? "evolution-base64" : mediaAttachment.remoteUrl ? "remote-url" : "metadata-only"
      const saved = base64
        ? await saveBase64Attachment({
            companyId: inbound.companyId,
            conversationId: convId,
            fileName: mediaAttachment.fileName,
            mimeType: mediaAttachment.mimeType,
            base64,
          })
        : mediaAttachment.remoteUrl
        ? await saveRemoteAttachment({
            companyId: inbound.companyId,
            conversationId: convId,
            fileName: mediaAttachment.fileName,
            mimeType: mediaAttachment.mimeType,
            remoteUrl: mediaAttachment.remoteUrl,
          })
        : null

      await db.messageAttachment.create({
        data: {
          companyId: inbound.companyId,
          conversationId: convId,
          messageId,
          type: saved?.type ?? mediaAttachment.type,
          fileName: saved?.fileName ?? mediaAttachment.fileName,
          mimeType: saved?.mimeType ?? mediaAttachment.mimeType,
          size: saved?.size ?? mediaAttachment.size,
          storagePath: saved?.storagePath ?? null,
          url: saved?.url ?? mediaAttachment.remoteUrl ?? "",
          source: "WHATSAPP_INBOUND",
          externalUrl: mediaAttachment.remoteUrl,
          metadata: { ...mediaAttachment.metadata, downloadMethod },
        },
      })
    } catch (err) {
      console.warn("[inbound-processor] Falha ao salvar mídia localmente:", err)
      await db.messageAttachment.create({
        data: {
          companyId: inbound.companyId,
          conversationId: convId,
          messageId,
          type: mediaAttachment.type,
          fileName: mediaAttachment.fileName,
          mimeType: mediaAttachment.mimeType,
          size: mediaAttachment.size,
          url: mediaAttachment.remoteUrl ?? "",
          source: "WHATSAPP_INBOUND",
          externalUrl: mediaAttachment.remoteUrl,
          metadata: { ...mediaAttachment.metadata, downloadMethod: "failed" },
        },
      })
    }
  }

  // 4. Auto-assign via distribution rules (only for new conversations without an attendant)
  if (isNew) {
    const convWithAttendant = await db.conversation.findUnique({
      where: { id: convId },
      select: { attendantId: true },
    })
    if (!convWithAttendant?.attendantId) {
      const resolution = await resolveAttendant(convId, inbound.companyId)
      if (resolution.userId && resolution.userId !== "__EXISTING_OWNER__") {
        await assignConversation(convId, resolution.userId, inbound.companyId, resolution.teamId)
      } else if (resolution.teamId) {
        await db.conversation.update({ where: { id: convId }, data: { teamId: resolution.teamId } })
      }
    }
  }
}

export async function runInboundProcessor(
  trigger: "cron" | "manual" | `event:${string}` = "cron",
  ctx: WorkerContext = {},
) {
  return runWorker("inbound-processor", trigger, ctx, async (handle) => {
    const now = new Date()

    const pending = await db.inboundMessage.findMany({
      where: {
        status: "PENDING",
        nextAttemptAt: { lte: now },
        ...(ctx.companyId ? { companyId: ctx.companyId } : {}),
      },
      orderBy: { nextAttemptAt: "asc" },
      take: BATCH_SIZE,
    })

    if (pending.length === 0) {
      await handle.finish({ total: 0, processed: 0, failed: 0 })
      return
    }

    await handle.log("info", `Processando ${pending.length} mensagem(ns) inbound`)

    let processed = 0
    let failed    = 0

    for (const inbound of pending) {
      // Claim atomically — prevents double-processing if two processes run
      const claimed = await db.inboundMessage.updateMany({
        where: { id: inbound.id, status: "PENDING" },
        data:  { status: "PROCESSING" },
      })
      if (claimed.count === 0) continue

      try {
        await processInbound(inbound)

        await db.inboundMessage.update({
          where: { id: inbound.id },
          data:  { status: "DONE", processedAt: new Date(), error: null },
        })

        await handle.log("info", `Processado: ${inbound.senderPhone} [${inbound.messageType}]`, {
          itemId: inbound.id,
          detail: { waMessageId: inbound.waMessageId },
        })

        processed++
      } catch (err) {
        const msg          = err instanceof Error ? err.message : String(err)
        const nextAttempts = inbound.attempts + 1
        const isFinal      = nextAttempts >= MAX_ATTEMPTS

        await db.inboundMessage.update({
          where: { id: inbound.id },
          data: {
            status:        isFinal ? "FAILED" : "PENDING",
            attempts:      nextAttempts,
            nextAttemptAt: isFinal ? new Date() : calcNextAttempt(nextAttempts),
            error:         msg,
          },
        })

        await handle.log("error",
          `Falha (tentativa ${nextAttempts}/${MAX_ATTEMPTS}): ${msg}`,
          { itemId: inbound.id, detail: { phone: inbound.senderPhone } },
        )

        failed++
      }
    }

    await handle.finish({ total: pending.length, processed, failed })
  })
}

export async function repairInboundMedia(ctx: WorkerContext = {}) {
  const attachments = await db.messageAttachment.findMany({
    where: {
      source: "WHATSAPP_INBOUND",
      type: { in: ["AUDIO", "IMAGE", "DOCUMENT", "VIDEO"] },
      ...(ctx.companyId ? { companyId: ctx.companyId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      companyId: true,
      conversationId: true,
      fileName: true,
      mimeType: true,
      metadata: true,
    },
  })

  let repaired = 0
  const failed: { attachmentId: string; reason: string }[] = []

  for (const attachment of attachments) {
    const metadata = attachment.metadata as { waMessageId?: string | null; downloadMethod?: string | null } | null
    if (metadata?.downloadMethod === "evolution-base64") continue
    if (!metadata?.waMessageId) {
      failed.push({ attachmentId: attachment.id, reason: "missing_waMessageId" })
      continue
    }

    const inbound = await db.inboundMessage.findFirst({
      where: { companyId: attachment.companyId, waMessageId: metadata.waMessageId },
      select: { instanceId: true, payload: true },
    })
    if (!inbound) {
      failed.push({ attachmentId: attachment.id, reason: "inbound_not_found" })
      continue
    }

    const base64 = await fetchEvolutionMediaBase64(inbound.instanceId, inbound.payload as EvoMessage)
    if (!base64) {
      failed.push({ attachmentId: attachment.id, reason: "evolution_media_unavailable" })
      continue
    }

    try {
      const saved = await saveBase64Attachment({
        companyId: attachment.companyId,
        conversationId: attachment.conversationId,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        base64,
      })

      await db.messageAttachment.update({
        where: { id: attachment.id },
        data: {
          fileName: saved.fileName,
          mimeType: saved.mimeType,
          size: saved.size,
          storagePath: saved.storagePath,
          url: saved.url,
          metadata: { ...(attachment.metadata as object), downloadMethod: "evolution-base64", repairedAt: new Date().toISOString() },
        },
      })
      repaired++
    } catch (err) {
      failed.push({ attachmentId: attachment.id, reason: err instanceof Error ? err.message : "save_failed" })
    }
  }

  return { checked: attachments.length, repaired, failed: failed.length, failures: failed.slice(0, 25) }
}
