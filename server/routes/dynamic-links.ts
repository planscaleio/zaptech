import { Router, Request, Response } from "express"
import { db } from "../db.js"

const router = Router()
export const publicDynamicRedirectRouter = Router()

const STATUS_VALUES = ["ATIVO", "PAUSADO", "ARQUIVADO"] as const

function cleanPhone(value: unknown): string | null {
  if (typeof value !== "string") return null
  const digits = value.replace(/\D/g, "")
  return digits.length >= 10 ? digits : null
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function cleanSlugPart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8)
}

async function makeUniqueSlug(name: string, requested?: string | null) {
  const base = cleanSlugPart(requested || name) || `campanha-${randomSuffix()}`
  for (let i = 0; i < 8; i += 1) {
    const slug = i === 0 ? `${base}-${randomSuffix()}` : `${base}-${randomSuffix()}`
    const exists = await db.dynamicQrLink.findUnique({ where: { slug }, select: { id: true } })
    if (!exists) return slug
  }
  return `${base}-${Date.now().toString(36)}`
}

function getPublicBase(req: Request) {
  const configured = process.env.PUBLIC_APP_URL?.trim().replace(/\/+$/, "")
  if (configured) return configured
  const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0]?.trim() || req.protocol || "http"
  const host = req.headers["x-forwarded-host"] || req.headers.host
  return `${proto}://${host}`
}

function publicUrl(req: Request, slug: string) {
  return `${getPublicBase(req)}/r/${slug}`
}

function unavailable(res: Response, title: string, detail: string, status = 404) {
  return res.status(status).type("html").send(`<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; color: #0f172a; }
      main { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
      section { max-width: 440px; border: 1px solid #e2e8f0; background: white; border-radius: 12px; padding: 24px; box-shadow: 0 8px 28px rgba(15, 23, 42, .08); }
      h1 { margin: 0 0 8px; font-size: 20px; line-height: 1.25; }
      p { margin: 0; color: #475569; line-height: 1.55; }
    </style>
  </head>
  <body><main><section><h1>${title}</h1><p>${detail}</p></section></main></body>
</html>`)
}

function param(req: Request, key: string) {
  const value = req.params[key]
  return Array.isArray(value) ? value[0] : value
}

function withPublicUrl(req: Request, link: { slug: string }) {
  return { ...link, publicUrl: publicUrl(req, link.slug) }
}

// GET /dynamic-links/routing?companyId=
router.get("/routing", async (req: Request, res: Response) => {
  const { companyId } = req.query
  if (!companyId || typeof companyId !== "string") {
    return res.status(400).json({ error: "companyId é obrigatório" })
  }

  const routing = await db.companyWhatsAppRouting.findUnique({ where: { companyId } })
  return res.json(routing ?? {
    companyId,
    activePhone: null,
    backupPhones: [],
    defaultMessage: null,
    enabled: true,
  })
})

// PUT /dynamic-links/routing
router.put("/routing", async (req: Request, res: Response) => {
  const { companyId, activePhone, backupPhones, defaultMessage, enabled } = req.body ?? {}
  if (!companyId || typeof companyId !== "string") {
    return res.status(400).json({ error: "companyId é obrigatório" })
  }

  const phone = cleanPhone(activePhone)
  const backups = Array.isArray(backupPhones)
    ? Array.from(new Set(backupPhones.map(cleanPhone).filter(Boolean) as string[])).filter((p) => p !== phone)
    : []

  const routing = await db.companyWhatsAppRouting.upsert({
    where: { companyId },
    update: {
      activePhone: phone,
      backupPhones: backups,
      defaultMessage: cleanText(defaultMessage),
      enabled: enabled !== false,
    },
    create: {
      companyId,
      activePhone: phone,
      backupPhones: backups,
      defaultMessage: cleanText(defaultMessage),
      enabled: enabled !== false,
    },
  })
  return res.json(routing)
})

// GET /dynamic-links?companyId=
router.get("/", async (req: Request, res: Response) => {
  const { companyId } = req.query
  if (!companyId || typeof companyId !== "string") {
    return res.status(400).json({ error: "companyId é obrigatório" })
  }

  const links = await db.dynamicQrLink.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    include: {
      campaign: { select: { id: true, name: true } },
      clicks: {
        orderBy: { clickedAt: "desc" },
        take: 5,
        select: {
          id: true,
          clickedAt: true,
          destinationPhone: true,
          utmSource: true,
          utmMedium: true,
          utmCampaign: true,
          utmContent: true,
          referrer: true,
        },
      },
    },
  })

  return res.json(links.map((link) => withPublicUrl(req, link)))
})

// POST /dynamic-links
router.post("/", async (req: Request, res: Response) => {
  const {
    companyId, campaignId, name, slug, messageTemplate,
    utmSource, utmMedium, utmCampaign, utmContent,
  } = req.body ?? {}

  if (!companyId || typeof companyId !== "string" || !cleanText(name)) {
    return res.status(400).json({ error: "companyId e name são obrigatórios" })
  }

  const created = await db.dynamicQrLink.create({
    data: {
      companyId,
      campaignId: cleanText(campaignId),
      slug: await makeUniqueSlug(name, slug),
      name: name.trim(),
      messageTemplate: cleanText(messageTemplate),
      utmSource: cleanText(utmSource),
      utmMedium: cleanText(utmMedium),
      utmCampaign: cleanText(utmCampaign),
      utmContent: cleanText(utmContent),
    },
  })

  return res.status(201).json(withPublicUrl(req, created))
})

// PATCH /dynamic-links/:id
router.patch("/:id", async (req: Request, res: Response) => {
  const allowedStatus = STATUS_VALUES.includes(req.body?.status)
  const data: Record<string, unknown> = {}
  const stringFields = ["name", "campaignId", "messageTemplate", "utmSource", "utmMedium", "utmCampaign", "utmContent"]

  for (const field of stringFields) {
    if (req.body?.[field] !== undefined) {
      data[field] = field === "name" ? cleanText(req.body[field]) : cleanText(req.body[field])
    }
  }
  if (allowedStatus) data.status = req.body.status
  if (data.name === null) return res.status(400).json({ error: "name não pode ficar vazio" })
  if (Object.keys(data).length === 0) return res.status(400).json({ error: "Nenhum campo para atualizar" })

  const updated = await db.dynamicQrLink.update({
    where: { id: param(req, "id") },
    data,
  })
  return res.json(withPublicUrl(req, updated))
})

// PATCH /dynamic-links/:id/status
router.patch("/:id/status", async (req: Request, res: Response) => {
  const { status } = req.body ?? {}
  if (!STATUS_VALUES.includes(status)) return res.status(400).json({ error: "Status inválido" })

  const updated = await db.dynamicQrLink.update({
    where: { id: param(req, "id") },
    data: { status },
  })
  return res.json(withPublicUrl(req, updated))
})

// GET /dynamic-links/:id/metrics
router.get("/:id/metrics", async (req: Request, res: Response) => {
  const link = await db.dynamicQrLink.findUnique({
    where: { id: param(req, "id") },
    select: { id: true, clickCount: true, lastClickedAt: true },
  })
  if (!link) return res.status(404).json({ error: "Link não encontrado" })

  const [byUtm, byDestination, recent] = await Promise.all([
    db.dynamicQrClick.groupBy({
      by: ["utmSource", "utmMedium", "utmCampaign", "utmContent"],
      where: { linkId: link.id },
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take: 20,
    }),
    db.dynamicQrClick.groupBy({
      by: ["destinationPhone"],
      where: { linkId: link.id },
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
    }),
    db.dynamicQrClick.findMany({
      where: { linkId: link.id },
      orderBy: { clickedAt: "desc" },
      take: 20,
    }),
  ])

  return res.json({ link, byUtm, byDestination, recent })
})

publicDynamicRedirectRouter.get("/:slug", async (req: Request, res: Response) => {
  const link = await db.dynamicQrLink.findUnique({
    where: { slug: param(req, "slug") },
  })

  if (!link) return unavailable(res, "Campanha não encontrada", "Este QR code não está associado a uma campanha ativa.")
  if (link.status !== "ATIVO") return unavailable(res, "Campanha pausada", "Este QR code está temporariamente indisponível.", 410)

  const routing = await db.companyWhatsAppRouting.findUnique({ where: { companyId: link.companyId } })
  const activePhone = cleanPhone(routing?.activePhone)
  if (!routing?.enabled || !activePhone) {
    return unavailable(res, "WhatsApp indisponível", "A empresa ainda não configurou um número ativo para esta campanha.", 503)
  }

  const query = req.query
  const utmSource = cleanText(query.utm_source) ?? link.utmSource
  const utmMedium = cleanText(query.utm_medium) ?? link.utmMedium
  const utmCampaign = cleanText(query.utm_campaign) ?? link.utmCampaign
  const utmContent = cleanText(query.utm_content) ?? link.utmContent
  const message = cleanText(query.text) ?? link.messageTemplate ?? routing.defaultMessage ?? ""
  const referrer = cleanText(req.headers.referer) ?? cleanText(req.headers.referrer)

  await db.$transaction([
    db.dynamicQrClick.create({
      data: {
        linkId: link.id,
        companyId: link.companyId,
        destinationPhone: activePhone,
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        referrer,
      },
    }),
    db.dynamicQrLink.update({
      where: { id: link.id },
      data: { clickCount: { increment: 1 }, lastClickedAt: new Date() },
    }),
  ])

  const destination = new URL("https://api.whatsapp.com/send")
  destination.searchParams.set("phone", activePhone)
  if (message) destination.searchParams.set("text", message)

  return res.redirect(302, destination.toString())
})

export default router
