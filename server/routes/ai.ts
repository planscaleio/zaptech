import { Router, Request, Response } from "express"
import { db } from "../db.js"

const router = Router()

const OLLAMA_BASE  = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"
const OLLAMA_MODEL = process.env.OLLAMA_MODEL    ?? "gemma4:latest"

type ToolId = "summary" | "next_action" | "policy" | "followup"

const TOOL_LABELS: Record<ToolId, string> = {
  summary:     "Resumo da conversa",
  next_action: "Próxima melhor ação",
  policy:      "Checagem de política",
  followup:    "Automação de follow-up",
}

const AI_UNAVAILABLE_RESPONSE = {
  code: "AI_UNAVAILABLE",
  error: "IA indisponível no momento. Tente novamente em instantes.",
}

function sendAiUnavailable(res: Response, err: unknown) {
  console.error("[ai] Ollama error:", err)
  return res.status(503).json(AI_UNAVAILABLE_RESPONSE)
}

// ─── Tag suggestion ────────────────────────────────────────────────────────────

// POST /ai/suggest-tags  { conversationId }
router.post("/suggest-tags", async (req: Request, res: Response) => {
  const { conversationId } = req.body ?? {}
  if (!conversationId) return res.status(400).json({ error: "conversationId é obrigatório" })

  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      companyId: true,
      customer: { select: { name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: { role: true, authorName: true, text: true },
      },
      tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
    },
  })

  if (!conversation) return res.status(404).json({ error: "Conversa não encontrada" })
  if (conversation.messages.length === 0) {
    return res.status(422).json({ error: "Conversa sem mensagens para analisar" })
  }

  // Busca tags existentes da empresa
  const existingTags = await db.tag.findMany({
    where: { companyId: conversation.companyId },
    select: { id: true, name: true, color: true },
  })

  const transcript = conversation.messages
    .map((m) => `[${m.role}] ${m.authorName}: ${m.text}`)
    .join("\n")

  const existingList = existingTags.length > 0
    ? `\nTags já cadastradas no CRM (reutilize sempre que se aplicar): ${existingTags.map((t) => t.name).join(", ")}`
    : ""

  const prompt = `Você é um analista de CRM especializado em vendas B2B. Sua tarefa é classificar esta conversa com tags estratégicas para segmentação e acompanhamento comercial.${existingList}

Cliente: ${conversation.customer?.name ?? "Cliente sem nome"}
Transcrição da conversa:
${transcript}

CRITÉRIOS para uma boa tag de CRM:
1. Representa uma CATEGORIA de negócio ou comportamento recorrente (ex: "lead-quente", "interessado-em-plano-pro", "objecao-preco")
2. Ajuda a FILTRAR e SEGMENTAR leads para ações comerciais futuras
3. É REUTILIZÁVEL em outras conversas do mesmo tipo
4. NÃO é um detalhe pontual da conversa (evite datas, nomes específicos, eventos únicos)

Tags RUINS (não criar): datas específicas, nomes de pessoas, eventos únicos, detalhes operacionais passageiros
Tags BOAS: intenção de compra, segmento do cliente, tipo de produto/serviço de interesse, momento do funil, objeções recorrentes, canal de origem, urgência

Responda APENAS com JSON válido, sem markdown. Sugira entre 2 e 4 tags — menos é mais. Só crie tags novas se nenhuma existente servir.

{"tags": [{"name": "nome-em-kebab-case-sem-acentos", "reason": "por que esta tag classifica este lead (1 frase)", "isNew": true_ou_false}]}`

  let raw: string
  try {
    raw = await callOllama(prompt)
  } catch (err) {
    return sendAiUnavailable(res, err)
  }

  // Extrai JSON mesmo se vier com texto ao redor
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return res.status(502).json({ error: "Resposta inesperada da IA", raw })

  let parsed: { tags: { name: string; reason: string; isNew: boolean }[] }
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    return res.status(502).json({ error: "JSON inválido da IA", raw })
  }

  // Enriquece cada sugestão com id se a tag já existe
  const suggestions = (parsed.tags ?? []).map((s) => {
    const existing = existingTags.find((t) => t.name.toLowerCase() === s.name.toLowerCase())
    return {
      name: s.name.toLowerCase().replace(/\s+/g, "-"),
      reason: s.reason,
      isNew: !existing,
      existingId: existing?.id ?? null,
      color: existing?.color ?? "#6366f1",
    }
  })

  return res.json({
    suggestions,
    appliedTags: conversation.tags.map((t) => t.tag),
    existingTags,
  })
})

// POST /ai/apply-tag  { conversationId, tagName, tagId? }
router.post("/apply-tag", async (req: Request, res: Response) => {
  const { conversationId, tagName, tagId } = req.body ?? {}
  if (!conversationId || !tagName) {
    return res.status(400).json({ error: "conversationId e tagName são obrigatórios" })
  }

  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, companyId: true },
  })
  if (!conversation) return res.status(404).json({ error: "Conversa não encontrada" })

  // Reutiliza tag existente pelo id ou pelo nome, ou cria
  let tag = tagId
    ? await db.tag.findUnique({ where: { id: tagId } })
    : await db.tag.findUnique({ where: { companyId_name: { companyId: conversation.companyId, name: tagName } } })

  if (!tag) {
    tag = await db.tag.create({
      data: { companyId: conversation.companyId, name: tagName.toLowerCase().replace(/\s+/g, "-") },
    })
  }

  // Upsert do link (ignora se já aplicada)
  await db.conversationTagLink.upsert({
    where: { conversationId_tagId: { conversationId, tagId: tag.id } },
    create: { conversationId, tagId: tag.id },
    update: {},
  })

  return res.json({ tag })
})

// POST /ai/remove-tag  { conversationId, tagId }
router.post("/remove-tag", async (req: Request, res: Response) => {
  const { conversationId, tagId } = req.body ?? {}
  if (!conversationId || !tagId) {
    return res.status(400).json({ error: "conversationId e tagId são obrigatórios" })
  }

  await db.conversationTagLink.deleteMany({ where: { conversationId, tagId } })
  return res.json({ ok: true })
})

function buildPrompt(tool: ToolId, customerName: string, transcript: string): string {
  const base = `Você é um assistente especialista em vendas consultivas B2B. Responda em português do Brasil, de forma objetiva e estruturada.

Cliente: ${customerName}
Transcrição da conversa:
${transcript}

`
  const instructions: Record<ToolId, string> = {
    summary: `${base}Faça um resumo executivo desta conversa em até 5 bullet points. Destaque: intenção do cliente, principais dúvidas, objeções levantadas e o estado atual da negociação.`,

    next_action: `${base}Com base nesta conversa, qual é a próxima melhor ação para o atendente realizar? Responda em formato:
**Ação recomendada:** (1 frase direta)
**Motivo:** (1-2 frases)
**Como executar:** (2-3 passos práticos)`,

    policy: `${base}Analise esta conversa e verifique se há alguma violação das boas práticas de atendimento ou políticas comerciais. Avalie:
1. Tom e linguagem (profissional?)
2. Promessas ou compromissos inadequados
3. Informações incorretas ou enganosas
4. Oportunidades perdidas de qualificação
Seja direto: se estiver tudo certo, diga isso.`,

    followup: `${base}Crie um plano de follow-up para este cliente. Inclua:
**Timing:** quando fazer o próximo contato
**Canal:** WhatsApp, e-mail ou ligação
**Mensagem sugerida:** texto pronto para enviar
**Objetivo do contato:** o que queremos avançar`,
  }

  return instructions[tool]
}

async function callOllama(prompt: string): Promise<string> {
  const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false }),
  })
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`)
  const data = await res.json() as { response: string }
  return data.response.trim()
}

// POST /ai/tool  { conversationId, tool, instruction? }
router.post("/tool", async (req: Request, res: Response) => {
  const { conversationId, tool, instruction } = req.body ?? {}

  if (!conversationId || !tool) {
    return res.status(400).json({ error: "conversationId e tool são obrigatórios" })
  }
  if (!["summary", "next_action", "policy", "followup"].includes(tool)) {
    return res.status(400).json({ error: "tool inválida" })
  }

  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      customer: { select: { id: true, name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: { role: true, authorName: true, text: true, createdAt: true },
      },
    },
  })

  if (!conversation) return res.status(404).json({ error: "Conversa não encontrada" })
  if (conversation.messages.length === 0) {
    return res.status(422).json({ error: "Conversa sem mensagens para analisar" })
  }

  const transcript = conversation.messages
    .map((m) => `[${m.role}] ${m.authorName}: ${m.text}`)
    .join("\n")

  let prompt = buildPrompt(tool as ToolId, conversation.customer?.name ?? "Cliente sem nome", transcript)
  if (instruction?.trim()) {
    prompt += `\n\nInstrução adicional do vendedor: ${instruction.trim()}`
  }

  let result: string
  try {
    result = await callOllama(prompt)
  } catch (err) {
    return sendAiUnavailable(res, err)
  }

  const conv = await db.conversation.findUnique({ where: { id: conversationId }, select: { companyId: true } })

  // Persist in AIAudit + AIAuditFinding
  const audit = await db.aIAudit.create({
    data: {
      conversationId,
      companyId: conv!.companyId,
      conversationName: TOOL_LABELS[tool as ToolId], // repurpose as tool label
      recommendation: result,
      findings: {
        create: result
          .split("\n")
          .filter((l) => l.trim().length > 0)
          .slice(0, 10)
          .map((text) => ({ text: text.trim() })),
      },
    },
    select: { id: true, conversationName: true, recommendation: true, createdAt: true },
  })

  return res.json({
    result,
    auditId: audit.id,
    tool: audit.conversationName,
    createdAt: audit.createdAt,
  })
})

// GET /ai/history/:conversationId
router.get("/history/:conversationId", async (req: Request, res: Response) => {
  const audits = await db.aIAudit.findMany({
    where: { conversationId: req.params.conversationId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      conversationName: true,  // used as tool label
      recommendation: true,    // used as result
      createdAt: true,
    },
  })
  return res.json(audits.map((a) => ({
    id: a.id,
    tool: a.conversationName,
    result: a.recommendation,
    createdAt: a.createdAt,
  })))
})

// POST /ai/broadcast-variations  { context, segmentName, count? }
// Generates 1–3 WhatsApp message variations for a broadcast using Ollama
router.post("/broadcast-variations", async (req: Request, res: Response) => {
  const { context, segmentName, count = 3 } = req.body ?? {}
  if (!context?.trim()) return res.status(400).json({ error: "context é obrigatório" })

  const n = Math.min(Math.max(Number(count), 1), 3)

  const prompt = `Você é especialista em marketing conversacional via WhatsApp.

Crie ${n} variação(ões) de mensagem para uma transmissão em massa com as seguintes características:
- Segmento de destino: ${segmentName ?? "clientes"}
- Contexto / objetivo: ${context.trim()}

Regras obrigatórias:
- Cada mensagem deve ser curta (máximo 3 frases), natural e pessoal — como se fosse enviada por uma pessoa real
- NÃO use emojis em excesso (no máximo 1 por mensagem)
- Evite linguagem de propaganda ou termos como "oferta imperdível", "aproveite já"
- Cada variação deve ter um ângulo diferente: ex. curiosidade, benefício direto, pergunta aberta
- Escreva APENAS as mensagens, sem títulos, sem numeração, sem explicações

Formato de resposta (siga exatamente):
VARIACAO_A: [texto da mensagem]
VARIACAO_B: [texto da mensagem]${n >= 3 ? "\nVARIACAO_C: [texto da mensagem]" : ""}`

  try {
    const raw = await callOllama(prompt)

    const extract = (key: string) => {
      const match = raw.match(new RegExp(`${key}:\\s*(.+?)(?=VARIACAO_[BC]:|$)`, "s"))
      return match?.[1]?.trim().replace(/^["']|["']$/g, "") ?? null
    }

    const variations: string[] = []
    const a = extract("VARIACAO_A"); if (a) variations.push(a)
    const b = extract("VARIACAO_B"); if (b) variations.push(b)
    const c = extract("VARIACAO_C"); if (c && n >= 3) variations.push(c)

    if (variations.length === 0) return res.status(502).json({ code: "AI_INVALID_RESPONSE", error: "IA não retornou variações válidas" })

    return res.json({ variations })
  } catch (err) {
    return sendAiUnavailable(res, err)
  }
})

export default router
