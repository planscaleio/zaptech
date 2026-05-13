/**
 * stage-sync.worker
 *
 * Keeps Customer.stage in sync with the customer's most advanced active
 * KanbanCard position across all pipelines.
 *
 * Mapping heuristic (by column sortOrder position within a board, 0-based):
 *   0 → PROSPECCAO
 *   1 → QUALIFICACAO
 *   2 → DEMONSTRACAO
 *   3 → PROPOSTA
 *   4 → NEGOCIACAO
 *   5+ → FECHADO (or POS_VENDA if customer already has status CLIENTE)
 *
 * If the customer has no active cards, stage is left unchanged.
 *
 * Trigger: cron (every hour) | event:card.moved | manual
 */

import { db } from "../db.js"
import { runWorker, withRetry, type WorkerContext } from "./runner.js"

const STAGE_MAP = [
  "PROSPECCAO",
  "QUALIFICACAO",
  "DEMONSTRACAO",
  "PROPOSTA",
  "NEGOCIACAO",
  "FECHADO",
  "POS_VENDA",
] as const

type CustomerStage = typeof STAGE_MAP[number]

export async function runStageSync(trigger: "cron" | "manual" | `event:${string}` = "cron", ctx: WorkerContext = {}) {
  return runWorker("stage-sync", trigger, ctx, async (handle) => {
    // Fetch all customers with at least one kanban card
    const customerWhere = ctx.companyId ? { companyId: ctx.companyId } : {}

    const customers = await db.customer.findMany({
      where: {
        ...customerWhere,
        kanbanCards: { some: {} },
      },
      select: {
        id: true,
        stage: true,
        status: true,
        kanbanCards: {
          select: {
            id: true,
            column: {
              select: {
                sortOrder: true,
                board: {
                  select: { columns: { orderBy: { sortOrder: "asc" }, select: { id: true, sortOrder: true } } },
                },
              },
            },
          },
        },
      },
    })

    await handle.log("info", `Sincronizando stage de ${customers.length} cliente(s)`)

    let processed = 0
    let failed = 0
    let unchanged = 0

    for (const customer of customers) {
      try {
        // Find the most advanced position (highest relative index) across all cards
        let maxRelativeIndex = -1

        for (const card of customer.kanbanCards) {
          const totalCols = card.column.board.columns.length
          if (totalCols === 0) continue
          const colIndex = card.column.board.columns.findIndex((c) => c.sortOrder === card.column.sortOrder)
          const relativeIndex = totalCols > 1 ? colIndex / (totalCols - 1) : 0
          if (relativeIndex > maxRelativeIndex) maxRelativeIndex = relativeIndex
        }

        if (maxRelativeIndex < 0) { unchanged++; continue }

        // Map 0.0–1.0 to STAGE_MAP
        const stageIndex = Math.min(
          STAGE_MAP.length - 1,
          Math.round(maxRelativeIndex * (STAGE_MAP.length - 1)),
        )
        const newStage: CustomerStage = customer.status === "CLIENTE" && stageIndex >= 5
          ? "POS_VENDA"
          : STAGE_MAP[stageIndex]

        if (newStage === customer.stage) { unchanged++; continue }

        await withRetry(() =>
          db.customer.update({
            where: { id: customer.id },
            data: { stage: newStage },
          })
        )

        await handle.log("info", `Cliente ${customer.id}: ${customer.stage} → ${newStage}`, {
          itemId: customer.id,
          detail: { from: customer.stage, to: newStage },
        })

        processed++
      } catch (err) {
        failed++
        await handle.log("error", `Falha no cliente ${customer.id}: ${err instanceof Error ? err.message : String(err)}`, {
          itemId: customer.id,
        })
      }
    }

    await handle.log("info", `${unchanged} cliente(s) sem alteração de stage`)
    await handle.finish({ total: customers.length, processed, failed })
  })
}
