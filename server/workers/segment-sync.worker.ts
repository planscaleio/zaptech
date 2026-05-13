/**
 * segment-sync.worker
 *
 * Re-evaluates all segments across all companies (or a single company when
 * companyId is passed) and updates SegmentCustomer membership atomically.
 *
 * Trigger: cron (hourly) | event:customer.updated | manual
 */

import { db } from "../db.js"
import { runWorker, withRetry, type WorkerContext } from "./runner.js"
import { buildWhere } from "../routes/segments.js"
import type { SegmentFilter } from "../routes/segments.js"

function parseCriteria(raw: string | null): SegmentFilter[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

export async function runSegmentSync(trigger: WorkerContext["meta"] extends undefined ? "cron" | "manual" | `event:${string}` : any = "cron", ctx: WorkerContext = {}) {
  return runWorker("segment-sync", trigger, ctx, async (handle) => {
    const where = ctx.companyId ? { companyId: ctx.companyId } : {}

    const segments = await db.segment.findMany({
      where,
      select: { id: true, name: true, companyId: true, criteria: true },
    })

    await handle.log("info", `Iniciando sync de ${segments.length} segmento(s)`)

    let processed = 0
    let failed = 0

    for (const segment of segments) {
      const filters = parseCriteria(segment.criteria)

      if (filters.length === 0) {
        await handle.log("info", `Segmento "${segment.name}" sem filtros — ignorado`, { itemId: segment.id })
        continue
      }

      try {
        await withRetry(async () => {
          const whereClause = buildWhere(segment.companyId, filters)
          const matched = await db.customer.findMany({ where: whereClause, select: { id: true } })
          const matchedIds = matched.map((c) => c.id)

          await db.$transaction([
            db.segmentCustomer.deleteMany({ where: { segmentId: segment.id } }),
            db.segmentCustomer.createMany({
              data: matchedIds.map((customerId) => ({ segmentId: segment.id, customerId })),
              skipDuplicates: true,
            }),
          ])

          await handle.log("info", `"${segment.name}" → ${matchedIds.length} cliente(s)`, {
            itemId: segment.id,
            detail: { count: matchedIds.length },
          })
        })
        processed++
      } catch (err) {
        failed++
        await handle.log("error", `Falha ao sincronizar segmento "${segment.name}": ${err instanceof Error ? err.message : String(err)}`, {
          itemId: segment.id,
        })
      }
    }

    await handle.finish({ total: segments.length, processed, failed })
  })
}
