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
import adminRouter from "./routes/admin.js"
import uploadsRouter from "./routes/uploads.js"
import { Router } from "express"
import { db } from "./db.js"
import { startWorkers, runSegmentSync, runCardScore, runStageSync, runAiScore, runInboundProcessor, repairInboundMedia, runOutboundSender, runOutboundRecovery, runAssignmentRecovery, runEmailSync } from "./workers/index.js"

const app = express()
const api = Router()
const PORT = Number(process.env.PORT ?? 3002)

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(express.json({ limit: "75mb" }))
app.use(express.urlencoded({ extended: true }))

// Request logger
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`)
  next()
})

// ─── Routes ───────────────────────────────────────────────────────────────────

// Health check — fora do prefixo /api para EasyPanel/Docker
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() })
})

// Webhook e links públicos — fora do prefixo /api
app.use("/webhook/evolution", evolutionWebhook)
app.use("/r", publicDynamicRedirectRouter)
app.use("/uploads", uploadsRouter)

// ─── API routes (prefixo /api) ────────────────────────────────────────────────

api.use("/auth", authRouter)
api.use("/conversations", conversationsRouter)
api.use("/customers", customersRouter)
api.use("/ai", aiRouter)
api.use("/pipelines", pipelinesRouter)
api.use("/segments", segmentsRouter)
api.use("/teams", teamsRouter)
api.use("/campaigns", campaignsRouter)
api.use("/knowledge", knowledgeRouter)
api.use("/product-categories", productCategoriesRouter)
api.use("/products", productsRouter)
api.use("/quotes", quotesRouter)
api.use("/dynamic-links", dynamicLinksRouter)
api.use("/support-tickets", supportTicketsRouter)
api.use("/business-accounts", businessAccountsRouter)
api.use("/auditorias", auditoriasRouter)
api.use("/settings", settingsRouter)
api.use("/agents", agentsRouter)

// GET /api/tags?companyId=
api.get("/tags", async (req: Request, res: Response) => {
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

api.get("/workers/runs", async (req: Request, res: Response) => {
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

api.get("/workers/runs/:runId", async (req: Request, res: Response) => {
  const run = await db.workerRun.findUnique({
    where: { id: req.params.runId },
    include: { logs: { orderBy: { createdAt: "asc" } } },
  })
  if (!run) return res.status(404).json({ error: "Run não encontrado" })
  return res.json(run)
})

api.post("/workers/trigger", async (req: Request, res: Response) => {
  const { worker, companyId, meta } = req.body ?? {}
  const ctx = { companyId, meta }
  let runId: string
  try {
    switch (worker) {
      case "inbound-processor":  runId = await runInboundProcessor("manual", ctx);  break
      case "repair-inbound-media": {
        const result = await repairInboundMedia(ctx)
        return res.json(result)
      }
      case "outbound-sender":    runId = await runOutboundSender("manual", ctx);    break
      case "outbound-recovery":  runId = await runOutboundRecovery("manual", ctx);  break
      case "email-sync":         runId = await runEmailSync("manual", ctx);         break
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

app.use("/api", api)
app.use("/api/admin", adminRouter)

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
