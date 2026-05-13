export type RopChannel = "WHATSAPP" | "EMAIL" | "BOTH"

export type Rop = {
  id: string
  title: string
  shortcut: string
  category: string
  channel: RopChannel
  text: string
  active: boolean
  updatedAt: string
}

export const ROP_STORAGE_KEY = "zapvendas:rops"

export const ropChannels: Array<{ value: RopChannel; label: string }> = [
  { value: "BOTH", label: "WhatsApp e E-mail" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "EMAIL", label: "E-mail" },
]

export const ropCategories = [
  "Boas-vindas",
  "Qualificação",
  "Proposta",
  "Suporte",
  "Financeiro",
  "Follow-up",
  "Encerramento",
]

const defaultRops: Rop[] = [
  {
    id: "rop-boas-vindas",
    title: "Boas-vindas e triagem",
    shortcut: "/boasvindas",
    category: "Boas-vindas",
    channel: "BOTH",
    active: true,
    updatedAt: new Date("2026-05-01T12:00:00.000Z").toISOString(),
    text: "Olá! Obrigado pelo contato. Para te ajudar melhor, pode me confirmar seu nome, empresa e qual objetivo você quer resolver hoje?",
  },
  {
    id: "rop-qualificacao-comercial",
    title: "Qualificação comercial",
    shortcut: "/qualificar",
    category: "Qualificação",
    channel: "WHATSAPP",
    active: true,
    updatedAt: new Date("2026-05-01T12:05:00.000Z").toISOString(),
    text: "Perfeito. Antes de te indicar o melhor caminho, me conta rapidamente: quantas pessoas usam a operação hoje, quais canais vocês atendem e qual CRM ou ferramenta central vocês já utilizam?",
  },
  {
    id: "rop-envio-proposta",
    title: "Envio de proposta",
    shortcut: "/proposta",
    category: "Proposta",
    channel: "EMAIL",
    active: true,
    updatedAt: new Date("2026-05-01T12:10:00.000Z").toISOString(),
    text: "Olá,\n\nConforme conversamos, segue o resumo da proposta com escopo, implantação e próximos passos. Fico à disposição para ajustar qualquer ponto antes da aprovação.\n\nAtenciosamente,",
  },
  {
    id: "rop-suporte-retorno",
    title: "Retorno de suporte",
    shortcut: "/suporte",
    category: "Suporte",
    channel: "BOTH",
    active: true,
    updatedAt: new Date("2026-05-01T12:15:00.000Z").toISOString(),
    text: "Recebemos sua solicitação e já estamos analisando. Vou acompanhar por aqui e te retorno com a atualização assim que tivermos a próxima etapa definida.",
  },
  {
    id: "rop-follow-up",
    title: "Follow-up sem retorno",
    shortcut: "/followup",
    category: "Follow-up",
    channel: "BOTH",
    active: true,
    updatedAt: new Date("2026-05-01T12:20:00.000Z").toISOString(),
    text: "Passando para confirmar se ficou alguma dúvida sobre o que conversamos. Posso te ajudar com uma simulação, detalhes de implantação ou próximos passos?",
  },
]

export function loadRops(): Rop[] {
  if (typeof window === "undefined") return defaultRops

  try {
    const stored = window.localStorage.getItem(ROP_STORAGE_KEY)
    if (!stored) {
      saveRops(defaultRops)
      return defaultRops
    }

    const parsed = JSON.parse(stored) as Rop[]
    return Array.isArray(parsed) ? parsed : defaultRops
  } catch {
    return defaultRops
  }
}

export function saveRops(rops: Rop[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(ROP_STORAGE_KEY, JSON.stringify(rops))
  window.dispatchEvent(new Event("rops:changed"))
}

export function channelMatchesRop(rop: Rop, channel: string) {
  if (!rop.active) return false
  if (rop.channel === "BOTH") return true
  return rop.channel === channel
}

export function ropChannelLabel(channel: RopChannel) {
  return ropChannels.find((item) => item.value === channel)?.label ?? channel
}

export function createBlankRop(): Rop {
  return {
    id: `rop-${Date.now()}`,
    title: "",
    shortcut: "/",
    category: "Boas-vindas",
    channel: "BOTH",
    text: "",
    active: true,
    updatedAt: new Date().toISOString(),
  }
}
