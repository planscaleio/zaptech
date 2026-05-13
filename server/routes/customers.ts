import { Router, Request, Response } from "express"
import { db } from "../db.js"

const router = Router()

// GET /customers?companyId=&q=&status=&stage=&isVip=
router.get("/", async (req: Request, res: Response) => {
  const { companyId, q, status, stage, isVip } = req.query
  if (!companyId || typeof companyId !== "string") {
    return res.status(400).json({ error: "companyId é obrigatório" })
  }

  const where: Record<string, unknown> = { companyId }
  if (status && typeof status === "string") where.status = status
  if (stage && typeof stage === "string") where.stage = stage
  if (isVip === "true") where.isVip = true
  if (isVip === "false") where.isVip = false
  if (q && typeof q === "string" && q.trim()) {
    const t = q.trim()
    where.OR = [
      { name: { contains: t, mode: "insensitive" } },
      { phone: { contains: t } },
      { email: { contains: t, mode: "insensitive" } },
      { companyName: { contains: t, mode: "insensitive" } },
    ]
  }

  const customers = await db.customer.findMany({
    where: where as any,
    orderBy: { lastContactAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      status: true,
      stage: true,
      source: true,
      lastContactAt: true,
      value: true,
      aiScore: true,
      aiSentiment: true,
      aiRisk: true,
      isVip: true,
      companyName: true,
      city: true,
      createdAt: true,
      tags: {
        select: { tag: { select: { id: true, name: true, color: true } } },
      },
      _count: { select: { conversations: true } },
    },
  })

  return res.json(customers.map(({ _count, tags, ...c }) => ({
    ...c,
    tags: tags.map((t) => t.tag),
    conversationCount: _count.conversations,
  })))
})

// POST /customers — create
router.post("/", async (req: Request, res: Response) => {
  const { companyId, name, phone, email, document, city, companyName, segment, stage, status, source, value } = req.body ?? {}
  if (!companyId || !name?.trim()) {
    return res.status(400).json({ error: "companyId e name são obrigatórios" })
  }
  const customer = await db.customer.create({
    data: {
      companyId,
      name: name.trim(),
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      document: document?.trim() || null,
      city: city?.trim() || null,
      companyName: companyName?.trim() || null,
      segment: segment?.trim() || null,
      stage: stage ?? "QUALIFICACAO",
      status: status ?? "EM_ANALISE",
      source: source || null,
      value: value != null && value !== "" ? value : null,
    },
    select: { id: true, name: true },
  })
  return res.status(201).json(customer)
})

// GET /customers/:id
router.get("/:id", async (req: Request, res: Response) => {
  const { id } = req.params

  const customer = await db.customer.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      document: true,
      city: true,
      companyName: true,
      segment: true,
      status: true,
      stage: true,
      source: true,
      value: true,
      lifetimeValue: true,
      lastContactAt: true,
      createdAt: true,
      aiScore: true,
      aiSentiment: true,
      aiRisk: true,
      aiNextBestAction: true,
      isVip: true,
      aiFindings: {
        select: { id: true, text: true },
      },
      tags: {
        select: { tag: { select: { id: true, name: true, color: true } } },
      },
      owner: {
        select: { id: true, name: true, role: true },
      },
      products: {
        select: { id: true, productName: true, status: true, price: true, description: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
      quotes: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          number: true,
          status: true,
          validUntil: true,
          total: true,
          sentAt: true,
          createdAt: true,
          conversation: { select: { id: true, channel: true } },
          generatedBy: { select: { id: true, name: true } },
          events: {
            orderBy: { createdAt: "desc" },
            take: 3,
            select: { id: true, type: true, authorName: true, message: true, createdAt: true },
          },
        },
      },
      attendants: {
        select: {
          role: true,
          description: true,
          user: { select: { id: true, name: true, role: true } },
        },
      },
      segmentLinks: {
        select: { segment: { select: { id: true, name: true } } },
      },
      kanbanCards: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          name: true,
          priority: true,
          score: true,
          value: true,
          expectedCloseAt: true,
          createdAt: true,
          column: {
            select: {
              id: true,
              name: true,
              board: { select: { id: true, name: true } },
            },
          },
        },
      },
      conversations: {
        orderBy: { lastMessageAt: "desc" },
        take: 5,
        select: {
          id: true,
          channel: true,
          status: true,
          preview: true,
          lastMessageAt: true,
          createdAt: true,
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { text: true, role: true, createdAt: true },
          },
        },
      },
      businessAccount: {
        select: { id: true, name: true, status: true, industry: true },
      },
    },
  })

  if (!customer) return res.status(404).json({ error: "Cliente não encontrado" })

  return res.json({
    ...customer,
    tags: customer.tags.map((t) => t.tag),
    segments: customer.segmentLinks.map((sl) => sl.segment),
  })
})

// PATCH /customers/:id — update profile fields
router.patch("/:id", async (req: Request, res: Response) => {
  const allowed = ["name", "phone", "email", "document", "city", "companyName", "segment", "stage", "status", "source", "value", "isVip"]
  const data: Record<string, unknown> = {}
  for (const key of allowed) {
    if (req.body?.[key] !== undefined) {
      const v = req.body[key]
      data[key] = v === "" ? null : v
    }
  }
  if (Object.keys(data).length === 0) return res.status(400).json({ error: "Nenhum campo para atualizar" })
  const customer = await db.customer.update({
    where: { id: req.params.id },
    data,
    select: { id: true, name: true, status: true, stage: true, isVip: true },
  })
  return res.json(customer)
})

// DELETE /customers/:id — soft delete
router.delete("/:id", async (req: Request, res: Response) => {
  await db.customer.update({
    where: { id: req.params.id },
    data: { status: "INATIVO" },
  })
  return res.json({ ok: true })
})

// PATCH /customers/:id/vip
router.patch("/:id/vip", async (req: Request, res: Response) => {
  const { isVip } = req.body ?? {}
  if (typeof isVip !== "boolean") {
    return res.status(400).json({ error: "isVip (boolean) é obrigatório" })
  }
  const customer = await db.customer.update({
    where: { id: req.params.id },
    data: { isVip },
    select: { id: true, isVip: true },
  })
  return res.json(customer)
})

// POST /customers/:id/products
router.post("/:id/products", async (req: Request, res: Response) => {
  const { productName, status, price, description } = req.body ?? {}
  if (!productName?.trim()) return res.status(400).json({ error: "productName é obrigatório" })
  const product = await db.customerProduct.create({
    data: {
      customerId: req.params.id,
      productName: productName.trim(),
      status: status ?? "ATIVO",
      price: price != null && price !== "" ? price : null,
      description: description?.trim() || null,
    },
    select: { id: true, productName: true, status: true, price: true, description: true, createdAt: true },
  })
  return res.status(201).json(product)
})

// DELETE /customers/:id/products/:productId
router.delete("/:id/products/:productId", async (req: Request, res: Response) => {
  await db.customerProduct.delete({ where: { id: req.params.productId } })
  return res.json({ ok: true })
})

// POST /customers/:id/analyze — AI analysis via Ollama
router.post("/:id/analyze", async (req: Request, res: Response) => {
  const { id } = req.params

  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      conversations: {
        orderBy: { lastMessageAt: "desc" },
        take: 3,
        include: { messages: { orderBy: { createdAt: "desc" }, take: 5 } },
      },
      products: true,
      kanbanCards: { include: { activities: { orderBy: { createdAt: "desc" }, take: 3 } } },
    },
  })
  if (!customer) return res.status(404).json({ error: "Cliente não encontrado" })

  const conversationSummary = customer.conversations.map((c) => {
    const msgs = c.messages.map((m) => `[${m.role}] ${m.text}`).join("\n")
    return `Canal: ${c.channel}, Status: ${c.status}\n${msgs}`
  }).join("\n---\n")

  const productSummary = customer.products.map((p) => `${p.productName} (${p.status}, R$${p.price ?? "—"})`).join(", ")

  const prompt = `Você é um analista de CRM especialista. Analise o perfil do cliente abaixo e retorne insights acionáveis.

Cliente: ${customer.name}
Empresa: ${customer.companyName ?? "—"}
Status: ${customer.status}
Etapa: ${customer.stage}
Valor: R$${customer.value ?? "—"}
Fonte: ${customer.source ?? "—"}
Produtos: ${productSummary || "nenhum"}

Conversas recentes:
${conversationSummary || "nenhuma"}

Retorne APENAS um JSON válido neste formato exato:
{
  "score": número de 0 a 100,
  "sentiment": "POSITIVO" | "NEUTRO" | "NEGATIVO",
  "risk": "BAIXO" | "MEDIO" | "ALTO" | "CRITICO",
  "nextBestAction": "recomendação em 1-2 frases",
  "findings": ["insight 1", "insight 2", "insight 3"]
}`

  const OLLAMA_BASE  = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"
  const OLLAMA_MODEL = process.env.OLLAMA_MODEL    ?? "gemma4:latest"

  try {
    const ollamaRes = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
    })
    if (!ollamaRes.ok) throw new Error("Ollama indisponível")
    const ollamaData = await ollamaRes.json() as { response: string }

    const raw = ollamaData.response.trim()
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error("Resposta inválida da IA")
    const parsed = JSON.parse(jsonMatch[0])

    // Persist findings and AI fields
    await db.$transaction([
      db.customerAIFinding.deleteMany({ where: { customerId: id } }),
      ...(Array.isArray(parsed.findings) ? parsed.findings.map((text: string) =>
        db.customerAIFinding.create({ data: { customerId: id, text } })
      ) : []),
      db.customer.update({
        where: { id },
        data: {
          aiScore: typeof parsed.score === "number" ? Math.min(100, Math.max(0, parsed.score)) : undefined,
          aiSentiment: parsed.sentiment ?? undefined,
          aiRisk: parsed.risk ?? undefined,
          aiNextBestAction: parsed.nextBestAction ?? undefined,
        },
      }),
    ])

    const updated = await db.customer.findUnique({
      where: { id },
      select: { aiScore: true, aiSentiment: true, aiRisk: true, aiNextBestAction: true, aiFindings: { select: { id: true, text: true } } },
    })
    return res.json(updated)
  } catch {
    return res.status(502).json({ error: "Não foi possível analisar. Verifique se o Ollama está ativo." })
  }
})

export default router
