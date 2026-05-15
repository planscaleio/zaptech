/**
 * assignment-recovery.worker
 *
 * Finds conversations assigned to an attendant that have had no
 * ATENDENTE response in the last 2 hours, then re-runs distribution
 * rules to reassign them (excluding the current attendant).
 *
 * Trigger: cron (10min) | manual
 */

import { db } from "../db.js"
import { runWorker, type WorkerContext } from "./runner.js"
import { resolveAttendant, assignConversation } from "../lib/distributionEngine.js"

const STALE_HOURS = 2

export async function runAssignmentRecovery(
  trigger: "cron" | "manual" = "cron",
  ctx: WorkerContext = {},
) {
  return runWorker("assignment-recovery", trigger, ctx, async (handle) => {
    const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000)

    // Find assigned conversations with no attendant reply since cutoff
    const stale = await db.conversation.findMany({
      where: {
        attendantId: { not: null },
        status: { notIn: ["ENCERRADO", "ARQUIVADO", "PARA_EXCLUIR", "RESOLVIDO"] },
        ...(ctx.companyId ? { companyId: ctx.companyId } : {}),
        NOT: {
          messages: {
            some: {
              role: { in: ["ATENDENTE", "AGENTE_IA"] },
              createdAt: { gt: cutoff },
            },
          },
        },
      },
      select: { id: true, companyId: true, attendantId: true },
      take: 100,
    })

    if (stale.length === 0) {
      await handle.finish({ total: 0, processed: 0, failed: 0 })
      return
    }

    await handle.log("info", `${stale.length} conversa(s) parada(s) para reatribuição`)

    let processed = 0
    let failed = 0

    for (const conv of stale) {
      try {
        const resolution = await resolveAttendant(
          conv.id,
          conv.companyId,
          conv.attendantId ?? undefined,
        )

        if (resolution.userId && resolution.userId !== "__EXISTING_OWNER__") {
          await assignConversation(conv.id, resolution.userId, conv.companyId, resolution.teamId)
          await handle.log("info", `Reatribuída conversa ${conv.id} → atendente ${resolution.userId}`, {
            itemId: conv.id,
          })
        } else if (resolution.teamId) {
          await db.conversation.update({ where: { id: conv.id }, data: { teamId: resolution.teamId } })
          await handle.log("info", `Conversa ${conv.id} direcionada para fila do time ${resolution.teamId}`, {
            itemId: conv.id,
          })
        } else {
          await handle.log("info", `Conversa ${conv.id} mantida na fila (sem atendente disponível)`, {
            itemId: conv.id,
          })
        }

        processed++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        await handle.log("error", `Falha ao reatribuir ${conv.id}: ${msg}`, { itemId: conv.id })
        failed++
      }
    }

    await handle.finish({ total: stale.length, processed, failed })
  })
}
