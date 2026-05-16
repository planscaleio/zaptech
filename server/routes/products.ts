import { Router, Request, Response } from "express"
import { parse } from "csv-parse/sync"
import { db } from "../db.js"

const router = Router()

function normalizeMoney(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback.toFixed(2)
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return fallback.toFixed(2)
  return n.toFixed(2)
}

// POST /products/import?companyId=
router.post("/import", async (req: Request, res: Response) => {
  const { companyId } = req.query
  const { csv, type } = req.body ?? {}
  if (!companyId || typeof companyId !== "string")
    return res.status(400).json({ error: "companyId é obrigatório" })
  if (!csv || typeof csv !== "string")
    return res.status(400).json({ error: "CSV é obrigatório" })
  if (type !== "products" && type !== "categories")
    return res.status(400).json({ error: "type deve ser 'products' ou 'categories'" })

  let records: Record<string, string>[]
  try {
    records = parse(csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      delimiter: ",",
    })
  } catch (err) {
    return res.status(400).json({ error: `CSV inválido: ${err instanceof Error ? err.message : String(err)}` })
  }

  if (records.length === 0)
    return res.json({ created: 0, updated: 0, errors: [] })

  const errors: string[] = []

  if (type === "categories") {
    let created = 0
    let updated = 0
    for (const row of records) {
      const name = (row.nome || row.name || "").trim()
      if (!name) { errors.push(`Linha sem nome: ${JSON.stringify(row)}`); continue }
      const description = (row.descricao || row.description || "").trim() || null
      const status = (row.status || "ATIVO").toUpperCase() === "INATIVO" ? "INATIVO" : "ATIVO"
      const result = await db.productCategory.upsert({
        where: { companyId_name: { companyId, name } },
        create: { companyId, name, description, status },
        update: { description, status },
      })
      if (result.createdAt.getTime() === result.updatedAt.getTime()) created++
      else updated++
    }
    return res.json({ created, updated, errors })
  }

  // type === "products"
  // 1. Auto-create categories from "categoria" column (upsert)
  const categoryNames = [...new Set(
    records.map((r) => (r.categoria || r.category || "").trim()).filter(Boolean)
  )]
  if (categoryNames.length > 0) {
    for (const name of categoryNames) {
      await db.productCategory.upsert({
        where: { companyId_name: { companyId, name } },
        create: { companyId, name, status: "ATIVO" },
        update: {},
      })
    }
  }
  const categoryMap = new Map(
    (await db.productCategory.findMany({
      where: { companyId, name: { in: categoryNames } },
      select: { id: true, name: true },
    })).map((c) => [c.name.toLowerCase(), c.id])
  )

  // 2. Determine next auto-SKU number
  const existingSkus = await db.catalogProduct.findMany({
    where: { companyId, sku: { startsWith: "PROD-" } },
    select: { sku: true },
    take: 1,
    orderBy: { sku: "desc" },
  })
  let autoSkuN = 0
  if (existingSkus.length > 0) {
    const match = existingSkus[0].sku?.match(/PROD-(\d+)/)
    if (match) autoSkuN = parseInt(match[1], 10)
  }

  // 3. Upsert products
  let created = 0
  let updated = 0
  for (const row of records) {
    const name = (row.nome || row.name || "").trim()
    if (!name) { errors.push(`Linha sem nome: ${JSON.stringify(row)}`); continue }
    const rawSku = (row.sku || "").trim()
    const catName = (row.categoria || row.category || "").trim()
    const categoryId = catName ? categoryMap.get(catName.toLowerCase()) ?? null : null
    const productData = {
      name,
      description: (row.descricao || row.description || "").trim() || null,
      unit: (row.unidade || row.unit || "un").trim() || "un",
      price: normalizeMoney(row.preco || row.price || 0),
      categoryId,
      status: (row.status || "ATIVO").toUpperCase() === "INATIVO" ? "INATIVO" : "ATIVO",
    }

    if (rawSku) {
      const result = await db.catalogProduct.upsert({
        where: { companyId_sku: { companyId, sku: rawSku } },
        create: { companyId, sku: rawSku, ...productData },
        update: productData,
      })
      if (result.createdAt.getTime() === result.updatedAt.getTime()) created++
      else updated++
    } else {
      const sku = `PROD-${String(++autoSkuN).padStart(3, "0")}`
      await db.catalogProduct.create({ data: { companyId, sku, ...productData } })
      created++
    }
  }
  return res.json({ created, updated, errors })
})

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