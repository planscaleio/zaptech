import { Router, Request, Response } from "express"
import { db } from "../db.js"

const router = Router()

type QuoteItemInput = {
  productId?: string | null
  quantity?: string | number | null
  unitPrice?: string | number | null
  discountType?: "VALOR" | "PERCENTUAL" | "" | null
  discountValue?: string | number | null
}

const STAGE_ORDER = ["PROSPECCAO", "QUALIFICACAO", "DEMONSTRACAO", "PROPOSTA", "NEGOCIACAO", "FECHADO", "POS_VENDA"]
const ACTIVE_STATUSES = ["RASCUNHO", "ENVIADO", "ACEITO", "RECUSADO", "EXPIRADO", "CANCELADO"] as const

function moneyNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function money(value: number) {
  return Math.max(0, value).toFixed(2)
}

function formatBRL(value: unknown) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value ?? 0))
}

function formatQuoteMessage(quote: Awaited<ReturnType<typeof loadQuoteForMessage>>, authorName: string) {
  if (!quote) return ""
  const lines = quote.items.map((item, index) => {
    const discount = Number(item.discountAmount) > 0 ? `, desconto ${formatBRL(item.discountAmount)}` : ""
    return `${index + 1}. ${item.productName} - ${Number(item.quantity)} ${item.unit} x ${formatBRL(item.unitPrice)}${discount} = ${formatBRL(item.total)}`
  })

  return [
    `Olá, ${quote.customer.name}. Segue o orçamento #${quote.number}:`,
    "",
    ...lines,
    "",
    `Subtotal: ${formatBRL(quote.subtotal)}`,
    `Descontos: ${formatBRL(quote.discountTotal)}`,
    `Frete: ${formatBRL(quote.freight)}`,
    `Total: ${formatBRL(quote.total)}`,
    `Validade: ${new Date(quote.validUntil).toLocaleDateString("pt-BR")}`,
    quote.notes ? `Observações: ${quote.notes}` : null,
    "",
    `Gerado por: ${authorName}`,
  ].filter(Boolean).join("\n")
}

async function loadQuoteForMessage(id: string) {
  return db.quote.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, phone: true, stage: true } },
      conversation: { select: { id: true, companyId: true, channel: true, customerId: true, customer: { select: { phone: true } } } },
      items: { orderBy: { createdAt: "asc" } },
    },
  })
}

async function buildItems(companyId: string, items: QuoteItemInput[]) {
  if (!Array.isArray(items) || items.length === 0) throw new Error("Inclua ao menos um produto no orçamento")

  const productIds = items.map((item) => item.productId).filter(Boolean) as string[]
  const products = await db.catalogProduct.findMany({
    where: { companyId, id: { in: productIds } },
    include: { category: { select: { name: true } } },
  })
  const byId = new Map(products.map((product) => [product.id, product]))

  return items.map((item) => {
    if (!item.productId) throw new Error("Produto é obrigatório em todos os itens")
    const product = byId.get(item.productId)
    if (!product) throw new Error("Produto não encontrado")
    if (product.status !== "ATIVO") throw new Error(`Produto inativo: ${product.name}`)

    const quantity = Math.max(0, moneyNumber(item.quantity, 1))
    if (quantity <= 0) throw new Error(`Quantidade inválida para ${product.name}`)
    const unitPrice = Math.max(0, moneyNumber(item.unitPrice, Number(product.price)))
    const subtotal = quantity * unitPrice
    const discountType = item.discountType === "PERCENTUAL" || item.discountType === "VALOR" ? item.discountType : null
    const discountValue = Math.max(0, moneyNumber(item.discountValue, 0))
    const rawDiscount = discountType === "PERCENTUAL" ? subtotal * Math.min(discountValue, 100) / 100 : discountValue
    const discountAmount = Math.min(subtotal, rawDiscount)
    const total = subtotal - discountAmount

    return {
      productId: product.id,
      productName: product.name,
      categoryName: product.category?.name ?? null,
      sku: product.sku,
      unit: product.unit,
      quantity: money(quantity),
      unitPrice: money(unitPrice),
      discountType,
      discountValue: discountType ? money(discountValue) : null,
      subtotal: money(subtotal),
      discountAmount: money(discountAmount),
      total: money(total),
    }
  })
}

function summarize(items: Awaited<ReturnType<typeof buildItems>>, freightInput: unknown) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.subtotal), 0)
  const discountTotal = items.reduce((sum, item) => sum + Number(item.discountAmount), 0)
  const freight = Math.max(0, moneyNumber(freightInput, 0))
  const total = Math.max(0, subtotal - discountTotal + freight)
  return {
    subtotal: money(subtotal),
    discountTotal: money(discountTotal),
    freight: money(freight),
    total: money(total),
  }
}

router.get("/", async (req: Request, res: Response) => {
  const { companyId, customerId, conversationId, status } = req.query
  if (!companyId || typeof companyId !== "string") {
    return res.status(400).json({ error: "companyId é obrigatório" })
  }
  const where: Record<string, unknown> = { companyId }
  if (customerId && typeof customerId === "string") where.customerId = customerId
  if (conversationId && typeof conversationId === "string") where.conversationId = conversationId
  if (status && typeof status === "string") where.status = status

  const quotes = await db.quote.findMany({
    where: where as any,
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { id: true, name: true, phone: true, email: true } },
      conversation: { select: { id: true, channel: true } },
      generatedBy: { select: { id: true, name: true } },
      items: { orderBy: { createdAt: "asc" } },
      events: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  })
  return res.json(quotes)
})

router.get("/:id", async (req: Request, res: Response) => {
  const id = String(req.params.id)
  const quote = await db.quote.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, phone: true, email: true, stage: true } },
      conversation: { select: { id: true, channel: true, preview: true } },
      generatedBy: { select: { id: true, name: true } },
      items: { orderBy: { createdAt: "asc" } },
      events: { orderBy: { createdAt: "desc" } },
    },
  })
  if (!quote) return res.status(404).json({ error: "Orçamento não encontrado" })
  return res.json(quote)
})

router.post("/", async (req: Request, res: Response) => {
  try {
    const { companyId, customerId, conversationId, generatedById, generatedByName, validUntil, notes, freight, items } = req.body ?? {}
    if (!companyId || !customerId || !validUntil) {
      return res.status(400).json({ error: "companyId, customerId e validUntil são obrigatórios" })
    }

    const customer = await db.customer.findFirst({ where: { id: customerId, companyId }, select: { id: true, name: true } })
    if (!customer) return res.status(404).json({ error: "Cliente não encontrado" })

    if (conversationId) {
      const conversation = await db.conversation.findFirst({ where: { id: conversationId, companyId, customerId }, select: { id: true } })
      if (!conversation) return res.status(404).json({ error: "Conversa não encontrada para este cliente" })
    }

    const quoteItems = await buildItems(companyId, items)
    const totals = summarize(quoteItems, freight)
    const last = await db.quote.findFirst({ where: { companyId }, orderBy: { number: "desc" }, select: { number: true } })
    const number = (last?.number ?? 0) + 1
    const authorName = generatedByName?.trim() || "Sistema"

    const quote = await db.quote.create({
      data: {
        companyId,
        customerId,
        conversationId: conversationId || null,
        generatedById: generatedById || null,
        number,
        validUntil: new Date(validUntil),
        notes: notes?.trim() || null,
        ...totals,
        items: { create: quoteItems },
        events: {
          create: {
            type: "CRIADO",
            authorId: generatedById || null,
            authorName,
            message: `Orçamento #${number} criado.`,
          },
        },
      },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        conversation: { select: { id: true, channel: true } },
        generatedBy: { select: { id: true, name: true } },
        items: { orderBy: { createdAt: "asc" } },
        events: { orderBy: { createdAt: "desc" } },
      },
    })
    return res.status(201).json(quote)
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

router.patch("/:id/status", async (req: Request, res: Response) => {
  const id = String(req.params.id)
  const { status, authorId, authorName } = req.body ?? {}
  if (!ACTIVE_STATUSES.includes(status)) return res.status(400).json({ error: "Status inválido" })
  const eventType = status === "RASCUNHO" ? "ATUALIZADO" : status

  const quote = await db.quote.update({
    where: { id },
    data: {
      status,
      events: {
        create: {
          type: eventType,
          authorId: authorId || null,
          authorName: authorName?.trim() || "Sistema",
          message: `Status alterado para ${status}.`,
        },
      },
    },
    include: { events: { orderBy: { createdAt: "desc" }, take: 5 } },
  })
  return res.json(quote)
})

router.post("/:id/send", async (req: Request, res: Response) => {
  const id = String(req.params.id)
  const { authorId, authorName } = req.body ?? {}
  const quote = await loadQuoteForMessage(id)
  if (!quote) return res.status(404).json({ error: "Orçamento não encontrado" })
  if (quote.items.length === 0) return res.status(422).json({ error: "Orçamento sem itens" })
  if (!quote.conversationId || !quote.conversation) return res.status(422).json({ error: "Orçamento sem conversa vinculada" })
  if (quote.conversation.channel === "EMAIL") return res.status(422).json({ error: "Envio por e-mail não faz parte deste ciclo" })

  const recipientPhone = quote.conversation.customer?.phone ?? quote.customer.phone
  if (!recipientPhone) return res.status(422).json({ error: "Cliente sem telefone cadastrado" })

  const connector = await db.connector.findFirst({
    where: { companyId: quote.companyId, type: "CANAL", status: "CONECTADO" },
    select: { name: true },
  })
  const instanceId = connector?.name ?? process.env.EVOLUTION_INSTANCE_NAME ?? "default"
  const safeAuthorName = authorName?.trim() || "Atendente"
  const body = formatQuoteMessage(quote, safeAuthorName)

  const customerStage = quote.customer.stage
  const shouldMoveToProposal = STAGE_ORDER.indexOf(customerStage) >= 0 && STAGE_ORDER.indexOf(customerStage) < STAGE_ORDER.indexOf("PROPOSTA")

  const updated = await db.$transaction(async (tx) => {
    const sent = await tx.quote.update({
      where: { id: quote.id },
      data: {
        status: "ENVIADO",
        sentAt: new Date(),
        events: {
          create: {
            type: "ENVIADO",
            authorId: authorId || null,
            authorName: safeAuthorName,
            message: `Orçamento #${quote.number} enviado pela conversa.`,
          },
        },
      },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        conversation: { select: { id: true, channel: true } },
        generatedBy: { select: { id: true, name: true } },
        items: { orderBy: { createdAt: "asc" } },
        events: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    })

    await tx.message.create({
      data: {
        conversationId: quote.conversationId!,
        authorName: "Sistema",
        role: "SISTEMA",
        text: `Orçamento #${quote.number} registrado para envio por ${safeAuthorName}. Total: ${formatBRL(quote.total)}.`,
        align: "left",
      },
    })
    await tx.conversation.update({
      where: { id: quote.conversationId! },
      data: { preview: `Orçamento #${quote.number} enviado - ${formatBRL(quote.total)}`, lastMessageAt: new Date(), status: "AGUARDANDO" },
    })
    await tx.outboundMessage.create({
      data: {
        companyId: quote.companyId,
        conversationId: quote.conversationId!,
        instanceId,
        recipientPhone,
        body,
        status: "QUEUED",
        createdByUserId: authorId || null,
        clientRequestId: `quote_${quote.id}_${Date.now()}`,
      },
    })
    if (shouldMoveToProposal) {
      await tx.customer.update({ where: { id: quote.customerId }, data: { stage: "PROPOSTA" } })
    }
    return sent
  })

  return res.json({ quote: updated, queued: true })
})

export default router
