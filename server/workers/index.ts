/**
 * Worker bootstrap — imported once by server/index.ts at startup.
 *
 * Schedule:
 *   segment-sync  every 60 min
 *   card-score    every 30 min
 *   stage-sync    every 60 min
 *   email-sync    every 2 min
 *   ai-score      daily at ~03:00 (approximated via interval)
 */

import { runSegmentSync }          from "./segment-sync.worker.js"
import { runCardScore }            from "./card-score.worker.js"
import { runStageSync }            from "./stage-sync.worker.js"
import { runAiScore }              from "./ai-score.worker.js"
import { repairInboundMedia, runInboundProcessor } from "./inbound-processor.worker.js"
import { runOutboundSender }       from "./outbound-sender.worker.js"
import { runOutboundRecovery }     from "./outbound-recovery.worker.js"
import { runAssignmentRecovery }   from "./assignment-recovery.worker.js"
import { runEmailSync }            from "./email-sync.worker.js"

export { runSegmentSync, runCardScore, runStageSync, runAiScore, runInboundProcessor, repairInboundMedia, runOutboundSender, runOutboundRecovery, runAssignmentRecovery, runEmailSync }

const MIN = 60_000

function schedule(name: string, fn: () => Promise<unknown>, intervalMs: number) {
  console.log(`[workers] ${name} agendado a cada ${intervalMs / MIN}min`)
  // First run after a short delay so the server finishes booting
  setTimeout(async () => {
    await fn().catch((e) => console.error(`[workers] ${name} erro no arranque:`, e))
    setInterval(() => fn().catch((e) => console.error(`[workers] ${name} erro:`, e)), intervalMs)
  }, 15_000)
}

export function startWorkers() {
  // Messaging queue — high frequency
  schedule("inbound-processor",  () => runInboundProcessor("cron"),  5_000)
  schedule("outbound-sender",    () => runOutboundSender("cron"),    5_000)
  schedule("outbound-recovery",  () => runOutboundRecovery("cron"),  2 * MIN)
  schedule("email-sync",         () => runEmailSync("cron"),         2 * MIN)

  // CRM workers
  schedule("segment-sync",        () => runSegmentSync("cron"),        60 * MIN)
  schedule("card-score",          () => runCardScore("cron"),          30 * MIN)
  schedule("stage-sync",          () => runStageSync("cron"),          60 * MIN)
  schedule("assignment-recovery", () => runAssignmentRecovery("cron"), 10 * MIN)

  // ai-score: once a day — approximate with 24h interval, first run at ~03:00 local
  const now = new Date()
  const next3am = new Date(now)
  next3am.setHours(3, 0, 0, 0)
  if (next3am <= now) next3am.setDate(next3am.getDate() + 1)
  const msUntil3am = next3am.getTime() - now.getTime()

  console.log(`[workers] ai-score agendado para ~03:00 (em ${Math.round(msUntil3am / MIN)}min)`)
  setTimeout(() => {
    runAiScore("cron").catch((e) => console.error("[workers] ai-score erro:", e))
    setInterval(() => runAiScore("cron").catch((e) => console.error("[workers] ai-score erro:", e)), 24 * 60 * MIN)
  }, msUntil3am)
}
