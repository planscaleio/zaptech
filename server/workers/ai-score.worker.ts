/**
 * ai-score.worker
 *
 * Runs AI analysis (Ollama) for customers that haven't been analysed yet
 * or whose aiScore is stale (last analysis > staleDays ago, default 7).
 *
 * To avoid hammering Ollama, processes customers sequentially with a small
 * delay between requests (configurable via WORKER_AI_DELAY_MS env var).
 *
 * Trigger: cron (daily at 03:00) | manual | event:customer.created
 */

import { db } from "../db.js"
import { runWorker, withRetry, type WorkerContext } from "./runner.js"

const OLLAMA_BASE  = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"
const OLLAMA_MODEL = process.env.OLLAMA_MODEL    ?? "gemma4:latest"
const DELAY_MS     = Number(process.env.WORKER_AI_DELAY_MS ?? 200)
const STALE_DAYS   = 7

interface AiScoreContext extends WorkerContext {
  customerId?: string  // if set, only analyses this customer
  force?: boolean      // re-analyse even if recent
}

async function analyseCustomer(customerId: string) {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
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
  if (!customer) throw new Error("Cliente não encontrado")

  const convSummary = customer.conversations.map((c) =>
    `Canal: ${c.channel}, Status: ${c.status}\n${c.messages.map((m) => `[${m.role}] ${m.text}`).join("\n")}`
  ).join("\n---\n")

  const productSummary = customer.products
    .map((p) => `${p.productName} (${p.status}, R$${p.price ?? "—"})`)
    .join(", ")

  const prompt = `Você é um analista de CRM. Analise o perfil do cliente abaixo e retorne insights acionáveis.

Cliente: ${customer.name}
Empresa: ${customer.companyName ?? "—"}
Status: ${customer.status} | Etapa: ${customer.stage}
Valor: R$${customer.value ?? "—"} | Fonte: ${customer.source ?? "—"}
Produtos: ${productSummary || "nenhum"}

Conversas recentes:
${convSummary || "nenhuma"}

Retorne APENAS JSON válido:
{
  "score": 0-100,
  "sentiment": "POSITIVO"|"NEUTRO"|"NEGATIVO",
  "risk": "BAIXO"|"MEDIO"|"ALTO"|"CRITICO",
  "nextBestAction": "1-2 frases",
  "findings": ["insight 1", "insight 2", "insight 3"]
}`

  const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
  })
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`)
  const data = await res.json() as { response: string }

  const jsonMatch = data.response.trim().match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("Resposta inválida da IA")
  const parsed = JSON.parse(jsonMatch[0])

  await db.$transaction([
    db.customerAIFinding.deleteMany({ where: { customerId } }),
    ...(Array.isArray(parsed.findings) ? parsed.findings.map((text: string) =>
      db.customerAIFinding.create({ data: { customerId, text } })
    ) : []),
    db.customer.update({
      where: { id: customerId },
      data: {
        aiScore:          typeof parsed.score === "number" ? Math.min(100, Math.max(0, parsed.score)) : undefined,
        aiSentiment:      parsed.sentiment   ?? undefined,
        aiRisk:           parsed.risk        ?? undefined,
        aiNextBestAction: parsed.nextBestAction ?? undefined,
      },
    }),
  ])

  return parsed
}

export async function runAiScore(trigger: "cron" | "manual" | `event:${string}` = "cron", ctx: AiScoreContext = {}) {
  return runWorker("ai-score", trigger, ctx, async (handle) => {
    let customers: { id: string; name: string }[]

    if (ctx.customerId) {
      const c = await db.customer.findUnique({ where: { id: ctx.customerId }, select: { id: true, name: true } })
      customers = c ? [c] : []
    } else {
      const staleThreshold = new Date(Date.now() - STALE_DAYS * 86400000)
      const where: any = {
        ...(ctx.companyId ? { companyId: ctx.companyId } : {}),
        ...(ctx.force ? {} : {
          OR: [
            { aiScore: null },
            { updatedAt: { lt: staleThreshold } },
          ],
        }),
      }
      customers = await db.customer.findMany({ where, select: { id: true, name: true }, take: 100 })
    }

    await handle.log("info", `Analisando ${customers.length} cliente(s) via IA`)

    let processed = 0
    let failed = 0

    for (const customer of customers) {
      try {
        await withRetry(() => analyseCustomer(customer.id), 2, 1000)
        await handle.log("info", `"${customer.name}" analisado com sucesso`, { itemId: customer.id })
        processed++
      } catch (err) {
        failed++
        await handle.log("error", `Falha ao analisar "${customer.name}": ${err instanceof Error ? err.message : String(err)}`, {
          itemId: customer.id,
        })
      }

      if (DELAY_MS > 0) await new Promise((r) => setTimeout(r, DELAY_MS))
    }

    await handle.finish({ total: customers.length, processed, failed })
  })
}
