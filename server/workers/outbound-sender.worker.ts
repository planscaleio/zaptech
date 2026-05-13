/**
 * outbound-sender.worker
 *
 * Picks QUEUED OutboundMessages using FOR UPDATE SKIP LOCKED, sends via Evolution API,
 * creates Message in history only after confirmed send, handles retry with backoff.
 *
 * Trigger: cron (5s) | manual | event:outbound.created
 */

import { db } from "../db.js"
import { runWorker, type WorkerContext } from "./runner.js"
import { calcNextAttempt } from "../utils/evolution.js"

const BATCH_SIZE = 20

const EVOLUTION_BASE = process.env.EVOLUTION_BASE_URL ?? "http://localhost:8080"
const EVOLUTION_KEY  = process.env.EVOLUTION_API_KEY  ?? ""

async function sendViaEvolution(instanceId: string, recipientPhone: string, body: string): Promise<string> {
  const res = await fetch(`${EVOLUTION_BASE}/message/sendText/${instanceId}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", apikey: EVOLUTION_KEY },
    body:    JSON.stringify({ number: recipientPhone, text: body }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`Evolution API HTTP ${res.status}: ${detail.slice(0, 200)}`)
  }

  const json = await res.json() as { key?: { id?: string } }
  return json.key?.id ?? ""
}

export async function runOutboundSender(
  trigger: "cron" | "manual" | `event:${string}` = "cron",
  ctx: WorkerContext = {},
) {
  return runWorker("outbound-sender", trigger, ctx, async (handle) => {
    // Find candidates first, then claim via optimistic updateMany (same pattern as inbound-processor)
    const candidates = await db.outboundMessage.findMany({
      where: {
        status:        "QUEUED",
        nextAttemptAt: { lte: new Date() },
        ...(ctx.companyId ? { companyId: ctx.companyId } : {}),
      },
      orderBy: [{ priority: "asc" }, { nextAttemptAt: "asc" }],
      take: BATCH_SIZE,
    })

    if (candidates.length === 0) {
      await handle.finish({ total: 0, processed: 0, failed: 0 })
      return
    }

    // Claim atomically — skip any already taken by another process
    const claimed: typeof candidates = []
    for (const msg of candidates) {
      const result = await db.outboundMessage.updateMany({
        where: { id: msg.id, status: "QUEUED" },
        data:  { status: "PROCESSING" },
      })
      if (result.count > 0) claimed.push(msg)
    }

    const toProcess = claimed

    if (toProcess.length === 0) {
      await handle.finish({ total: 0, processed: 0, failed: 0 })
      return
    }

    await handle.log("info", `Enviando ${toProcess.length} mensagem(ns) outbound`)

    let processed = 0
    let failed    = 0

    for (const msg of toProcess) {
      try {
        const waMessageId = await sendViaEvolution(
          msg.instanceId,
          msg.recipientPhone,
          msg.body ?? "",
        )

        // Persist to history only after confirmed send
        await db.$transaction([
          db.outboundMessage.update({
            where: { id: msg.id },
            data:  { status: "SENT", waMessageId: waMessageId || null, sentAt: new Date(), error: null },
          }),
          db.message.create({
            data: {
              conversationId: msg.conversationId,
              authorName:     "Atendente",
              role:           "ATENDENTE",
              text:           msg.body ?? "",
              isAiGenerated:  false,
              align:          "right",
            },
          }),
          db.conversation.update({
            where: { id: msg.conversationId },
            data:  { preview: (msg.body ?? "").slice(0, 200), lastMessageAt: new Date() },
          }),
        ])

        await handle.log("info", `Enviada → ${msg.recipientPhone}`, {
          itemId: msg.id,
          detail: { waMessageId, conversationId: msg.conversationId },
        })

        processed++
      } catch (err) {
        const errorMsg     = err instanceof Error ? err.message : String(err)
        const nextAttempts = msg.attempts + 1
        const isFinal      = nextAttempts >= msg.maxAttempts

        await db.outboundMessage.update({
          where: { id: msg.id },
          data: {
            status:        isFinal ? "FAILED" : "QUEUED",
            attempts:      nextAttempts,
            nextAttemptAt: isFinal ? new Date() : calcNextAttempt(nextAttempts),
            error:         errorMsg,
            failedAt:      isFinal ? new Date() : null,
          },
        })

        await handle.log("error",
          `Falha ao enviar → ${msg.recipientPhone} (tentativa ${nextAttempts}/${msg.maxAttempts}): ${errorMsg}`,
          { itemId: msg.id },
        )

        failed++
      }
    }

    await handle.finish({ total: toProcess.length, processed, failed })
  })
}
