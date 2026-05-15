import fs from "node:fs"
import path from "node:path"
import { Router, type Request, type Response } from "express"
import { db } from "../db.js"
import { absoluteUploadPath, uploadUrlFromRelativePath } from "../lib/media-storage.js"

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
    where: { OR: [{ url }, { storagePath: normalizedPath }] },
    select: { fileName: true, mimeType: true, storagePath: true },
  })

  const storagePath = attachment?.storagePath ?? normalizedPath
  const absolutePath = absoluteUploadPath(storagePath)

  let stat: fs.Stats
  try {
    stat = await fs.promises.stat(absolutePath)
  } catch {
    return res.status(404).json({ error: "Arquivo não encontrado" })
  }

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
