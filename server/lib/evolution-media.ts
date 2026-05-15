const EVOLUTION_BASE = process.env.EVOLUTION_BASE_URL ?? "http://localhost:8080"
const EVOLUTION_KEY  = process.env.EVOLUTION_API_KEY  ?? ""

type EvoMessage = {
  key?: unknown
  message?: unknown
}

export async function fetchEvolutionMediaBase64(instanceId: string, msg: EvoMessage): Promise<string | null> {
  if (!EVOLUTION_KEY) return null

  const bodies = [
    { message: msg, convertToMp4: false },
    { key: msg.key, message: msg.message, convertToMp4: false },
  ]

  for (const body of bodies) {
    try {
      const response = await fetch(`${EVOLUTION_BASE}/chat/getBase64FromMediaMessage/${instanceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: EVOLUTION_KEY },
        body: JSON.stringify(body),
      })
      if (!response.ok) continue
      const data = await response.json() as { base64?: string }
      if (typeof data.base64 === "string" && data.base64.trim()) {
        return data.base64
      }
    } catch {
      // Try the next body shape.
    }
  }

  return null
}
