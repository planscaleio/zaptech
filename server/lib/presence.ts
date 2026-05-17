// In-memory presence tracking for WhatsApp typing/composing/recording state.
// Keyed by customer phone (E.164 digits only). TTL-based: states older than
// PRESENCE_TTL_MS are treated as stale and not returned.

const PRESENCE_TTL_MS = 30_000

export type PresenceState = "composing" | "recording" | "available" | "unavailable" | "paused"

interface PresenceEntry {
  state: PresenceState
  updatedAt: number
}

const presenceByPhone = new Map<string, PresenceEntry>()

export function setPresence(phone: string, state: PresenceState): void {
  if (!phone) return
  presenceByPhone.set(phone, { state, updatedAt: Date.now() })
}

export function getPresence(phone: string): PresenceState | null {
  const entry = presenceByPhone.get(phone)
  if (!entry) return null
  if (Date.now() - entry.updatedAt > PRESENCE_TTL_MS) {
    presenceByPhone.delete(phone)
    return null
  }
  return entry.state
}

export function isTyping(phone: string): boolean {
  const s = getPresence(phone)
  return s === "composing" || s === "recording"
}
