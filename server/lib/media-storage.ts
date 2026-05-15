import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"

export type AttachmentKind = "IMAGE" | "AUDIO" | "DOCUMENT" | "VIDEO"

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const UPLOAD_ROOT = path.resolve(process.cwd(), process.env.MEDIA_UPLOAD_DIR ?? "uploads")

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
  "audio/opus",
  "audio/webm",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
])

export function attachmentKindFromMime(mimeType: string): AttachmentKind {
  if (mimeType.startsWith("image/")) return "IMAGE"
  if (mimeType.startsWith("audio/")) return "AUDIO"
  if (mimeType.startsWith("video/")) return "VIDEO"
  return "DOCUMENT"
}

export function mediaTypeForEvolution(kind: AttachmentKind) {
  if (kind === "IMAGE") return "image"
  if (kind === "VIDEO") return "video"
  return "document"
}

export function assertAllowedUpload(mimeType: string, size: number) {
  if (size > MAX_UPLOAD_BYTES) {
    throw new Error("Arquivo acima do limite de 10MB.")
  }
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error("Tipo de arquivo não permitido.")
  }
}

function safeFileName(fileName: string) {
  const parsed = path.parse(fileName)
  const base = parsed.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "arquivo"
  const ext = parsed.ext.replace(/[^a-zA-Z0-9.]/g, "").slice(0, 12)
  return `${base}${ext}`
}

function relativeUploadPath(companyId: string, conversationId: string, fileName: string) {
  const date = new Date().toISOString().slice(0, 10)
  return path.join("conversations", companyId, conversationId, date, `${crypto.randomUUID()}-${safeFileName(fileName)}`)
}

export function uploadUrlFromRelativePath(relativePath: string) {
  return `/uploads/${relativePath.split(path.sep).join("/")}`
}

export function absoluteUploadPath(relativePath: string) {
  return path.join(UPLOAD_ROOT, relativePath)
}

export async function saveBase64Attachment(opts: {
  companyId: string
  conversationId: string
  fileName: string
  mimeType: string
  base64: string
}) {
  const buffer = Buffer.from(opts.base64.replace(/^data:[^;]+;base64,/, ""), "base64")
  assertAllowedUpload(opts.mimeType, buffer.byteLength)

  const relativePath = relativeUploadPath(opts.companyId, opts.conversationId, opts.fileName)
  const absolutePath = absoluteUploadPath(relativePath)
  await fs.mkdir(path.dirname(absolutePath), { recursive: true })
  await fs.writeFile(absolutePath, buffer)

  return {
    type: attachmentKindFromMime(opts.mimeType),
    fileName: safeFileName(opts.fileName),
    mimeType: opts.mimeType,
    size: buffer.byteLength,
    storagePath: relativePath,
    url: uploadUrlFromRelativePath(relativePath),
  }
}

export async function saveRemoteAttachment(opts: {
  companyId: string
  conversationId: string
  fileName: string
  mimeType: string
  remoteUrl: string
}) {
  const response = await fetch(opts.remoteUrl)
  if (!response.ok) throw new Error(`Falha ao baixar mídia (${response.status})`)
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error("Mídia recebida acima do limite de 10MB.")
  }

  const relativePath = relativeUploadPath(opts.companyId, opts.conversationId, opts.fileName)
  const absolutePath = absoluteUploadPath(relativePath)
  await fs.mkdir(path.dirname(absolutePath), { recursive: true })
  await fs.writeFile(absolutePath, buffer)

  return {
    type: attachmentKindFromMime(opts.mimeType),
    fileName: safeFileName(opts.fileName),
    mimeType: opts.mimeType,
    size: buffer.byteLength,
    storagePath: relativePath,
    url: uploadUrlFromRelativePath(relativePath),
  }
}
