import { db } from "../db.js"

export type WorkerTrigger = "cron" | "manual" | `event:${string}`

export interface WorkerContext {
  companyId?: string
  meta?: Record<string, unknown>
}

export interface RunHandle {
  runId: string
  log: (level: "info" | "warn" | "error", message: string, opts?: { itemId?: string; detail?: unknown }) => Promise<void>
  fail: (error: unknown) => Promise<void>
  finish: (stats: { total?: number; processed?: number; failed?: number }) => Promise<void>
}

/**
 * Creates a WorkerRun record, executes the worker fn, and finalises the record.
 * Returns the runId so callers can reference it.
 */
export async function runWorker(
  workerName: string,
  trigger: WorkerTrigger,
  ctx: WorkerContext,
  fn: (handle: RunHandle) => Promise<void>,
): Promise<string> {
  const run = await db.workerRun.create({
    data: {
      worker: workerName,
      trigger,
      status: "RUNNING",
      companyId: ctx.companyId ?? null,
      meta: ctx.meta ?? undefined,
      startedAt: new Date(),
    },
  })

  const runId = run.id
  const startMs = Date.now()

  const handle: RunHandle = {
    runId,

    async log(level, message, opts = {}) {
      console.log(`[${workerName}][${level.toUpperCase()}] ${message}`)
      await db.workerLog.create({
        data: {
          runId,
          level,
          message,
          itemId: opts.itemId ?? null,
          detail: opts.detail ? (opts.detail as any) : undefined,
        },
      })
    },

    async fail(error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`[${workerName}][FAILED] ${msg}`)
      await db.workerRun.update({
        where: { id: runId },
        data: {
          status: "FAILED",
          error: msg,
          finishedAt: new Date(),
          durationMs: Date.now() - startMs,
        },
      })
    },

    async finish({ total, processed, failed }) {
      const status = failed && failed > 0 && processed !== total ? "PARTIAL" : "SUCCESS"
      await db.workerRun.update({
        where: { id: runId },
        data: {
          status,
          finishedAt: new Date(),
          durationMs: Date.now() - startMs,
          itemsTotal: total ?? null,
          itemsProcessed: processed ?? null,
          itemsFailed: failed ?? null,
        },
      })
      console.log(`[${workerName}][${status}] total=${total} processed=${processed} failed=${failed} (${Date.now() - startMs}ms)`)
    },
  }

  try {
    await fn(handle)
  } catch (err) {
    // Only call fail if the worker didn't already mark itself as failed/finished
    const current = await db.workerRun.findUnique({ where: { id: runId }, select: { status: true } })
    if (current?.status === "RUNNING") {
      await handle.fail(err)
    }
  }

  return runId
}

/**
 * Retry wrapper — re-attempts up to `attempts` times with exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 500,
): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** i))
      }
    }
  }
  throw lastError
}
