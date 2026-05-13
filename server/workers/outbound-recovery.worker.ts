/**
 * outbound-recovery.worker
 *
 * Detects OutboundMessages stuck in PROCESSING for more than 5 minutes
 * (server crash / process kill during send) and re-queues or marks as FAILED.
 *
 * Trigger: cron (2min) | manual
 */

import { db } from "../db.js"
import { runWorker, type WorkerContext } from "./runner.js"
import { calcNextAttempt } from "../utils/evolution.js"

const STUCK_THRESHOLD_MS = 5 * 60 * 1000  // 5 minutes

export async function runOutboundRecovery(
  trigger: "cron" | "manual" | `event:${string}` = "cron",
  ctx: WorkerContext = {},
) {
  return runWorker("outbound-recovery", trigger, ctx, async (handle) => {
    const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS)

    const stuck = await db.outboundMessage.findMany({
      where: {
        status:    "PROCESSING",
        updatedAt: { lt: cutoff },
        ...(ctx.companyId ? { companyId: ctx.companyId } : {}),
      },
      take: 100,
    })

    if (stuck.length === 0) {
      await handle.finish({ total: 0, processed: 0, failed: 0 })
      return
    }

    await handle.log("warn", `Encontradas ${stuck.length} mensagem(ns) travadas em PROCESSING`)

    let recovered  = 0
    let abandoned  = 0

    for (const msg of stuck) {
      const nextAttempts = msg.attempts + 1
      const isFinal      = nextAttempts >= msg.maxAttempts

      await db.outboundMessage.update({
        where: { id: msg.id },
        data: {
          status:        isFinal ? "FAILED" : "QUEUED",
          attempts:      nextAttempts,
          nextAttemptAt: isFinal ? new Date() : calcNextAttempt(nextAttempts),
          error:         `Recuperada após timeout em PROCESSING (tentativa ${nextAttempts}/${msg.maxAttempts})`,
          failedAt:      isFinal ? new Date() : undefined,
        },
      })

      await handle.log(
        isFinal ? "error" : "warn",
        `Mensagem ${isFinal ? "abandonada (FAILED)" : "recolocada na fila (QUEUED)"}: ${msg.recipientPhone}`,
        { itemId: msg.id, detail: { attempts: nextAttempts, maxAttempts: msg.maxAttempts } },
      )

      isFinal ? abandoned++ : recovered++
    }

    await handle.finish({ total: stuck.length, processed: recovered, failed: abandoned })
  })
}
