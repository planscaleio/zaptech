// Shared utilities used by both the Evolution webhook and the inbound-processor worker.

/** Strips the JID suffix, returning a clean phone number. */
export function jidToPhone(jid: string): string {
  return jid.replace(/@.+$/, "").replace(/:\d+$/, "")
}

/** Returns the human-readable text from any message type. */
export function extractText(message?: Record<string, unknown>): string {
  if (!message) return ""
  return (
    (message.conversation as string) ??
    ((message.extendedTextMessage as Record<string, unknown>)?.text as string) ??
    ((message.imageMessage as Record<string, unknown>)?.caption as string) ??
    ((message.videoMessage as Record<string, unknown>)?.caption as string) ??
    ((message.documentMessage as Record<string, unknown>)?.title as string) ??
    ""
  )
}

/** Returns a placeholder label for non-text message types. */
export function mediaPlaceholder(messageType: string): string {
  const map: Record<string, string> = {
    imageMessage:    "[imagem]",
    videoMessage:    "[vídeo]",
    audioMessage:    "[áudio]",
    documentMessage: "[documento]",
    stickerMessage:  "[sticker]",
    locationMessage: "[localização]",
    contactMessage:  "[contato]",
    reactionMessage: "[reação]",
  }
  return map[messageType] ?? `[${messageType}]`
}

const BACKOFF_DELAYS_SEC = [30, 120, 300, 900]

/** Calculates the next retry time using exponential-ish backoff. */
export function calcNextAttempt(attemptsDone: number): Date {
  const delaySec = BACKOFF_DELAYS_SEC[attemptsDone] ?? BACKOFF_DELAYS_SEC[BACKOFF_DELAYS_SEC.length - 1]
  return new Date(Date.now() + delaySec * 1000)
}
