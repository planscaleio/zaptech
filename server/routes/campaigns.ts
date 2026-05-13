import { Router, Request, Response } from "express"
import { db } from "../db.js"

const router = Router()

const CAMPAIGN_TYPES = ["AQUISICAO", "RETENCAO", "ABM", "REATIVACAO", "UPSELL"] as const
const CAMPAIGN_STATUSES = ["ATIVA", "PLANEJADA", "PAUSADA", "CONCLUIDA", "CANCELADA"] as const

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function param(req: Request, key: string) {
  const value = req.params[key]
  return Array.isArray(value) ? value[0] : value
}

// GET /campaigns?companyId=
router.get("/", async (req: Request, res: Response) => {
  const { companyId } = req.query
  if (!companyId || typeof companyId !== "string") {
    return res.status(400).json({ error: "companyId é obrigatório" })
  }

  const campaigns = await db.campaign.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    include: {
      segment: { select: { id: true, name: true, _count: { select: { customers: true } } } },
      dynamicQrLinks: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          slug: true,
          name: true,
          status: true,
          clickCount: true,
          lastClickedAt: true,
          utmSource: true,
          utmMedium: true,
          utmCampaign: true,
          utmContent: true,
          createdAt: true,
        },
      },
    },
  })

  return res.json(campaigns)
})

// POST /campaigns
router.post("/", async (req: Request, res: Response) => {
  const { companyId, name, type, status, budget, segmentId } = req.body ?? {}
  const safeName = cleanText(name)
  if (!companyId || typeof companyId !== "string" || !safeName) {
    return res.status(400).json({ error: "companyId e name são obrigatórios" })
  }

  const safeType = CAMPAIGN_TYPES.includes(type) ? type : "AQUISICAO"
  const safeStatus = CAMPAIGN_STATUSES.includes(status) ? status : "PLANEJADA"

  const campaign = await db.campaign.create({
    data: {
      companyId,
      name: safeName,
      type: safeType,
      status: safeStatus,
      budget: budget != null && budget !== "" ? budget : null,
      segmentId: cleanText(segmentId),
    },
    include: {
      segment: { select: { id: true, name: true, _count: { select: { customers: true } } } },
      dynamicQrLinks: true,
    },
  })

  return res.status(201).json(campaign)
})

// PATCH /campaigns/:id
router.patch("/:id", async (req: Request, res: Response) => {
  const data: Record<string, unknown> = {}

  if (req.body?.name !== undefined) {
    const name = cleanText(req.body.name)
    if (!name) return res.status(400).json({ error: "name não pode ficar vazio" })
    data.name = name
  }
  if (CAMPAIGN_TYPES.includes(req.body?.type)) data.type = req.body.type
  if (CAMPAIGN_STATUSES.includes(req.body?.status)) data.status = req.body.status
  if (req.body?.budget !== undefined) data.budget = req.body.budget === "" ? null : req.body.budget
  if (req.body?.segmentId !== undefined) data.segmentId = cleanText(req.body.segmentId)

  if (Object.keys(data).length === 0) return res.status(400).json({ error: "Nenhum campo para atualizar" })

  const campaign = await db.campaign.update({
    where: { id: param(req, "id") },
    data,
    include: {
      segment: { select: { id: true, name: true, _count: { select: { customers: true } } } },
      dynamicQrLinks: true,
    },
  })

  return res.json(campaign)
})

export default router
