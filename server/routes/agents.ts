import { Router, type Request, type Response } from "express"
import { db } from "../db.js"

const router = Router()

const OLLAMA_BASE  = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"
const OLLAMA_MODEL = process.env.OLLAMA_MODEL    ?? "gemma4:latest"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentConfig {
  objetivo:          string
  instrucoesDiretas: string
  formatoResposta:   string
  tomDeVoz:          string
  restricoes:        string
  mensagemInicial:   string
  contexto:          string   // background / knowledge context
}

const DEFAULT_CONFIG: AgentConfig = {
  objetivo:          "",
  instrucoesDiretas: "",
  formatoResposta:   "",
  tomDeVoz:          "",
  restricoes:        "",
  mensagemInicial:   "",
  contexto:          "",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function assembleSystemPrompt(config: Partial<AgentConfig>): string {
  const sections: [string, string][] = [
    ["OBJETIVO",            config.objetivo          ?? ""],
    ["CONTEXTO",            config.contexto          ?? ""],
    ["INSTRUÇÕES",          config.instrucoesDiretas ?? ""],
    ["FORMATO DE RESPOSTA", config.formatoResposta   ?? ""],
    ["TOM DE VOZ",          config.tomDeVoz          ?? ""],
    ["RESTRIÇÕES",          config.restricoes        ?? ""],
  ]
  return sections
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `# ${k}\n${v.trim()}`)
    .join("\n\n")
}

async function callOllamaChat(
  model: string,
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  temperatura: number,
): Promise<string> {
  const payload = {
    model,
    stream: false,
    options: { temperature: temperatura },
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
  }
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`)
  const data = await res.json() as { message: { content: string } }
  return data.message.content.trim()
}

const AGENT_SELECT = {
  id: true, name: true, iconName: true, status: true,
  description: true, instructions: true, config: true,
  modelId: true, temperatura: true, createdAt: true, updatedAt: true,
  _count: { select: { conversations: true } },
} as const

// ─── GET /agents?companyId=&q=&status= ───────────────────────────────────────

router.get("/", async (req: Request, res: Response) => {
  const { companyId, q, status } = req.query as Record<string, string>
  if (!companyId) return res.status(400).json({ error: "companyId é obrigatório" })

  const validStatuses = ["ONLINE", "BUSY", "OFFLINE"]
  const agents = await db.agent.findMany({
    where: {
      companyId,
      ...(status && validStatuses.includes(status) ? { status: status as "ONLINE" | "BUSY" | "OFFLINE" } : {}),
      ...(q?.trim() ? { name: { contains: q.trim(), mode: "insensitive" } } : {}),
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: AGENT_SELECT,
  })
  return res.json(agents)
})

// ─── POST /agents ─────────────────────────────────────────────────────────────

router.post("/", async (req: Request, res: Response) => {
  const { companyId, name, iconName, status, description, config, modelId, temperatura } = req.body ?? {}
  if (!companyId || !name) {
    return res.status(400).json({ error: "companyId e name são obrigatórios" })
  }

  const validStatuses = ["ONLINE", "BUSY", "OFFLINE"]
  const safeStatus    = validStatuses.includes(status) ? status : "ONLINE"
  const safeConfig    = { ...DEFAULT_CONFIG, ...(config ?? {}) }
  const assembled     = assembleSystemPrompt(safeConfig)

  const agent = await db.agent.create({
    data: {
      companyId,
      name,
      iconName:     iconName    ?? "Bot",
      status:       safeStatus,
      description:  description ?? null,
      instructions: assembled || null,
      config:       safeConfig,
      modelId:      modelId     ?? OLLAMA_MODEL,
      temperatura:  typeof temperatura === "number" ? temperatura : 0.3,
    },
    select: AGENT_SELECT,
  })
  return res.status(201).json(agent)
})

// ─── GET /agents/:id ──────────────────────────────────────────────────────────

router.get("/:id", async (req: Request, res: Response) => {
  const agent = await db.agent.findUnique({
    where: { id: req.params.id },
    select: {
      ...AGENT_SELECT,
      conversations: {
        orderBy: { lastMessageAt: "desc" },
        take: 10,
        select: {
          id: true, channel: true, status: true, preview: true, lastMessageAt: true,
          customer: { select: { id: true, name: true } },
        },
      },
    },
  })
  if (!agent) return res.status(404).json({ error: "Agente não encontrado" })
  return res.json(agent)
})

// ─── PATCH /agents/:id ────────────────────────────────────────────────────────

router.patch("/:id", async (req: Request, res: Response) => {
  const { name, iconName, status, description, config, modelId, temperatura } = req.body ?? {}
  const validStatuses = ["ONLINE", "BUSY", "OFFLINE"]

  // If config is being updated, re-assemble the system prompt
  let instructions: string | undefined
  if (config) {
    instructions = assembleSystemPrompt(config) || undefined
  }

  const agent = await db.agent.update({
    where: { id: req.params.id },
    data: {
      ...(name         !== undefined ? { name }         : {}),
      ...(iconName     !== undefined ? { iconName }     : {}),
      ...(description  !== undefined ? { description }  : {}),
      ...(config       !== undefined ? { config, instructions: instructions ?? null } : {}),
      ...(modelId      !== undefined ? { modelId }      : {}),
      ...(typeof temperatura === "number" ? { temperatura } : {}),
      ...(status && validStatuses.includes(status) ? { status: status as "ONLINE" | "BUSY" | "OFFLINE" } : {}),
    },
    select: AGENT_SELECT,
  })
  return res.json(agent)
})

// ─── DELETE /agents/:id ───────────────────────────────────────────────────────

router.delete("/:id", async (req: Request, res: Response) => {
  await db.conversation.updateMany({ where: { agentId: req.params.id }, data: { agentId: null } })
  await db.agent.delete({ where: { id: req.params.id } })
  return res.json({ ok: true })
})

// ─── POST /agents/:id/test — chat de teste ao vivo ───────────────────────────

router.post("/:id/test", async (req: Request, res: Response) => {
  const agent = await db.agent.findUnique({
    where: { id: req.params.id },
    select: { instructions: true, config: true, modelId: true, temperatura: true },
  })
  if (!agent) return res.status(404).json({ error: "Agente não encontrado" })

  const { messages } = req.body as {
    messages: { role: "user" | "assistant"; content: string }[]
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages é obrigatório" })
  }

  const config      = agent.config as Partial<AgentConfig> | null
  const systemPrompt = agent.instructions ?? assembleSystemPrompt(config ?? {})
  const model       = agent.modelId ?? OLLAMA_MODEL
  const temperatura = agent.temperatura ?? 0.3

  if (!systemPrompt.trim()) {
    return res.status(422).json({ error: "Configure as instruções do agente antes de testar." })
  }

  try {
    const content = await callOllamaChat(model, systemPrompt, messages, temperatura)
    return res.json({ content })
  } catch (err) {
    console.error("[agents/test] Ollama error:", err)
    return res.status(503).json({
      code: "AI_UNAVAILABLE",
      error: "IA indisponível no momento. Tente novamente em instantes.",
    })
  }
})

export default router
