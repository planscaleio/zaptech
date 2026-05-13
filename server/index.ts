import "dotenv/config"
import path from "node:path"
import { fileURLToPath } from "node:url"
import express, { Request, Response } from "express"
import evolutionWebhook from "./webhooks/evolution.js"
import authRouter from "./routes/auth.js"
import conversationsRouter from "./routes/conversations.js"
import customersRouter from "./routes/customers.js"
import aiRouter from "./routes/ai.js"
import pipelinesRouter from "./routes/pipelines.js"
import segmentsRouter from "./routes/segments.js"
import teamsRouter from "./routes/teams.js"
import campaignsRouter from "./routes/campaigns.js"
import knowledgeRouter from "./routes/knowledge.js"
import productCategoriesRouter from "./routes/product-categories.js"
import productsRouter from "./routes/products.js"
import quotesRouter from "./routes/quotes.js"
import dynamicLinksRouter, { publicDynamicRedirectRouter } from "./routes/dynamic-links.js"
import supportTicketsRouter from "./routes/support-tickets.js"
import businessAccountsRouter from "./routes/business-accounts.js"
import auditoriasRouter from "./routes/auditorias.js"
import settingsRouter from "./routes/settings.js"
import agentsRouter from "./routes/agents.js"
import { db } from "./db.js"
import { startWorkers, runSegmentSync, runCardScore, runStageSync, runAiScore, runInboundProcessor, runOutboundSender, runOutboundRecovery, runAssignmentRecovery } from "./workers/index.js"

const app = express()
const PORT = Number(process.env.PORT ?? 3002)

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true }))

// Request logger
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`)
  next()
})

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() })
})

app.use("/auth", authRouter)
app.use("/conversations", conversationsRouter)
app.use("/customers", customersRouter)
app.use("/ai", aiRouter)
app.use("/pipelines", pipelinesRouter)
app.use("/segments", segmentsRouter)
app.use("/teams", teamsRouter)
app.use("/campaigns", campaignsRouter)
app.use("/knowledge", knowledgeRouter)
app.use("/product-categories", productCategoriesRouter)
app.use("/products", productsRouter)
app.use("/quotes", quotesRouter)
app.use("/dynamic-links", dynamicLinksRouter)
app.use("/support-tickets", supportTicketsRouter)
app.use("/business-accounts", businessAccountsRouter)
app.use("/auditorias", auditoriasRouter)
app.use("/settings", settingsRouter)
app.use("/agents", agentsRouter)
app.use("/webhook/evolution", evolutionWebhook)
app.use("/r", publicDynamicRedirectRouter)

// GET /tags?companyId=  — lista todas as tags da empresa
app.get("/tags", async (req: Request, res: Response) => {
  const { companyId } = req.query
  if (!companyId || typeof companyId !== "string") {
    return res.status(400).json({ error: "companyId é obrigatório" })
  }
  const tags = await db.tag.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, color: true },
  })
  return res.json(tags)
})

// ─── Worker audit routes ──────────────────────────────────────────────────────

// GET /workers/runs?worker=&status=&limit=
app.get("/workers/runs", async (req: Request, res: Response) => {
  const { worker, status, companyId, limit = "50" } = req.query
  const where: Record<string, unknown> = {}
  if (worker && typeof worker === "string") where.worker = worker
  if (status && typeof status === "string") where.status = status
  if (companyId && typeof companyId === "string") where.companyId = companyId

  const runs = await db.workerRun.findMany({
    where,
    orderBy: { startedAt: "desc" },
    take: Math.min(Number(limit), 200),
    select: {
      id: true, worker: true, trigger: true, status: true, companyId: true,
      startedAt: true, finishedAt: true, durationMs: true,
      itemsTotal: true, itemsProcessed: true, itemsFailed: true,
      error: true, meta: true,
    },
  })
  return res.json(runs)
})

// GET /workers/runs/:runId — run detail with logs
app.get("/workers/runs/:runId", async (req: Request, res: Response) => {
  const run = await db.workerRun.findUnique({
    where: { id: req.params.runId },
    include: { logs: { orderBy: { createdAt: "asc" } } },
  })
  if (!run) return res.status(404).json({ error: "Run não encontrado" })
  return res.json(run)
})

// POST /workers/trigger — manually trigger a worker
app.post("/workers/trigger", async (req: Request, res: Response) => {
  const { worker, companyId, meta } = req.body ?? {}
  const ctx = { companyId, meta }
  let runId: string
  try {
    switch (worker) {
      case "inbound-processor":  runId = await runInboundProcessor("manual", ctx);  break
      case "outbound-sender":    runId = await runOutboundSender("manual", ctx);    break
      case "outbound-recovery":  runId = await runOutboundRecovery("manual", ctx);  break
      case "segment-sync":       runId = await runSegmentSync("manual", ctx);       break
      case "card-score":         runId = await runCardScore("manual", ctx);         break
      case "stage-sync":         runId = await runStageSync("manual", ctx);         break
      case "ai-score":           runId = await runAiScore("manual", ctx);           break
      case "assignment-recovery": runId = await runAssignmentRecovery("manual", ctx); break
      default: return res.status(400).json({ error: `Worker desconhecido: ${worker}` })
    }
    return res.json({ runId })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

// ─── Static (production) ─────────────────────────────────────────────────────

if (process.env.NODE_ENV === "production") {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const distPath  = path.resolve(__dirname, "../dist")
  app.use(express.static(distPath))
  app.get("/{*path}", (_req, res) => res.sendFile(path.join(distPath, "index.html")))
} else {
  app.use((_req, res) => res.status(404).json({ error: "Not found" }))
}

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀 Servidor rodando em http://localhost:${PORT}`)
  console.log(`   Webhook Evolution: http://localhost:${PORT}/webhook/evolution`)
  console.log(`   Health check:      http://localhost:${PORT}/health\n`)
  startWorkers()
})
