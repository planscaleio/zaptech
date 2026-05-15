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
  "audio/wav",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
])

export const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/mp4": ".m4a",
  "audio/aac": ".aac",
  "audio/ogg": ".ogg",
  "audio/opus": ".opus",
  "audio/webm": ".webm",
  "audio/wav": ".wav",
  "application/pdf": ".pdf",
  "text/plain": ".txt",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
}

export function normalizeMimeType(mimeType: string) {
  const normalized = mimeType.split(";")[0]?.trim().toLowerCase() || "application/octet-stream"
  if (normalized === "audio/x-m4a") return "audio/mp4"
  if (normalized === "audio/x-wav") return "audio/wav"
  return normalized
}

export function attachmentKindFromMime(mimeType: string): AttachmentKind {
  const normalized = normalizeMimeType(mimeType)
  if (normalized.startsWith("image/")) return "IMAGE"
  if (normalized.startsWith("audio/")) return "AUDIO"
  if (normalized.startsWith("video/")) return "VIDEO"
  return "DOCUMENT"
}

export function mediaTypeForEvolution(kind: AttachmentKind) {
  if (kind === "IMAGE") return "image"
  if (kind === "VIDEO") return "video"
  return "document"
}

export function assertAllowedUpload(mimeType: string, size: number) {
  const normalized = normalizeMimeType(mimeType)
  if (size > MAX_UPLOAD_BYTES) {
    throw new Error("Arquivo acima do limite de 10MB.")
  }
  if (!ALLOWED_MIME_TYPES.has(normalized)) {
    throw new Error("Tipo de arquivo não permitido.")
  }
}

function safeFileName(fileName: string, mimeType?: string) {
  const parsed = path.parse(fileName)
  const base = parsed.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "arquivo"
  const fallbackExt = mimeType ? MIME_EXTENSIONS[mimeType] ?? "" : ""
  const ext = (parsed.ext || fallbackExt).replace(/[^a-zA-Z0-9.]/g, "").slice(0, 12)
  return `${base}${ext}`
}

function relativeUploadPath(companyId: string, conversationId: string, fileName: string, mimeType?: string) {
  const date = new Date().toISOString().slice(0, 10)
  return path.join("conversations", companyId, conversationId, date, `${crypto.randomUUID()}-${safeFileName(fileName, mimeType)}`)
}

export function uploadUrlFromRelativePath(relativePath: string) {
  return `/uploads/${relativePath.split(path.sep).map(encodeURIComponent).join("/")}`
}

export function absoluteUploadPath(relativePath: string) {
  return path.join(UPLOAD_ROOT, relativePath)
}

export function extensionForMime(mimeType: string) {
  return MIME_EXTENSIONS[normalizeMimeType(mimeType)] ?? ""
}

export async function saveBase64Attachment(opts: {
  companyId: string
  conversationId: string
  fileName: string
  mimeType: string
  base64: string
}) {
  const buffer = Buffer.from(opts.base64.replace(/^data:[^;]+;base64,/, ""), "base64")
  const mimeType = normalizeMimeType(opts.mimeType)
  assertAllowedUpload(mimeType, buffer.byteLength)

  const relativePath = relativeUploadPath(opts.companyId, opts.conversationId, opts.fileName, mimeType)
  const absolutePath = absoluteUploadPath(relativePath)
  await fs.mkdir(path.dirname(absolutePath), { recursive: true })
  await fs.writeFile(absolutePath, buffer)

  return {
    type: attachmentKindFromMime(mimeType),
    fileName: safeFileName(opts.fileName, mimeType),
    mimeType,
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
  const mimeType = normalizeMimeType(opts.mimeType)
  const response = await fetch(opts.remoteUrl)
  if (!response.ok) throw new Error(`Falha ao baixar mídia (${response.status})`)
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error("Mídia recebida acima do limite de 10MB.")
  }

  const relativePath = relativeUploadPath(opts.companyId, opts.conversationId, opts.fileName, mimeType)
  const absolutePath = absoluteUploadPath(relativePath)
  await fs.mkdir(path.dirname(absolutePath), { recursive: true })
  await fs.writeFile(absolutePath, buffer)

  return {
    type: attachmentKindFromMime(mimeType),
    fileName: safeFileName(opts.fileName, mimeType),
    mimeType,
    size: buffer.byteLength,
    storagePath: relativePath,
    url: uploadUrlFromRelativePath(relativePath),
  }
}
