import { Router, Request, Response } from "express"
import { db } from "../db.js"

const router = Router()

router.get("/", async (req: Request, res: Response) => {
  const { companyId, status } = req.query
  if (!companyId || typeof companyId !== "string") {
    return res.status(400).json({ error: "companyId é obrigatório" })
  }

  const categories = await db.productCategory.findMany({
    where: {
      companyId,
      ...(status && typeof status === "string" ? { status: status as "ATIVO" | "INATIVO" } : {}),
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: true } } },
  })

  return res.json(categories.map(({ _count, ...category }) => ({
    ...category,
    productCount: _count.products,
  })))
})

router.post("/", async (req: Request, res: Response) => {
  const { companyId, name, description, status } = req.body ?? {}
  if (!companyId || !name?.trim()) {
    return res.status(400).json({ error: "companyId e name são obrigatórios" })
  }

  const category = await db.productCategory.create({
    data: {
      companyId,
      name: name.trim(),
      description: description?.trim() || null,
      status: status === "INATIVO" ? "INATIVO" : "ATIVO",
    },
  })
  return res.status(201).json(category)
})

router.patch("/:id", async (req: Request, res: Response) => {
  const id = String(req.params.id)
  const data: Record<string, unknown> = {}
  if (req.body?.name !== undefined) data.name = String(req.body.name).trim()
  if (req.body?.description !== undefined) data.description = req.body.description?.trim() || null
  if (req.body?.status !== undefined) data.status = req.body.status === "INATIVO" ? "INATIVO" : "ATIVO"
  if (Object.keys(data).length === 0) return res.status(400).json({ error: "Nenhum campo para atualizar" })

  const category = await db.productCategory.update({
    where: { id },
    data,
  })
  return res.json(category)
})

export default router
