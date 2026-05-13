export type TicketStatus = "Novo" | "Triagem" | "Em atendimento" | "Aguardando cliente" | "Resolvido"
export type TicketPriority = "Crítica" | "Alta" | "Média" | "Baixa"
export type TicketSlaState = "Vencido" | "Em risco" | "No prazo"
export type TicketCategory = "Financeiro" | "Técnico" | "Implantação" | "Comercial"

export interface SupportTicket {
  id: string
  code: string
  title: string
  customer: string
  contact: string
  channel: string
  conversationId?: string | null
  category: TicketCategory
  priority: TicketPriority
  status: TicketStatus
  team: string
  assignee: string
  slaState: TicketSlaState
  slaDueAt: string
  timeLeft: string
  updatedAt: string
  tags: string[]
  summary: string
  activity: { at: string; author: string; text: string }[]
}

const STORAGE_KEY = "zv_mock_support_tickets"
const EVENT_NAME = "zv:support-ticket-created"

export const supportTeams = ["Suporte N1", "Suporte Técnico", "Financeiro CS", "Implantação", "Comercial"] as const
export const supportCategories: TicketCategory[] = ["Financeiro", "Técnico", "Implantação", "Comercial"]
export const supportPriorities: TicketPriority[] = ["Crítica", "Alta", "Média", "Baixa"]

export const mockSupportTickets: SupportTicket[] = [
  {
    id: "mock-001",
    code: "SUP-1048",
    title: "Cliente sem acesso ao painel financeiro",
    customer: "Carolina Mendes",
    contact: "carolina@clinicavita.com.br",
    channel: "E-mail",
    conversationId: "email-carolina",
    category: "Financeiro",
    priority: "Alta",
    status: "Em atendimento",
    team: "Financeiro CS",
    assignee: "Aline Costa",
    slaState: "Em risco",
    slaDueAt: new Date(Date.now() + 42 * 60_000).toISOString(),
    timeLeft: "42 min",
    updatedAt: new Date(Date.now() - 18 * 60_000).toISOString(),
    tags: ["fatura", "plano-growth"],
    summary: "Solicitou segunda via da fatura e análise de troca de plano antes do próximo ciclo.",
    activity: [
      { at: "há 18 min", author: "Aline Costa", text: "Validou dados de cobrança e pediu simulação do plano Growth." },
      { at: "há 41 min", author: "Sistema", text: "SLA classificado como em risco por prioridade alta." },
    ],
  },
  {
    id: "mock-002",
    code: "SUP-1047",
    title: "Falha intermitente na integração REST",
    customer: "Gustavo Pires",
    contact: "gustavo@novalog.com",
    channel: "E-mail",
    conversationId: "email-gustavo",
    category: "Técnico",
    priority: "Crítica",
    status: "Triagem",
    team: "Suporte Técnico",
    assignee: "Rafael Lima",
    slaState: "Vencido",
    slaDueAt: new Date(Date.now() - 28 * 60_000).toISOString(),
    timeLeft: "-28 min",
    updatedAt: new Date(Date.now() - 52 * 60_000).toISOString(),
    tags: ["api", "crm", "webhook"],
    summary: "Cliente usa CRM próprio e reportou falha ao registrar histórico completo via API.",
    activity: [
      { at: "há 52 min", author: "Rafael Lima", text: "Solicitou documentação e amostra de payload com erro." },
      { at: "há 1h", author: "Sistema", text: "Ticket criado a partir de conversa de e-mail." },
    ],
  },
  {
    id: "mock-003",
    code: "SUP-1046",
    title: "Ajuste de usuários na implantação",
    customer: "Helena Duarte",
    contact: "helena@aurorafoods.com.br",
    channel: "E-mail",
    conversationId: "email-helena",
    category: "Implantação",
    priority: "Média",
    status: "Aguardando cliente",
    team: "Implantação",
    assignee: "Marina Lopes",
    slaState: "No prazo",
    slaDueAt: new Date(Date.now() + 7 * 60 * 60_000).toISOString(),
    timeLeft: "7h",
    updatedAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
    tags: ["usuarios", "implantacao"],
    summary: "Precisa incluir mais dois usuários sem alterar cronograma de implantação.",
    activity: [
      { at: "há 2h", author: "Marina Lopes", text: "Enviou revisão de escopo para validação da cliente." },
      { at: "há 3h", author: "Sistema", text: "Equipe Implantação selecionada por categoria." },
    ],
  },
  {
    id: "mock-004",
    code: "SUP-1045",
    title: "Dúvida sobre operação omnichannel Enterprise",
    customer: "Bianca Torres",
    contact: "bianca@atlascommerce.com.br",
    channel: "E-mail",
    conversationId: "email-bianca",
    category: "Comercial",
    priority: "Alta",
    status: "Novo",
    team: "Comercial",
    assignee: "Sem responsável",
    slaState: "No prazo",
    slaDueAt: new Date(Date.now() + 3 * 60 * 60_000).toISOString(),
    timeLeft: "3h",
    updatedAt: new Date(Date.now() - 9 * 60_000).toISOString(),
    tags: ["enterprise", "sla", "omnichannel"],
    summary: "Cliente quer visibilidade de SLA por canal e automações com IA para operação comercial.",
    activity: [
      { at: "há 9 min", author: "Sistema", text: "Ticket novo aguardando triagem da equipe Comercial." },
    ],
  },
]

export function readSessionSupportTickets(): SupportTicket[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) as SupportTicket[] : []
  } catch {
    return []
  }
}

export function saveSessionSupportTickets(tickets: SupportTicket[]) {
  if (typeof window === "undefined") return
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tickets))
  window.dispatchEvent(new Event(EVENT_NAME))
}

export function createSupportTicket(ticket: Omit<SupportTicket, "id" | "code" | "activity" | "updatedAt"> & { activity?: SupportTicket["activity"] }) {
  const existing = readSessionSupportTickets()
  const nextNumber = 2001 + existing.length
  const created: SupportTicket = {
    id: `session-${Date.now()}`,
    code: `SUP-${nextNumber}`,
    updatedAt: new Date().toISOString(),
    activity: ticket.activity ?? [{ at: "agora", author: "Sistema", text: "Chamado criado a partir de conversa." }],
    ...ticket,
  }
  saveSessionSupportTickets([created, ...existing])
  return created
}

export function supportTicketEventName() {
  return EVENT_NAME
}
