import { db } from "../db.js"

type ConnectorConfig = {
  instanceId?: unknown
  instanceName?: unknown
  evolutionInstance?: unknown
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function instanceFromConfig(config: unknown) {
  const parsed = config && typeof config === "object" ? config as ConnectorConfig : {}
  return (
    stringValue(parsed.instanceId) ??
    stringValue(parsed.instanceName) ??
    stringValue(parsed.evolutionInstance)
  )
}

function looksLikeFriendlyName(name: string) {
  return /\s/.test(name) || /^whatsapp oficial$/i.test(name.trim())
}

export async function resolveEvolutionInstanceId(companyId: string) {
  const connector = await db.connector.findFirst({
    where: { companyId, type: "CANAL", status: "CONECTADO" },
    orderBy: { updatedAt: "desc" },
    select: { name: true, config: true },
  })

  const configured = connector ? instanceFromConfig(connector.config) : null
  if (configured) return configured

  const envInstance = stringValue(process.env.EVOLUTION_INSTANCE_NAME)
  if (envInstance) return envInstance

  if (connector?.name && !looksLikeFriendlyName(connector.name)) return connector.name

  return "default"
}
