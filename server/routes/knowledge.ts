import { Router, Request, Response } from "express"
import { db } from "../db.js"

const router = Router()

const STATUSES = ["RASCUNHO", "PUBLICADO", "ARQUIVADO"] as const
const CHANNELS = ["WHATSAPP", "INSTAGRAM", "SITE", "EMAIL", "TELEFONE", "WEBHOOK"] as const

const ARTICLE_INCLUDE = {
  createdBy: { select: { id: true, name: true } },
  parent: { select: { id: true, title: true } },
  publishedVersion: {
    select: { id: true, version: true, status: true, content: true, publishedAt: true, createdAt: true, updatedAt: true },
  },
  draftVersion: {
    select: { id: true, version: true, status: true, content: true, createdAt: true, updatedAt: true },
  },
  versions: {
    orderBy: { version: "desc" as const },
    select: { id: true, version: true, status: true, publishedAt: true, createdAt: true, updatedAt: true },
  },
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function param(req: Request, key: string) {
  const value = req.params[key]
  return Array.isArray(value) ? value[0] : value
}

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
  }
  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean)
  }
  return []
}

function normalizeChannels(value: unknown): string[] {
  const requested = normalizeStringList(value)
  if (requested.includes("ALL")) return []
  return requested.filter((channel) => CHANNELS.includes(channel as typeof CHANNELS[number]))
}

function safeStatus(value: unknown, fallback: typeof STATUSES[number]) {
  return STATUSES.includes(value as typeof STATUSES[number]) ? value as typeof STATUSES[number] : fallback
}

function parseJsonList(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []
  } catch {
    return []
  }
}

function serializeArticle(article: any, preferPublished = false) {
  const content = preferPublished
    ? article.publishedVersion?.content ?? article.content
    : article.draftVersion?.content ?? article.publishedVersion?.content ?? article.content

  return {
    ...article,
    content,
    tags: parseJsonList(article.tags),
    channels: parseJsonList(article.channels),
    publishedVersion: article.publishedVersion,
    draftVersion: preferPublished ? null : article.draftVersion,
    versions: preferPublished ? article.versions.filter((version: { status: string }) => version.status === "PUBLICADO") : article.versions,
  }
}

async function validateParent(parentId: string | null, companyId: string, articleId?: string) {
  if (!parentId) return null

  let current = await db.knowledgeArticle.findUnique({
    where: { id: parentId },
    select: { id: true, parentId: true, companyId: true },
  })

  if (!current || current.companyId !== companyId) {
    return "Procedimento pai inválido para esta empresa"
  }

  while (current) {
    if (articleId && current.id === articleId) {
      return "A hierarquia não pode criar um ciclo entre procedimentos"
    }
    if (!current.parentId) break
    current = await db.knowledgeArticle.findUnique({
      where: { id: current.parentId },
      select: { id: true, parentId: true, companyId: true },
    })
  }

  return null
}

// GET /knowledge?companyId=&q=&channel=&category=&status=
router.get("/", async (req: Request, res: Response) => {
  const { companyId, q, channel, category, status, parentId } = req.query
  if (!companyId || typeof companyId !== "string") {
    return res.status(400).json({ error: "companyId é obrigatório" })
  }

  const where: Record<string, unknown> = { companyId }
  if (typeof status === "string" && STATUSES.includes(status as typeof STATUSES[number])) {
    where.status = status
  }
  if (typeof category === "string" && category.trim()) {
    where.category = { equals: category.trim(), mode: "insensitive" }
  }
  if (typeof parentId === "string") {
    where.parentId = parentId.trim() || null
  }
  if (typeof q === "string" && q.trim()) {
    const term = q.trim()
    const searchPublishedOnly = status === "PUBLICADO"
    where.OR = [
      { title: { contains: term, mode: "insensitive" } },
      { category: { contains: term, mode: "insensitive" } },
      { tags: { contains: term, mode: "insensitive" } },
      searchPublishedOnly
        ? { publishedVersion: { content: { contains: term, mode: "insensitive" } } }
        : { content: { contains: term, mode: "insensitive" } },
      ...(searchPublishedOnly ? [] : [{ versions: { some: { content: { contains: term, mode: "insensitive" } } } }]),
    ]
  }

  const articles = await db.knowledgeArticle.findMany({
    where: where as any,
    orderBy: [{ title: "asc" }],
    take: 300,
    include: ARTICLE_INCLUDE,
  })

  const channelFilter = typeof channel === "string" && channel !== "ALL" ? channel : null
  const filtered = channelFilter
    ? articles.filter((article) => {
      const articleChannels = parseJsonList(article.channels)
      return articleChannels.length === 0 || articleChannels.includes(channelFilter)
    })
    : articles

  return res.json(filtered.map((article) => serializeArticle(article, status === "PUBLICADO")))
})

// POST /knowledge
router.post("/", async (req: Request, res: Response) => {
  const { companyId, parentId, title, category, content, tags, channels, status, createdById } = req.body ?? {}
  const safeTitle = cleanText(title)
  const safeContent = cleanText(content)
  if (!companyId || typeof companyId !== "string" || !safeTitle || !safeContent) {
    return res.status(400).json({ error: "companyId, title e content são obrigatórios" })
  }

  const safeArticleStatus = safeStatus(status, "RASCUNHO")
  const versionStatus = safeArticleStatus === "PUBLICADO" ? "PUBLICADO" : "RASCUNHO"
  const safeParentId = cleanText(parentId)
  const parentError = await validateParent(safeParentId, companyId)
  if (parentError) return res.status(400).json({ error: parentError })

  const article = await db.$transaction(async (tx) => {
    const created = await tx.knowledgeArticle.create({
      data: {
        companyId,
        parentId: safeParentId,
        title: safeTitle,
        category: cleanText(category) ?? "Geral",
        content: safeContent,
        tags: JSON.stringify(normalizeStringList(tags)),
        channels: JSON.stringify(normalizeChannels(channels)),
        status: safeArticleStatus,
        createdById: cleanText(createdById),
      },
    })

    const version = await tx.knowledgeArticleVersion.create({
      data: {
        articleId: created.id,
        createdById: cleanText(createdById),
        version: 1,
        status: versionStatus,
        content: safeContent,
        publishedAt: versionStatus === "PUBLICADO" ? new Date() : null,
      },
    })

    return tx.knowledgeArticle.update({
      where: { id: created.id },
      data: versionStatus === "PUBLICADO"
        ? { publishedVersionId: version.id, draftVersionId: null }
        : { draftVersionId: version.id },
      include: ARTICLE_INCLUDE,
    })
  })

  return res.status(201).json(serializeArticle(article))
})

// PATCH /knowledge/:id
router.patch("/:id", async (req: Request, res: Response) => {
  const id = param(req, "id")
  const existing = await db.knowledgeArticle.findUnique({
    where: { id },
    include: {
      publishedVersion: true,
      draftVersion: true,
      versions: { orderBy: { version: "desc" }, take: 1 },
    },
  })
  if (!existing) return res.status(404).json({ error: "Procedimento não encontrado" })

  const requestedStatus = req.body?.status !== undefined ? safeStatus(req.body.status, existing.status) : existing.status
  const nextContent = cleanText(req.body?.content) ?? existing.draftVersion?.content ?? existing.publishedVersion?.content ?? existing.content

  if (req.body?.title !== undefined && cleanText(req.body.title) === null) {
    return res.status(400).json({ error: "title não pode ficar vazio" })
  }
  if (req.body?.content !== undefined && cleanText(req.body.content) === null) {
    return res.status(400).json({ error: "content não pode ficar vazio" })
  }
  const nextParentId = req.body?.parentId !== undefined ? cleanText(req.body.parentId) : undefined
  if (nextParentId === id) {
    return res.status(400).json({ error: "Um procedimento não pode ser pai dele mesmo" })
  }
  if (nextParentId !== undefined) {
    const parentError = await validateParent(nextParentId, existing.companyId, id)
    if (parentError) return res.status(400).json({ error: parentError })
  }

  const article = await db.$transaction(async (tx) => {
    const articleData: Record<string, unknown> = {}
    if (req.body?.title !== undefined) articleData.title = cleanText(req.body.title)
    if (req.body?.category !== undefined) articleData.category = cleanText(req.body.category) ?? "Geral"
    if (req.body?.parentId !== undefined) articleData.parentId = nextParentId
    if (req.body?.tags !== undefined) articleData.tags = JSON.stringify(normalizeStringList(req.body.tags))
    if (req.body?.channels !== undefined) articleData.channels = JSON.stringify(normalizeChannels(req.body.channels))

    if (requestedStatus === "ARQUIVADO") {
      articleData.status = "ARQUIVADO"
      await tx.knowledgeArticle.update({ where: { id }, data: articleData })
      return tx.knowledgeArticle.findUniqueOrThrow({ where: { id }, include: ARTICLE_INCLUDE })
    }

    if (requestedStatus === "PUBLICADO") {
      const nextVersion = (existing.versions[0]?.version ?? 0) + 1
      const version = await tx.knowledgeArticleVersion.create({
        data: {
          articleId: id,
          createdById: cleanText(req.body?.createdById),
          version: nextVersion,
          status: "PUBLICADO",
          content: nextContent,
          publishedAt: new Date(),
        },
      })
      articleData.status = "PUBLICADO"
      articleData.content = nextContent
      articleData.publishedVersionId = version.id
      articleData.draftVersionId = null
      await tx.knowledgeArticle.update({ where: { id }, data: articleData })
      return tx.knowledgeArticle.findUniqueOrThrow({ where: { id }, include: ARTICLE_INCLUDE })
    }

    if (req.body?.content !== undefined) {
      if (existing.draftVersionId) {
        await tx.knowledgeArticleVersion.update({
          where: { id: existing.draftVersionId },
          data: { content: nextContent, createdById: cleanText(req.body?.createdById) },
        })
        articleData.draftVersionId = existing.draftVersionId
      } else {
        const nextVersion = (existing.versions[0]?.version ?? 0) + 1
        const draft = await tx.knowledgeArticleVersion.create({
          data: {
            articleId: id,
            createdById: cleanText(req.body?.createdById),
            version: nextVersion,
            status: "RASCUNHO",
            content: nextContent,
          },
        })
        articleData.draftVersionId = draft.id
      }
      articleData.content = nextContent
    }

    articleData.status = existing.publishedVersionId ? "PUBLICADO" : "RASCUNHO"
    await tx.knowledgeArticle.update({ where: { id }, data: articleData })
    return tx.knowledgeArticle.findUniqueOrThrow({ where: { id }, include: ARTICLE_INCLUDE })
  })

  return res.json(serializeArticle(article))
})

// DELETE /knowledge/:id — archive article identity and hide it from service use
router.delete("/:id", async (req: Request, res: Response) => {
  const article = await db.knowledgeArticle.update({
    where: { id: param(req, "id") },
    data: { status: "ARQUIVADO" },
    include: ARTICLE_INCLUDE,
  })
  return res.json(serializeArticle(article))
})

export default router
