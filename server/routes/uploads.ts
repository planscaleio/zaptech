import fs from "node:fs"
import path from "node:path"
import { Router, type Request, type Response } from "express"
import { db } from "../db.js"
import { absoluteUploadPath, extensionForMime, uploadUrlFromRelativePath } from "../lib/media-storage.js"

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
      ],
    },
    select: { fileName: true, mimeType: true, storagePath: true, url: true },
  })

  const storagePath = attachment?.storagePath ?? normalizedPath
  const resolved = await resolveExistingFile(storagePath, attachment?.mimeType)
  if (!resolved) {
    return res.status(404).json({ error: "Arquivo não encontrado" })
  }
  const { absolutePath, stat } = resolved

  const mimeType = attachment?.mimeType ?? "application/octet-stream"
  const fileName = attachment?.fileName ?? path.basename(absolutePath)
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
