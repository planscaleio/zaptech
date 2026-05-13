import { Router, Request, Response } from "express"
import { db } from "../db.js"

const router = Router()

function normalizeMoney(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback.toFixed(2)
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return fallback.toFixed(2)
  return n.toFixed(2)
}

router.get("/", async (req: Request, res: Response) => {
  const { companyId, q, status, categoryId } = req.query
  if (!companyId || typeof companyId !== "string") {
    return res.status(400).json({ error: "companyId é obrigatório" })
  }

  const where: Record<string, unknown> = { companyId }
  if (status && typeof status === "string") where.status = status
  if (categoryId && typeof categoryId === "string") where.categoryId = categoryId
  if (q && typeof q === "string" && q.trim()) {
    const term = q.trim()
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { sku: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
    ]
  }

  const products = await db.catalogProduct.findMany({
    where: where as any,
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: { category: { select: { id: true, name: true, status: true } } },
  })
  return res.json(products)
})

router.post("/", async (req: Request, res: Response) => {
  const { companyId, categoryId, name, sku, description, unit, price, status } = req.body ?? {}
  if (!companyId || !name?.trim()) {
    return res.status(400).json({ error: "companyId e name são obrigatórios" })
  }

  if (categoryId) {
    const category = await db.productCategory.findFirst({ where: { id: categoryId, companyId }, select: { id: true } })
    if (!category) return res.status(404).json({ error: "Categoria não encontrada" })
  }

  const product = await db.catalogProduct.create({
    data: {
      companyId,
      categoryId: categoryId || null,
      name: name.trim(),
      sku: sku?.trim() || null,
      description: description?.trim() || null,
      unit: unit?.trim() || "un",
      price: normalizeMoney(price),
      status: status === "INATIVO" ? "INATIVO" : "ATIVO",
    },
    include: { category: { select: { id: true, name: true, status: true } } },
  })
  return res.status(201).json(product)
})

router.patch("/:id", async (req: Request, res: Response) => {
  const id = String(req.params.id)
  const current = await db.catalogProduct.findUnique({
    where: { id },
    select: { companyId: true },
  })
  if (!current) return res.status(404).json({ error: "Produto não encontrado" })

  const data: Record<string, unknown> = {}
  if (req.body?.categoryId !== undefined) {
    if (req.body.categoryId) {
      const category = await db.productCategory.findFirst({
        where: { id: req.body.categoryId, companyId: current.companyId },
        select: { id: true },
      })
      if (!category) return res.status(404).json({ error: "Categoria não encontrada" })
      data.categoryId = req.body.categoryId
    } else {
      data.categoryId = null
    }
  }
  if (req.body?.name !== undefined) data.name = String(req.body.name).trim()
  if (req.body?.sku !== undefined) data.sku = req.body.sku?.trim() || null
  if (req.body?.description !== undefined) data.description = req.body.description?.trim() || null
  if (req.body?.unit !== undefined) data.unit = req.body.unit?.trim() || "un"
  if (req.body?.price !== undefined) data.price = normalizeMoney(req.body.price)
  if (req.body?.status !== undefined) data.status = req.body.status === "INATIVO" ? "INATIVO" : "ATIVO"
  if (Object.keys(data).length === 0) return res.status(400).json({ error: "Nenhum campo para atualizar" })

  const product = await db.catalogProduct.update({
    where: { id },
    data,
    include: { category: { select: { id: true, name: true, status: true } } },
  })
  return res.json(product)
})

export default router
