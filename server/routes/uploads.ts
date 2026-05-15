import fs from "node:fs"
import path from "node:path"
import { Router, type Request, type Response } from "express"
import { db } from "../db.js"
import { absoluteUploadPath, extensionForMime, normalizeMimeType, saveBase64Attachment, uploadUrlFromRelativePath } from "../lib/media-storage.js"
import { fetchEvolutionMediaBase64 } from "../lib/evolution-media.js"

const router = Router()

function parseRange(range: string | undefined, size: number) {
  if (!range?.startsWith("bytes=")) return null
  const [startRaw, endRaw] = range.replace("bytes=", "").split("-")
  const start = Number(startRaw)
  const end = endRaw ? Number(endRaw) : size - 1
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end >= size || start > end) return null
  return { start, end }
}

function contentDisposition(fileName: string, mode: "inline" | "attachment") {
  const asciiFallback = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]+/g, "")
    .replace(/["\\]/g, "")
    .trim() || "arquivo"
  return `${mode}; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

async function statIfExists(filePath: string) {
  try {
    return await fs.promises.stat(filePath)
  } catch {
    return null
  }
}

async function resolveExistingFile(storagePath: string, mimeType?: string | null) {
  const directPath = absoluteUploadPath(storagePath)
  const directStat = await statIfExists(directPath)
  if (directStat) return { absolutePath: directPath, stat: directStat }

  if (path.extname(storagePath)) return null

  const expectedExt = mimeType ? extensionForMime(mimeType) : ""
  const candidateExts = [
    expectedExt,
    ".ogg",
    ".opus",
    ".webm",
    ".mp3",
    ".m4a",
    ".pdf",
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
  ].filter(Boolean)

  for (const ext of [...new Set(candidateExts)]) {
    const candidatePath = absoluteUploadPath(`${storagePath}${ext}`)
    const candidateStat = await statIfExists(candidatePath)
    if (candidateStat) return { absolutePath: candidatePath, stat: candidateStat }
  }

  return null
}

type UploadAttachment = {
  id: string
  companyId: string
  conversationId: string
  fileName: string
  mimeType: string
  storagePath: string | null
  url: string
  metadata: unknown
}

type RepairOutcome =
  | { status: "repaired"; resolved: { absolutePath: string; stat: fs.Stats }; mimeType: string; fileName: string }
  | { status: "not_found"; reason: string }
  | { status: "upstream_error"; reason: string }

function logUploadRepairError(message: string, detail: Record<string, unknown>) {
  console.warn("[uploads] media repair:", message, detail)
}

function uploadRequestContext(storagePath: string) {
  const parts = storagePath.split(/[\\/]/)
  const conversationsIndex = parts.indexOf("conversations")
  if (conversationsIndex < 0) return null

  const companyId = parts[conversationsIndex + 1]
  const conversationId = parts[conversationsIndex + 2]
  const fileName = parts[parts.length - 1] ?? ""
  const waMessageId = fileName.match(/(?:audio|image|document|video)-([A-Z0-9]+)$/i)?.[1] ?? null

  if (!companyId || !conversationId || !waMessageId) return null
  return { companyId, conversationId, fileName, waMessageId }
}

function mediaInfoFromPayload(payload: unknown) {
  const msg = payload as { message?: Record<string, unknown>; messageType?: string; key?: { id?: string } }
  const messageType = msg.messageType ?? ""
  const node = msg.message?.[messageType]
  const media = node && typeof node === "object" ? node as Record<string, unknown> : {}

  const mimeType = typeof media.mimetype === "string"
    ? normalizeMimeType(media.mimetype)
    : messageType === "audioMessage"
    ? "audio/ogg"
    : "application/octet-stream"
  const fileName =
    (typeof media.fileName === "string" && media.fileName) ||
    (typeof media.title === "string" && media.title) ||
    `${messageType.replace("Message", "") || "arquivo"}-${msg.key?.id ?? Date.now()}`

  return { mimeType, fileName }
}

async function repairMissingAttachmentFile(attachment: UploadAttachment) {
  const metadata = attachment.metadata as { waMessageId?: string | null } | null
  if (!metadata?.waMessageId) return { status: "not_found", reason: "attachment_missing_waMessageId" } satisfies RepairOutcome

  const inbound = await db.inboundMessage.findFirst({
    where: { companyId: attachment.companyId, waMessageId: metadata.waMessageId },
    select: { instanceId: true, payload: true },
  })
  if (!inbound) return { status: "not_found", reason: "inbound_not_found" } satisfies RepairOutcome

  const base64 = await fetchEvolutionMediaBase64(inbound.instanceId, inbound.payload as { key?: unknown; message?: unknown })
  if (!base64) return { status: "upstream_error", reason: "evolution_media_unavailable" } satisfies RepairOutcome

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

    const resolved = await resolveExistingFile(saved.storagePath, saved.mimeType)
    if (!resolved) return { status: "not_found", reason: "saved_file_not_found" } satisfies RepairOutcome
    return { status: "repaired", resolved, mimeType: saved.mimeType, fileName: saved.fileName } satisfies RepairOutcome
  } catch (err) {
    logUploadRepairError("failed_to_save_attachment_repair", {
      companyId: attachment.companyId,
      conversationId: attachment.conversationId,
      waMessageId: metadata.waMessageId,
      mimeType: attachment.mimeType,
      storagePath: attachment.storagePath,
      error: err instanceof Error ? err.message : String(err),
    })
    return { status: "upstream_error", reason: err instanceof Error ? err.message : "repair_save_failed" } satisfies RepairOutcome
  }
}

async function repairMissingFileFromRequest(storagePath: string) {
  const context = uploadRequestContext(storagePath)
  if (!context) return { status: "not_found", reason: "request_context_not_found" } satisfies RepairOutcome

  const inbound = await db.inboundMessage.findFirst({
    where: { companyId: context.companyId, waMessageId: context.waMessageId },
    select: { instanceId: true, payload: true },
  })
  if (!inbound) return { status: "not_found", reason: "inbound_not_found" } satisfies RepairOutcome

  const base64 = await fetchEvolutionMediaBase64(inbound.instanceId, inbound.payload as { key?: unknown; message?: unknown })
  if (!base64) return { status: "upstream_error", reason: "evolution_media_unavailable" } satisfies RepairOutcome

  const mediaInfo = mediaInfoFromPayload(inbound.payload)
  try {
    const saved = await saveBase64Attachment({
      companyId: context.companyId,
      conversationId: context.conversationId,
      fileName: mediaInfo.fileName || context.fileName,
      mimeType: mediaInfo.mimeType,
      base64,
    })

    const existingAttachment = await db.messageAttachment.findFirst({
      where: {
        companyId: context.companyId,
        conversationId: context.conversationId,
        metadata: { path: ["waMessageId"], equals: context.waMessageId },
      },
      select: { id: true, metadata: true },
    })

    if (existingAttachment) {
      await db.messageAttachment.update({
        where: { id: existingAttachment.id },
        data: {
          fileName: saved.fileName,
          mimeType: saved.mimeType,
          size: saved.size,
          storagePath: saved.storagePath,
          url: saved.url,
          metadata: { ...(existingAttachment.metadata as object), downloadMethod: "evolution-base64", repairedAt: new Date().toISOString() },
        },
      })
    }

    const resolved = await resolveExistingFile(saved.storagePath, saved.mimeType)
    if (!resolved) return { status: "not_found", reason: "saved_file_not_found" } satisfies RepairOutcome
    return { status: "repaired", resolved, mimeType: saved.mimeType, fileName: saved.fileName } satisfies RepairOutcome
  } catch (err) {
    logUploadRepairError("failed_to_save_request_repair", {
      companyId: context.companyId,
      conversationId: context.conversationId,
      waMessageId: context.waMessageId,
      mimeType: mediaInfo.mimeType,
      storagePath,
      error: err instanceof Error ? err.message : String(err),
    })
    return { status: "upstream_error", reason: err instanceof Error ? err.message : "repair_save_failed" } satisfies RepairOutcome
  }
}

router.get("/*path", async (req: Request, res: Response) => {
  const requestedPath = Array.isArray(req.params.path) ? req.params.path.join("/") : req.params.path
  const decodedPath = requestedPath.split("/").map((part) => {
    try {
      return decodeURIComponent(part)
    } catch {
      return part
    }
  }).join("/")
  const normalizedPath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, "")
  const url = uploadUrlFromRelativePath(normalizedPath)

  const attachment = await db.messageAttachment.findFirst({
    where: {
      OR: [
        { url },
        { storagePath: normalizedPath },
        { url: `/uploads/${normalizedPath}` },
        { storagePath: { startsWith: normalizedPath } },
        { url: { startsWith: `/uploads/${normalizedPath}` } },
      ],
    },
    select: {
      id: true,
      companyId: true,
      conversationId: true,
      fileName: true,
      mimeType: true,
      storagePath: true,
      url: true,
      metadata: true,
    },
  })

  const storagePath = attachment?.storagePath ?? normalizedPath
  let resolved = await resolveExistingFile(storagePath, attachment?.mimeType)
  let repairedMimeType: string | null = null
  let repairedFileName: string | null = null
  let upstreamRepairError: string | null = null

  if (!resolved && attachment) {
    const repair = await repairMissingAttachmentFile(attachment)
    if (repair.status === "repaired") {
      resolved = repair.resolved
      repairedMimeType = repair.mimeType
      repairedFileName = repair.fileName
    } else if (repair.status === "upstream_error") {
      upstreamRepairError = repair.reason
    }
  }
  if (!resolved) {
    const repair = await repairMissingFileFromRequest(normalizedPath)
    if (repair.status === "repaired") {
      resolved = repair.resolved
      repairedMimeType = repair.mimeType
      repairedFileName = repair.fileName
    } else if (repair.status === "upstream_error") {
      upstreamRepairError = repair.reason
    }
  }
  if (!resolved) {
    if (upstreamRepairError) {
      console.warn("[uploads] media unavailable after repair attempt", {
        path: normalizedPath,
        attachmentId: attachment?.id,
        companyId: attachment?.companyId,
        conversationId: attachment?.conversationId,
        mimeType: attachment?.mimeType,
        storagePath,
        reason: upstreamRepairError,
      })
      return res.status(502).json({ error: "Não foi possível recuperar a mídia na Evolution", code: "MEDIA_REPAIR_FAILED" })
    }
    return res.status(404).json({ error: "Arquivo não encontrado" })
  }
  const { absolutePath, stat } = resolved

  const inferredContext = uploadRequestContext(normalizedPath)
  const mimeType = normalizeMimeType(repairedMimeType ?? attachment?.mimeType ?? (inferredContext?.fileName.startsWith("audio-") ? "audio/ogg" : "application/octet-stream"))
  const fileName = repairedFileName ?? attachment?.fileName ?? path.basename(absolutePath)
  const range = parseRange(req.headers.range, stat.size)
  const dispositionMode = req.query.download === "1" ? "attachment" : "inline"

  res.setHeader("Accept-Ranges", "bytes")
  res.setHeader("Content-Type", mimeType)
  res.setHeader("Content-Disposition", contentDisposition(fileName, dispositionMode))
  res.setHeader("Cache-Control", "public, max-age=86400")

  if (range) {
    res.status(206)
    res.setHeader("Content-Range", `bytes ${range.start}-${range.end}/${stat.size}`)
    res.setHeader("Content-Length", range.end - range.start + 1)
    fs.createReadStream(absolutePath, { start: range.start, end: range.end }).pipe(res)
    return
  }

  res.setHeader("Content-Length", stat.size)
  fs.createReadStream(absolutePath).pipe(res)
})

export default router
