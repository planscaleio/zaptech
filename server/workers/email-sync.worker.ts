/**
 * email-sync.worker
 *
 * Synchronizes active shared IMAP/SMTP accounts into EMAIL conversations.
 *
 * Trigger: cron (2 min) | manual
 */

import { db } from "../db.js"
import { syncEmailAccount } from "../lib/email-service.js"
import { runWorker, type WorkerContext } from "./runner.js"

export async function runEmailSync(
  trigger: "cron" | "manual" | `event:${string}` = "cron",
  ctx: WorkerContext = {},
) {
  return runWorker("email-sync", trigger, ctx, async (handle) => {
    const accounts = await db.emailAccount.findMany({
      where: {
        syncEnabled: true,
        status: { in: ["CONECTADO", "DESCONECTADO", "REVISAR"] },
        ...(ctx.companyId ? { companyId: ctx.companyId } : {}),
      },
      select: { id: true, email: true },
      orderBy: { updatedAt: "asc" },
      take: 20,
    })

    if (accounts.length === 0) {
      await handle.finish({ total: 0, processed: 0, failed: 0 })
      return
    }

    await handle.log("info", `Sincronizando ${accounts.length} conta(s) de e-mail`)

    let processed = 0
    let failed = 0

    for (const account of accounts) {
      try {
        const result = await syncEmailAccount(account.id)
        await handle.log("info", `${account.email}: ${result.imported} mensagem(ns) importada(s)`, {
          itemId: account.id,
          detail: result,
        })
        processed++
      } catch (err) {
        failed++
        await handle.log("error", `${account.email}: ${err instanceof Error ? err.message : String(err)}`, {
          itemId: account.id,
        })
      }
    }

    await handle.finish({ total: accounts.length, processed, failed })
  })
}
