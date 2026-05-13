/**
 * card-score.worker
 *
 * Recalculates the lead score (0–100) for KanbanCards using the 7-factor model.
 * Runs across all companies or a single one. Can also target a single cardId.
 *
 * Trigger: cron (every 30min) | event:card.updated | manual
 */

import { db } from "../db.js"
import { runWorker, withRetry, type WorkerContext } from "./runner.js"

interface CardScoreContext extends WorkerContext {
  cardId?: string  // if set, only recomputes this specific card
}

export async function runCardScore(trigger: "cron" | "manual" | `event:${string}` = "cron", ctx: CardScoreContext = {}) {
  return runWorker("card-score", trigger, ctx, async (handle) => {
    // Build query — single card, single company, or all
    const where = ctx.cardId
      ? { id: ctx.cardId }
      : ctx.companyId
        ? { column: { board: { companyId: ctx.companyId } } }
        : {}

    const cards = await db.kanbanCard.findMany({
      where,
      include: {
        activities: { orderBy: { createdAt: "desc" } },
        column: {
          include: {
            board: { include: { columns: { orderBy: { sortOrder: "asc" } } } },
          },
        },
        customer: true,
      },
    })

    await handle.log("info", `Calculando score de ${cards.length} card(s)`)

    let processed = 0
    let failed = 0

    for (const card of cards) {
      try {
        await withRetry(async () => {
          const allColumns = card.column.board.columns
          const stageIndex = allColumns.findIndex((c) => c.id === card.column.id)
          const stageTotal = allColumns.length
          const stagePts = stageTotal > 1 ? Math.round((stageIndex / (stageTotal - 1)) * 25) : 0

          let valuePts = 0
          if (card.value) {
            const v = Number(card.value)
            if (v >= 50000)      valuePts = 20
            else if (v >= 20000) valuePts = 16
            else if (v >= 10000) valuePts = 12
            else if (v >= 5000)  valuePts = 8
            else if (v >= 1000)  valuePts = 4
            else                 valuePts = 2
          }

          const actCount = card.activities.length
          const actPts = Math.min(20, actCount * 3)

          let recencyPts = 0
          if (card.activities.length > 0) {
            const daysSince = (Date.now() - new Date(card.activities[0].createdAt).getTime()) / 86400000
            if (daysSince <= 1)       recencyPts = 15
            else if (daysSince <= 3)  recencyPts = 12
            else if (daysSince <= 7)  recencyPts = 8
            else if (daysSince <= 14) recencyPts = 4
            else                      recencyPts = 1
          } else {
            const daysSinceCreated = (Date.now() - new Date(card.createdAt).getTime()) / 86400000
            recencyPts = daysSinceCreated <= 2 ? 8 : daysSinceCreated <= 7 ? 4 : 0
          }

          let profilePts = 0
          if (card.value)            profilePts += 2
          if (card.expectedCloseAt)  profilePts += 2
          if (card.contactName)      profilePts += 2
          if (card.contactEmail)     profilePts += 2
          if (card.contactPhone)     profilePts += 2

          const priorityPts = card.priority === "ALTA" ? 5 : card.priority === "MEDIA" ? 3 : 1
          const customerAiPts = card.customer?.aiScore ? Math.round((card.customer.aiScore / 100) * 5) : 0

          const total = Math.min(100, stagePts + valuePts + actPts + recencyPts + profilePts + priorityPts + customerAiPts)

          const breakdown = { stagePts, valuePts, actPts, recencyPts, profilePts, priorityPts, customerAiPts, total, computed: new Date().toISOString() }

          await db.kanbanCard.update({
            where: { id: card.id },
            data: { score: total, scoreBreakdown: breakdown },
          })
        })
        processed++
      } catch (err) {
        failed++
        await handle.log("error", `Falha no card "${card.name}": ${err instanceof Error ? err.message : String(err)}`, {
          itemId: card.id,
        })
      }
    }

    await handle.finish({ total: cards.length, processed, failed })
  })
}
