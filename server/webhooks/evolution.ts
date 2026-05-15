import { Router, type Request, type Response } from "express"
import { db } from "../db.js"
import { jidToPhone, extractText } from "../utils/evolution.js"

const router = Router()

// ─── Normalização de evento ───────────────────────────────────────────────────
// A Evolution API v2 envia eventos em dois formatos possíveis:
//   "messages.upsert"  (dot notation lowercase)
//   "MESSAGES_UPSERT"  (underscore uppercase)
// Normalizamos para uppercase+underscore para ter um único switch.

function normalizeEvent(raw: string): string {
  return raw.toUpperCase().replace(/\./g, "_")
}

// ─── Tipos do payload ─────────────────────────────────────────────────────────

interface EvolutionPayload {
  event: string
  instance: string
  data: Record<string, unknown>
  destination?: string
  date_time?: string
  sender?: string
  server_url?: string
  apikey?: string
}

// Mensagem individual da Evolution
interface EvoMessage {
  key?: {
    remoteJid?: string
    fromMe?: boolean
    id?: string
    participant?: string
  }
  message?: Record<string, unknown>
  messageType?: string
  pushName?: string
  status?: string
  messageTimestamp?: number
  instanceId?: string
}

// Contato
interface EvoContact {
  id?: string
  name?: string
  pushName?: string
  profilePicUrl?: string
}

// Atualização de mensagem
interface EvoMessageUpdate {
  key?: { id?: string; remoteJid?: string; fromMe?: boolean }
  update?: { status?: string }
}

// Conexão
interface EvoConnection {
  state?: "open" | "close" | "connecting"
  statusReason?: number
  qrcode?: { base64?: string; code?: string }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Encontra ou cria a company pelo nome da instância Evolution
// Por ora usa a primeira company — quando houver auth por instância, trocar aqui
async function resolveCompany(instance: string): Promise<string | null> {
  // Tenta achar connector com nome = instance
  const connector = await db.connector.findFirst({
    where: { name: instance },
    select: { companyId: true },
  })
  if (connector) return connector.companyId

  // Fallback: primeira company cadastrada
  const company = await db.company.findFirst({ select: { id: true } })
  return company?.id ?? null
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function onMessagesUpsert(instance: string, data: Record<string, unknown>) {
  const messages: EvoMessage[] = Array.isArray(data)
    ? (data as EvoMessage[])
    : Array.isArray((data as Record<string, unknown>).messages)
    ? ((data as Record<string, unknown>).messages as EvoMessage[])
    : [data as EvoMessage]

  const companyId = await resolveCompany(instance)
  if (!companyId) {
    console.warn(`[${instance}] ⚠️ Nenhuma company encontrada — mensagens descartadas`)
    return
  }

  for (const msg of messages) {
    const jid         = msg.key?.remoteJid ?? ""
    const fromMe      = msg.key?.fromMe ?? false
    const waMessageId = msg.key?.id ?? ""

    if (jid.endsWith("@g.us")) continue  // ignorar grupos
    if (fromMe) continue                  // ignorar mensagens enviadas por nós (outbound)
    if (!waMessageId) { console.warn(`[${instance}] Mensagem sem key.id — ignorada`); continue }

    const senderPhone = jidToPhone(jid)
    const messageType = msg.messageType ?? "unknown"

    // Enfileira — processamento feito pelo inbound-processor.worker
    await db.inboundMessage.upsert({
      where:  { instanceId_waMessageId: { instanceId: instance, waMessageId } },
      update: {},  // idempotência: se já existe, não atualiza
      create: {
        companyId,
        instanceId:  instance,
        waMessageId,
        senderPhone,
        messageType,
        payload:      msg as object,
        status:       "PENDING",
        nextAttemptAt: new Date(),
      },
    })

    console.log(`[${instance}] ✉️ Enfileirada | ${senderPhone} | ${messageType} | waId: ${waMessageId}`)
  }
}

async function onMessagesUpdate(instance: string, data: Record<string, unknown>) {
  const updates: EvoMessageUpdate[] = Array.isArray(data) ? data : [data as EvoMessageUpdate]
  for (const u of updates) {
    console.log(`[${instance}] ✏️ Status de mensagem | id: ${u.key?.id} | ${u.update?.status}`)
  }
}

async function onContactsUpsert(instance: string, data: Record<string, unknown>) {
  const contacts: EvoContact[] = Array.isArray(data) ? data : [data as EvoContact]
  const companyId = await resolveCompany(instance)
  if (!companyId) return

  for (const c of contacts) {
    if (!c.id) continue
    const phone = jidToPhone(c.id)
    const name = c.pushName ?? c.name ?? phone

    await db.customer.upsert({
      where: {
        id: (await db.customer.findFirst({ where: { companyId, phone } }))?.id ?? "new",
      },
      update: { name },
      create: {
        companyId,
        name,
        phone,
        status: "EM_ANALISE",
        stage: "QUALIFICACAO",
      },
    })

    console.log(`[${instance}] 👤 Contato upserted | ${name} (${phone})`)
  }
}

async function onConnectionUpdate(instance: string, data: Record<string, unknown>) {
  const conn = data as EvoConnection
  console.log(`[${instance}] 🔌 Conexão | estado: ${conn.state} | razão: ${conn.statusReason ?? "-"}`)

  const companyId = await resolveCompany(instance)
  if (!companyId) return

  // Upsert do connector de WhatsApp
  await db.connector.upsert({
    where: {
      companyId_name: { companyId, name: instance },
    },
    update: {
      status: conn.state === "open" ? "CONECTADO" : conn.state === "connecting" ? "REVISAR" : "DESCONECTADO",
      details: `Estado: ${conn.state} — ${new Date().toLocaleString("pt-BR")}`,
      config: { instanceId: instance },
      lastEventAt: new Date(),
    },
    create: {
      companyId,
      name: instance,
      type: "CANAL",
      status: conn.state === "open" ? "CONECTADO" : "DESCONECTADO",
      details: `Estado: ${conn.state}`,
      config: { instanceId: instance },
      lastEventAt: new Date(),
    },
  })
}

async function onPresenceUpdate(instance: string, data: Record<string, unknown>) {
  const p = data as { id?: string; presences?: Record<string, { lastKnownPresence?: string }> }
  const state = Object.values(p.presences ?? {})[0]?.lastKnownPresence ?? "unknown"
  console.log(`[${instance}] 👁️ Presença | ${jidToPhone(p.id ?? "")} → ${state}`)
}

async function onChatsUpsert(instance: string, data: Record<string, unknown>) {
  const chats = Array.isArray(data) ? data : [data]
  console.log(`[${instance}] 📋 Chats sincronizados: ${chats.length}`)
}

async function onMessagesDelete(instance: string, data: Record<string, unknown>) {
  const d = data as { key?: { id?: string } }
  console.log(`[${instance}] 🗑️ Mensagem deletada | id: ${d.key?.id}`)
}

async function onCall(instance: string, data: Record<string, unknown>) {
  const call = data as { from?: string; status?: string }
  console.log(`[${instance}] 📞 Chamada | de: ${call.from} | status: ${call.status}`)
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

async function dispatch(raw: string, instance: string, data: Record<string, unknown>): Promise<void> {
  const event = normalizeEvent(raw)

  switch (event) {
    case "MESSAGES_UPSERT":   return onMessagesUpsert(instance, data)
    case "MESSAGES_UPDATE":   return onMessagesUpdate(instance, data)
    case "MESSAGES_DELETE":   return onMessagesDelete(instance, data)
    case "CONTACTS_UPSERT":
    case "CONTACTS_UPDATE":   return onContactsUpsert(instance, data)
    case "CONNECTION_UPDATE": return onConnectionUpdate(instance, data)
    case "PRESENCE_UPDATE":   return onPresenceUpdate(instance, data)
    case "CHATS_UPSERT":
    case "CHATS_UPDATE":      return onChatsUpsert(instance, data)
    case "SEND_MESSAGE":
    case "CHATS_DELETE":
    case "GROUPS_UPSERT":
    case "GROUP_UPDATE":
    case "GROUP_PARTICIPANTS_UPDATE":
    case "LABELS_EDIT":
    case "LABELS_ASSOCIATION":
    case "TYPEBOT_START":
    case "TYPEBOT_CHANGE_FLOW":
      console.log(`[${instance}] ℹ️  ${event} (sem handler dedicado)`)
      break
    default:
      console.warn(`[${instance}] ⚠️  Evento não mapeado: "${raw}" → normalizado: "${event}"`)
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

router.post("/", async (req: Request, res: Response) => {
  res.status(200).json({ ok: true })

  const payload = req.body as EvolutionPayload

  if (!payload?.event) {
    console.warn("[evolution] Payload sem 'event':", JSON.stringify(payload).slice(0, 300))
    return
  }

  try {
    await dispatch(payload.event, payload.instance ?? "unknown", payload.data ?? {})
  } catch (err) {
    console.error(`[evolution] Erro no evento "${payload.event}":`, err)
  }
})

router.get("/", (_req: Request, res: Response) => {
  res.json({ status: "ok", endpoint: "evolution webhook", timestamp: new Date().toISOString() })
})

export default router
