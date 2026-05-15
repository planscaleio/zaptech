import { useCallback, useMemo, useState, useEffect, useRef } from "react"
import { useAuth } from "@/hooks/useAuth"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  closestCorners,
} from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { DroppableColumn, CardGhost } from "@/components/KanbanDnd"
import {
  Activity,
  Archive,
  ArchiveX,
  ArrowRightLeft,
  Bell,
  BookOpenText,
  Bot,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  CircleCheck,
  ClipboardList,
  Crown,
  DollarSign,
  Download,
  CircleDot,
  Clock3,
  Command,
  FileText,
  GitBranch,
  ImageIcon,
  Inbox,
  Kanban,
  Languages,
  Layers3,
  LifeBuoy,
  Loader2,
  Lock,
  Pencil,
  Mail,
  Maximize2,
  Megaphone,
  MessageCircle,
  MoreHorizontal,
  PanelLeft,
  Paperclip,
  Pause,
  Phone,
  Plus,
  PlayCircle,
  Radio,
  Save,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tags,
  Thermometer,
  TrendingUp,
  UserRound,
  Users,
  Trash2,
  Volume2,
  Wand2,
  Workflow,
  X,
  Zap,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Sheet, SheetHeader, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { supportCategories, supportPriorities, supportTeams, type TicketCategory, type TicketPriority } from "@/lib/supportTickets"
import { channelMatchesRop, loadRops, ropChannelLabel, type Rop } from "@/lib/rops"
import { formatKnowledgeChannels, htmlToPlainText, type KnowledgeArticle, type KnowledgeChannel } from "@/lib/knowledge"

const conversations = [
  {
    name: "Mariana Costa",
    company: "Clínica Aquarela",
    channel: "WhatsApp",
    status: "Alta intenção",
    leadValue: "R$ 18.400",
    tags: ["#crm", "#demo"],
    aiReason: "Pediu preço, integração e expansão de usuários",
    nextAction: "Confirmar CRM e enviar proposta com implantação",
    tone: "warning" as const,
    time: "2 min",
    preview: "Quer confirmar valores para contratar ainda hoje.",
  },
  {
    name: "Rafael Lima",
    company: "RL Distribuidora",
    channel: "Instagram",
    status: "Aguardando",
    leadValue: "R$ 9.800",
    tags: ["#planos", "#growth"],
    aiReason: "Comparando planos com sinal de orçamento",
    nextAction: "Enviar comparativo Growth x Scale",
    tone: "secondary" as const,
    time: "8 min",
    preview: "Pediu comparação entre os planos Growth e Scale.",
  },
  {
    name: "Bianca Alves",
    company: "Solo Arquitetura",
    channel: "Site",
    status: "Em análise",
    leadValue: "R$ 12.200",
    tags: ["#implantacao", "#site"],
    aiReason: "Lead qualificado com dúvida de implantação",
    nextAction: "Agendar diagnóstico técnico",
    tone: "success" as const,
    time: "14 min",
    preview: "Lead qualificado pelo agente de triagem.",
  },
]

const messages = [
  {
    author: "Mariana Costa",
    role: "Cliente",
    text: "Oi, preciso entender se consigo começar com 4 atendentes e depois aumentar. Vocês conseguem integrar com meu CRM?",
    align: "left",
  },
  {
    author: "Agente IA",
    role: "Qualificação",
    text: "A cliente tem urgência e citou expansão. Sugestão: confirmar CRM atual, volume mensal e oferecer plano com implantação assistida.",
    align: "left",
    ai: true,
  },
  {
    author: "Você",
    role: "Atendimento",
    text: "Conseguimos sim, Mariana. Para eu te passar o caminho mais certeiro: qual CRM vocês usam hoje e qual volume médio de conversas por mês?",
    align: "right",
  },
]

const agents = [
  { name: "Triagem", icon: Inbox, load: "18 filas", status: "online" },
  { name: "Qualificador", icon: BrainCircuit, load: "9 leads", status: "online" },
  { name: "Vendas", icon: MessageCircle, load: "6 ativas", status: "busy" },
  { name: "Suporte", icon: LifeBuoy, load: "3 tickets", status: "online" },
]

const OLLAMA_MODEL_LABEL = "Gemma 4"

const AI_TOOLS = [
  { id: "summary",     name: "Resumo da conversa",    icon: Sparkles,    accent: "bg-cyan-50 text-cyan-700",     color: "text-cyan-700" },
  { id: "next_action", name: "Próxima melhor ação",   icon: Wand2,       accent: "bg-amber-50 text-amber-700",   color: "text-amber-700" },
  { id: "policy",      name: "Checagem de política",  icon: ShieldCheck, accent: "bg-emerald-50 text-emerald-700", color: "text-emerald-700" },
  { id: "followup",    name: "Automação de follow-up",icon: Workflow,    accent: "bg-rose-50 text-rose-700",     color: "text-rose-700" },
] as const

type AIToolId = typeof AI_TOOLS[number]["id"]

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const re = /\*\*(.+?)\*\*/g
  let last = 0, m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    parts.push(<strong key={m.index} className="font-semibold text-foreground">{m[1]}</strong>)
    last = re.lastIndex
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

function renderMarkdown(text: string): React.ReactNode {
  const blocks: React.ReactNode[] = []
  let listItems: { key: number; content: string; ordered: boolean; num?: string }[] = []

  const flushList = () => {
    if (!listItems.length) return
    const ordered = listItems[0].ordered
    if (ordered) {
      blocks.push(
        <ol key={`ol-${listItems[0].key}`} className="mb-3 ml-1 space-y-1 list-none">
          {listItems.map((item) => (
            <li key={item.key} className="flex gap-2 text-sm leading-6 text-foreground/85">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">{item.num}</span>
              <span>{renderInline(item.content)}</span>
            </li>
          ))}
        </ol>
      )
    } else {
      blocks.push(
        <ul key={`ul-${listItems[0].key}`} className="mb-3 ml-1 space-y-1 list-none">
          {listItems.map((item) => (
            <li key={item.key} className="flex gap-2 text-sm leading-6 text-foreground/85">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{renderInline(item.content)}</span>
            </li>
          ))}
        </ul>
      )
    }
    listItems = []
  }

  const lines = text.split("\n")
  lines.forEach((line, i) => {
    // Heading ## or ###
    const h2 = line.match(/^#{1,3}\s+(.+)/)
    if (h2) {
      flushList()
      blocks.push(
        <h3 key={i} className="mb-2 mt-4 flex items-center gap-2 text-sm font-bold tracking-wide text-foreground first:mt-0">
          {renderInline(h2[1])}
        </h3>
      )
      return
    }
    // Ordered list: "1.  text" or "1. text"
    const ordered = line.match(/^(\d+)\.\s{1,3}(.+)/)
    if (ordered) {
      listItems.push({ key: i, content: ordered[2], ordered: true, num: ordered[1] })
      return
    }
    // Unordered list: "*   text" or "- text" or "•  text"
    const bullet = line.match(/^[-*•]\s+(.+)/)
    if (bullet) {
      listItems.push({ key: i, content: bullet[1], ordered: false })
      return
    }
    // Blank line
    if (!line.trim()) {
      flushList()
      blocks.push(<div key={i} className="h-2" />)
      return
    }
    // Regular paragraph
    flushList()
    blocks.push(
      <p key={i} className="mb-1.5 text-sm leading-6 text-foreground/85">
        {renderInline(line)}
      </p>
    )
  })
  flushList()
  return <>{blocks}</>
}

const metrics = [
  { label: "Atendimentos ativos", value: "42", change: "+12%" },
  { label: "Tempo médio", value: "1m 48s", change: "-22%" },
  { label: "Conversões hoje", value: "17", change: "+8%" },
]

// navItems and viewCopy moved to src/lib/nav.ts
const navItems = [
  { id: "atendimento", label: "Atendimento", icon: MessageCircle },
  { id: "quadros", label: "Quadros comerciais", icon: Kanban },
  { id: "agentes", label: "Agentes IA", icon: Bot },
  { id: "automacoes", label: "Automações", icon: Workflow },
  { id: "segmentacao", label: "Segmentação", icon: Layers3 },
  { id: "transmissao", label: "Transmissão", icon: Radio },
  { id: "campanhas", label: "Campanhas", icon: Megaphone },
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "equipes", label: "Equipes de venda", icon: UserRound },
  { id: "auditorias", label: "Auditorias & Análises", icon: ShieldCheck },
  { id: "relatorios", label: "Relatórios", icon: Activity },
  { id: "configuracoes", label: "Configurações", icon: Settings },
] as const

type ViewId = (typeof navItems)[number]["id"]

const viewCopy: Record<ViewId, { title: string; subtitle: string; action: string }> = {
  atendimento: {
    title: "Central de atendimento",
    subtitle: "Multiagente, multicanal e assistida por IA",
    action: "Novo atendimento",
  },
  quadros: {
    title: "Quadros comerciais",
    subtitle: "Pipeline visual com contato, bot, coluna e dados do usuário",
    action: "Adicionar cartão",
  },
  agentes: {
    title: "Agentes IA",
    subtitle: "Modelos, instruções e regras de resposta conectados aos fluxos",
    action: "Novo agente",
  },
  automacoes: {
    title: "Fluxos de conversa",
    subtitle: "Construtor visual para agentes, mensagens e condições",
    action: "Novo fluxo",
  },
  segmentacao: {
    title: "Segmentação",
    subtitle: "Agrupe leads e clientes por intenção, perfil, produto e comportamento",
    action: "Novo segmento",
  },
  transmissao: {
    title: "Transmissão",
    subtitle: "Envios em massa controlados por canal, segmento e regras de opt-in",
    action: "Nova transmissão",
  },
  campanhas: {
    title: "Campanhas",
    subtitle: "Planejamento, execução e análise de campanhas comerciais",
    action: "Nova campanha",
  },
  clientes: {
    title: "Clientes",
    subtitle: "Visão compacta da base, histórico e oportunidades",
    action: "Novo cliente",
  },
  equipes: {
    title: "Equipes de venda",
    subtitle: "Cadastro, gestão, metas e distribuição dos times comerciais",
    action: "Nova equipe",
  },
  auditorias: {
    title: "Auditorias & Análises",
    subtitle: "Análise pesada de IA para conversas, riscos, qualidade e performance",
    action: "Nova auditoria",
  },
  relatorios: {
    title: "Relatórios",
    subtitle: "Indicadores de operação, conversão e performance dos agentes",
    action: "Novo relatório",
  },
  configuracoes: {
    title: "Configurações",
    subtitle: "Canais, usuários, permissões e integrações da operação",
    action: "Configurar",
  },
}


const flowNodes = [
  {
    id: "assistant",
    title: "Assistente GPT",
    type: "Assistente de IA",
    body: "Você deve SEMPRE retornar uma resposta final ao usuário. Mesmo quando utilizar ferramentas, resuma o resultado em texto simples.",
    branches: ["Inatividade 30 min", "Resposta bem-sucedida", "Resposta falha"],
  },
  {
    id: "message",
    title: "Enviar mensagem",
    type: "WhatsApp",
    body: "Olá, {nome_cliente}. Esta é uma atualização importante sobre sua conversa. Entraremos em contato para discutir a renovação.",
    branches: ["Próximo passo após a mensagem"],
  },
]

const customers = [
  {
    name: "Mariana Costa",
    company: "Clínica Aquarela",
    phone: "+55 11 98822-4100",
    email: "mariana@aquarela.com",
    owner: "Camila Souza",
    stage: "Demonstração",
    value: "R$ 18.400",
    source: "Campanha CRM",
    status: "Quente",
    lastContact: "há 2 min",
    tags: ["#crm", "#whatsapp", "#demo"],
    segment: "Saúde",
    document: "32.940.118/0001-02",
    city: "São Paulo, SP",
    lifetimeValue: "R$ 64.200",
    purchasedProducts: [
      ["Plano Growth", "Ativo", "R$ 4.800/mês"],
      ["Implantação assistida", "Concluído", "R$ 8.000"],
      ["Pacote WhatsApp 10k", "Ativo", "R$ 1.200/mês"],
    ],
    attendants: [
      ["Camila Souza", "Closer", "Responsável atual"],
      ["Nina Ribeiro", "SDR", "Qualificação inicial"],
      ["Agente IA Vendas", "IA", "Resumo e próxima ação"],
    ],
    chatHistory: [
      ["WhatsApp", "Hoje 14:32", "Negociação sobre integração com CRM", "Positivo"],
      ["Site", "Ontem 09:18", "Solicitou demonstração e preços", "Neutro"],
      ["Instagram", "22/04/2026", "Comentou campanha e pediu material", "Positivo"],
    ],
    aiReview: {
      score: "91/100",
      sentiment: "Positivo",
      risk: "Baixo",
      nextBestAction: "Enviar proposta com integração CRM e implantação assistida.",
      findings: ["Alta intenção de compra", "Objeção principal é integração", "Cliente valoriza expansão de usuários"],
    },
  },
  {
    name: "Rafael Lima",
    company: "RL Distribuidora",
    phone: "+55 31 97770-1190",
    email: "rafael@rldistribuidora.com",
    owner: "João Martins",
    stage: "Proposta",
    value: "R$ 9.800",
    source: "Instagram",
    status: "Nutrição",
    lastContact: "há 8 min",
    tags: ["#growth", "#planos"],
  },
  {
    name: "Bianca Alves",
    company: "Solo Arquitetura",
    phone: "+55 21 99814-2201",
    email: "bianca@solo.arq.br",
    owner: "Daniel Fachin",
    stage: "Qualificação",
    value: "R$ 12.200",
    source: "Site",
    status: "Em análise",
    lastContact: "há 14 min",
    tags: ["#implantacao", "#site"],
  },
  {
    name: "Guilherme Vendramine",
    company: "Vendramine Consultoria",
    phone: "+55 33 8806-6425",
    email: "-",
    owner: "Daniel Fachin",
    stage: "Fechado",
    value: "R$ 22.000",
    source: "Webhook",
    status: "Cliente",
    lastContact: "ontem",
    tags: ["#fechado", "#webhook"],
  },
]

const salesTeams = [
  {
    name: "Inside Sales",
    manager: "Camila Souza",
    members: 8,
    target: "R$ 320 mil",
    pipeline: "R$ 870 mil",
    conversion: "18%",
    channels: ["WhatsApp", "Instagram"],
  },
  {
    name: "Enterprise",
    manager: "Daniel Fachin",
    members: 5,
    target: "R$ 540 mil",
    pipeline: "R$ 1,4 mi",
    conversion: "24%",
    channels: ["Site", "CRM"],
  },
  {
    name: "Sucesso Comercial",
    manager: "João Martins",
    members: 6,
    target: "R$ 190 mil",
    pipeline: "R$ 420 mil",
    conversion: "31%",
    channels: ["WhatsApp", "E-mail"],
  },
]

const teamMembers = [
  ["Camila Souza", "Coordenadora", "42 leads", "R$ 188 mil"],
  ["João Martins", "Closer", "27 leads", "R$ 141 mil"],
  ["Daniel Fachin", "Enterprise", "19 leads", "R$ 390 mil"],
  ["Nina Ribeiro", "SDR", "53 leads", "R$ 96 mil"],
]

const settingsGroups = [
  {
    title: "Canais conectados",
    description: "WhatsApp, Instagram, site e entrada por webhook",
    items: [
      ["WhatsApp Business", "Conectado", "success" as const],
      ["Instagram Direct", "Conectado", "success" as const],
      ["Widget do site", "Pendente", "warning" as const],
    ],
  },
  {
    title: "Usuários e permissões",
    description: "Perfis de acesso para atendimento, gestores e administradores",
    items: [
      ["Administradores", "3 usuários", "secondary" as const],
      ["Atendentes", "18 usuários", "secondary" as const],
      ["Auditores IA", "2 usuários", "secondary" as const],
    ],
  },
  {
    title: "Integrações",
    description: "CRM, webhooks, calendário e enriquecimento de dados",
    items: [
      ["CRM comercial", "Ativo", "success" as const],
      ["Webhook de leads", "Ativo", "success" as const],
      ["Calendário de reuniões", "Revisar", "warning" as const],
    ],
  },
] as const

const segments = [
  ["Leads quentes CRM", "842 contatos", "Intenção alta + origem CRM", "R$ 1,8 mi"],
  ["Clientes expansão", "214 contas", "Produto ativo + uso crescente", "R$ 920 mil"],
  ["Reativação 90 dias", "1.204 contatos", "Sem conversa recente", "R$ 640 mil"],
  ["Enterprise inbound", "96 contas", "Valor potencial acima de R$ 50 mil", "R$ 2,4 mi"],
]

const broadcasts = [
  ["Renovação de contratos", "WhatsApp", "Agendada", "3.420 contatos", "18:00"],
  ["Convite demonstração", "Instagram", "Rascunho", "840 contatos", "-"],
  ["Follow-up proposta", "WhatsApp", "Em envio", "1.128 contatos", "42%"],
]

const campaigns = [
  ["Growth Maio", "Aquisição", "Ativa", "R$ 46.200", "312 leads"],
  ["Reativação clínicas", "Retenção", "Planejada", "R$ 18.900", "1.204 contatos"],
  ["Enterprise CRM", "ABM", "Ativa", "R$ 220.000", "96 contas"],
]

const auditAnalyses = [
  ["Atendimento Mariana Costa", "91/100", "Baixo risco", "Enviar proposta com integração CRM"],
  ["Follow-up RL Distribuidora", "76/100", "Risco médio", "Responder objeção de preço com prova social"],
  ["Suporte Solo Arquitetura", "84/100", "Baixo risco", "Agendar implantação assistida"],
  ["Renovação Vendramine", "68/100", "Alto risco", "Escalar para gestor com desconto aprovado"],
]

const aiImpactCards = [
  ["Resumo automático", "Cliente quer começar com 4 atendentes, integrar CRM e escalar depois."],
  ["Auto-tags", "#crm #alta-intencao #implantacao #expansao"],
  ["Próxima melhor ação", "Confirmar CRM atual, volume mensal e enviar proposta com onboarding assistido."],
  ["Risco detectado", "Baixo. Risco depende apenas da compatibilidade de integração."],
]

// App.tsx now only exports view components.
// Routing and layout are handled by src/main.tsx + src/layouts/AppLayout.tsx

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConvSummary {
  id: string
  preview: string | null
  status: string
  channel: string
  lastMessageAt: string | null
  createdAt: string
  leadValue: string | null
  aiReason: string | null
  nextAction: string | null
  tags: { id: string; name: string; color: string }[]
  customer: { id: string; name: string; phone: string | null; email?: string | null; status: string; aiScore: number | null; isVip: boolean; avatarUrl?: string | null }
}

interface ConvDetail extends ConvSummary {
  messages: {
    id: string
    authorName: string
    role: string
    text: string
    align: string
    isAiGenerated: boolean
    createdAt: string
    pending?: boolean
    attachments?: MessageAttachment[]
  }[]
  customer: ConvSummary["customer"] & {
    email: string | null; stage: string | null; source: string | null; value: string | null
    aiSentiment: string | null; aiRisk: string | null; aiNextBestAction: string | null
    aiFindings: { id: string; text: string }[]
  }
}

type MessageAttachment = {
  id: string
  type: "IMAGE" | "AUDIO" | "DOCUMENT" | "VIDEO"
  fileName: string
  mimeType: string
  size: number | null
  url: string
  externalUrl?: string | null
}

type PendingAttachment = {
  id: string
  file: File
  previewUrl: string
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "—"
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "agora"
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

function formatFileSize(size: number | null | undefined): string {
  if (!size) return "—"
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? "").replace(/^data:[^;]+;base64,/, ""))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function statusToVariant(status: string): "warning" | "success" | "secondary" | "outline" {
  const map: Record<string, "warning" | "success" | "secondary"> = {
    ALTA_INTENCAO: "warning",
    RESOLVIDO: "success",
    ENCERRADO: "success",
    EM_ANALISE: "secondary",
    AGUARDANDO: "secondary",
    ARQUIVADO: "secondary",
    PARA_EXCLUIR: "secondary",
  }
  return map[status] ?? "outline"
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    ALTA_INTENCAO: "Alta intenção",
    AGUARDANDO: "Aguardando",
    EM_ANALISE: "Em análise",
    RESOLVIDO: "Resolvido",
    ENCERRADO: "Encerrado",
    ARQUIVADO: "Arquivado",
    PARA_EXCLUIR: "Para excluir",
  }
  return map[status] ?? status
}

function channelLabel(channel: string): string {
  const map: Record<string, string> = { WHATSAPP: "WhatsApp", INSTAGRAM: "Instagram", SITE: "Site", EMAIL: "E-mail", TELEFONE: "Telefone" }
  return map[channel] ?? channel
}

const brlFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

function parseCurrencyValue(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (!value) return null

  const raw = String(value).trim()
  if (!raw || raw === "—") return null

  const numeric = raw.replace(/[^\d,.-]/g, "")
  if (!numeric) return null

  const normalized = numeric.includes(",")
    ? numeric.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(numeric)
      ? numeric.replace(/\./g, "")
      : numeric

  const amount = Number(normalized)
  return Number.isFinite(amount) ? amount : null
}

function formatCurrency(value: string | number | null | undefined, fallback = "—"): string {
  const amount = parseCurrencyValue(value)
  return amount === null ? fallback : brlFormatter.format(amount)
}

function initials(name: string): string {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
}

const avatarPalette = [
  "bg-cyan-50 text-cyan-700",
  "bg-emerald-50 text-emerald-700",
  "bg-amber-50 text-amber-700",
  "bg-rose-50 text-rose-700",
  "bg-violet-50 text-violet-700",
  "bg-slate-100 text-slate-700",
]

function avatarTone(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash + seed.charCodeAt(i) * (i + 1)) % avatarPalette.length
  return avatarPalette[hash]
}

function CustomerAvatar({ customer, className = "size-10" }: { customer: ConvSummary["customer"]; className?: string }) {
  return (
    <Avatar className={className}>
      {customer.avatarUrl ? (
        <AvatarImage src={customer.avatarUrl} alt={customer.name} />
      ) : (
        <AvatarFallback className={cn("ring-1 ring-inset ring-black/5", avatarTone(customer.id || customer.name))}>
          <UserRound className="size-4" />
        </AvatarFallback>
      )}
    </Avatar>
  )
}

function formatAudioTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${String(secs).padStart(2, "0")}`
}

function ChatAudioPlayer({ attachment, outgoing }: { attachment: MessageAttachment; outgoing?: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const objectUrlRef = useRef<string | null>(null)
  const [src, setSrc] = useState(attachment.url || attachment.externalUrl || "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  useEffect(() => {
    const url = attachment.url || attachment.externalUrl || ""
    setSrc(url)
    setError("")
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [attachment.id, attachment.url, attachment.externalUrl])

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

  async function ensureBlobSource() {
    if (!src || src.startsWith("blob:") || objectUrlRef.current) return src

    setLoading(true)
    setError("")
    try {
      const response = await fetch(src)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      objectUrlRef.current = blobUrl
      setSrc(blobUrl)
      return blobUrl
    } catch (err) {
      const detail = err instanceof Error && err.message.startsWith("HTTP ") ? ` (${err.message})` : ""
      setError(`Não foi possível carregar este áudio${detail}.`)
      return null
    } finally {
      setLoading(false)
    }
  }

  async function togglePlayback() {
    const audio = audioRef.current
    if (!audio || loading) return

    if (playing) {
      audio.pause()
      return
    }

    const playableSrc = await ensureBlobSource()
    if (!playableSrc) return

    window.setTimeout(() => {
      audioRef.current?.play().catch(() => setError("O navegador não conseguiu reproduzir este áudio."))
    }, 0)
  }

  function seek(value: string) {
    const audio = audioRef.current
    if (!audio) return
    const next = Number(value)
    audio.currentTime = next
    setCurrentTime(next)
  }

  const progressMax = duration > 0 ? duration : 1
  const downloadHref = attachment.url
    ? `${attachment.url}${attachment.url.includes("?") ? "&" : "?"}download=1`
    : attachment.externalUrl ?? "#"

  return (
    <div className={cn(
      "min-w-[260px] rounded-lg border p-2.5 shadow-sm",
      outgoing ? "border-white/25 bg-white/15 text-primary-foreground" : "border-slate-200 bg-white text-slate-900",
    )}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setError("Áudio indisponível ou em formato inválido.")}
        className="hidden"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={togglePlayback}
          disabled={loading}
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-full transition-colors",
            outgoing ? "bg-white/20 hover:bg-white/30" : "bg-sky-50 text-sky-700 hover:bg-sky-100",
            loading && "opacity-60",
          )}
          aria-label={playing ? "Pausar áudio" : "Reproduzir áudio"}
        >
          {playing ? <Pause className="size-4" /> : <PlayCircle className="size-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-1.5 font-medium">
              <Volume2 className="size-3.5 shrink-0" />
              <span className="truncate">{attachment.fileName}</span>
            </span>
            <a
              href={downloadHref}
              target="_blank"
              rel="noopener noreferrer"
              className={cn("ml-auto rounded p-1 transition-colors", outgoing ? "hover:bg-white/20" : "hover:bg-muted")}
              aria-label="Abrir áudio em nova aba"
            >
              <Download className="size-3.5" />
            </a>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-9 text-[11px] tabular-nums opacity-75">{formatAudioTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={progressMax}
              step={0.1}
              value={Math.min(currentTime, progressMax)}
              onChange={(event) => seek(event.target.value)}
              className="h-1 flex-1 accent-sky-600"
            />
            <span className="w-9 text-right text-[11px] tabular-nums opacity-75">{formatAudioTime(duration)}</span>
          </div>
        </div>
      </div>
      {error && <p className={cn("mt-2 text-xs", outgoing ? "text-white/80" : "text-red-600")}>{error}</p>}
      {loading && <p className={cn("mt-2 text-xs", outgoing ? "text-white/70" : "text-muted-foreground")}>Carregando áudio...</p>}
    </div>
  )
}

function MessageAttachments({ attachments, outgoing }: { attachments?: MessageAttachment[]; outgoing?: boolean }) {
  if (!attachments || attachments.length === 0) return null

  return (
    <div className="mt-2 space-y-2">
      {attachments.map((attachment) => {
        const href = attachment.url || attachment.externalUrl || "#"
        const openHref = href === "#" ? href : `${href}${href.includes("?") ? "&" : "?"}download=1`
        if (attachment.type === "IMAGE") {
          return (
            <a key={attachment.id} href={href} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-md border bg-white/70">
              <img src={href} alt={attachment.fileName} className="max-h-72 w-full object-contain" />
              <span className={cn("flex items-center gap-1.5 px-2 py-1.5 text-xs", outgoing ? "text-primary-foreground/85" : "text-muted-foreground")}>
                <ImageIcon className="size-3.5" />
                {attachment.fileName}
              </span>
            </a>
          )
        }
        if (attachment.type === "AUDIO") {
          return <ChatAudioPlayer key={attachment.id} attachment={attachment} outgoing={outgoing} />
        }
        return (
          <a
            key={attachment.id}
            href={openHref}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-2 rounded-md border bg-white/70 p-2 text-sm transition-colors hover:bg-white",
              outgoing ? "text-slate-900" : "text-foreground",
            )}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <FileText className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{attachment.fileName}</span>
              <span className="text-xs text-muted-foreground">{formatFileSize(attachment.size)}</span>
            </span>
            <Download className="size-4 shrink-0 text-muted-foreground" />
          </a>
        )
      })}
    </div>
  )
}

// ─── SupportView ─────────────────────────────────────────────────────────────

export function SupportView({ mode = "support" }: { mode?: "support" | "emails" }) {
  const auth = useAuth()
  const companyId = auth?.companyId
  const isEmailView = mode === "emails"

  const [convList, setConvList] = useState<ConvSummary[]>([])
  const [selected, setSelected] = useState<ConvDetail | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [reply, setReply] = useState("")
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState("")
  const selectedIdRef = useRef<string | null>(null)
  const selectedRef = useRef<ConvDetail | null>(null)
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null)
  const attachmentInputRef = useRef<HTMLInputElement>(null)
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([])
  const pendingAttachmentsRef = useRef<PendingAttachment[]>([])
  const [rops, setRops] = useState<Rop[]>(() => loadRops())
  const [ropsOpen, setRopsOpen] = useState(false)
  const [ropSearch, setRopSearch] = useState("")
  const ropsRef = useRef<HTMLDivElement>(null)
  const [knowledgeArticles, setKnowledgeArticles] = useState<KnowledgeArticle[]>([])
  const [knowledgeOpen, setKnowledgeOpen] = useState(false)
  const [knowledgeSearch, setKnowledgeSearch] = useState("")
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string | null>(null)
  const knowledgeRef = useRef<HTMLDivElement>(null)

  // Conversation list search + tag filter + archive view
  const [convSearch, setConvSearch] = useState("")
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [tagFilterOpen, setTagFilterOpen] = useState(false)
  const tagFilterRef = useRef<HTMLDivElement>(null)
  const [showArchived, setShowArchived] = useState(false)

  // Conv item context menu (3 dots)
  const [convMenuOpen, setConvMenuOpen] = useState<string | null>(null)
  const convMenuRef = useRef<HTMLDivElement>(null)

  // Manual tag popover on chat header
  const [manualTagOpen, setManualTagOpen] = useState(false)
  const [manualTagSearch, setManualTagSearch] = useState("")
  const [allCompanyTags, setAllCompanyTags] = useState<{ id: string; name: string; color: string }[]>([])
  const [newTagName, setNewTagName] = useState("")
  const manualTagRef = useRef<HTMLDivElement>(null)

  // AI tools
  const [aiToolOpen, setAiToolOpen] = useState(false)
  const [aiDropdownOpen, setAiDropdownOpen] = useState(false)
  const [activeTool, setActiveTool] = useState<AIToolId | "tag" | null>(null)
  const [aiInstruction, setAiInstruction] = useState("")
  const [aiPhase, setAiPhase] = useState<"prepare" | "loading" | "result">("prepare")
  const [aiResult, setAiResult] = useState("")
  const [aiHistory, setAiHistory] = useState<{ id: string; tool: string; result: string; createdAt: string }[]>([])
  const [aiHistoryLoading, setAiHistoryLoading] = useState(false)
  const [historyExpanded, setHistoryExpanded] = useState<string | null>(null)
  const aiDropdownRef = useRef<HTMLDivElement>(null)

  // Tag suggestion state
  type TagSuggestion = { name: string; reason: string; isNew: boolean; existingId: string | null; color: string }
  const [tagSuggestions, setTagSuggestions] = useState<TagSuggestion[]>([])
  const [tagLoading, setTagLoading] = useState(false)
  const [tagError, setTagError] = useState("")

  // Transfer conversation state
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferMode, setTransferMode] = useState<"user" | "team">("user")
  const [transferTargetId, setTransferTargetId] = useState("")
  const [transferNote, setTransferNote] = useState("")
  const [transferSaving, setTransferSaving] = useState(false)
  const [transferError, setTransferError] = useState("")
  const [transferDone, setTransferDone] = useState(false)
  const [transferUsers, setTransferUsers] = useState<{ id: string; name: string; role: string }[]>([])
  const [transferTeams, setTransferTeams] = useState<{ id: string; name: string }[]>([])
  const [transferSearch, setTransferSearch] = useState("")
  const [transferLoading, setTransferLoading] = useState(false)

  // Tags currently applied on the selected conversation (derived + writable)
  const appliedTagNames = useMemo(
    () => new Set((selected?.tags ?? []).map((t) => t.name)),
    [selected?.tags]
  )

  const availableRops = useMemo(() => {
    const channel = isEmailView ? "EMAIL" : selected?.channel ?? "WHATSAPP"
    const term = ropSearch.trim().toLowerCase()

    return rops
      .filter((rop) => channelMatchesRop(rop, channel))
      .filter((rop) => !term || [rop.title, rop.shortcut, rop.category, rop.text].some((value) => value.toLowerCase().includes(term)))
  }, [isEmailView, ropSearch, rops, selected?.channel])

  const availableKnowledgeArticles = useMemo(() => {
    const channel = isEmailView ? "EMAIL" : selected?.channel ?? "WHATSAPP"
    const term = knowledgeSearch.trim().toLowerCase()

    return knowledgeArticles
      .filter((article) => article.status === "PUBLICADO")
      .filter((article) => article.channels.length === 0 || article.channels.includes(channel as KnowledgeChannel))
      .filter((article) => !term || [
        article.title,
        article.category,
        htmlToPlainText(article.content),
        article.tags.join(" "),
        formatKnowledgeChannels(article.channels),
      ].some((value) => value.toLowerCase().includes(term)))
  }, [isEmailView, knowledgeArticles, knowledgeSearch, selected?.channel])

  const selectedKnowledge = useMemo(
    () => availableKnowledgeArticles.find((article) => article.id === selectedKnowledgeId) ?? null,
    [availableKnowledgeArticles, selectedKnowledgeId],
  )

  // Actions dropdown + opportunity modal
  type Pipeline = { id: string; name: string; columns: { id: string; name: string }[] }
  const [actionsOpen, setActionsOpen] = useState(false)
  const actionsRef = useRef<HTMLDivElement>(null)
  const [oppModalOpen, setOppModalOpen] = useState(false)
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [pipelinesLoading, setPipelinesLoading] = useState(false)
  const [oppPipelineId, setOppPipelineId] = useState("")
  const [oppColumnId, setOppColumnId] = useState("")
  const [oppName, setOppName] = useState("")
  const [oppDesc, setOppDesc] = useState("")
  const [oppSaving, setOppSaving] = useState(false)
  const [oppSuccess, setOppSuccess] = useState<{ boardName: string; columnName: string } | null>(null)
  const [ticketModalOpen, setTicketModalOpen] = useState(false)
  const [ticketTitle, setTicketTitle] = useState("")
  const [ticketSummary, setTicketSummary] = useState("")
  const [ticketCategory, setTicketCategory] = useState<TicketCategory>("Técnico")
  const [ticketPriority, setTicketPriority] = useState<TicketPriority>("Média")
  const [ticketTeam, setTicketTeam] = useState<string>(supportTeams[0])
  const [ticketSuccess, setTicketSuccess] = useState<string | null>(null)
  const [ticketSaving, setTicketSaving] = useState(false)
  const [ticketError, setTicketError] = useState("")
  type TicketActivityEntry = { id: string; authorName: string; text: string; createdAt: string }
  const [ticketId, setTicketId] = useState<string | null>(null)
  const [ticketSlaDueAt, setTicketSlaDueAt] = useState<string | null>(null)
  const [ticketSlaState, setTicketSlaState] = useState<string | null>(null)
  const [ticketActivities, setTicketActivities] = useState<TicketActivityEntry[]>([])
  const [ticketNote, setTicketNote] = useState("")
  const [ticketNoteAdding, setTicketNoteAdding] = useState(false)
  const [ticketFiles, setTicketFiles] = useState<File[]>([])
  type QuoteProduct = { id: string; name: string; price: string; unit: string; status: string; category: { name: string } | null }
  type QuoteDraftItem = { productId: string; quantity: string; unitPrice: string; discountType: "VALOR" | "PERCENTUAL"; discountValue: string }
  const [quoteModalOpen, setQuoteModalOpen] = useState(false)
  const [quoteProducts, setQuoteProducts] = useState<QuoteProduct[]>([])
  const [quoteProductsLoading, setQuoteProductsLoading] = useState(false)
  const [quoteValidUntil, setQuoteValidUntil] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() + 7)
    return date.toISOString().slice(0, 10)
  })
  const [quoteFreight, setQuoteFreight] = useState("")
  const [quoteNotes, setQuoteNotes] = useState("")
  const [quoteItems, setQuoteItems] = useState<QuoteDraftItem[]>([])
  const [quoteSaving, setQuoteSaving] = useState(false)
  const [quoteError, setQuoteError] = useState("")
  const [quoteSuccess, setQuoteSuccess] = useState("")

  useEffect(() => {
    selectedRef.current = selected
  }, [selected])

  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments
  }, [pendingAttachments])

  useEffect(() => {
    return () => {
      pendingAttachmentsRef.current.forEach((attachment) => URL.revokeObjectURL(attachment.previewUrl))
    }
  }, [])

  const conversationListUrl = useCallback(() => {
    const params = new URLSearchParams({ companyId: companyId ?? "" })
    if (isEmailView) params.set("channel", "EMAIL")
    return `/api/conversations?${params.toString()}`
  }, [companyId, isEmailView])

  const scopeConversations = useCallback((data: ConvSummary[]) => {
    return isEmailView ? data : data.filter((conversation) => conversation.channel !== "EMAIL")
  }, [isEmailView])

  const refreshActiveConversation = useCallback((targetId?: string | null) => {
    const id = targetId ?? selectedIdRef.current
    if (!id) return Promise.resolve()

    return fetch(`/api/conversations/${id}/messages`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: ConvDetail | null) => {
        if (!data || selectedIdRef.current !== id) return
        setSelected((prev) => {
          if (!prev) return data
          const pending = prev.messages.filter(
            (m) => m.pending && !data.messages.some((dm) => dm.text === m.text && dm.role === m.role)
          )
          const merged = pending.length > 0
            ? { ...data, messages: [...data.messages, ...pending] }
            : data
          if (
            merged.messages.length === prev.messages.length &&
            merged.lastMessageAt === prev.lastMessageAt &&
            merged.preview === prev.preview &&
            merged.status === prev.status &&
            merged.messages.every((m, i) => m.id === prev.messages[i]?.id)
          ) {
            return prev
          }
          return merged
        })
        setConvList((prev) => prev.map((c) =>
          c.id === id ? { ...c, preview: data.preview, lastMessageAt: data.lastMessageAt, status: data.status } : c
        ))
      })
      .catch(() => {})
  }, [])

  const refreshConversationList = useCallback((options: { selectFirst?: boolean } = {}) => {
    if (!companyId) return Promise.resolve()

    return fetch(conversationListUrl())
      .then((r) => r.ok ? r.json() : null)
      .then((data: ConvSummary[] | null) => {
        if (!data) return
        const scoped = scopeConversations(data)
        const openId = selectedIdRef.current
        const openedSummary = openId ? scoped.find((conversation) => conversation.id === openId) : null
        const currentSelected = selectedRef.current

        setConvList((prev) => {
          if (
            scoped.length === prev.length &&
            scoped.every((d, i) =>
              d.id === prev[i]?.id &&
              d.lastMessageAt === prev[i]?.lastMessageAt &&
              d.preview === prev[i]?.preview &&
              d.status === prev[i]?.status
            )
          ) {
            return prev
          }
          return scoped
        })

        if (openedSummary && currentSelected?.id === openedSummary.id && openedSummary.lastMessageAt !== currentSelected.lastMessageAt) {
          void refreshActiveConversation(openedSummary.id)
        }

        if (options.selectFirst && !selectedIdRef.current) {
          if (scoped.length > 0) loadDetail(scoped[0].id)
          else {
            setSelected(null)
            setSelectedId(null)
            selectedIdRef.current = null
          }
        }
      })
      .catch(() => {})
  }, [companyId, conversationListUrl, refreshActiveConversation, scopeConversations])

  useEffect(() => {
    if (!companyId) return
    setLoadingList(true)
    selectedIdRef.current = null
    setSelectedId(null)
    setSelected(null)
    refreshConversationList({ selectFirst: true })
      .finally(() => setLoadingList(false))
  }, [companyId, isEmailView, refreshConversationList])

  useEffect(() => {
    if (!companyId) return
    const params = new URLSearchParams({ companyId, status: "PUBLICADO" })
    fetch(`/api/knowledge?${params.toString()}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: KnowledgeArticle[]) => setKnowledgeArticles(Array.isArray(data) ? data : []))
      .catch(() => setKnowledgeArticles([]))
  }, [companyId])

  useEffect(() => {
    function refreshRops() {
      setRops(loadRops())
    }

    window.addEventListener("rops:changed", refreshRops)
    window.addEventListener("storage", refreshRops)
    window.addEventListener("focus", refreshRops)
    return () => {
      window.removeEventListener("rops:changed", refreshRops)
      window.removeEventListener("storage", refreshRops)
      window.removeEventListener("focus", refreshRops)
    }
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ropsRef.current && !ropsRef.current.contains(e.target as Node)) {
        setRopsOpen(false)
      }
      if (knowledgeRef.current && !knowledgeRef.current.contains(e.target as Node)) {
        setKnowledgeOpen(false)
        setSelectedKnowledgeId(null)
      }
    }

    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [selected?.messages])

  // Poll conversation list so new inbound WhatsApp/e-mail conversations appear automatically.
  useEffect(() => {
    if (!companyId) return
    const poll = setInterval(() => {
      void refreshConversationList()
    }, 5_000)

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") {
        void refreshConversationList()
        void refreshActiveConversation()
      }
    }

    window.addEventListener("focus", refreshWhenVisible)
    document.addEventListener("visibilitychange", refreshWhenVisible)

    return () => {
      clearInterval(poll)
      window.removeEventListener("focus", refreshWhenVisible)
      document.removeEventListener("visibilitychange", refreshWhenVisible)
    }
  }, [companyId, refreshActiveConversation, refreshConversationList])

  // Poll for new messages on the active conversation.
  useEffect(() => {
    const poll = setInterval(() => {
      void refreshActiveConversation()
    }, 2_000)
    return () => clearInterval(poll)
  }, [refreshActiveConversation])

  function loadDetail(id: string) {
    setSelectedId(id)
    selectedIdRef.current = id
    setSelected(null)
    setLoadingDetail(true)
    setSendError("")
    pendingAttachments.forEach((attachment) => URL.revokeObjectURL(attachment.previewUrl))
    setPendingAttachments([])
    fetch(`/api/conversations/${id}/messages`)
      .then((r) => r.json())
      .then((data: ConvDetail) => setSelected(data))
      .catch(console.error)
      .finally(() => setLoadingDetail(false))
    // Marca como lida e notifica o badge na sidebar imediatamente
    fetch(`/api/conversations/${id}/read`, { method: "PATCH" })
      .then(() => window.dispatchEvent(new Event("conv:read")))
      .catch(() => {})
  }

  function handleAttachmentFiles(files: File[]) {
    setSendError("")
    const allowed = files.filter((file) => {
      const isAllowed =
        file.type.startsWith("image/") ||
        file.type === "application/pdf" ||
        file.type === "text/plain" ||
        file.type.includes("word") ||
        file.type.includes("excel") ||
        file.type.includes("spreadsheet")
      if (!isAllowed) setSendError("Envie imagens, PDF ou documentos comuns.")
      if (file.size > 10 * 1024 * 1024) setSendError("Cada arquivo deve ter no máximo 10MB.")
      return isAllowed && file.size <= 10 * 1024 * 1024
    })
    if (allowed.length === 0) return

    setPendingAttachments((prev) => {
      const room = Math.max(0, 5 - prev.length)
      return [
        ...prev,
        ...allowed.slice(0, room).map((file) => ({
          id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
          file,
          previewUrl: URL.createObjectURL(file),
        })),
      ]
    })
  }

  function removePendingAttachment(id: string) {
    setPendingAttachments((prev) => {
      const removed = prev.find((attachment) => attachment.id === id)
      if (removed) URL.revokeObjectURL(removed.previewUrl)
      return prev.filter((attachment) => attachment.id !== id)
    })
  }

  async function sendReply() {
    if ((!reply.trim() && pendingAttachments.length === 0) || !selected || sending) return
    setSending(true)
    setSendError("")
    const text = reply.trim()
    const attachmentsToSend = pendingAttachments
    setReply("")
    setPendingAttachments([])

    // Optimistic message so the user sees it immediately
    const optimisticMsg = {
      id: `optimistic-${Date.now()}`,
      authorName: auth?.name ?? "Atendente",
      role: "ATENDENTE" as const,
      text: text || attachmentsToSend.map((attachment) => attachment.file.name).join(", "),
      align: "right" as const,
      isAiGenerated: false,
      createdAt: new Date().toISOString(),
      pending: true,
    }
    setSelected((prev) => prev ? { ...prev, messages: [...prev.messages, optimisticMsg] } : prev)

    try {
      let attachmentIds: string[] = []
      if (attachmentsToSend.length > 0) {
        const uploadPayload = await Promise.all(attachmentsToSend.map(async (attachment) => ({
          fileName: attachment.file.name,
          mimeType: attachment.file.type || "application/octet-stream",
          base64: await fileToBase64(attachment.file),
        })))

        const uploadRes = await fetch(`/api/conversations/${selected.id}/attachments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: uploadPayload }),
        })
        const uploadData = await uploadRes.json().catch(() => ({}))
        if (!uploadRes.ok) throw new Error(uploadData.error ?? "Erro ao enviar anexo.")
        attachmentIds = (uploadData.attachments ?? []).map((attachment: { id: string }) => attachment.id)
      }

      const res = await fetch(`/api/conversations/${selected.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, attachmentIds, authorName: auth?.name ?? "Atendente" }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSendError(data.error ?? "Erro ao enviar mensagem.")
        // Remove optimistic message on error
        setSelected((prev) => prev
          ? { ...prev, messages: prev.messages.filter((m) => m.id !== optimisticMsg.id) }
          : prev)
        setReply(text)
        setPendingAttachments(attachmentsToSend)
        return
      }
      attachmentsToSend.forEach((attachment) => URL.revokeObjectURL(attachment.previewUrl))
      if (data.local && data.message) {
        const convId = selected.id
        setSelected((prev) => prev ? {
          ...prev,
          status: "AGUARDANDO",
          preview: text,
          lastMessageAt: data.message.createdAt,
          messages: prev.messages.map((m) => m.id === optimisticMsg.id ? data.message : m),
        } : prev)
        setConvList((prev) => prev.map((c) =>
          c.id === convId ? { ...c, preview: text, lastMessageAt: data.message.createdAt, status: "AGUARDANDO" } : c
        ))
        return
      }
      // 202 queued — poll messages in 3s and 8s to pick up the confirmed DB record
      const convId = selected.id
      const optimisticId = optimisticMsg.id
      function mergeWithPending(d: ConvDetail) {
        setSelected((prev) => {
          if (!prev || selectedIdRef.current !== convId) return d
          // If the confirmed messages already include text matching the optimistic one, drop it
          const stillPending = prev.messages.filter(
            (m) => m.pending && !d.messages.some((dm) => dm.text === m.text && dm.role === m.role)
          )
          return { ...d, messages: [...d.messages, ...stillPending] }
        })
      }
      setTimeout(() => {
        if (selectedIdRef.current !== convId) return
        fetch(`/api/conversations/${convId}/messages`)
          .then((r) => r.json())
          .then((d: ConvDetail) => mergeWithPending(d))
          .catch(() => {})
      }, 3000)
      setTimeout(() => {
        if (selectedIdRef.current !== convId) return
        fetch(`/api/conversations/${convId}/messages`)
          .then((r) => r.json())
          .then((d: ConvDetail) => {
            // Final poll — drop all pending regardless (message is sent or failed at API level)
            if (selectedIdRef.current === convId) setSelected(d)
          })
          .catch(() => {})
        void optimisticId // reference to avoid lint warning
      }, 8000)
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Não foi possível conectar ao servidor.")
      setSelected((prev) => prev
        ? { ...prev, messages: prev.messages.filter((m) => m.id !== optimisticMsg.id) }
        : prev)
      setReply(text)
      setPendingAttachments(attachmentsToSend)
    } finally {
      setSending(false)
    }
  }

  function handleReplyKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      sendReply()
    }
  }

  function applyRop(rop: Rop) {
    setReply(rop.text)
    setRopsOpen(false)
    setRopSearch("")
  }

  function insertKnowledgeArticle(article: KnowledgeArticle) {
    const textarea = replyTextareaRef.current
    const content = htmlToPlainText(article.content).trim()
    if (!content) return

    if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      setReply((current) => `${current.slice(0, start)}${content}${current.slice(end)}`)
      window.setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + content.length, start + content.length)
      }, 0)
    } else {
      setReply((current) => current.trim() ? `${current.trim()}\n\n${content}` : content)
      window.setTimeout(() => textarea?.focus(), 0)
    }

    setKnowledgeOpen(false)
    setSelectedKnowledgeId(null)
    setKnowledgeSearch("")
  }

  function copyKnowledgeArticle(article: KnowledgeArticle) {
    navigator.clipboard?.writeText(htmlToPlainText(article.content)).catch(() => {})
  }

  function openAiTool(toolId: AIToolId) {
    setActiveTool(toolId)
    setAiResult("")
    setAiInstruction("")
    setAiPhase("prepare")
    setAiToolOpen(true)
    setAiDropdownOpen(false)
  }

  function openTagTool() {
    if (!selected) return
    setActiveTool("tag")
    setTagSuggestions([])
    setTagError("")
    setTagLoading(true)
    setAiToolOpen(true)
    setAiDropdownOpen(false)
    fetch("/api/ai/suggest-tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: selected.id }),
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error ?? "Não foi possível gerar sugestões agora.")
        return d
      })
      .then((d) => setTagSuggestions(d.suggestions ?? []))
      .catch((err) => {
        setTagSuggestions([])
        setTagError(err instanceof Error ? err.message : "Erro ao conectar com a IA.")
      })
      .finally(() => setTagLoading(false))
  }

  function addTagToState(convId: string, tag: { id: string; name: string; color: string }) {
    setSelected((prev) => prev && prev.id === convId ? {
      ...prev,
      tags: prev.tags.some((t) => t.id === tag.id) ? prev.tags : [...prev.tags, tag],
    } : prev)
    setConvList((prev) => prev.map((c) =>
      c.id === convId ? { ...c, tags: c.tags.some((t) => t.id === tag.id) ? c.tags : [...c.tags, tag] } : c
    ))
  }

  function removeTagFromState(convId: string, tagId: string) {
    setSelected((prev) => prev && prev.id === convId ? { ...prev, tags: prev.tags.filter((t) => t.id !== tagId) } : prev)
    setConvList((prev) => prev.map((c) =>
      c.id === convId ? { ...c, tags: c.tags.filter((t) => t.id !== tagId) } : c
    ))
  }

  // Called from AI suggestion sheet — toggles apply/remove on click
  function toggleTag(s: TagSuggestion) {
    if (!selected) return
    const alreadyApplied = appliedTagNames.has(s.name)
    if (alreadyApplied) {
      const existingTag = selected.tags.find((t) => t.name === s.name)
      if (!existingTag) return
      removeTagFromState(selected.id, existingTag.id)
      fetch("/api/ai/remove-tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selected.id, tagId: existingTag.id }),
      }).catch(() => addTagToState(selected.id, existingTag))
    } else {
      // Optimistic: add a placeholder tag — will be replaced with real data on response
      fetch("/api/ai/apply-tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selected.id, tagName: s.name, tagId: s.existingId }),
      })
        .then((r) => r.json())
        .then((d) => { if (d.tag) addTagToState(selected.id, d.tag) })
        .catch(() => {})
    }
  }

  // Called from manual tag popover — applies a tag by id/name
  function applyTagDirect(tag: { id: string; name: string; color: string }) {
    if (!selected) return
    if (appliedTagNames.has(tag.name)) {
      removeTagFromState(selected.id, tag.id)
      fetch("/api/ai/remove-tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selected.id, tagId: tag.id }),
      }).catch(() => addTagToState(selected.id, tag))
    } else {
      addTagToState(selected.id, tag)
      fetch("/api/ai/apply-tag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selected.id, tagName: tag.name, tagId: tag.id }),
      })
        .then((r) => r.json())
        .then((d) => { if (d.tag) addTagToState(selected.id, d.tag) })
        .catch(() => removeTagFromState(selected.id, tag.id))
    }
  }

  // Creates a new tag for the company and immediately applies it
  function createAndApplyTag(name: string) {
    if (!selected || !companyId || !name.trim()) return
    const clean = name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
    if (!clean) return
    fetch("/api/ai/apply-tag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: selected.id, tagName: clean }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.tag) {
          addTagToState(selected.id, d.tag)
          setAllCompanyTags((prev) => prev.some((t) => t.id === d.tag.id) ? prev : [...prev, d.tag])
        }
      })
      .catch(() => {})
    setNewTagName("")
  }

  function removeTagFromConv(tagId: string) {
    if (!selected) return
    removeTagFromState(selected.id, tagId)
    fetch("/api/ai/remove-tag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: selected.id, tagId }),
    }).catch(() => {})
  }

  function openOpportunityModal() {
    setActionsOpen(false)
    setOppSuccess(null)
    setOppName(selected?.customer.name ?? "")
    setOppDesc("")
    setOppPipelineId("")
    setOppColumnId("")
    setOppModalOpen(true)
    if (!companyId || pipelines.length > 0) return
    setPipelinesLoading(true)
    fetch(`/api/pipelines?companyId=${companyId}`)
      .then((r) => r.json())
      .then((d: Pipeline[]) => {
        setPipelines(d)
        if (d.length > 0) {
          setOppPipelineId(d[0].id)
          if (d[0].columns.length > 0) setOppColumnId(d[0].columns[0].id)
        }
      })
      .catch(() => {})
      .finally(() => setPipelinesLoading(false))
  }

  function handlePipelineChange(pid: string) {
    setOppPipelineId(pid)
    const board = pipelines.find((p) => p.id === pid)
    setOppColumnId(board?.columns[0]?.id ?? "")
  }

  function saveOpportunity() {
    if (!selected || !companyId || !oppPipelineId) return
    setOppSaving(true)
    fetch("/api/pipelines/opportunity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        customerId: selected.customer.id,
        conversationId: selected.id,
        pipelineId: oppPipelineId,
        columnId: oppColumnId || undefined,
        name: oppName.trim() || selected.customer.name,
        description: oppDesc.trim() || undefined,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.id) {
          setOppSuccess({ boardName: d.column.board.name, columnName: d.column.name })
        }
      })
      .catch(() => {})
      .finally(() => setOppSaving(false))
  }

  function openTicketModal() {
    if (!selected) return
    setActionsOpen(false)
    setTicketSuccess(null)
    setTicketError("")
    setTicketId(null)
    setTicketSlaDueAt(null)
    setTicketSlaState(null)
    setTicketActivities([])
    setTicketNote("")
    setTicketFiles([])
    setTicketTitle(`Chamado - ${selected.customer.name}`)
    setTicketSummary(selected.preview ?? selected.messages.at(-1)?.text ?? "")
    setTicketCategory(selected.channel === "EMAIL" ? "Financeiro" : "Técnico")
    setTicketPriority(selected.status === "ALTA_INTENCAO" ? "Alta" : "Média")
    setTicketTeam(selected.channel === "EMAIL" ? "Financeiro CS" : "Suporte N1")
    setTicketModalOpen(true)
  }

  function ticketSlaPreview() {
    const hours = ticketPriority === "Crítica" ? 1 : ticketPriority === "Alta" ? 4 : ticketPriority === "Média" ? 24 : 72
    return new Date(Date.now() + hours * 3_600_000)
  }

  async function saveTicket() {
    if (!selected || !companyId) return
    setTicketError("")
    setTicketSaving(true)
    try {
      const due = ticketSlaPreview()
      const res = await fetch("/api/support-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          title: ticketTitle.trim() || `Chamado - ${selected.customer.name}`,
          customer: selected.customer.name,
          contact: selected.customer.email ?? selected.customer.phone ?? "",
          channel: channelLabel(selected.channel),
          conversationId: selected.id,
          category: ticketCategory,
          priority: ticketPriority,
          team: ticketTeam,
          slaDueAt: due.toISOString(),
          summary: ticketSummary.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setTicketError(data.error ?? "Erro ao criar chamado"); return }
      setTicketSuccess(data.code)
      setTicketId(data.id)
      setTicketSlaDueAt(data.slaDueAt)
      setTicketSlaState(data.slaState)
      setTicketActivities(data.activity ?? [])
    } finally {
      setTicketSaving(false)
    }
  }

  async function addTicketNote() {
    if (!ticketId || !ticketNote.trim()) return
    setTicketNoteAdding(true)
    try {
      const res = await fetch(`/api/support-tickets/${ticketId}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorName: auth?.name ?? "Atendente", text: ticketNote.trim() }),
      })
      const data = await res.json()
      if (!res.ok) return
      setTicketNote("")
      setTicketActivities(data.activity ?? [])
    } finally {
      setTicketNoteAdding(false)
    }
  }

  function openTransferModal() {
    if (!selected || !companyId) return
    setTransferMode("user")
    setTransferTargetId("")
    setTransferNote("")
    setTransferError("")
    setTransferDone(false)
    setTransferSearch("")
    setTransferLoading(true)
    setTransferOpen(true)
    Promise.all([
      fetch(`/api/settings/users?companyId=${companyId}`)
        .then((r) => r.json())
        .then((d) => (Array.isArray(d) ? d : [])),
      fetch(`/api/teams?companyId=${companyId}`)
        .then((r) => r.json())
        .then((d) => Array.isArray(d) ? d : d.teams ?? []),
    ]).then(([users, teams]) => {
      setTransferUsers(users)
      setTransferTeams(teams)
      setTransferLoading(false)
    }).catch(() => setTransferLoading(false))
  }

  async function saveTransfer() {
    if (!selected || !transferTargetId) return
    setTransferError("")
    setTransferSaving(true)
    try {
      const res = await fetch(`/api/conversations/${selected.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: transferMode,
          targetId: transferTargetId,
          note: transferNote || undefined,
          authorName: auth?.name ?? undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setTransferError(data.error ?? "Erro ao transferir"); return }
      setTransferDone(true)
      refreshActiveConversation(selected.id)
    } catch {
      setTransferError("Erro de conexão")
    } finally {
      setTransferSaving(false)
    }
  }

  function quoteTotalPreview() {
    return quoteItems.reduce((sum, item) => {
      const subtotal = Number(item.quantity || 0) * Number(item.unitPrice || 0)
      const rawDiscount = item.discountType === "PERCENTUAL"
        ? subtotal * Math.min(Number(item.discountValue || 0), 100) / 100
        : Number(item.discountValue || 0)
      return sum + Math.max(0, subtotal - Math.min(subtotal, Math.max(0, rawDiscount)))
    }, Math.max(0, Number(quoteFreight || 0)))
  }

  function formatMoney(value: string | number | null | undefined) {
    return formatCurrency(value, brlFormatter.format(0))
  }

  function openQuoteModal() {
    if (!selected || !companyId) return
    setActionsOpen(false)
    setQuoteError("")
    setQuoteSuccess("")
    setQuoteFreight("")
    setQuoteNotes("")
    setQuoteItems([])
    const date = new Date()
    date.setDate(date.getDate() + 7)
    setQuoteValidUntil(date.toISOString().slice(0, 10))
    setQuoteModalOpen(true)
    setQuoteProductsLoading(true)
    fetch(`/api/products?companyId=${companyId}&status=ATIVO`)
      .then((r) => r.json())
      .then((data: QuoteProduct[]) => setQuoteProducts(Array.isArray(data) ? data : []))
      .catch(() => setQuoteProducts([]))
      .finally(() => setQuoteProductsLoading(false))
  }

  function addQuoteProduct(productId: string) {
    const product = quoteProducts.find((p) => p.id === productId)
    if (!product) return
    setQuoteItems((items) => [...items, {
      productId,
      quantity: "1",
      unitPrice: product.price,
      discountType: "VALOR",
      discountValue: "",
    }])
  }

  function updateQuoteDraftItem(index: number, patch: Partial<QuoteDraftItem>) {
    setQuoteItems((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item))
  }

  async function createAndSendQuote() {
    if (!selected || !companyId || quoteSaving) return
    if (selected.channel === "EMAIL") {
      setQuoteError("Envio por e-mail não faz parte deste ciclo. Use uma conversa de chat/WhatsApp.")
      return
    }
    if (!quoteValidUntil || quoteItems.length === 0) {
      setQuoteError("Adicione produtos e defina a validade.")
      return
    }
    setQuoteSaving(true)
    setQuoteError("")
    setQuoteSuccess("")
    try {
      const createRes = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          customerId: selected.customer.id,
          conversationId: selected.id,
          generatedById: auth?.id,
          generatedByName: auth?.name ?? "Atendente",
          validUntil: quoteValidUntil,
          freight: quoteFreight || "0",
          notes: quoteNotes,
          items: quoteItems,
        }),
      })
      const created = await createRes.json()
      if (!createRes.ok) throw new Error(created.error ?? "Erro ao criar orçamento")

      const sendRes = await fetch(`/api/quotes/${created.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorId: auth?.id, authorName: auth?.name ?? "Atendente" }),
      })
      const sent = await sendRes.json()
      if (!sendRes.ok) throw new Error(sent.error ?? "Erro ao enviar orçamento")
      setQuoteSuccess(`Orçamento #${created.number} enfileirado para envio.`)
      fetch(`/api/conversations/${selected.id}/messages`)
        .then((r) => r.json())
        .then((data: ConvDetail) => {
          setSelected(data)
          setConvList((prev) => prev.map((c) =>
            c.id === data.id ? { ...c, preview: data.preview, lastMessageAt: data.lastMessageAt, status: data.status } : c
          ))
        })
        .catch(() => {})
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : "Erro ao criar orçamento.")
    } finally {
      setQuoteSaving(false)
    }
  }

  function runAiTool() {
    if (!selected || !activeTool || activeTool === "tag") return
    setAiPhase("loading")
    setAiResult("")
    fetch("/api/ai/tool", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: selected.id, tool: activeTool, instruction: aiInstruction.trim() }),
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error ?? "Não foi possível processar com a IA agora.")
        return d
      })
      .then((d) => {
        setAiResult(d.result ?? "Sem resposta.")
        loadAiHistory(selected.id)
      })
      .catch((err) => setAiResult(err instanceof Error ? err.message : "Erro ao conectar com a IA."))
      .finally(() => setAiPhase("result"))
  }

  function openAiHistory() {
    setActiveTool(null)
    setHistoryExpanded(null)
    setAiToolOpen(true)
    setAiDropdownOpen(false)
    if (selected) loadAiHistory(selected.id)
  }

  function loadAiHistory(convId: string) {
    setAiHistoryLoading(true)
    fetch(`/api/ai/history/${convId}`)
      .then((r) => r.json())
      .then((d) => setAiHistory(d))
      .catch(() => {})
      .finally(() => setAiHistoryLoading(false))
  }

  // Close all dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (aiDropdownRef.current && !aiDropdownRef.current.contains(e.target as Node)) setAiDropdownOpen(false)
      if (tagFilterRef.current && !tagFilterRef.current.contains(e.target as Node)) setTagFilterOpen(false)
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) setActionsOpen(false)
      if (convMenuRef.current && !convMenuRef.current.contains(e.target as Node)) setConvMenuOpen(null)
      if (manualTagRef.current && !manualTagRef.current.contains(e.target as Node)) {
        setManualTagOpen(false)
        setManualTagSearch("")
        setNewTagName("")
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  function updateConvStatus(convId: string, status: string) {
    const role = auth?.role ?? "ATENDENTE"
    fetch(`/api/conversations/${convId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, role }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { alert(d.error); return }
        // Remove da lista activa ou atualiza status
        setConvList((prev) => prev.map((c) => c.id === convId ? { ...c, status } : c))
        if (selected?.id === convId) setSelected((prev) => prev ? { ...prev, status } : prev)
        setConvMenuOpen(null)
      })
      .catch(() => {})
  }

  function deleteConv(convId: string) {
    const role = auth?.role ?? "ATENDENTE"
    if (!window.confirm("Excluir permanentemente esta conversa? Esta ação não pode ser desfeita.")) return
    fetch(`/api/conversations/${convId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { alert(d.error); return }
        setConvList((prev) => prev.filter((c) => c.id !== convId))
        if (selected?.id === convId) { setSelected(null); setSelectedId(null) }
        setConvMenuOpen(null)
      })
      .catch(() => {})
  }

  // Load all company tags when manual tag popover opens
  useEffect(() => {
    if (!manualTagOpen || !companyId) return
    fetch(`/api/tags?companyId=${companyId}`)
      .then((r) => r.json())
      .then((d) => setAllCompanyTags(d))
      .catch(() => {})
  }, [manualTagOpen, companyId])

  const customer = selected?.customer

  return (
    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
      <div className="grid h-full min-w-[1120px] grid-cols-[320px_minmax(500px,1fr)_285px] gap-2.5 p-2.5 md:p-3">

        {/* Left — conversation list */}
        <section className="flex min-h-0 flex-col gap-3 overflow-hidden">
          <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <CardHeader className="p-3 pb-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>
                    {isEmailView
                      ? showArchived ? "E-mails arquivados" : "Caixa de entrada"
                      : showArchived ? "Conversas arquivadas" : "Fila inteligente"}
                  </CardTitle>
                  <CardDescription className="text-[11px]">
                    {isEmailView
                      ? showArchived ? "E-mails fora da fila ativa" : "E-mails de clientes para atendimento"
                      : showArchived ? "Arquivadas e marcadas para exclusão" : "Priorizada por intenção e SLA"}
                  </CardDescription>
                </div>
                <button
                  onClick={() => { setShowArchived((v) => !v); setConvSearch(""); setTagFilter(null) }}
                  title={showArchived ? "Ver fila ativa" : "Ver arquivadas"}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-lg transition-colors",
                    showArchived
                      ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {showArchived ? <ArchiveX className="size-4" /> : <Archive className="size-4" />}
                </button>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2 pt-2">
                <div className="flex h-8 min-w-0 items-center gap-2 rounded-md border bg-white px-2">
                  <Search className="size-3.5 text-muted-foreground" />
                  <Input
                    className="h-7 border-0 px-0 text-xs shadow-none focus-visible:ring-0"
                    placeholder={isEmailView ? "Buscar e-mail" : "Buscar lead"}
                    value={convSearch}
                    onChange={(e) => setConvSearch(e.target.value)}
                  />
                </div>
                {/* Tag filter dropdown */}
                <div className="relative" ref={tagFilterRef}>
                  <button
                    onClick={() => setTagFilterOpen((v) => !v)}
                    className={cn(
                      "flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors",
                      tagFilter
                        ? "border-violet-400 bg-violet-50 text-violet-700"
                        : "bg-white text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {tagFilter ? `#${tagFilter}` : "#tag"}
                    {tagFilter
                      ? <X className="size-3" onClick={(e) => { e.stopPropagation(); setTagFilter(null) }} />
                      : <ChevronDown className="size-3.5" />
                    }
                  </button>
                  {tagFilterOpen && (
                    <div className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-xl border bg-white shadow-lg">
                      {(() => {
                        const allTags = Array.from(
                          new Map(
                            convList.flatMap((c) => c.tags).map((t) => [t.id, t])
                          ).values()
                        )
                        return allTags.length === 0
                          ? <p className="px-3 py-2 text-xs text-muted-foreground">Sem tags nas conversas.</p>
                          : (
                            <>
                              {tagFilter && (
                                <button
                                  onClick={() => { setTagFilter(null); setTagFilterOpen(false) }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50"
                                >
                                  <X className="size-3" /> Limpar filtro
                                </button>
                              )}
                              {allTags.map((tag) => (
                                <button
                                  key={tag.id}
                                  onClick={() => { setTagFilter(tag.name === tagFilter ? null : tag.name); setTagFilterOpen(false) }}
                                  className={cn(
                                    "flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-muted/50",
                                    tagFilter === tag.name && "bg-violet-50 text-violet-700 font-medium"
                                  )}
                                >
                                  <span className={cn(
                                    "flex size-4 shrink-0 items-center justify-center rounded border text-[10px]",
                                    tagFilter === tag.name ? "border-violet-500 bg-violet-500 text-white" : "border-muted-foreground/30"
                                  )}>
                                    {tagFilter === tag.name && "✓"}
                                  </span>
                                  #{tag.name}
                                </button>
                              ))}
                            </>
                          )
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 pt-0 pr-2">
              {loadingList && (
                <p className="py-6 text-center text-xs text-muted-foreground">Carregando…</p>
              )}
              {!loadingList && convList.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">Nenhuma conversa ainda.</p>
              )}
              {convList
                .filter((c) => showArchived
                  ? ["ARQUIVADO", "PARA_EXCLUIR"].includes(c.status)
                  : !["ARQUIVADO", "PARA_EXCLUIR"].includes(c.status)
                )
                .filter((c) => !tagFilter || c.tags.some((t) => t.name === tagFilter))
                .filter((c) => {
                  if (!convSearch.trim()) return true
                  const q = convSearch.toLowerCase()
                  return (
                    c.customer.name.toLowerCase().includes(q) ||
                    (c.customer.phone ?? "").includes(q) ||
                    (c.customer.email ?? "").toLowerCase().includes(q) ||
                    (c.preview ?? "").toLowerCase().includes(q)
                  )
                })
                .map((conv) => {
                  const contact = isEmailView
                    ? conv.customer.email ?? conv.customer.phone ?? "Sem e-mail"
                    : conv.customer.phone ?? conv.customer.email ?? "Sem contato"
                  const selectedConv = selectedId === conv.id
                  const primaryTag = conv.tags[0]

                  return (
                    <div
                      key={conv.id}
                      className={cn(
                        "group relative w-full cursor-pointer rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors hover:bg-muted/45",
                        selectedConv && "border-primary/30 bg-primary/5",
                        conv.status === "PARA_EXCLUIR" && "border-red-200 bg-red-50/40",
                        conv.customer.isVip && !selectedConv && "bg-amber-50/25",
                      )}
                      onClick={() => loadDetail(conv.id)}
                    >
                      <div className="min-w-0 border-b pb-1 group-last:border-b-0">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="min-w-0 truncate text-xs font-semibold">{conv.customer.name}</p>
                              {conv.customer.isVip && <Crown className="size-3 shrink-0 text-amber-500" />}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                              {isEmailView ? <Mail className="size-2.5 shrink-0" /> : <MessageCircle className="size-2.5 shrink-0" />}
                              <span className="truncate">{contact}</span>
                            </div>
                          </div>
                          {conv.leadValue && (
                            <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                              {formatCurrency(conv.leadValue)}
                            </span>
                          )}
                        </div>

                        <div className="mt-1 flex items-start gap-2">
                          <p className="min-w-0 flex-1 truncate text-[11px] leading-4 text-muted-foreground">{conv.preview ?? "—"}</p>
                          {conv.aiReason && <Sparkles className="mt-0.5 size-3 shrink-0 text-cyan-600" />}
                        </div>

                        <div className="mt-1 flex items-center gap-1">
                          <span className={cn(
                            "size-1.5 rounded-full",
                            conv.status === "ALTA_INTENCAO" ? "bg-amber-500"
                              : conv.status === "RESOLVIDO" || conv.status === "ENCERRADO" ? "bg-emerald-500"
                              : conv.status === "PARA_EXCLUIR" ? "bg-red-500"
                              : "bg-slate-300",
                          )} />
                          <span className="truncate text-[9px] text-muted-foreground">{statusLabel(conv.status)}</span>
                          {primaryTag && (
                            <span className="truncate rounded bg-muted px-1 py-0.5 text-[9px] text-muted-foreground">#{primaryTag.name}</span>
                          )}
                          {conv.tags.length > 1 && <span className="text-[9px] text-muted-foreground">+{conv.tags.length - 1}</span>}
                          <span className={cn("ml-auto shrink-0 text-[10px]", selectedConv ? "font-semibold text-primary" : "text-muted-foreground")}>
                            {formatRelativeTime(conv.lastMessageAt)}
                          </span>
                        </div>
                      </div>

                      <div
                        className="absolute right-2 top-5 z-10"
                        ref={convMenuOpen === conv.id ? convMenuRef : undefined}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => setConvMenuOpen(convMenuOpen === conv.id ? null : conv.id)}
                          className="flex size-7 items-center justify-center rounded-full bg-white/90 opacity-0 shadow-sm transition-opacity hover:bg-muted group-hover:opacity-100"
                        >
                          <MoreHorizontal className="size-3.5 text-muted-foreground" />
                        </button>
                        {convMenuOpen === conv.id && (
                          <div className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-xl border bg-white shadow-lg">
                            {conv.status !== "ARQUIVADO" && conv.status !== "PARA_EXCLUIR" && (
                              <button
                                onClick={() => updateConvStatus(conv.id, "ARQUIVADO")}
                                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50"
                              >
                                <Archive className="size-3.5 text-muted-foreground" />
                                Arquivar
                              </button>
                            )}
                            {conv.status === "ARQUIVADO" && (
                              <button
                                onClick={() => updateConvStatus(conv.id, "EM_ANALISE")}
                                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50"
                              >
                                <ArchiveX className="size-3.5 text-muted-foreground" />
                                Desarquivar
                              </button>
                            )}
                            {["OWNER", "ADMIN", "GESTOR"].includes(auth?.role ?? "") && conv.status !== "PARA_EXCLUIR" && (
                              <button
                                onClick={() => updateConvStatus(conv.id, "PARA_EXCLUIR")}
                                className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-amber-700 transition-colors hover:bg-amber-50"
                              >
                                <Trash2 className="size-3.5" />
                                Marcar para excluir
                              </button>
                            )}
                            {["OWNER", "ADMIN"].includes(auth?.role ?? "") && conv.status === "PARA_EXCLUIR" && (
                              <>
                                <button
                                  onClick={() => updateConvStatus(conv.id, "EM_ANALISE")}
                                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50"
                                >
                                  <ArchiveX className="size-3.5 text-muted-foreground" />
                                  Cancelar exclusão
                                </button>
                                <div className="border-t" />
                                <button
                                  onClick={() => deleteConv(conv.id)}
                                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
                                >
                                  <Trash2 className="size-3.5" />
                                  Excluir permanentemente
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
            </CardContent>
          </Card>
        </section>

        {/* Center — chat thread */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white shadow-soft">
          {loadingDetail && !selected ? (
            <div className="flex flex-1 flex-col">
              <div className="flex shrink-0 items-center gap-2.5 border-b p-3">
                <div className="size-10 animate-pulse rounded-full bg-muted" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-48 animate-pulse rounded bg-muted" />
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-3">
                {[60, 80, 50, 70].map((w, i) => (
                  <div key={i} className={cn("flex gap-3", i % 2 === 1 && "justify-end")}>
                    {i % 2 === 0 && <div className="size-8 shrink-0 animate-pulse rounded-full bg-muted" />}
                    <div className="animate-pulse rounded-lg bg-muted py-6" style={{ width: `${w}%` }} />
                  </div>
                ))}
              </div>
            </div>
          ) : selected ? (
            <>
              <div className="flex shrink-0 flex-wrap items-center gap-2.5 border-b p-3">
                <CustomerAvatar customer={selected.customer} className="size-10" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-base font-semibold">{selected.customer.name}</h2>
                    {selected.customer.isVip && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 ring-1 ring-amber-300/60">
                        <Crown className="size-3" />VIP
                      </span>
                    )}
                    <Badge variant={statusToVariant(selected.status)}>{statusLabel(selected.status)}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {(isEmailView ? selected.customer.email ?? selected.customer.phone : selected.customer.phone ?? selected.customer.email) ?? "Sem contato"} · {channelLabel(selected.channel)}
                  </p>
                </div>
                {/* Manual tag popover */}
                <div className="relative" ref={manualTagRef}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setManualTagOpen((v) => !v); setManualTagSearch(""); setNewTagName("") }}
                    className="gap-1.5"
                  >
                    <Tags className="size-3.5" />
                    Tags
                    {(selected?.tags ?? []).length > 0 && (
                      <span className="ml-0.5 flex size-4 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700">
                        {(selected?.tags ?? []).length}
                      </span>
                    )}
                  </Button>
                  {manualTagOpen && (
                    <div className="absolute left-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-xl border bg-white shadow-lg">
                      {/* search + create */}
                      <div className="p-2 border-b">
                        <div className="flex items-center gap-1.5 rounded-lg border bg-muted/30 px-2.5 py-1.5">
                          <Search className="size-3 shrink-0 text-muted-foreground" />
                          <input
                            autoFocus
                            className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                            placeholder="Buscar ou criar tag…"
                            value={manualTagSearch}
                            onChange={(e) => { setManualTagSearch(e.target.value); setNewTagName(e.target.value) }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const exact = allCompanyTags.find((t) => t.name === newTagName.trim().toLowerCase().replace(/\s+/g, "-"))
                                if (exact) applyTagDirect(exact)
                                else createAndApplyTag(newTagName)
                                setManualTagOpen(false)
                              }
                            }}
                          />
                        </div>
                      </div>

                      {/* tag list */}
                      <div className="max-h-52 overflow-y-auto py-1">
                        {allCompanyTags
                          .filter((t) => !manualTagSearch || t.name.includes(manualTagSearch.toLowerCase()))
                          .map((tag) => {
                            const isOn = appliedTagNames.has(tag.name)
                            return (
                              <button
                                key={tag.id}
                                onClick={() => applyTagDirect(tag)}
                                className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                              >
                                <span className={cn(
                                  "flex size-4 shrink-0 items-center justify-center rounded border text-[10px] transition-colors",
                                  isOn ? "border-violet-500 bg-violet-500 text-white" : "border-muted-foreground/30"
                                )}>
                                  {isOn && "✓"}
                                </span>
                                <span className="text-xs font-medium text-foreground">#{tag.name}</span>
                              </button>
                            )
                          })}
                        {allCompanyTags.filter((t) => !manualTagSearch || t.name.includes(manualTagSearch.toLowerCase())).length === 0 && (
                          <p className="px-3 py-2 text-xs text-muted-foreground">Nenhuma tag encontrada.</p>
                        )}
                      </div>

                      {/* create new */}
                      {newTagName.trim() && !allCompanyTags.some((t) => t.name === newTagName.trim().toLowerCase().replace(/\s+/g, "-")) && (
                        <div className="border-t p-2">
                          <button
                            onClick={() => { createAndApplyTag(newTagName); setManualTagOpen(false) }}
                            className="flex w-full items-center gap-2 rounded-lg bg-violet-50 px-3 py-2 text-xs font-medium text-violet-700 hover:bg-violet-100 transition-colors"
                          >
                            <Plus className="size-3.5" />
                            Criar "#{newTagName.trim().toLowerCase().replace(/\s+/g, "-")}"
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {/* Actions dropdown */}
                <div className="relative" ref={actionsRef}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setActionsOpen((v) => !v)}
                    className="gap-1.5"
                  >
                    Ações
                    <ChevronDown className="size-3.5" />
                  </Button>
                  {actionsOpen && (
                    <div className="absolute right-0 top-full z-50 mt-1.5 w-52 overflow-hidden rounded-xl border bg-white shadow-lg">
                      <button
                        onClick={openOpportunityModal}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50"
                      >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                          <Kanban className="size-3.5" />
                        </span>
                        Criar Oportunidade
                      </button>
                      <button
                        onClick={openTicketModal}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50"
                      >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-cyan-50 text-cyan-700">
                          <LifeBuoy className="size-3.5" />
                        </span>
                        Abrir chamado
                      </button>
                      {selected && !["ARQUIVADO","PARA_EXCLUIR"].includes(selected.status) && (
                        <button
                          onClick={() => { updateConvStatus(selected.id, "ARQUIVADO"); setActionsOpen(false) }}
                          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50"
                        >
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                            <Archive className="size-3.5" />
                          </span>
                          Arquivar conversa
                        </button>
                      )}
                      {selected?.status === "ARQUIVADO" && (
                        <button
                          onClick={() => { updateConvStatus(selected.id, "EM_ANALISE"); setActionsOpen(false) }}
                          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50"
                        >
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                            <ArchiveX className="size-3.5" />
                          </span>
                          Desarquivar conversa
                        </button>
                      )}
                      {["OWNER","ADMIN","GESTOR"].includes(auth?.role ?? "") && selected && selected.status !== "PARA_EXCLUIR" && (
                        <button
                          onClick={() => { updateConvStatus(selected.id, "PARA_EXCLUIR"); setActionsOpen(false) }}
                          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-amber-700 transition-colors hover:bg-amber-50"
                        >
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-700">
                            <Trash2 className="size-3.5" />
                          </span>
                          Marcar para excluir
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* AI tools dropdown */}
                <div className="relative" ref={aiDropdownRef}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAiDropdownOpen((v) => !v)}
                    className="gap-1.5"
                  >
                    <Sparkles className="size-3.5 text-cyan-600" />
                    IA
                    <ChevronDown className="size-3" />
                  </Button>
                  {aiDropdownOpen && (
                    <div className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-xl border bg-white shadow-lg">
                      {AI_TOOLS.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => openAiTool(t.id)}
                          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50"
                        >
                          <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", t.accent)}>
                            <t.icon className="size-3.5" />
                          </span>
                          {t.name}
                        </button>
                      ))}
                      <div className="border-t">
                        <button
                          onClick={openTagTool}
                          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50"
                        >
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-violet-50 text-violet-700">
                            <Tags className="size-3.5" />
                          </span>
                          Sugerir Tags
                        </button>
                      </div>
                      <div className="border-t">
                        <button
                          onClick={openAiHistory}
                          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50"
                        >
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                            <Activity className="size-3.5" />
                          </span>
                          Histórico de ações IA
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
                {selected.messages.map((msg) => (
                  msg.role === "SISTEMA" ? (
                    <div key={msg.id} className="flex justify-center py-0.5">
                      <div className="flex items-center gap-1.5 rounded-full border border-dashed border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-slate-500">
                        <Lock className="size-3 shrink-0" />
                        <span className="font-medium">Nota interna</span>
                        <span className="mx-1 text-slate-300">&middot;</span>
                        <span>{msg.text}</span>
                      </div>
                    </div>
                  ) : (
                  <div className={cn("flex gap-3", msg.align === "right" && "justify-end")}>
                    {msg.align === "left" && (
                      <Avatar className="size-8">
                        <AvatarFallback className={msg.isAiGenerated ? "bg-cyan-50 text-cyan-700" : "bg-slate-100 text-slate-600"}>
                          {msg.isAiGenerated ? "IA" : <UserRound className="size-3.5" />}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className={cn(
                      "max-w-[760px] rounded-lg border px-3 py-2.5",
                      msg.align === "right" ? "bg-primary text-primary-foreground"
                        : msg.isAiGenerated ? "border-cyan-200 bg-cyan-50 text-cyan-950"
                        : "bg-muted/50",
                      msg.pending && "opacity-80",
                    )}>
                      <div className="mb-1 flex items-center gap-2 text-xs opacity-80">
                        <span className="font-medium">{msg.authorName}</span>
                        <span>{msg.role}</span>
                        <span className="ml-auto flex items-center gap-1.5">
                          {formatRelativeTime(msg.createdAt)}
                          {msg.pending && (
                            <span className="inline-flex items-center">
                              <svg className="size-3 animate-spin opacity-60" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                              </svg>
                            </span>
                          )}
                        </span>
                      </div>
                      {msg.text && <p className="text-sm leading-5">{msg.text}</p>}
                      <MessageAttachments attachments={msg.attachments} outgoing={msg.align === "right"} />
                    </div>
                  </div>
                  )
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="shrink-0 border-t p-3">
                <div className="rounded-lg border bg-muted/35 p-2.5">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">
                      {isEmailView ? <Mail className="mr-1 size-3" /> : <Clock3 className="mr-1 size-3" />}
                      {isEmailView ? "Responder e-mail" : "Responder via WhatsApp"}
                    </Badge>
                    <div className="relative" ref={ropsRef}>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn("h-7 gap-1.5 px-2 text-xs", ropsOpen && "border-primary/30 bg-primary/5 text-primary")}
                        onClick={() => setRopsOpen((open) => !open)}
                        disabled={!selected}
                      >
                        <ClipboardList className="size-3.5" />
                        ROPs
                        <Badge variant="secondary" className="h-4 px-1 text-[10px]">{availableRops.length}</Badge>
                        <ChevronDown className={cn("size-3 transition-transform", ropsOpen && "rotate-180")} />
                      </Button>

                      {ropsOpen && (
                        <div className="absolute bottom-9 left-0 z-50 w-[420px] overflow-hidden rounded-lg border bg-white shadow-xl">
                          <div className="border-b p-2.5">
                            <div className="relative">
                              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                              <input
                                className="h-8 w-full rounded-md border bg-white pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-ring"
                                placeholder="Buscar ROP, atalho ou categoria"
                                value={ropSearch}
                                onChange={(event) => setRopSearch(event.target.value)}
                              />
                            </div>
                          </div>
                          <div className="max-h-80 overflow-y-auto">
                            {availableRops.map((rop) => (
                              <button
                                key={rop.id}
                                type="button"
                                onClick={() => applyRop(rop)}
                                className="flex w-full gap-2.5 border-b px-3 py-2.5 text-left transition-colors hover:bg-muted/45"
                              >
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                                  <ClipboardList className="size-4" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center gap-2">
                                    <span className="truncate text-xs font-semibold">{rop.title}</span>
                                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{rop.shortcut}</span>
                                  </span>
                                  <span className="mt-1 block truncate text-[11px] text-muted-foreground">{rop.category} · {ropChannelLabel(rop.channel)}</span>
                                  <span className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">{rop.text}</span>
                                </span>
                                <ChevronRight className="mt-1 size-3.5 shrink-0 text-muted-foreground" />
                              </button>
                            ))}
                            {availableRops.length === 0 && (
                              <div className="p-5 text-center text-xs text-muted-foreground">
                                Nenhuma ROP ativa para este canal.
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="relative" ref={knowledgeRef}>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn("h-7 gap-1.5 px-2 text-xs", knowledgeOpen && "border-sky-300 bg-sky-50 text-sky-700")}
                        onClick={() => setKnowledgeOpen((open) => !open)}
                        disabled={!selected}
                      >
                        <BookOpenText className="size-3.5" />
                        Base
                        <Badge variant="secondary" className="h-4 px-1 text-[10px]">{availableKnowledgeArticles.length}</Badge>
                        <ChevronDown className={cn("size-3 transition-transform", knowledgeOpen && "rotate-180")} />
                      </Button>

                      {knowledgeOpen && (
                        <div className="absolute bottom-9 left-0 z-50 w-[460px] overflow-hidden rounded-lg border bg-white shadow-xl">
                          <div className="border-b p-2.5">
                            <div className="relative">
                              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                              <input
                                className="h-8 w-full rounded-md border bg-white pl-8 pr-3 text-xs outline-none focus:ring-2 focus:ring-ring"
                                placeholder="Buscar procedimento, tag ou conteúdo"
                                value={knowledgeSearch}
                                onChange={(event) => {
                                  setKnowledgeSearch(event.target.value)
                                  setSelectedKnowledgeId(null)
                                }}
                              />
                            </div>
                          </div>
                          <div className="grid max-h-[360px] grid-cols-[190px_minmax(0,1fr)] overflow-hidden">
                            <div className="max-h-[360px] overflow-y-auto border-r">
                              {availableKnowledgeArticles.map((article) => (
                                <button
                                  key={article.id}
                                  type="button"
                                  onClick={() => setSelectedKnowledgeId(article.id)}
                                  className={cn(
                                    "flex w-full gap-2 border-b px-2.5 py-2 text-left transition-colors hover:bg-muted/45",
                                    selectedKnowledge?.id === article.id && "bg-sky-50",
                                  )}
                                >
                                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sky-50 text-sky-700">
                                    <BookOpenText className="size-3.5" />
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-xs font-semibold">{article.title}</span>
                                    <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{article.category}</span>
                                  </span>
                                </button>
                              ))}
                              {availableKnowledgeArticles.length === 0 && (
                                <div className="p-4 text-center text-xs text-muted-foreground">Nenhum procedimento publicado para este canal.</div>
                              )}
                            </div>
                            <div className="max-h-[360px] overflow-y-auto p-3">
                              {selectedKnowledge ? (
                                <div className="space-y-3">
                                  <div>
                                    <p className="text-xs font-semibold">{selectedKnowledge.title}</p>
                                    <p className="mt-1 text-[11px] text-muted-foreground">
                                      {selectedKnowledge.category} · {formatKnowledgeChannels(selectedKnowledge.channels)}
                                    </p>
                                  </div>
                                  <div
                                    className="max-h-44 overflow-y-auto rounded-md border bg-muted/25 p-2 text-[11px] leading-4 [&_blockquote]:border-l-2 [&_blockquote]:pl-2 [&_blockquote]:text-muted-foreground [&_h3]:text-xs [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-4 [&_ul]:list-disc [&_ul]:pl-4"
                                    dangerouslySetInnerHTML={{ __html: selectedKnowledge.content }}
                                  />
                                  {selectedKnowledge.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {selectedKnowledge.tags.map((tag) => (
                                        <span key={tag} className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{tag}</span>
                                      ))}
                                    </div>
                                  )}
                                  <div className="grid grid-cols-3 gap-1.5">
                                    <Button size="sm" className="h-7 px-2 text-[11px]" onClick={() => insertKnowledgeArticle(selectedKnowledge)}>
                                      Inserir
                                    </Button>
                                    <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => copyKnowledgeArticle(selectedKnowledge)}>
                                      Copiar
                                    </Button>
                                    <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => { window.location.href = "/base-conhecimento" }}>
                                      Ver
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex h-full min-h-44 items-center justify-center text-center text-xs text-muted-foreground">
                                  Selecione um procedimento para consultar.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {isEmailView ? "Resposta salva localmente nesta primeira versão" : "Ctrl+Enter para enviar"}
                    </span>
                  </div>
                  {sendError && (
                    <p className="mb-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12px] text-red-600">{sendError}</p>
                  )}
                  {pendingAttachments.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {pendingAttachments.map((attachment) => {
                        const isImage = attachment.file.type.startsWith("image/")
                        return (
                          <div key={attachment.id} className="flex max-w-64 items-center gap-2 rounded-md border bg-white p-1.5 pr-2 text-xs">
                            {isImage ? (
                              <img src={attachment.previewUrl} alt={attachment.file.name} className="size-9 rounded object-cover" />
                            ) : (
                              <span className="flex size-9 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                                <FileText className="size-4" />
                              </span>
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{attachment.file.name}</span>
                              <span className="text-[11px] text-muted-foreground">{formatFileSize(attachment.file.size)}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => removePendingAttachment(attachment.id)}
                              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                              aria-label="Remover anexo"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <input
                      ref={attachmentInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                      onChange={(event) => {
                        handleAttachmentFiles(Array.from(event.target.files ?? []))
                        event.target.value = ""
                      }}
                    />
                    {!isEmailView && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Anexar arquivo"
                        onClick={() => attachmentInputRef.current?.click()}
                        disabled={!selected || sending || pendingAttachments.length >= 5}
                      >
                        <Paperclip className="size-4" />
                      </Button>
                    )}
                    <textarea
                      ref={replyTextareaRef}
                      className={cn(
                        "flex-1 resize-none rounded-md border bg-white px-3 py-2 text-sm leading-5 shadow-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50",
                        isEmailView ? "min-h-28" : "min-h-16",
                      )}
                      placeholder={isEmailView ? "Escreva a resposta do e-mail..." : "Digite sua resposta..."}
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={handleReplyKeyDown}
                      disabled={sending}
                    />
                    <Button
                      size="icon"
                      aria-label="Enviar resposta"
                      onClick={sendReply}
                      disabled={(!reply.trim() && pendingAttachments.length === 0) || sending}
                    >
                      {sending ? (
                        <svg className="animate-spin size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                        </svg>
                      ) : (
                        <Send />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Selecione uma conversa
            </div>
          )}
        </section>

        {/* AI Tool Sheet */}
        <Sheet open={aiToolOpen} onClose={() => setAiToolOpen(false)}>
          <SheetHeader>
            {activeTool === "tag" ? (
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-violet-50">
                  <Tags className="size-4 text-violet-700" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Sugerir Tags</p>
                  <p className="text-xs text-muted-foreground">{selected?.customer.name ?? "—"}</p>
                </div>
              </div>
            ) : activeTool ? (
              <div className="flex items-center gap-2.5">
                {(() => { const t = AI_TOOLS.find((x) => x.id === activeTool)!; return (
                  <>
                    <span className={cn("flex size-8 items-center justify-center rounded-lg", t.accent)}>
                      <t.icon className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{selected?.customer.name ?? "—"}</p>
                    </div>
                  </>
                )})()}
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-muted">
                  <Activity className="size-4 text-muted-foreground" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Histórico de ações IA</p>
                  <p className="text-xs text-muted-foreground">{selected?.customer.name ?? "—"}</p>
                </div>
              </div>
            )}
          </SheetHeader>
          <SheetContent>
            {activeTool === "tag" ? (
              /* ── TAG SUGGESTION VIEW ───────────────────────────── */
              <div className="space-y-4">
                {tagLoading ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="size-4 animate-spin rounded-full border-2 border-violet-300 border-t-violet-700" />
                      A IA está analisando a conversa…
                    </div>
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-14 animate-pulse rounded-xl border bg-muted/30" />
                    ))}
                  </div>
                ) : tagError ? (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{tagError}</p>
                ) : tagSuggestions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma sugestão disponível.</p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Clique para aplicar ou remover uma tag. Clique novamente para desmarcar.
                    </p>
                    <div className="space-y-2">
                      {tagSuggestions.map((s) => {
                        const applied = appliedTagNames.has(s.name)
                        return (
                          <button
                            key={s.name}
                            onClick={() => toggleTag(s)}
                            className={cn(
                              "flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-all active:scale-[0.99]",
                              applied
                                ? "border-violet-300 bg-violet-50 hover:bg-violet-100/60"
                                : "hover:border-violet-300 hover:bg-violet-50/50"
                            )}
                          >
                            <span
                              className={cn(
                                "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors",
                                applied
                                  ? "bg-violet-600 text-white"
                                  : "bg-violet-100 text-violet-700"
                              )}
                            >
                              {applied ? "✓" : "#"}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-foreground">#{s.name}</span>
                                {applied && (
                                  <span className="rounded px-1 py-0.5 text-[10px] font-medium bg-violet-100 text-violet-700">aplicada</span>
                                )}
                                {!applied && !s.isNew && (
                                  <span className="rounded px-1 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">existente</span>
                                )}
                                {!applied && s.isNew && (
                                  <span className="rounded px-1 py-0.5 text-[10px] font-medium bg-violet-100 text-violet-700">nova</span>
                                )}
                              </div>
                              <p className="mt-0.5 text-xs text-muted-foreground leading-4">{s.reason}</p>
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    {/* Tags já aplicadas na conversa */}
                    {(selected?.tags ?? []).length > 0 && (
                      <div className="pt-2 border-t">
                        <p className="mb-2 text-xs font-medium text-muted-foreground">Todas as tags desta conversa</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(selected?.tags ?? []).map((tag) => (
                            <span
                              key={tag.id}
                              className="flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800"
                            >
                              #{tag.name}
                              <button
                                onClick={() => removeTagFromConv(tag.id)}
                                className="ml-0.5 text-violet-400 hover:text-violet-700"
                              >
                                <X className="size-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={openTagTool}
                      className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      ↺ Nova análise
                    </button>
                  </>
                )}
              </div>
            ) : activeTool ? (
              <>
                {/* ── phase: prepare ─────────────────────────────────── */}
                {aiPhase === "prepare" && (() => {
                  const t = AI_TOOLS.find((x) => x.id === activeTool)!
                  const placeholders: Record<AIToolId, string> = {
                    summary:     "Ex: foque nos pontos de objeção e ignore a saudação inicial",
                    next_action: "Ex: o cliente mencionou orçamento apertado, leve isso em conta",
                    policy:      "Ex: verifique especificamente se foram feitas promessas de prazo",
                    followup:    "Ex: o cliente preferiu ser contactado por e-mail após 3 dias",
                  }
                  const descriptions: Record<AIToolId, string> = {
                    summary:     "A IA vai ler toda a conversa e gerar um resumo executivo com intenção, objeções e estado da negociação.",
                    next_action: "A IA vai sugerir a próxima ação mais eficaz com base no contexto da conversa.",
                    policy:      "A IA vai revisar a conversa buscando inconsistências, promessas inadequadas ou oportunidades perdidas.",
                    followup:    "A IA vai criar um plano de follow-up com timing, canal e mensagem pronta para envio.",
                  }
                  return (
                    <div className="flex h-full flex-col gap-5">
                      {/* description */}
                      <div className={cn("rounded-xl border p-4 text-sm leading-6", t.accent.replace("text-", "border-").replace("bg-", "border-"))}>
                        <p className="text-foreground/80">{descriptions[activeTool]}</p>
                      </div>

                      {/* instruction input */}
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">
                          Instrução ou contexto adicional
                          <span className="ml-1.5 font-normal normal-case text-muted-foreground">(opcional)</span>
                        </label>
                        <textarea
                          className="min-h-[120px] w-full resize-none rounded-xl border bg-white px-3.5 py-3 text-sm leading-6 text-foreground shadow-sm outline-none placeholder:text-muted-foreground/40 focus:ring-2 focus:ring-primary/30"
                          placeholder={placeholders[activeTool]}
                          value={aiInstruction}
                          onChange={(e) => setAiInstruction(e.target.value)}
                          autoFocus
                        />
                        <p className="text-[11px] text-muted-foreground/60">
                          Use este campo para direcionar a análise, mencionar contexto que não está na conversa ou fazer uma pergunta específica.
                        </p>
                      </div>

                      {/* context preview */}
                      <div className="rounded-xl border bg-muted/40 p-3">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Contexto que será analisado</p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{selected?.customer.name}</span>
                          {" · "}{selected?.messages.length ?? 0} mensagens
                          {" · "}{channelLabel(selected?.channel ?? "")}
                        </p>
                      </div>

                      {/* run button */}
                      <div className="mt-auto">
                        <button
                          onClick={runAiTool}
                          className={cn(
                            "flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-all hover:brightness-105 active:scale-[0.98]",
                            t.accent.replace("bg-", "bg-").replace("text-", "")
                          )}
                          style={{ background: `hsl(var(--primary))` }}
                        >
                          <t.icon className="size-4" />
                          Executar {t.name}
                        </button>
                      </div>
                    </div>
                  )
                })()}

                {/* ── phase: loading ─────────────────────────────────── */}
                {aiPhase === "loading" && (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3 rounded-xl border bg-cyan-50/60 px-4 py-3 text-sm text-cyan-800">
                      <svg className="animate-spin size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      <span>Analisando com <strong>{OLLAMA_MODEL_LABEL}</strong>…</span>
                    </div>
                    {[92, 78, 85, 55, 70, 80, 48].map((w, i) => (
                      <div key={i} className="h-3 animate-pulse rounded-full bg-muted" style={{ width: `${w}%`, animationDelay: `${i * 80}ms` }} />
                    ))}
                  </div>
                )}

                {/* ── phase: result ──────────────────────────────────── */}
                {aiPhase === "result" && (
                  <div className="flex flex-col gap-4">
                    {/* re-run / back */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setAiPhase("prepare"); setAiResult("") }}
                        className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        ← Ajustar instrução
                      </button>
                      <button
                        onClick={runAiTool}
                        className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        ↺ Reexecutar
                      </button>
                    </div>

                    {/* result body */}
                    <div className="rounded-xl border bg-white p-4 shadow-sm">
                      {renderMarkdown(aiResult)}
                    </div>
                  </div>
                )}
              </>
            ) : (
              // History view
              aiHistoryLoading ? (
                <div className="space-y-3">
                  {[1,2,3].map((i) => (
                    <div key={i} className="rounded-xl border p-4 space-y-2">
                      <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-full animate-pulse rounded bg-muted" />
                      <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
                    </div>
                  ))}
                </div>
              ) : aiHistory.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <span className="flex size-12 items-center justify-center rounded-full bg-muted">
                    <Activity className="size-5 text-muted-foreground" />
                  </span>
                  <p className="text-sm text-muted-foreground">Nenhuma ação de IA realizada ainda.</p>
                  <p className="text-xs text-muted-foreground/60">Use as ferramentas acima para começar.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {aiHistory.map((entry) => {
                    const tool = AI_TOOLS.find((t) => t.name === entry.tool)
                    const isExpanded = historyExpanded === entry.id
                    return (
                      <div key={entry.id} className="rounded-xl border bg-white shadow-sm overflow-hidden">
                        <button
                          onClick={() => setHistoryExpanded(isExpanded ? null : entry.id)}
                          className="flex w-full items-center gap-2 p-4 text-left hover:bg-muted/30 transition-colors"
                        >
                          {tool && (
                            <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md", tool.accent)}>
                              <tool.icon className="size-3.5" />
                            </span>
                          )}
                          <span className="text-xs font-semibold text-foreground">{entry.tool}</span>
                          <span className="ml-auto text-[11px] text-muted-foreground mr-1">
                            {new Date(entry.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                          </span>
                          <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                        </button>
                        {!isExpanded && (
                          <div className="px-4 pb-3">
                            <p className="line-clamp-2 text-xs leading-5 text-foreground/60">
                              {entry.result.replace(/#{1,3}\s+/g, "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/^[-*•]\s+/gm, "• ")}
                            </p>
                          </div>
                        )}
                        {isExpanded && (
                          <div className="border-t px-4 py-3">
                            {renderMarkdown(entry.result)}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            )}
          </SheetContent>
        </Sheet>

        {/* ── Opportunity modal ───────────────────────────────────────── */}
        {oppModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) { setOppModalOpen(false); setOppSuccess(null) } }}
          >
            <div className="w-full max-w-md rounded-2xl border bg-white shadow-2xl">
              {/* Header */}
              <div className="flex items-center gap-3 border-b px-5 py-4">
                <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-50">
                  <Kanban className="size-5 text-emerald-700" />
                </span>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">Criar Oportunidade</p>
                  <p className="text-xs text-muted-foreground">{selected?.customer.name}</p>
                </div>
                <button
                  onClick={() => { setOppModalOpen(false); setOppSuccess(null) }}
                  className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>

              {oppSuccess ? (
                /* Success state */
                <div className="flex flex-col items-center gap-4 px-6 py-8 text-center">
                  <span className="flex size-14 items-center justify-center rounded-full bg-emerald-50">
                    <CheckCircle2 className="size-7 text-emerald-600" />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">Oportunidade criada!</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Card adicionado em <strong>{oppSuccess.columnName}</strong> no pipeline <strong>{oppSuccess.boardName}</strong>.
                    </p>
                  </div>
                  <button
                    onClick={() => { setOppModalOpen(false); setOppSuccess(null) }}
                    className="mt-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              ) : (
                /* Form */
                <div className="space-y-4 px-5 py-4">
                  {pipelinesLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => <div key={i} className="h-9 animate-pulse rounded-lg bg-muted" />)}
                    </div>
                  ) : pipelines.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Nenhum pipeline encontrado. Crie um na tela de Quadros.</p>
                  ) : (
                    <>
                      {/* Pipeline select */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Pipeline</label>
                        <select
                          value={oppPipelineId}
                          onChange={(e) => handlePipelineChange(e.target.value)}
                          className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          {pipelines.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Column select */}
                      {oppPipelineId && (
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">Coluna (etapa)</label>
                          <div className="flex flex-wrap gap-1.5">
                            {(pipelines.find((p) => p.id === oppPipelineId)?.columns ?? []).map((col) => (
                              <button
                                key={col.id}
                                onClick={() => setOppColumnId(col.id)}
                                className={cn(
                                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                                  oppColumnId === col.id
                                    ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                                    : "border-muted text-muted-foreground hover:border-emerald-300 hover:text-emerald-700"
                                )}
                              >
                                {col.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Name */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Nome da oportunidade</label>
                        <input
                          value={oppName}
                          onChange={(e) => setOppName(e.target.value)}
                          placeholder={selected?.customer.name ?? "Nome"}
                          className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
                        />
                      </div>

                      {/* Description */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Descrição <span className="text-muted-foreground/60">(opcional)</span></label>
                        <textarea
                          value={oppDesc}
                          onChange={(e) => setOppDesc(e.target.value)}
                          rows={2}
                          placeholder="Contexto da oportunidade…"
                          className="w-full resize-none rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
                        />
                      </div>
                    </>
                  )}

                  {/* Footer */}
                  <div className="flex justify-end gap-2 border-t pt-4">
                    <button
                      onClick={() => setOppModalOpen(false)}
                      className="rounded-lg border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={saveOpportunity}
                      disabled={oppSaving || !oppPipelineId}
                      className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      {oppSaving && <div className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                      Criar Oportunidade
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <Sheet open={ticketModalOpen && !!selected} onOpenChange={(open) => { if (!open) { setTicketModalOpen(false); setTicketSuccess(null); setTicketError("") } }}>
          <SheetContent className="flex w-full flex-col overflow-hidden p-0 sm:max-w-xl">
            {/* Header */}
            <div className="flex shrink-0 items-center gap-3 border-b px-5 py-4">
              <span className="flex size-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
                <LifeBuoy className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-base">Abrir chamado</SheetTitle>
                <p className="truncate text-xs text-muted-foreground">{selected?.customer.name} · {selected ? channelLabel(selected.channel) : ""}</p>
              </div>
              {ticketSuccess && (
                <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold text-cyan-700">{ticketSuccess}</span>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {/* ── Formulário ─────────────────────────────────────────── */}
              <div className="space-y-4 px-5 py-4">
                {ticketError && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{ticketError}</div>}

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Resumo do chamado</label>
                  <textarea
                    className="min-h-32 w-full resize-y rounded-md border bg-white px-3 py-2 text-sm leading-5 outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                    placeholder="Descreva o contexto do chamado…"
                    value={ticketSummary}
                    onChange={(e) => setTicketSummary(e.target.value)}
                    disabled={!!ticketSuccess}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Título</label>
                  <Input
                    value={ticketTitle}
                    onChange={(e) => setTicketTitle(e.target.value)}
                    disabled={!!ticketSuccess}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Categoria", value: ticketCategory, onChange: (v: string) => setTicketCategory(v as TicketCategory), options: supportCategories },
                    { label: "Prioridade", value: ticketPriority, onChange: (v: string) => setTicketPriority(v as TicketPriority), options: supportPriorities },
                    { label: "Equipe",     value: ticketTeam,     onChange: (v: string) => setTicketTeam(v),                      options: [...supportTeams] },
                  ].map(({ label, value, onChange, options }) => (
                    <div key={label} className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">{label}</label>
                      <select
                        className="h-9 w-full rounded-md border bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        disabled={!!ticketSuccess}
                      >
                        {options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                </div>

                {!ticketSuccess && (
                  <div className="flex justify-end gap-2 border-t pt-4">
                    <Button variant="outline" onClick={() => setTicketModalOpen(false)}>Cancelar</Button>
                    <Button disabled={ticketSaving} onClick={saveTicket}>
                      <LifeBuoy className="size-3.5" /> {ticketSaving ? "Criando…" : "Criar chamado"}
                    </Button>
                  </div>
                )}
              </div>

              {/* ── Divisória de acompanhamento ─────────────────────────── */}
              <div className="relative my-1 flex items-center gap-3 px-5">
                <div className="h-px flex-1 bg-border" />
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Acompanhamento</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="space-y-5 px-5 pb-6 pt-4">
                {/* SLA */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      label: "SLA limite",
                      value: ticketSlaDueAt
                        ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(ticketSlaDueAt))
                        : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(ticketSlaPreview()),
                      muted: !ticketSlaDueAt,
                    },
                    {
                      label: "Estado SLA",
                      value: ticketSlaState ?? (ticketPriority === "Crítica" ? "Em risco" : "No prazo"),
                      muted: !ticketSlaDueAt,
                    },
                    {
                      label: "Tempo restante",
                      value: (() => {
                        const due = ticketSlaDueAt ? new Date(ticketSlaDueAt) : ticketSlaPreview()
                        const diff = due.getTime() - Date.now()
                        const abs = Math.abs(diff)
                        const h = Math.floor(abs / 3_600_000)
                        const m = Math.floor((abs % 3_600_000) / 60_000)
                        const sign = diff < 0 ? "-" : ""
                        return h > 0 ? `${sign}${h}h ${m}min` : `${sign}${m}min`
                      })(),
                      muted: !ticketSlaDueAt,
                    },
                  ].map(({ label, value, muted }) => (
                    <div key={label} className={cn("rounded-lg border p-2.5 text-center", muted ? "border-dashed bg-muted/20" : "bg-cyan-50/60")}>
                      <p className={cn("text-sm font-bold", muted ? "text-muted-foreground" : "text-cyan-800")}>{value}</p>
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Arquivos */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Arquivos anexados</p>
                  <label className={cn(
                    "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors",
                    ticketFiles.length > 0 ? "border-primary/30 bg-primary/5" : "hover:border-primary/40 hover:bg-muted/30",
                  )}>
                    <input
                      type="file"
                      multiple
                      className="sr-only"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? [])
                        setTicketFiles((prev) => [...prev, ...files])
                        e.target.value = ""
                      }}
                    />
                    {ticketFiles.length === 0 ? (
                      <>
                        <svg className="size-6 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636M12 16v-4m0 0V8m0 4h4m-4 0H8" /></svg>
                        <p className="text-xs text-muted-foreground">Clique para anexar arquivos</p>
                      </>
                    ) : (
                      <div className="w-full space-y-1 text-left">
                        {ticketFiles.map((f, i) => (
                          <div key={i} className="flex items-center justify-between gap-2 rounded-md border bg-white px-2.5 py-1.5 text-xs">
                            <span className="min-w-0 truncate">{f.name}</span>
                            <button
                              className="shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={(e) => { e.preventDefault(); setTicketFiles((prev) => prev.filter((_, j) => j !== i)) }}
                            >
                              <X className="size-3" />
                            </button>
                          </div>
                        ))}
                        <p className="pt-1 text-center text-[11px] text-muted-foreground">+ Clique para adicionar mais</p>
                      </div>
                    )}
                  </label>
                </div>

                {/* Comentários */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Adicionar comentário</p>
                  <textarea
                    className="min-h-20 w-full resize-none rounded-md border bg-white px-3 py-2 text-xs leading-5 outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder={ticketId ? "Escreva uma nota interna ou atualização…" : "Disponível após criar o chamado"}
                    value={ticketNote}
                    onChange={(e) => setTicketNote(e.target.value)}
                    disabled={!ticketId}
                  />
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    disabled={!ticketId || !ticketNote.trim() || ticketNoteAdding}
                    onClick={addTicketNote}
                  >
                    {ticketNoteAdding ? "Adicionando…" : "Adicionar comentário"}
                  </Button>
                </div>

                {/* Histórico */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Histórico de atendimento</p>
                  {ticketActivities.length === 0 ? (
                    <div className="rounded-lg border border-dashed px-4 py-5 text-center">
                      <p className="text-xs text-muted-foreground">{ticketId ? "Nenhum registro ainda." : "Histórico disponível após criar o chamado."}</p>
                    </div>
                  ) : (
                    <div className="divide-y rounded-lg border">
                      {ticketActivities.map((entry) => (
                        <div key={entry.id} className="flex gap-3 px-3 py-3">
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold">
                              {entry.authorName}{" "}
                              <span className="font-normal text-muted-foreground">
                                · {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(entry.createdAt))}
                              </span>
                            </p>
                            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{entry.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {ticketSuccess && (
                  <div className="flex gap-2 border-t pt-4">
                    <Button variant="outline" className="flex-1" onClick={() => { setTicketModalOpen(false); setTicketSuccess(null) }}>Fechar</Button>
                    <Button className="flex-1" onClick={() => { window.location.href = "/suporte" }}>Ir para Suporte</Button>
                  </div>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <Sheet open={quoteModalOpen && !!selected} onOpenChange={(open) => { if (!open) setQuoteModalOpen(false) }}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
            <SheetHeader className="mb-4">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <ClipboardList className="size-5" />
                </span>
                <div className="min-w-0">
                  <SheetTitle>Novo orçamento</SheetTitle>
                  <p className="truncate text-xs text-muted-foreground">{selected?.customer.name} · {selected ? channelLabel(selected.channel) : ""}</p>
                </div>
              </div>
            </SheetHeader>
            <div className="space-y-3">
                {quoteError && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{quoteError}</p>}
                {quoteSuccess && <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{quoteSuccess}</p>}
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Validade</span>
                    <Input type="date" value={quoteValidUntil} onChange={(event) => setQuoteValidUntil(event.target.value)} />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Frete</span>
                    <Input type="number" min="0" value={quoteFreight} onChange={(event) => setQuoteFreight(event.target.value)} placeholder="0,00" />
                  </label>
                </div>
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Produto</span>
                  <select
                    className="h-9 w-full rounded-md border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    value=""
                    onChange={(event) => {
                      if (event.target.value) addQuoteProduct(event.target.value)
                      event.target.value = ""
                    }}
                    disabled={quoteProductsLoading}
                  >
                    <option value="">{quoteProductsLoading ? "Carregando produtos..." : "Adicionar produto"}</option>
                    {quoteProducts.map((product) => (
                      <option key={product.id} value={product.id}>{product.name} · {formatMoney(product.price)}</option>
                    ))}
                  </select>
                </label>
                <div className="space-y-2">
                  {quoteItems.length === 0 ? (
                    <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                      Adicione um ou mais produtos para gerar o orçamento.
                    </p>
                  ) : quoteItems.map((item, index) => {
                    const product = quoteProducts.find((p) => p.id === item.productId)
                    return (
                      <div key={`${item.productId}-${index}`} className="rounded-lg border bg-muted/20 p-2.5">
                        <div className="flex items-center gap-2">
                          <p className="min-w-0 flex-1 truncate text-sm font-semibold">{product?.name ?? "Produto"}</p>
                          <button className="text-muted-foreground hover:text-destructive" onClick={() => setQuoteItems((items) => items.filter((_, i) => i !== index))}>
                            <X className="size-3.5" />
                          </button>
                        </div>
                        <div className="mt-2 grid grid-cols-[80px_1fr_90px_1fr] gap-2">
                          <Input className="h-8 text-xs" type="number" min="0" value={item.quantity} onChange={(event) => updateQuoteDraftItem(index, { quantity: event.target.value })} />
                          <Input className="h-8 text-xs" type="number" min="0" value={item.unitPrice} onChange={(event) => updateQuoteDraftItem(index, { unitPrice: event.target.value })} />
                          <select className="h-8 rounded-md border bg-white px-2 text-xs" value={item.discountType} onChange={(event) => updateQuoteDraftItem(index, { discountType: event.target.value as "VALOR" | "PERCENTUAL" })}>
                            <option value="VALOR">R$</option>
                            <option value="PERCENTUAL">%</option>
                          </select>
                          <Input className="h-8 text-xs" type="number" min="0" value={item.discountValue} onChange={(event) => updateQuoteDraftItem(index, { discountValue: event.target.value })} placeholder="Desconto" />
                        </div>
                      </div>
                    )
                  })}
                </div>
                <textarea
                  className="min-h-20 w-full resize-none rounded-md border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Observações para o cliente"
                  value={quoteNotes}
                  onChange={(event) => setQuoteNotes(event.target.value)}
                />
                <div className="flex items-center justify-between rounded-md border bg-emerald-50 px-3 py-2">
                  <span className="text-sm text-emerald-900">Total previsto</span>
                  <span className="text-lg font-bold text-emerald-700">{formatMoney(quoteTotalPreview())}</span>
                </div>
              <div className="flex justify-end gap-2 border-t pt-4">
                <Button variant="outline" onClick={() => setQuoteModalOpen(false)}>Cancelar</Button>
                <Button onClick={createAndSendQuote} disabled={quoteSaving || quoteItems.length === 0}>
                  {quoteSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                  Criar e enviar
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* ── Transfer Sheet ────────────────────────────────────────────── */}
        <Sheet open={transferOpen && !!selected} onOpenChange={(open) => { if (!open) setTransferOpen(false) }}>
          <SheetContent className="sm:max-w-sm">
            <SheetHeader>
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
                  <ArrowRightLeft className="size-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <SheetTitle>Transferir conversa</SheetTitle>
                  <p className="truncate text-xs text-muted-foreground">{selected?.customer.name}</p>
                </div>
              </div>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              {transferDone ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <div className="flex size-12 items-center justify-center rounded-full bg-emerald-50">
                    <CheckCircle2 className="size-6 text-emerald-600" />
                  </div>
                  <p className="text-sm text-muted-foreground">Conversa transferida com sucesso</p>
                  <Button size="sm" onClick={() => setTransferOpen(false)}>Fechar</Button>
                </div>
              ) : (
                <>
                  {/* Toggle: user / team */}
                  <div className="flex rounded-lg border p-0.5">
                    <button
                      className={cn("flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors", transferMode === "user" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                      onClick={() => { setTransferMode("user"); setTransferTargetId("") }}
                    >Para pessoa</button>
                    <button
                      className={cn("flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors", transferMode === "team" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                      onClick={() => { setTransferMode("team"); setTransferTargetId("") }}
                    >Para time</button>
                  </div>

                  {/* Search */}
                  <input
                    type="text"
                    placeholder="Buscar..."
                    className="w-full rounded-md border bg-transparent px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                    value={transferSearch}
                    onChange={(e) => setTransferSearch(e.target.value)}
                  />

                  {/* List */}
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {transferLoading ? (
                      <div className="flex items-center justify-center py-4"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>
                    ) : transferMode === "user" ? (
                      transferUsers
                        .filter((u) => u.name.toLowerCase().includes(transferSearch.toLowerCase()))
                        .map((u) => (
                          <button
                            key={u.id}
                            className={cn("flex w-full items-center justify-between rounded-md px-3 py-2 text-xs transition-colors hover:bg-muted", transferTargetId === u.id && "ring-1 ring-primary bg-primary/5")}
                            onClick={() => setTransferTargetId(u.id)}
                          >
                            <span className="font-medium">{u.name}</span>
                            <span className="text-muted-foreground">{u.role}</span>
                          </button>
                        ))
                    ) : (
                      transferTeams
                        .filter((t) => t.name.toLowerCase().includes(transferSearch.toLowerCase()))
                        .map((t) => (
                          <button
                            key={t.id}
                            className={cn("flex w-full items-center justify-between rounded-md px-3 py-2 text-xs transition-colors hover:bg-muted", transferTargetId === t.id && "ring-1 ring-primary bg-primary/5")}
                            onClick={() => setTransferTargetId(t.id)}
                          >
                            <span className="font-medium">{t.name}</span>
                          </button>
                        ))
                    )}
                  </div>

                  {/* Note */}
                  <textarea
                    placeholder="Motivo interno (opcional)"
                    className="w-full rounded-md border bg-transparent px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary"
                    rows={2}
                    value={transferNote}
                    onChange={(e) => setTransferNote(e.target.value)}
                  />

                  {transferError && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{transferError}</p>}

                  {/* Confirm */}
                  <Button
                    className="w-full"
                    size="sm"
                    disabled={!transferTargetId || transferSaving}
                    onClick={saveTransfer}
                  >
                    {transferSaving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                    Confirmar transferência
                  </Button>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Right — context sidebar */}
        <aside className="min-h-0 space-y-3 overflow-y-auto pr-1">
          {/* ── Ações rápidas ───────────────────────────────────────────── */}
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle>Ações rápidas</CardTitle>
              <CardDescription>Operações vinculadas a esta conversa</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-3 pt-0">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={openQuoteModal}
                disabled={!selected || selected.channel === "EMAIL"}
                title={selected?.channel === "EMAIL" ? "Envio por e-mail não faz parte deste ciclo" : "Criar orçamento para esta conversa"}
              >
                <ClipboardList className="size-3.5" />
                Criar orçamento
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={openTicketModal}
                disabled={!selected}
              >
                <LifeBuoy className="size-3.5" />
                Abrir chamado
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={openTransferModal}
                disabled={!selected}
              >
                <ArrowRightLeft className="size-3.5" />
                Transferir conversa
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle>Contexto do cliente</CardTitle>
              <CardDescription>Sinais unificados do relacionamento</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-3 pt-0">
              {[
                ["Valor potencial", formatCurrency(customer?.value)],
                ["Etapa", customer?.stage ?? "—"],
                ["Origem", customer?.source ?? "—"],
                ["Sentimento", customer?.aiSentiment ?? "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between border-b pb-2 last:border-b-0 last:pb-0">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-sm font-medium">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle>Análise da IA</CardTitle>
              <CardDescription>Leitura rápida para conduzir o atendimento</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-3 pt-0">
              {[
                ["Risco", customer?.aiRisk ?? "—"],
                ["Próxima ação", selected?.nextAction ?? "—"],
                ["Razão IA", selected?.aiReason ?? "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between border-b pb-2 last:border-b-0 last:pb-0">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="max-w-32 text-right text-sm font-medium leading-5">{value}</span>
                </div>
              ))}
              {customer?.aiNextBestAction && (
                <div className="rounded-md border bg-cyan-50 px-2 py-1.5 text-[11px] leading-4 text-cyan-950">
                  {customer.aiNextBestAction}
                </div>
              )}
            </CardContent>
          </Card>

        </aside>
      </div>
    </div>
  )
}

// ─── BoardsView ───────────────────────────────────────────────────────────────

type KActivity = {
  id: string
  type: string
  title: string | null
  content: string
  doneAt: string | null
  authorName: string
  createdAt: string
}

type KCard = {
  id: string
  name: string
  description: string | null
  initials: string | null
  priority: string
  dots: number
  score: number | null
  scoreBreakdown: Record<string, number | string> | null
  value: string | null
  expectedCloseAt: string | null
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  assignedUserId: string | null
  assignedUser: { id: string; name: string; avatarUrl: string | null } | null
  closeType: "GANHO" | "PERDIDO" | "CANCELADO" | null
  closeReason: string | null
  createdAt: string
  updatedAt: string
  customer: { id: string; name: string; phone: string; email: string | null; stage: string | null; aiScore: number | null } | null
  activities?: KActivity[]
}

type KColumn = {
  id: string
  name: string
  color: string | null
  sortOrder: number
  probability: number | null
  slaHours: number | null
  cards: KCard[]
}

type KBoard = {
  id: string
  name: string
  columns: KColumn[]
}

type BoardMeta = { id: string; name: string; columns: { id: string; name: string }[] }

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  NOTA:     FileText,
  LIGACAO:  Phone,
  EMAIL:    Mail,
  REUNIAO:  Users,
  TAREFA:   ClipboardList,
  WHATSAPP: MessageCircle,
}

const ACTIVITY_LABELS: Record<string, string> = {
  NOTA:     "Nota",
  LIGACAO:  "Ligação",
  EMAIL:    "E-mail",
  REUNIAO:  "Reunião",
  TAREFA:   "Tarefa",
  WHATSAPP: "WhatsApp",
}

const ACTIVITY_COLORS: Record<string, string> = {
  NOTA:     "bg-muted text-muted-foreground",
  LIGACAO:  "bg-emerald-50 text-emerald-700",
  EMAIL:    "bg-blue-50 text-blue-700",
  REUNIAO:  "bg-violet-50 text-violet-700",
  TAREFA:   "bg-amber-50 text-amber-700",
  WHATSAPP: "bg-green-50 text-green-700",
}

const PRIORITY_COLORS: Record<string, string> = {
  ALTA:   "bg-rose-500",
  MEDIA:  "bg-amber-400",
  BAIXA:  "bg-sky-400",
}

export function BoardsView() {
  const { companyId } = useAuth() ?? {}
  const [boards, setBoards] = useState<BoardMeta[]>([])
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null)
  const [board, setBoard] = useState<KBoard | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCard, setSelectedCard] = useState<KCard | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [movingCardId, setMovingCardId] = useState<string | null>(null)
  const [boardDropOpen, setBoardDropOpen] = useState(false)
  const boardDropRef = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState("")

  // Card detail states
  const [cardTab, setCardTab] = useState<"atividade" | "detalhes" | "cliente">("atividade")
  const [cardLoading, setCardLoading] = useState(false)
  const [activities, setActivities] = useState<KActivity[]>([])
  const [actType, setActType] = useState("NOTA")
  const [actTitle, setActTitle] = useState("")
  const [actContent, setActContent] = useState("")
  const [actSaving, setActSaving] = useState(false)
  // Inline edit for card fields
  const [editingField, setEditingField] = useState<string | null>(null)
  const [fieldDraft, setFieldDraft] = useState("")
  const [computingScore, setComputingScore] = useState(false)
  const [draggingCard, setDraggingCard] = useState<KCard | null>(null)
  const [pipelineMoveOpen, setPipelineMoveOpen] = useState(false)
  const pipelineMoveRef = useRef<HTMLDivElement>(null)
  const { name: authName } = useAuth() ?? {}
  const [companyUsers, setCompanyUsers] = useState<{ id: string; name: string; avatarUrl: string | null }[]>([])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  function handleDragStart(event: DragStartEvent) {
    const card = event.active.data.current?.card as KCard | undefined
    if (card) setDraggingCard(card)
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingCard(null)
    const { active, over } = event
    if (!over || !board) return

    const activeCardId = String(active.id)
    const overId = String(over.id)

    // Find which column currently holds the active card
    const sourceCol = board.columns.find((col) => col.cards.some((c) => c.id === activeCardId))
    if (!sourceCol) return

    // over.id can be a column id or another card id
    const targetCol =
      board.columns.find((col) => col.id === overId) ??
      board.columns.find((col) => col.cards.some((c) => c.id === overId))
    if (!targetCol) return

    if (sourceCol.id === targetCol.id) {
      // Reorder within same column
      const oldIndex = sourceCol.cards.findIndex((c) => c.id === activeCardId)
      const newIndex = targetCol.cards.findIndex((c) => c.id === overId)
      if (oldIndex === newIndex) return
      setBoard((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          columns: prev.columns.map((col) =>
            col.id === sourceCol.id
              ? { ...col, cards: arrayMove(col.cards, oldIndex, newIndex) }
              : col,
          ),
        }
      })
    } else {
      // Move to different column
      const card = sourceCol.cards.find((c) => c.id === activeCardId)
      if (!card) return
      setBoard((prev) => {
        if (!prev) return prev
        const overIndex = targetCol.cards.findIndex((c) => c.id === overId)
        const insertAt = overIndex >= 0 ? overIndex : targetCol.cards.length
        return {
          ...prev,
          columns: prev.columns.map((col) => {
            if (col.id === sourceCol.id) return { ...col, cards: col.cards.filter((c) => c.id !== activeCardId) }
            if (col.id === targetCol.id) {
              const updated = [...col.cards]
              updated.splice(insertAt, 0, card)
              return { ...col, cards: updated }
            }
            return col
          }),
        }
      })
      // Persist
      fetch(`/api/pipelines/cards/${activeCardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columnId: targetCol.id }),
      }).catch(() => {})
    }
  }

  // Load board list and company users
  useEffect(() => {
    if (!companyId) return
    fetch(`/api/pipelines?companyId=${companyId}`)
      .then((r) => r.json())
      .then((d: BoardMeta[]) => {
        setBoards(d)
        if (d.length > 0) setActiveBoardId(d[0].id)
      })
      .catch(() => {})
    fetch(`/api/teams/users?companyId=${companyId}`)
      .then((r) => r.json())
      .then((d: { id: string; name: string; avatarUrl: string | null }[]) => setCompanyUsers(d))
      .catch(() => {})
  }, [companyId])

  // Load active board with cards
  useEffect(() => {
    if (!activeBoardId || !companyId) return
    setLoading(true)
    fetch(`/api/pipelines/${activeBoardId}?companyId=${companyId}`)
      .then((r) => r.json())
      .then((d: KBoard) => setBoard(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [activeBoardId, companyId])

  // Close board dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (boardDropRef.current && !boardDropRef.current.contains(e.target as Node)) setBoardDropOpen(false)
      if (pipelineMoveRef.current && !pipelineMoveRef.current.contains(e.target as Node)) setPipelineMoveOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  function moveCard(cardId: string, targetColumnId: string) {
    if (!board) return
    setMovingCardId(cardId)
    // optimistic update
    const card = board.columns.flatMap((c) => c.cards).find((c) => c.id === cardId)
    if (!card) return
    setBoard((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        columns: prev.columns.map((col) => ({
          ...col,
          cards: col.id === targetColumnId
            ? col.cards.some((c) => c.id === cardId) ? col.cards : [...col.cards, card]
            : col.cards.filter((c) => c.id !== cardId),
        })),
      }
    })
    if (selectedCard?.id === cardId) setSelectedCard(card)
    fetch(`/api/pipelines/cards/${cardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columnId: targetColumnId }),
    }).catch(() => {}).finally(() => setMovingCardId(null))
  }

  function deleteCard(cardId: string) {
    if (!board) return
    setBoard((prev) => prev ? {
      ...prev,
      columns: prev.columns.map((col) => ({ ...col, cards: col.cards.filter((c) => c.id !== cardId) })),
    } : prev)
    setSheetOpen(false)
    fetch(`/api/pipelines/cards/${cardId}`, { method: "DELETE" }).catch(() => {})
  }

  function openCard(card: KCard) {
    setSelectedCard(card)
    setActivities([])
    setCardTab("atividade")
    setActType("NOTA")
    setActTitle("")
    setActContent("")
    setEditingField(null)
    setSheetOpen(true)
    setCardLoading(true)
    fetch(`/api/pipelines/cards/${card.id}`)
      .then((r) => r.json())
      .then((d: KCard & { activities: KActivity[] }) => {
        setSelectedCard(d)
        setActivities(d.activities ?? [])
      })
      .catch(() => {})
      .finally(() => setCardLoading(false))
  }

  function saveActivity() {
    if (!selectedCard || !actContent.trim()) return
    setActSaving(true)
    fetch(`/api/pipelines/cards/${selectedCard.id}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: actType, title: actTitle.trim() || null, content: actContent.trim(), authorName: authName }),
    })
      .then((r) => r.json())
      .then((d: KActivity) => {
        setActivities((prev) => [d, ...prev])
        setActContent("")
        setActTitle("")
      })
      .catch(() => {})
      .finally(() => setActSaving(false))
  }

  function deleteActivity(actId: string) {
    setActivities((prev) => prev.filter((a) => a.id !== actId))
    fetch(`/api/pipelines/activities/${actId}`, { method: "DELETE" }).catch(() => {})
  }

  function saveCardField(field: string, value: string) {
    if (!selectedCard) return
    setSelectedCard((prev) => prev ? { ...prev, [field]: value || null } : prev)
    setEditingField(null)
    fetch(`/api/pipelines/cards/${selectedCard.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    }).catch(() => {})
  }

  async function moveToPipeline(targetBoardId: string) {
    if (!selectedCard || !companyId) return
    setPipelineMoveOpen(false)
    // Get first column of target board
    const res = await fetch(`/api/pipelines/${targetBoardId}?companyId=${companyId}`)
    const targetBoard: KBoard = await res.json()
    if (!targetBoard?.columns?.length) return
    const targetColumnId = targetBoard.columns[0].id
    // Remove from current board optimistically
    setBoard((prev) => prev ? {
      ...prev,
      columns: prev.columns.map((col) => ({ ...col, cards: col.cards.filter((c) => c.id !== selectedCard.id) })),
    } : prev)
    setSheetOpen(false)
    await fetch(`/api/pipelines/cards/${selectedCard.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columnId: targetColumnId }),
    })
  }

  function computeScore() {
    if (!selectedCard) return
    setComputingScore(true)
    fetch(`/api/pipelines/cards/${selectedCard.id}/compute-score`, { method: "POST" })
      .then((r) => r.json())
      .then((d: KCard) => setSelectedCard(d))
      .catch(() => {})
      .finally(() => setComputingScore(false))
  }

  const filteredBoard = useMemo(() => {
    if (!board || !search.trim()) return board
    const q = search.toLowerCase()
    return {
      ...board,
      columns: board.columns.map((col) => ({
        ...col,
        cards: col.cards.filter((c) =>
          c.name.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.customer?.phone?.includes(q)
        ),
      })),
    }
  }, [board, search])

  return (
    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
      <div className="h-full min-w-[760px] p-2.5 md:p-3">
        <section className="flex min-h-0 h-full flex-col overflow-hidden rounded-lg border bg-white shadow-soft">
          <div className="flex shrink-0 flex-wrap items-center gap-3 border-b p-3">
            {/* Board selector */}
            <div className="relative" ref={boardDropRef}>
              <Button variant="outline" size="sm" onClick={() => setBoardDropOpen((v) => !v)}>
                {boards.find((b) => b.id === activeBoardId)?.name ?? "Selecionar pipeline"}
                <ChevronDown className="size-3.5" />
              </Button>
              {boardDropOpen && (
                <div className="absolute left-0 top-full z-50 mt-1.5 w-52 overflow-hidden rounded-xl border bg-white shadow-lg">
                  {boards.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => { setActiveBoardId(b.id); setBoardDropOpen(false) }}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50",
                        activeBoardId === b.id && "bg-muted/40 font-medium"
                      )}
                    >
                      <Kanban className="size-3.5 text-muted-foreground" />
                      {b.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="ml-auto hidden w-56 items-center gap-2 rounded-md border bg-white px-3 md:flex">
              <Search className="size-4 text-muted-foreground" />
              <Input
                className="h-8 border-0 px-0 shadow-none focus-visible:ring-0"
                placeholder="Buscar card…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="ghost" size="icon" aria-label="Configurar quadro">
              <Settings />
            </Button>
          </div>

          {/* Board body */}
          {loading ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              <span className="text-sm">Carregando pipeline…</span>
            </div>
          ) : !filteredBoard || filteredBoard.columns.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Nenhuma coluna neste pipeline.
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden bg-muted/35 p-3">
                {filteredBoard.columns.map((column) => (
                  <DroppableColumn
                    key={column.id}
                    columnId={column.id}
                    name={column.name}
                    color={column.color}
                    cards={column.cards}
                    selectedCardId={selectedCard?.id ?? null}
                    sheetOpen={sheetOpen}
                    onCardClick={(card) => openCard(card as Parameters<typeof openCard>[0])}
                  />
                ))}
              </div>
              <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.18,0.67,0.6,1.22)" }}>
                {draggingCard ? <CardGhost card={draggingCard} /> : null}
              </DragOverlay>
            </DndContext>
          )}
        </section>

      </div>
      {/* Card detail sheet */}
      {selectedCard && (
        <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
          {/* ── Header ── */}
          <div className="shrink-0 border-b bg-white">
            {/* Top bar */}
            <div className="flex items-center gap-3 px-5 pt-4 pb-3">
              <div className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm",
                selectedCard.priority === "ALTA" ? "bg-rose-500" :
                selectedCard.priority === "MEDIA" ? "bg-amber-400" : "bg-sky-400"
              )}>
                {selectedCard.initials ?? selectedCard.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold leading-tight">{selectedCard.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {selectedCard.customer?.name
                    ? `${selectedCard.customer.name} · `
                    : ""}
                  Criado {new Date(selectedCard.createdAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
              {/* Score badge */}
              {selectedCard.score != null && (() => {
                const s = selectedCard.score
                const bg = s >= 70 ? "bg-rose-500" : s >= 40 ? "bg-amber-400" : "bg-sky-400"
                const lbl = s >= 70 ? "Quente" : s >= 40 ? "Morno" : "Frio"
                return (
                  <div className={cn("flex flex-col items-center rounded-xl px-3 py-1.5 text-white", bg)}>
                    <span className="text-lg font-black leading-none">{s}</span>
                    <span className="text-[10px] font-medium opacity-90">{lbl}</span>
                  </div>
                )
              })()}
              {/* Move to another pipeline */}
              {boards.length > 1 && (
                <div ref={pipelineMoveRef} className="relative">
                  <button
                    onClick={() => setPipelineMoveOpen((v) => !v)}
                    className="flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                    title="Mover para outro pipeline"
                  >
                    <Kanban className="size-3.5" />
                    Pipeline
                    <ChevronDown className="size-3" />
                  </button>
                  {pipelineMoveOpen && (
                    <div className="absolute right-0 top-full z-50 mt-1.5 w-[280px] rounded-lg border bg-white shadow-xl">
                      <div className="border-b px-3.5 py-3">
                        <p className="text-xs font-semibold">Mover para outro pipeline</p>
                        <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">Selecione o destino do card.</p>
                      </div>
                      <div className="max-h-[260px] divide-y overflow-y-auto">
                        {boards.filter((b) => b.id !== activeBoardId).map((b) => (
                          <button
                            key={b.id}
                            onClick={() => moveToPipeline(b.id)}
                            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-muted/50"
                          >
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                              <Kanban className="size-3.5" />
                            </span>
                            <span className="min-w-0 flex-1 truncate text-xs font-medium">{b.name}</span>
                            <ChevronRight className="size-3.5 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                      <div className="border-t bg-muted/20 p-3">
                        <a
                          href="/quadros"
                          className="inline-flex h-8 w-full items-center justify-center rounded-md border bg-white px-3 text-xs font-medium transition-colors hover:bg-muted"
                        >
                          Ver todos os quadros
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => deleteCard(selectedCard.id)}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                <Trash2 className="size-4" />
              </button>
              <button
                onClick={() => setSheetOpen(false)}
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Pipeline stages */}
            <div className="flex gap-0 overflow-x-auto px-5 pb-0">
              {(filteredBoard?.columns ?? []).map((col, idx) => {
                const cols = filteredBoard?.columns ?? []
                const isCurrentCol = col.cards.some((c) => c.id === selectedCard.id)
                const currentIdx = cols.findIndex((c) => c.cards.some((cd) => cd.id === selectedCard.id))
                const isPast = idx < currentIdx
                return (
                  <button
                    key={col.id}
                    disabled={isCurrentCol || movingCardId === selectedCard.id}
                    onClick={() => moveCard(selectedCard.id, col.id)}
                    className={cn(
                      "group relative flex min-w-0 flex-1 items-center justify-center gap-1 border-b-2 pb-2 pt-1 text-[11px] font-medium transition-colors",
                      isCurrentCol
                        ? "border-primary text-primary"
                        : isPast
                        ? "border-primary/30 text-primary/50"
                        : "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
                    )}
                  >
                    <span className={cn(
                      "size-1.5 rounded-full shrink-0",
                      isCurrentCol ? "bg-primary" : isPast ? "bg-primary/30" : "bg-muted-foreground/20"
                    )} />
                    <span className="truncate">{col.name}</span>
                  </button>
                )
              })}
            </div>

            {/* Tabs */}
            <div className="flex border-t">
              {(["atividade", "detalhes", "cliente"] as const).map((tab) => {
                const icons = { atividade: Activity, detalhes: ClipboardList, cliente: UserRound }
                const Icon = icons[tab]
                return (
                  <button
                    key={tab}
                    onClick={() => setCardTab(tab)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors",
                      cardTab === tab
                        ? "border-b-2 border-primary text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="size-3.5" />
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Body ── */}
          <SheetContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
            {cardLoading && (
              <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /><span className="text-sm">Carregando…</span>
              </div>
            )}

            {/* ── Tab: Atividade ── */}
            {cardTab === "atividade" && (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {/* Compose box */}
                <div className="shrink-0 space-y-2.5 bg-muted/20 p-4 border-b">
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(ACTIVITY_LABELS).map(([key, lbl]) => {
                      const Icon = ACTIVITY_ICONS[key]
                      return (
                        <button
                          key={key}
                          onClick={() => setActType(key)}
                          className={cn(
                            "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all",
                            actType === key
                              ? "border-primary bg-primary/10 text-primary shadow-sm"
                              : "border-border bg-white text-muted-foreground hover:border-primary/40 hover:text-foreground"
                          )}
                        >
                          <Icon className="size-3" />{lbl}
                        </button>
                      )
                    })}
                  </div>
                  <Input
                    placeholder="Título (opcional)"
                    value={actTitle}
                    onChange={(e) => setActTitle(e.target.value)}
                    className="h-8 bg-white text-sm"
                  />
                  <textarea
                    placeholder={`Registrar ${ACTIVITY_LABELS[actType]?.toLowerCase() ?? "nota"}…`}
                    value={actContent}
                    onChange={(e) => setActContent(e.target.value)}
                    rows={3}
                    className="w-full resize-none rounded-lg border bg-white px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      disabled={!actContent.trim() || actSaving}
                      onClick={saveActivity}
                    >
                      {actSaving ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
                      Registrar {ACTIVITY_LABELS[actType]}
                    </Button>
                  </div>
                </div>

                {/* Timeline */}
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {activities.length === 0 && !cardLoading && (
                    <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                      <ClipboardList className="size-8 opacity-30" />
                      <p className="text-sm">Nenhuma atividade registrada</p>
                      <p className="text-xs opacity-70">Use o formulário acima para começar</p>
                    </div>
                  )}
                  <div className="relative px-4 py-2">
                    {activities.length > 0 && (
                      <div className="absolute left-[30px] top-4 bottom-4 w-px bg-border" />
                    )}
                    <div className="space-y-1">
                      {activities.map((act) => {
                        const Icon = ACTIVITY_ICONS[act.type] ?? FileText
                        const colorCls = ACTIVITY_COLORS[act.type] ?? "bg-muted text-muted-foreground"
                        return (
                          <div key={act.id} className="group flex gap-3 py-2">
                            <div className={cn("relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full shadow-sm", colorCls)}>
                              <Icon className="size-3.5" />
                            </div>
                            <div className="min-w-0 flex-1 rounded-xl border bg-white p-3 shadow-sm">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold leading-tight">
                                    {act.title ?? ACTIVITY_LABELS[act.type] ?? act.type}
                                  </p>
                                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                                    {act.authorName} · {new Date(act.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                                  </p>
                                </div>
                                <button
                                  onClick={() => deleteActivity(act.id)}
                                  className="shrink-0 rounded-lg p-1 text-muted-foreground opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              </div>
                              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/80 leading-relaxed">{act.content}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab: Detalhes ── */}
            {cardTab === "detalhes" && (
              <div className="min-h-0 flex-1 overflow-y-auto">
                {/* Lead Score card */}
                {(() => {
                  const s = Number(selectedCard.score ?? 0)
                  const hasScore = selectedCard.score != null
                  const scoreLabel = s >= 70 ? "Quente" : s >= 40 ? "Morno" : "Frio"
                  const barBg = s >= 70 ? "bg-rose-500" : s >= 40 ? "bg-amber-400" : "bg-sky-400"
                  const trackBg = s >= 70 ? "bg-rose-100" : s >= 40 ? "bg-amber-100" : "bg-sky-100"
                  const scoreText = s >= 70 ? "text-rose-600" : s >= 40 ? "text-amber-600" : "text-sky-600"
                  const bd = selectedCard.scoreBreakdown
                  const factors = [
                    { key: "stagePts",      label: "Etapa do funil",          max: 25, icon: TrendingUp },
                    { key: "valuePts",      label: "Valor do negócio",         max: 20, icon: DollarSign },
                    { key: "actPts",        label: "Engajamento",              max: 20, icon: Activity },
                    { key: "recencyPts",    label: "Recência de contato",      max: 15, icon: Clock3 },
                    { key: "profilePts",    label: "Perfil preenchido",        max: 10, icon: UserRound },
                    { key: "priorityPts",   label: "Prioridade",               max:  5, icon: CircleDot },
                    { key: "customerAiPts", label: "Score IA do cliente",      max:  5, icon: BrainCircuit },
                  ]
                  return (
                    <div className="m-4 overflow-hidden rounded-2xl border shadow-sm">
                      {/* Score hero */}
                      <div className={cn("relative px-5 py-4", hasScore ? trackBg : "bg-muted/30")}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Lead Score</p>
                            {hasScore ? (
                              <div className="mt-1 flex items-baseline gap-2">
                                <span className={cn("text-4xl font-black tabular-nums", scoreText)}>{s}</span>
                                <span className={cn("text-sm font-semibold", scoreText)}>{scoreLabel}</span>
                              </div>
                            ) : (
                              <p className="mt-1 text-sm text-muted-foreground">Não calculado</p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant={hasScore ? "outline" : "default"}
                            className="gap-1.5"
                            disabled={computingScore}
                            onClick={computeScore}
                          >
                            {computingScore
                              ? <Loader2 className="size-3.5 animate-spin" />
                              : <BrainCircuit className="size-3.5" />}
                            {hasScore ? "Recalcular" : "Calcular Score"}
                          </Button>
                        </div>
                        {hasScore && (
                          <div className="mt-3">
                            <div className={cn("h-2.5 w-full overflow-hidden rounded-full", trackBg, "bg-opacity-60")}>
                              <div
                                className={cn("h-full rounded-full transition-all duration-700", barBg)}
                                style={{ width: `${Math.min(100, s)}%` }}
                              />
                            </div>
                            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                              <span>0 · Frio</span><span>40 · Morno</span><span>70 · Quente</span><span>100</span>
                            </div>
                          </div>
                        )}
                        {!hasScore && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Avalia 7 fatores: etapa, valor, engajamento, recência, perfil, prioridade e score IA.
                          </p>
                        )}
                      </div>

                      {/* Factor breakdown */}
                      {bd && (
                        <div className="divide-y bg-white">
                          <p className="px-5 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Fatores</p>
                          {factors.map(({ key, label: fLabel, max, icon: FIcon }) => {
                            const pts = Number(bd[key] ?? 0)
                            const pct = max > 0 ? (pts / max) * 100 : 0
                            return (
                              <div key={key} className="flex items-center gap-3 px-5 py-2.5">
                                <FIcon className="size-3.5 shrink-0 text-muted-foreground" />
                                <span className="min-w-0 flex-1 truncate text-xs text-foreground">{fLabel}</span>
                                <div className={cn("h-1.5 w-20 shrink-0 overflow-hidden rounded-full", trackBg)}>
                                  <div
                                    className={cn("h-full rounded-full", barBg)}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="w-10 shrink-0 text-right text-[11px] font-semibold tabular-nums">
                                  {pts}<span className="font-normal text-muted-foreground">/{max}</span>
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Manual override */}
                      <div className="flex items-center gap-3 border-t bg-muted/20 px-5 py-3">
                        <span className="text-xs text-muted-foreground">Ajuste manual</span>
                        {editingField === "score" ? (
                          <div className="flex items-center gap-1.5">
                            <Input type="number" min={0} max={100} value={fieldDraft}
                              onChange={(e) => setFieldDraft(e.target.value)}
                              className="h-7 w-20 text-xs" />
                            <Button size="sm" className="h-7 px-3 text-xs" onClick={() => saveCardField("score", fieldDraft)}>Salvar</Button>
                            <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setEditingField(null)}>✕</button>
                          </div>
                        ) : (
                          <button
                            className="text-xs font-medium text-primary hover:underline"
                            onClick={() => { setEditingField("score"); setFieldDraft(String(selectedCard.score ?? 0)) }}
                          >
                            Editar
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {/* Priority */}
                <div className="mx-4 mb-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prioridade</p>
                  <div className="flex gap-2">
                    {["ALTA", "MEDIA", "BAIXA"].map((p) => (
                      <button
                        key={p}
                        onClick={() => saveCardField("priority", p)}
                        className={cn(
                          "flex-1 rounded-xl border-2 py-2 text-xs font-bold transition-all",
                          p === "ALTA"  && (selectedCard.priority === "ALTA"  ? "border-rose-400 bg-rose-50 text-rose-600"  : "border-transparent bg-muted/30 text-muted-foreground hover:bg-rose-50 hover:text-rose-500"),
                          p === "MEDIA" && (selectedCard.priority === "MEDIA" ? "border-amber-400 bg-amber-50 text-amber-600" : "border-transparent bg-muted/30 text-muted-foreground hover:bg-amber-50 hover:text-amber-500"),
                          p === "BAIXA" && (selectedCard.priority === "BAIXA" ? "border-sky-400 bg-sky-50 text-sky-600"   : "border-transparent bg-muted/30 text-muted-foreground hover:bg-sky-50 hover:text-sky-500"),
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Responsável pelo negócio */}
                <div className="mx-4 mb-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Responsável pelo negócio</p>
                  <select
                    value={selectedCard.assignedUserId ?? ""}
                    onChange={(e) => {
                      const val = e.target.value
                      const user = companyUsers.find((u) => u.id === val) ?? null
                      setSelectedCard((prev) => prev ? { ...prev, assignedUserId: val || null, assignedUser: user } : prev)
                      fetch(`/api/pipelines/cards/${selectedCard.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ assignedUserId: val || "" }),
                      }).catch(() => {})
                    }}
                    className="w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                  >
                    <option value="">— Sem responsável —</option>
                    {companyUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>

                {/* Motivo de fechamento */}
                <div className="mx-4 mb-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Desfecho do negócio</p>
                  <div className="flex gap-2">
                    {(["GANHO", "PERDIDO", "CANCELADO"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => {
                          const next = selectedCard.closeType === t ? null : t
                          setSelectedCard((prev) => prev ? { ...prev, closeType: next } : prev)
                          fetch(`/api/pipelines/cards/${selectedCard.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ closeType: next ?? "" }),
                          }).catch(() => {})
                        }}
                        className={cn(
                          "flex-1 rounded-xl border-2 py-2 text-xs font-bold transition-all",
                          t === "GANHO"    && (selectedCard.closeType === "GANHO"    ? "border-emerald-400 bg-emerald-50 text-emerald-700"  : "border-transparent bg-muted/30 text-muted-foreground hover:bg-emerald-50 hover:text-emerald-600"),
                          t === "PERDIDO"  && (selectedCard.closeType === "PERDIDO"  ? "border-red-400 bg-red-50 text-red-700"              : "border-transparent bg-muted/30 text-muted-foreground hover:bg-red-50 hover:text-red-600"),
                          t === "CANCELADO" && (selectedCard.closeType === "CANCELADO" ? "border-slate-400 bg-slate-100 text-slate-700"      : "border-transparent bg-muted/30 text-muted-foreground hover:bg-slate-100 hover:text-slate-600"),
                        )}
                      >
                        {t === "GANHO" ? "Ganho" : t === "PERDIDO" ? "Perdido" : "Cancelado"}
                      </button>
                    ))}
                  </div>
                  {selectedCard.closeType && (
                    <div>
                      {editingField === "closeReason" ? (
                        <div className="flex items-start gap-1.5">
                          <textarea
                            rows={2}
                            autoFocus
                            className="w-full resize-none rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                            value={fieldDraft}
                            placeholder={selectedCard.closeType === "GANHO" ? "Por que ganhamos este negócio?" : "Por que perdemos este negócio?"}
                            onChange={(e) => setFieldDraft(e.target.value)}
                          />
                          <Button size="sm" className="h-7 shrink-0 px-3 text-xs" onClick={() => saveCardField("closeReason", fieldDraft)}>OK</Button>
                          <button className="mt-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => setEditingField(null)}>✕</button>
                        </div>
                      ) : (
                        <button
                          className="w-full rounded-xl border bg-white px-3 py-2 text-left text-sm text-foreground/80 hover:border-primary/40 hover:text-primary transition-colors"
                          onClick={() => { setEditingField("closeReason"); setFieldDraft(selectedCard.closeReason ?? "") }}
                        >
                          {selectedCard.closeReason
                            ? selectedCard.closeReason
                            : <span className="italic text-muted-foreground/60">Clique para adicionar o motivo…</span>
                          }
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Editable fields */}
                <div className="mx-4 mb-4 space-y-0 overflow-hidden rounded-2xl border bg-white shadow-sm">
                  {[
                    { field: "name",            label: "Nome do card",           type: "text",     icon: ClipboardList },
                    { field: "description",     label: "Descrição",              type: "textarea", icon: FileText },
                    { field: "value",           label: "Valor estimado",         type: "number",   icon: DollarSign },
                    { field: "expectedCloseAt", label: "Previsão de fechamento", type: "date",     icon: CalendarDays },
                    { field: "contactName",     label: "Contato responsável",    type: "text",     icon: UserRound },
                    { field: "contactEmail",    label: "E-mail",                 type: "email",    icon: Mail },
                    { field: "contactPhone",    label: "Telefone",               type: "tel",      icon: Phone },
                  ].map(({ field, label, type, icon: FIcon }, i, arr) => {
                    const raw = (selectedCard as Record<string, unknown>)[field]
                    const display = field === "value"
                      ? raw != null ? `R$ ${Number(raw).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : null
                      : field === "expectedCloseAt"
                      ? raw ? new Date(raw as string).toLocaleDateString("pt-BR") : null
                      : raw ? String(raw) : null
                    const editVal = field === "expectedCloseAt" && raw
                      ? new Date(raw as string).toISOString().slice(0, 10)
                      : String(raw ?? "")
                    return (
                      <div key={field} className={cn("group flex items-start gap-3 px-4 py-3", i < arr.length - 1 && "border-b")}>
                        <FIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
                          {editingField === field ? (
                            <div className="mt-1 flex items-start gap-1.5">
                              {type === "textarea" ? (
                                <textarea
                                  rows={3}
                                  autoFocus
                                  className="w-full resize-none rounded-lg border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                                  value={fieldDraft}
                                  onChange={(e) => setFieldDraft(e.target.value)}
                                />
                              ) : (
                                <Input type={type} value={fieldDraft}
                                  onChange={(e) => setFieldDraft(e.target.value)}
                                  className="h-7 flex-1 text-sm" autoFocus />
                              )}
                              <Button size="sm" className="h-7 shrink-0 px-3 text-xs" onClick={() => saveCardField(field, fieldDraft)}>OK</Button>
                              <button className="mt-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => setEditingField(null)}>✕</button>
                            </div>
                          ) : (
                            <button
                              className="mt-0.5 block w-full text-left text-sm font-medium text-foreground/80 hover:text-primary transition-colors"
                              onClick={() => { setEditingField(field); setFieldDraft(editVal) }}
                            >
                              {display ?? <span className="font-normal italic text-muted-foreground/60">Clique para preencher</span>}
                            </button>
                          )}
                        </div>
                        {editingField !== field && (
                          <Pencil className="mt-1 size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-60" />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Tab: Cliente ── */}
            {cardTab === "cliente" && (
              <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
                {selectedCard.customer ? (
                  <>
                    {/* Customer hero */}
                    <div className="flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-sm">
                      <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-xl font-black text-primary">
                        {selectedCard.customer.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold">{selectedCard.customer.name}</p>
                        <p className="text-xs text-muted-foreground">{selectedCard.customer.phone ?? "—"}</p>
                        {selectedCard.customer.stage && (
                          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                            <TrendingUp className="size-3" />{selectedCard.customer.stage}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* AI Score */}
                    {selectedCard.customer.aiScore != null && (() => {
                      const as_ = Number(selectedCard.customer.aiScore)
                      const aBg = as_ >= 70 ? "bg-rose-500" : as_ >= 40 ? "bg-amber-400" : "bg-sky-400"
                      const aTrack = as_ >= 70 ? "bg-rose-100" : as_ >= 40 ? "bg-amber-100" : "bg-sky-100"
                      const aLabel = as_ >= 70 ? "Alta intenção" : as_ >= 40 ? "Interesse médio" : "Baixo engajamento"
                      return (
                        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                          <div className={cn("flex items-center justify-between px-5 py-3", aTrack)}>
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Score IA · Cliente</p>
                              <p className="mt-0.5 text-sm font-semibold text-foreground">{aLabel}</p>
                            </div>
                            <span className={cn("flex size-12 items-center justify-center rounded-xl text-lg font-black text-white shadow", aBg)}>
                              {as_}
                            </span>
                          </div>
                          <div className="px-5 py-3">
                            <div className={cn("h-2 w-full overflow-hidden rounded-full", aTrack)}>
                              <div className={cn("h-full rounded-full transition-all duration-700", aBg)} style={{ width: `${Math.min(100, as_)}%` }} />
                            </div>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Contact info */}
                    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                      {[
                        { label: "E-mail",   value: selectedCard.customer.email ?? null,  icon: Mail },
                        { label: "Telefone", value: selectedCard.customer.phone ?? null,  icon: Phone },
                        { label: "Estágio",  value: selectedCard.customer.stage ?? null,  icon: TrendingUp },
                      ].map(({ label, value, icon: Icon }, i) => (
                        <div key={label} className={cn("flex items-center gap-3 px-5 py-3", i > 0 && "border-t")}>
                          <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] text-muted-foreground">{label}</p>
                            <p className="truncate text-sm font-medium">{value ?? <span className="italic text-muted-foreground/50">—</span>}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                    <UserRound className="size-10 opacity-20" />
                    <p className="text-sm">Nenhum cliente vinculado</p>
                  </div>
                )}
              </div>
            )}
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}

export function FlowBuilderView({ mode }: { mode: "agentes" | "automacoes" }) {
  const helperText =
    mode === "agentes"
      ? "Configure comportamento, idioma, criatividade e mensagem inicial do agente."
      : "Monte o caminho da conversa conectando nós, saídas e mensagens automáticas."

  return (
    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
      <div className="grid h-full min-w-[1080px] grid-cols-[280px_minmax(520px,1fr)_250px] gap-2.5 p-2.5 md:p-3">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white shadow-soft">
          <div className="flex shrink-0 items-center gap-3 border-b p-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
              <Bot className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">Assistente GPT</p>
              <p className="text-xs text-muted-foreground">{helperText}</p>
            </div>
            <Badge variant="success">Ativo</Badge>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Nome do assistente</span>
              <Input defaultValue="Modelo de vendas 5" />
            </label>
            <label className="block space-y-1.5">
              <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Languages className="size-3.5" />
                Idioma
              </span>
              <button className="flex h-9 w-full items-center justify-between rounded-md border bg-white px-3 text-sm">
                Português
                <ChevronDown className="size-4 text-muted-foreground" />
              </button>
            </label>
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Thermometer className="size-3.5" />
                  Temperatura
                </span>
                <Badge variant="outline">0.25</Badge>
              </div>
              <input className="w-full accent-cyan-700" type="range" min="0" max="1" step="0.05" defaultValue="0.25" />
              <p className="mt-1 text-xs text-muted-foreground">Define o quão criativas ou precisas devem ser as respostas.</p>
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Instruções do assistente</span>
              <textarea
                className="min-h-28 w-full resize-none rounded-md border bg-white px-3 py-2 text-sm leading-5 shadow-sm outline-none focus:ring-2 focus:ring-ring"
                defaultValue="Você deve SEMPRE retornar uma resposta final ao usuário. Mesmo quando utilizar ferramentas, você DEVE resumir o resultado em texto simples. Nunca finalize a resposta apenas com chamadas de ferramenta."
              />
            </label>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Mensagem inicial</p>
              {["Mensagem inicial para o contato", "Mensagem inicial para a IA"].map((item, index) => (
                <label key={item} className="flex items-center gap-2 text-sm">
                  <input type="radio" defaultChecked={index === 0} name="initial-message" className="accent-primary" />
                  {item}
                </label>
              ))}
              <textarea
                className="min-h-16 w-full resize-none rounded-md border bg-white px-3 py-2 text-sm leading-5 shadow-sm outline-none focus:ring-2 focus:ring-ring"
                defaultValue="Olá, sou modelo 5. Me pergunte qualquer coisa."
              />
            </div>
          </div>

          <div className="shrink-0 border-t p-3">
            <Button className="w-full">
              <Save />
              Salvar
            </Button>
          </div>
        </aside>

        <section className="relative min-h-0 overflow-hidden rounded-lg border bg-white shadow-soft">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,_rgba(148,163,184,0.16)_1px,_transparent_1px),linear-gradient(to_bottom,_rgba(148,163,184,0.16)_1px,_transparent_1px)] bg-[size:34px_34px]" />
          <div className="relative z-10 flex h-full flex-col">
            <div className="flex shrink-0 items-center justify-between border-b bg-white/90 p-3 backdrop-blur">
              <div>
                <p className="text-sm font-semibold">{mode === "agentes" ? "Laboratório do agente" : "Fluxo: Respondeu sair"}</p>
                <p className="text-xs text-muted-foreground">Tela com nós, conectores, condições e publicação</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <PlayCircle />
                  Testar
                </Button>
                <Button size="sm">
                  <Zap />
                  Publicar
                </Button>
                <Button variant="ghost" size="icon" aria-label="Tela cheia">
                  <Maximize2 />
                </Button>
              </div>
            </div>

            <div className="relative min-h-0 flex-1 p-5">
              <svg className="pointer-events-none absolute left-[292px] top-[206px] h-28 w-56 overflow-visible">
                <path d="M 0 74 C 66 74 84 8 154 8" fill="none" stroke="rgb(15 118 110)" strokeWidth="2.5" />
                <circle cx="0" cy="74" r="5" fill="white" stroke="rgb(15 118 110)" strokeWidth="2" />
                <circle cx="154" cy="8" r="5" fill="white" stroke="rgb(15 118 110)" strokeWidth="2" />
              </svg>

              <div className="grid h-full grid-cols-[280px_1fr_300px] items-start gap-8">
                <FlowNode node={flowNodes[0]} selected />
                <div className="pt-28">
                  <Button variant="outline" size="icon" aria-label="Adicionar etapa">
                    <Plus />
                  </Button>
                </div>
                <FlowNode node={flowNodes[1]} variant="message" />
              </div>
            </div>
          </div>
        </section>

        <aside className="min-h-0 space-y-3 overflow-hidden">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle>Painel do nó</CardTitle>
              <CardDescription>Configuração rápida e saídas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {[
                ["Tipo", "Assistente GPT"],
                ["Próxima ação", "Enviar mensagem"],
                ["Fallback", "Transferir para humano"],
                ["CTR esperado", "100%"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between border-b pb-2 last:border-b-0 last:pb-0">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-sm font-medium">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle>Checklist</CardTitle>
              <CardDescription>Requisitos antes de publicar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {["Mensagem final configurada", "Saída de erro definida", "Teste de WhatsApp pendente"].map((item, index) => (
                <div key={item} className="flex items-center gap-2 text-sm">
                  {index < 2 ? <CheckCircle2 className="size-4 text-emerald-600" /> : <Clock3 className="size-4 text-amber-600" />}
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

function FlowNode({
  node,
  selected,
  variant = "assistant",
}: {
  node: (typeof flowNodes)[number]
  selected?: boolean
  variant?: "assistant" | "message"
}) {
  return (
    <div className={cn("rounded-lg border bg-white shadow-soft", selected && "border-primary/40 ring-2 ring-primary/10")}>
      <div className="flex items-center gap-2 border-b p-3">
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-md",
            variant === "message" ? "bg-emerald-50 text-emerald-700" : "bg-cyan-50 text-cyan-700",
          )}
        >
          {variant === "message" ? <Send className="size-4" /> : <Bot className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{node.title}</p>
          <p className="text-xs text-muted-foreground">{node.type}</p>
        </div>
        <CircleDot className="size-4 text-primary" />
      </div>
      <div className="space-y-3 p-3">
        <div className={cn("rounded-md p-3", variant === "message" ? "bg-emerald-50" : "bg-cyan-50")}>
          <p className="line-clamp-5 text-xs leading-5 text-foreground">{node.body}</p>
        </div>
        <div className="space-y-2">
          {node.branches.map((branch, index) => (
            <div key={branch} className="flex items-center gap-2">
              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{branch}</span>
              <Badge variant="outline">CTR {index === 2 ? "100%" : "0%"}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Customer types ───────────────────────────────────────────────────────────

interface CustomerSummary {
  id: string
  name: string
  phone: string
  status: string
  stage: string | null
  source: string | null
  lastContactAt: string | null
  value: string | null
  aiScore: number | null
  aiSentiment: string | null
  aiRisk: string | null
  tags: { id: string; name: string; color: string }[]
  conversationCount: number
}

interface CustomerDetail extends CustomerSummary {
  email: string | null
  document: string | null
  city: string | null
  companyName: string | null
  segment: string | null
  lifetimeValue: string | null
  aiNextBestAction: string | null
  aiFindings: { id: string; text: string }[]
  owner: { id: string; name: string; role: string } | null
  products: { productName: string; status: string; price: string | null }[]
  attendants: { role: string; description: string | null; user: { id: string; name: string; role: string } }[]
  conversations: {
    id: string
    channel: string
    status: string
    preview: string | null
    lastMessageAt: string | null
    createdAt: string
    messages: { text: string; role: string; createdAt: string }[]
  }[]
}

function stageLabel(stage: string | null): string {
  if (!stage) return "—"
  const map: Record<string, string> = {
    PROSPECCAO: "Prospecção", QUALIFICACAO: "Qualificação", DEMONSTRACAO: "Demonstração",
    PROPOSTA: "Proposta", NEGOCIACAO: "Negociação", FECHADO: "Fechado", POS_VENDA: "Pós-venda",
  }
  return map[stage] ?? stage
}

function customerStatusVariant(status: string): "warning" | "success" | "secondary" | "outline" {
  const map: Record<string, "warning" | "success" | "secondary"> = {
    QUENTE: "warning", CLIENTE: "success", INATIVO: "secondary", PERDIDO: "secondary",
    NUTRICAO: "secondary", EM_ANALISE: "secondary",
  }
  return map[status] ?? "outline"
}

function customerStatusLabel(status: string): string {
  const map: Record<string, string> = {
    QUENTE: "Quente", NUTRICAO: "Nutrição", EM_ANALISE: "Em análise",
    CLIENTE: "Cliente", INATIVO: "Inativo", PERDIDO: "Perdido",
  }
  return map[status] ?? status
}

export function CustomersView() {
  const auth = useAuth()
  const companyId = auth?.companyId

  const [custList, setCustList] = useState<CustomerSummary[]>([])
  const [selected, setSelected] = useState<CustomerDetail | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    if (!companyId) return
    setLoadingList(true)
    fetch(`/api/customers?companyId=${companyId}`)
      .then((r) => r.json())
      .then((data: CustomerSummary[]) => {
        setCustList(data)
        if (data.length > 0) loadDetail(data[0].id)
      })
      .catch(console.error)
      .finally(() => setLoadingList(false))
  }, [companyId])

  function loadDetail(id: string) {
    setLoadingDetail(true)
    fetch(`/api/customers/${id}`)
      .then((r) => r.json())
      .then((data: CustomerDetail) => setSelected(data))
      .catch(console.error)
      .finally(() => setLoadingDetail(false))
  }

  const sc = selected
  const profileRows = sc ? [
    { label: "Telefone", value: sc.phone, icon: Phone },
    { label: "E-mail", value: sc.email ?? "—", icon: Mail },
    { label: "Origem", value: sc.source ?? "—", icon: GitBranch },
    { label: "Documento", value: sc.document ?? "—", icon: FileText },
    { label: "Segmento", value: sc.segment ?? "—", icon: Tags },
    { label: "Cidade", value: sc.city ?? "—", icon: UserRound },
  ] : []

  return (
    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
      <div className="grid h-full min-w-[1180px] grid-cols-[310px_minmax(520px,1fr)_330px] gap-2.5 p-2.5 md:p-3">

        {/* Left — customer list */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white shadow-soft">
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b p-3">
            <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border bg-white px-2">
              <Search className="size-3.5 text-muted-foreground" />
              <Input className="h-7 border-0 px-0 text-xs shadow-none focus-visible:ring-0" placeholder="Buscar cliente, telefone ou empresa" />
            </div>
            <Button variant="outline" size="sm" className="px-2">#tag<ChevronDown /></Button>
          </div>
          <div className="grid shrink-0 grid-cols-[1fr_auto] border-b bg-muted/45 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span>Cliente</span>
            <span>Valor</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loadingList && <p className="py-6 text-center text-xs text-muted-foreground">Carregando…</p>}
            {!loadingList && custList.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">Nenhum cliente ainda.</p>
            )}
            {custList.map((cust) => (
              <button
                key={cust.id}
                onClick={() => loadDetail(cust.id)}
                className={cn(
                  "grid w-full grid-cols-[1fr_auto] items-start gap-3 border-b px-3 py-2.5 text-left transition-colors hover:bg-muted/45",
                  selected?.id === cust.id && "bg-primary/5",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{cust.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{cust.phone}</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {cust.tags.map((tag) => (
                      <Badge key={tag.id} variant="outline" className="px-1.5 py-0 text-[10px]">#{tag.name}</Badge>
                    ))}
                  </span>
                  <span className="mt-1 flex items-center gap-1.5">
                    <Badge variant={cust.stage === "FECHADO" ? "success" : "secondary"} className="px-1.5 py-0 text-[10px]">
                      {stageLabel(cust.stage)}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">{formatRelativeTime(cust.lastContactAt)}</span>
                  </span>
                </span>
                <span className="text-sm font-semibold text-primary">{cust.value ?? "—"}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Center — customer detail */}
        <section className="min-h-0 overflow-y-auto rounded-lg border bg-white p-3 shadow-soft">
          {!sc ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {loadingDetail ? "Carregando…" : "Selecione um cliente"}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start gap-3 border-b pb-3">
                <Avatar className="size-10"><AvatarFallback>{initials(sc.name)}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{sc.name}</p>
                  <p className="text-xs text-muted-foreground">{sc.companyName ?? sc.phone}</p>
                </div>
                <Badge variant={customerStatusVariant(sc.status)}>{customerStatusLabel(sc.status)}</Badge>
                <Button variant="outline" size="sm"><MessageCircle />Abrir chat</Button>
              </div>

              <div className="mt-3 grid gap-3 xl:grid-cols-2">
                <Card>
                  <CardHeader className="p-3 pb-2"><CardTitle className="text-sm">Cadastro completo</CardTitle></CardHeader>
                  <CardContent className="space-y-2 p-3 pt-0">
                    {profileRows.map(({ label, value, icon: Icon }) => (
                      <div key={label} className="flex items-center gap-2 border-b pb-2 last:border-b-0 last:pb-0">
                        <Icon className="size-4 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs text-muted-foreground">{label}</span>
                          <span className="block truncate text-sm font-medium">{value}</span>
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="p-3 pb-2"><CardTitle className="text-sm">Resumo comercial</CardTitle></CardHeader>
                  <CardContent className="space-y-2 p-3 pt-0">
                    {[
                      ["Responsável", sc.owner?.name ?? "—"],
                      ["Etapa", stageLabel(sc.stage)],
                      ["Pipeline aberto", sc.value ?? "—"],
                      ["LTV", sc.lifetimeValue ?? "—"],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between border-b pb-2 last:border-b-0 last:pb-0">
                        <span className="text-sm text-muted-foreground">{label}</span>
                        <span className="text-sm font-medium">{value}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <Card className="mt-3">
                <CardHeader className="p-3 pb-2">
                  <CardTitle>Produtos comprados</CardTitle>
                  <CardDescription>Contratos, pacotes e serviços vinculados ao cliente</CardDescription>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  {sc.products.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum produto registrado.</p>
                  ) : sc.products.map((p) => (
                    <div key={p.productName} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b py-2 last:border-b-0">
                      <span className="truncate text-sm font-medium">{p.productName}</span>
                      <Badge variant={p.status === "ATIVO" ? "success" : "secondary"}>{p.status}</Badge>
                      <span className="text-sm font-semibold text-primary">{p.price ?? "—"}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="mt-3">
                <CardHeader className="p-3 pb-2">
                  <CardTitle>Pessoas e agentes que atenderam</CardTitle>
                  <CardDescription>Histórico de responsabilidade humana e IA</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2 p-3 pt-0 xl:grid-cols-3">
                  {sc.attendants.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum atendente registrado.</p>
                  ) : sc.attendants.map((a) => (
                    <div key={a.user.id} className="rounded-lg border bg-white p-2.5">
                      <p className="truncate text-sm font-semibold">{a.user.name}</p>
                      <p className="text-xs text-muted-foreground">{a.role}</p>
                      <p className="mt-2 line-clamp-2 text-xs leading-4 text-muted-foreground">{a.description ?? "—"}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </section>

        {/* Right — AI + chat history */}
        <aside className="min-h-0 space-y-3 overflow-y-auto pr-1">
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle>Avaliação IA</CardTitle>
              <CardDescription>Qualidade, risco e recomendação do atendimento</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-3 pt-0">
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["Score", sc?.aiScore != null ? `${sc.aiScore}/100` : "—"],
                  ["Sentimento", sc?.aiSentiment ?? "—"],
                  ["Risco", sc?.aiRisk ?? "—"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border bg-muted/30 p-2">
                    <p className="text-[11px] text-muted-foreground">{label}</p>
                    <p className="mt-1 text-sm font-semibold">{value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border bg-cyan-50 p-3 text-sm leading-5 text-cyan-950">
                {sc?.aiNextBestAction ?? "Sem avaliação de IA disponível para este cliente."}
              </div>
              {(sc?.aiFindings ?? []).length > 0 && (
                <div className="space-y-2">
                  {sc!.aiFindings.map((f) => (
                    <div key={f.id} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="size-4 text-emerald-600" />
                      {f.text}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle>Chats históricos</CardTitle>
              <CardDescription>Acesso rápido às conversas anteriores</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-3 pt-0">
              {(sc?.conversations ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma conversa registrada.</p>
              ) : sc!.conversations.map((conv) => (
                <button key={conv.id} className="w-full rounded-lg border bg-white p-2.5 text-left hover:bg-muted/45">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{channelLabel(conv.channel)}</span>
                    <Badge variant={statusToVariant(conv.status)} className="px-1.5 py-0 text-[10px]">
                      {statusLabel(conv.status)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{formatRelativeTime(conv.lastMessageAt ?? conv.createdAt)}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-4 text-muted-foreground">
                    {conv.messages[0]?.text ?? conv.preview ?? "—"}
                  </p>
                </button>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

export function SalesTeamsView() {
  const selectedTeam = salesTeams[0]
  const salesTeamMetrics = [
    ["Meta mensal", selectedTeam.target, "78% realizado"],
    ["Pipeline aberto", selectedTeam.pipeline, "2,7x cobertura"],
    ["Conversão", selectedTeam.conversion, "+4 p.p. no mês"],
    ["Leads sem dono", "14", "Revisar hoje"],
  ]
  const territories = [
    ["São Paulo", "Camila Souza", "32 leads", "R$ 220 mil"],
    ["Minas Gerais", "João Martins", "18 leads", "R$ 96 mil"],
    ["Rio de Janeiro", "Nina Ribeiro", "24 leads", "R$ 134 mil"],
  ]
  const permissions = [
    ["Mover cards entre quadros", "Gestores e closers"],
    ["Transferir conversas", "Todos os membros"],
    ["Alterar metas", "Apenas gestores"],
    ["Ver auditoria IA", "Gestores e admins"],
  ]

  return (
    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
      <div className="grid h-full min-w-[1180px] grid-cols-[280px_minmax(560px,1fr)_320px] gap-2.5 p-2.5 md:p-3">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white shadow-soft">
          <div className="border-b p-3">
            <div className="flex h-8 items-center gap-2 rounded-md border bg-white px-2">
              <Search className="size-3.5 text-muted-foreground" />
              <Input className="h-7 border-0 px-0 text-xs shadow-none focus-visible:ring-0" placeholder="Buscar equipe" />
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
            {salesTeams.map((team, index) => (
              <button
                key={team.name}
                className={cn(
                  "w-full rounded-lg border bg-white p-2.5 text-left transition-colors hover:border-primary/50",
                  index === 0 && "border-primary/40 bg-primary/5 ring-2 ring-primary/10",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{team.name}</p>
                    <p className="text-xs text-muted-foreground">{team.manager}</p>
                  </div>
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                    {team.members}
                  </Badge>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Meta</p>
                    <p className="font-semibold">{team.target}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Pipeline</p>
                    <p className="font-semibold text-primary">{team.pipeline}</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {team.channels.map((channel) => (
                    <Badge key={channel} variant="outline" className="px-1.5 py-0 text-[10px]">
                      #{channel.toLowerCase()}
                    </Badge>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="min-h-0 overflow-y-auto rounded-lg border bg-white p-3 shadow-soft">
          <div className="flex flex-wrap items-start gap-3 border-b pb-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-base font-semibold">{selectedTeam.name}</h2>
                <Badge variant="success">Ativa</Badge>
                <Badge variant="outline">{selectedTeam.members} membros</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Gestor: {selectedTeam.manager} · Canais: {selectedTeam.channels.join(", ")}</p>
            </div>
            <Button variant="outline" size="sm">
              <Settings />
              Regras
            </Button>
            <Button size="sm">
              <Plus />
              Membro
            </Button>
          </div>

          <div className="mt-3 grid gap-2 lg:grid-cols-4">
            {salesTeamMetrics.map(([label, value, note]) => (
              <Card key={label}>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-lg font-semibold">{value}</p>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">{note}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mt-3">
            <CardHeader className="p-3 pb-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle>Carteira e capacidade dos membros</CardTitle>
                  <CardDescription>Papel, volume de leads, pipeline individual e carga atual</CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  <SlidersHorizontal />
                  Balancear carteira
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="grid grid-cols-[1fr_0.7fr_0.6fr_0.7fr_0.6fr] border-b bg-muted/45 px-3 py-2 text-xs font-medium text-muted-foreground">
                <span>Nome</span>
                <span>Papel</span>
                <span>Carteira</span>
                <span>Pipeline</span>
                <span>Carga</span>
              </div>
              {teamMembers.map(([name, role, leads, pipeline], index) => (
                <div key={name} className="grid grid-cols-[1fr_0.7fr_0.6fr_0.7fr_0.6fr] items-center border-b px-3 py-2.5 last:border-b-0">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{name}</span>
                    <span className="block text-[11px] text-muted-foreground">{index === 0 ? "Gestor do time" : "Membro ativo"}</span>
                  </span>
                  <span className="text-sm text-muted-foreground">{role}</span>
                  <span className="text-sm">{leads}</span>
                  <span className="text-sm font-semibold text-primary">{pipeline}</span>
                  <Badge variant={index === 3 ? "warning" : "success"} className="w-fit">
                    {index === 3 ? "Alta" : "OK"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            <Card>
              <CardHeader className="p-3 pb-2">
                <CardTitle>Territórios e segmentos</CardTitle>
                <CardDescription>Distribuição por praça, dono e potencial</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 p-3 pt-0">
                {territories.map(([region, owner, leads, pipeline]) => (
                  <div key={region} className="grid grid-cols-[1fr_0.9fr_0.6fr_0.7fr] items-center gap-2 border-b pb-2 last:border-b-0 last:pb-0">
                    <span className="truncate text-sm font-medium">{region}</span>
                    <span className="truncate text-sm text-muted-foreground">{owner}</span>
                    <span className="text-sm">{leads}</span>
                    <span className="text-sm font-semibold text-primary">{pipeline}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3 pb-2">
                <CardTitle>Metas por etapa</CardTitle>
                <CardDescription>Objetivos operacionais do funil da equipe</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 p-3 pt-0">
                {[
                  ["Novos leads", "220/mês", "74%"],
                  ["Demonstrações", "64/mês", "81%"],
                  ["Propostas", "38/mês", "69%"],
                  ["Fechamentos", "18/mês", "72%"],
                ].map(([label, goal, progress]) => (
                  <div key={label} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b pb-2 last:border-b-0 last:pb-0">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <span className="text-sm font-medium">{goal}</span>
                    <Badge variant="secondary">{progress}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>

        <aside className="min-h-0 space-y-3 overflow-y-auto pr-1">
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle>Regras de distribuição</CardTitle>
              <CardDescription>Como novos leads entram nas equipes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-3 pt-0">
              {[
                "Rodízio por disponibilidade",
                "Prioridade para menor carteira",
                "Enterprise acima de R$ 50 mil",
                "Reatribuir lead parado após 2h",
              ].map((rule) => (
                <div key={rule} className="flex items-center gap-2 rounded-md border bg-white p-2 text-sm">
                  <CheckCircle2 className="size-4 text-emerald-600" />
                  {rule}
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle>Permissões</CardTitle>
              <CardDescription>O que cada perfil pode fazer</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-3 pt-0">
              {permissions.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between border-b pb-2 last:border-b-0 last:pb-0">
                  <span className="max-w-32 text-sm text-muted-foreground">{label}</span>
                  <span className="max-w-36 text-right text-sm font-semibold leading-5">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle>Alertas da IA</CardTitle>
              <CardDescription>Riscos e recomendações para o gestor</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-3 pt-0">
              {[
                ["Nina está com carga alta", "Redistribuir 8 leads frios"],
                ["Enterprise com cobertura baixa", "Gerar campanha para contas alvo"],
                ["14 leads sem dono", "Aplicar regra de rodízio agora"],
              ].map(([title, text]) => (
                <button key={title} className="w-full rounded-lg border bg-amber-50 p-2.5 text-left hover:bg-amber-100/70">
                  <p className="text-sm font-semibold text-amber-900">{title}</p>
                  <p className="mt-1 text-xs leading-4 text-amber-800">{text}</p>
                </button>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

export function SettingsView() {
  const settingSections = [
    ["Operação", "SLA, idioma, fuso e transferência"],
    ["Canais", "WhatsApp, Instagram, site e webhook"],
    ["IA e auditoria", "Modelos, limites, políticas e logs"],
    ["Segurança", "MFA, permissões e retenção"],
    ["Dados", "Campos, duplicidade e enriquecimento"],
  ]
  const aiPolicies = [
    ["Aprovação humana", "Obrigatória para descontos e cancelamento"],
    ["Tom de resposta", "Consultivo, objetivo e sem promessas indevidas"],
    ["Dados sensíveis", "Mascarar CPF, cartão e credenciais"],
    ["Fallback", "Transferir para humano após 2 falhas"],
  ]

  return (
    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
      <div className="grid h-full min-w-[1180px] grid-cols-[250px_minmax(620px,1fr)_320px] gap-2.5 p-2.5 md:p-3">
        <aside className="min-h-0 overflow-y-auto rounded-lg border bg-white p-2 shadow-soft">
          {settingSections.map(([title, subtitle], index) => (
            <button
              key={title}
              className={cn(
                "mb-1.5 w-full rounded-lg border p-2.5 text-left transition-colors hover:border-primary/50",
                index === 0 && "border-primary/40 bg-primary/5 ring-2 ring-primary/10",
              )}
            >
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-4 text-muted-foreground">{subtitle}</p>
            </button>
          ))}
        </aside>

        <section className="min-h-0 overflow-y-auto rounded-lg border bg-white p-3 shadow-soft">
          <div className="flex flex-wrap items-center gap-3 border-b pb-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Settings className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold">Console de configurações</h2>
              <p className="text-xs text-muted-foreground">Controle operacional, IA, segurança, dados e integrações</p>
            </div>
            <Button variant="outline" size="sm">
              <FileText />
              Exportar logs
            </Button>
            <Button size="sm">
              <Save />
              Salvar alterações
            </Button>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {settingsGroups.map((group) => (
              <Card key={group.title}>
                <CardHeader className="p-3 pb-2">
                  <CardTitle>{group.title}</CardTitle>
                  <CardDescription>{group.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 p-3 pt-0">
                  {group.items.map(([name, status, tone]) => (
                    <button key={name} className="flex w-full items-center justify-between gap-2 rounded-lg border bg-white p-2.5 text-left hover:bg-muted/45">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{name}</span>
                        <span className="block text-xs text-muted-foreground">{status}</span>
                      </span>
                      <Badge variant={tone}>{status}</Badge>
                    </button>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            <Card>
              <CardHeader className="p-3 pb-2">
                <CardTitle>Preferências da operação</CardTitle>
                <CardDescription>SLA, idioma, distribuição e atendimento humano</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 p-3 pt-0 sm:grid-cols-2">
                {[
                  ["SLA padrão", "5 minutos"],
                  ["Fuso horário", "America/Sao_Paulo"],
                  ["Idioma", "Português"],
                  ["Transferência humana", "Ativa"],
                ].map(([label, value]) => (
                  <button key={label} className="flex h-10 items-center justify-between rounded-md border bg-white px-3 text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{value}</span>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3 pb-2">
                <CardTitle>Políticas de IA</CardTitle>
                <CardDescription>Guardrails para agentes, auditoria e automações</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 p-3 pt-0">
                {aiPolicies.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between border-b pb-2 last:border-b-0 last:pb-0">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <span className="max-w-56 text-right text-sm font-medium leading-5">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>

        <aside className="min-h-0 space-y-3 overflow-y-auto pr-1">
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle>Saúde do sistema</CardTitle>
              <CardDescription>Monitoramento administrativo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-3 pt-0">
              {[
                ["Uptime", "99,98%"],
                ["Fila de webhooks", "12 eventos"],
                ["Falhas de IA 24h", "3"],
                ["Retenção de logs", "180 dias"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between border-b pb-2 last:border-b-0 last:pb-0">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-sm font-semibold">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle>Segurança</CardTitle>
              <CardDescription>Controles obrigatórios</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-3 pt-0">
              {["MFA para administradores", "Logs de atendimento", "Auditoria de respostas IA", "Mascaramento de PII"].map((item) => (
                <div key={item} className="flex items-center justify-between rounded-md border bg-white px-3 py-2 text-sm">
                  <span>{item}</span>
                  <Badge variant="success">Ativo</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

export function SegmentationView() {
  const [isSheetOpen, setIsSheetOpen] = useState(true)
  const [segmentName, setSegmentName] = useState("Leads quentes com CRM")
  const [filters, setFilters] = useState([
    ["Origem", "é", "Campanha CRM"],
    ["Intenção IA", "é maior que", "80"],
    ["Última conversa", "nos últimos", "7 dias"],
  ])
  const filterOptions = [
    ["Produto", "comprou", "Plano Growth"],
    ["Valor potencial", "é maior que", "R$ 10.000"],
    ["Sentimento IA", "é", "Positivo"],
    ["Tag", "contém", "#demo"],
  ]
  const segmentTotal = Math.max(96, 1840 - filters.length * 286)
  const formattedTotal = new Intl.NumberFormat("pt-BR").format(segmentTotal)

  return (
    <div className="relative min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
      <div className="grid h-full min-w-[1180px] grid-cols-[300px_minmax(560px,1fr)_320px] gap-2.5 p-2.5 md:p-3">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white shadow-soft">
          <div className="border-b p-3">
            <div className="flex h-8 items-center gap-2 rounded-md border bg-white px-2">
              <Search className="size-3.5 text-muted-foreground" />
              <Input className="h-7 border-0 px-0 text-xs shadow-none focus-visible:ring-0" placeholder="Buscar segmento" />
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
            {segments.map(([name, total, rule, pipeline], index) => (
              <button
                key={name}
                className={cn(
                  "w-full rounded-lg border bg-white p-2.5 text-left transition-colors hover:border-primary/50",
                  index === 0 && "border-primary/40 bg-primary/5 ring-2 ring-primary/10",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{name}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-4 text-muted-foreground">{rule}</p>
                  </div>
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                    {total}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Pipeline</span>
                  <span className="text-sm font-semibold text-primary">{pipeline}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="min-h-0 overflow-y-auto rounded-lg border bg-white p-3 shadow-soft">
          <div className="flex flex-wrap items-start gap-3 border-b pb-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Layers3 className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-semibold">Leads quentes CRM</h2>
              <p className="text-xs text-muted-foreground">Segmento dinâmico por intenção, origem, comportamento e valor potencial</p>
            </div>
            <Button variant="outline" size="sm">
              <SlidersHorizontal />
              Filtros
            </Button>
            <Button size="sm" onClick={() => setIsSheetOpen(true)}>
              <Plus />
              Criar segmento
            </Button>
          </div>

          <div className="mt-3 grid gap-2 lg:grid-cols-4">
            {[
              ["Total de pessoas", "842", "atualizado agora"],
              ["Pipeline estimado", "R$ 1,8 mi", "baseado em oportunidades"],
              ["Conversão prevista", "24%", "+6 p.p. vs média"],
              ["Confiança IA", "91%", "segmento consistente"],
            ].map(([label, value, note]) => (
              <Card key={label}>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-lg font-semibold">{value}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{note}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_0.9fr]">
            <Card>
              <CardHeader className="p-3 pb-2">
                <CardTitle>Regras do segmento</CardTitle>
                <CardDescription>Filtros combinados para manter a audiência dinâmica</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 p-3 pt-0">
                {[
                  ["Origem", "é", "Campanha CRM"],
                  ["Intenção IA", "maior que", "80"],
                  ["Status", "não é", "Cliente fechado"],
                  ["Última conversa", "nos últimos", "7 dias"],
                ].map(([field, operator, value]) => (
                  <div key={`${field}-${value}`} className="grid grid-cols-[0.8fr_0.7fr_1fr] items-center gap-2 rounded-lg border bg-white p-2.5 text-sm">
                    <span className="font-medium">{field}</span>
                    <span className="text-muted-foreground">{operator}</span>
                    <span className="font-semibold text-primary">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3 pb-2">
                <CardTitle>Prévia da audiência</CardTitle>
                <CardDescription>Pessoas que entram neste segmento</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 p-3 pt-0">
                {customers.slice(0, 3).map((customer) => (
                  <div key={customer.name} className="flex items-center justify-between gap-3 rounded-lg border bg-white p-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{customer.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{customer.company}</p>
                    </div>
                    <span className="text-sm font-semibold text-primary">{customer.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="mt-3">
            <CardHeader className="p-3 pb-2">
              <CardTitle>Resultado esperado com IA</CardTitle>
              <CardDescription>Como o segmento pode ser usado automaticamente</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 p-3 pt-0 lg:grid-cols-3">
              {[
                ["Campanha sugerida", "Convite para demonstração com foco em integração CRM."],
                ["Mensagem base", "Vi que sua equipe está avaliando CRM. Posso te mostrar como conectar atendimento e vendas?"],
                ["Ação automática", "Enviar para equipe Inside Sales se ficar 2h sem resposta."],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border bg-cyan-50 p-3 text-cyan-950">
                  <p className="text-xs font-semibold">{label}</p>
                  <p className="mt-1 text-xs leading-4">{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <aside className="min-h-0 space-y-3 overflow-y-auto pr-1">
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle>Construtor rápido</CardTitle>
              <CardDescription>Crie segmentos por filtros e IA</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-3 pt-0">
              {[
                ["Filtros disponíveis", "32"],
                ["Campos de cliente", "14"],
                ["Sinais de IA", "8"],
                ["Total estimado", `${formattedTotal} pessoas`],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between border-b pb-2 last:border-b-0 last:pb-0">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-sm font-semibold">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle>Sugestões da IA</CardTitle>
              <CardDescription>Segmentos que valem criar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-3 pt-0">
              {["Clientes com expansão provável", "Leads com objeção de preço", "Contas enterprise sem follow-up"].map((suggestion) => (
                <button key={suggestion} className="w-full rounded-lg border bg-white p-2.5 text-left text-sm hover:bg-muted/45">
                  {suggestion}
                </button>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>

      {isSheetOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/25">
          <div className="h-full w-full max-w-[460px] overflow-y-auto border-l bg-white shadow-2xl">
            <div className="sticky top-0 z-10 border-b bg-white p-4">
              <div className="flex items-start gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Layers3 className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold">Criar segmento</h3>
                  <p className="text-xs text-muted-foreground">Nomeie, adicione filtros e acompanhe o tamanho da audiência.</p>
                </div>
                <Button variant="ghost" size="icon" aria-label="Fechar criação" onClick={() => setIsSheetOpen(false)}>
                  <X />
                </Button>
              </div>
            </div>

            <div className="space-y-4 p-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Nome do segmento</span>
                <Input value={segmentName} onChange={(event) => setSegmentName(event.target.value)} />
              </label>

              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">Total estimado de pessoas no segmento</p>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <span className="text-3xl font-semibold text-primary">{formattedTotal}</span>
                    <Badge variant="success">Atualização em tempo real</Badge>
                  </div>
                  <p className="mt-2 text-xs leading-4 text-muted-foreground">
                    A estimativa muda conforme os filtros são adicionados ou removidos.
                  </p>
                </CardContent>
              </Card>

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Filtros adicionados</p>
                  <Badge variant="secondary">{filters.length}</Badge>
                </div>
                <div className="space-y-2">
                  {filters.map(([field, operator, value], index) => (
                    <div key={`${field}-${index}`} className="rounded-lg border bg-white p-2.5">
                      <div className="grid grid-cols-[1fr_0.8fr_1fr_auto] items-center gap-2">
                        <button className="h-8 rounded-md border bg-muted/35 px-2 text-left text-xs font-medium">{field}</button>
                        <button className="h-8 rounded-md border bg-muted/35 px-2 text-left text-xs text-muted-foreground">{operator}</button>
                        <button className="h-8 rounded-md border bg-muted/35 px-2 text-left text-xs font-semibold text-primary">{value}</button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Remover filtro"
                          onClick={() => setFilters((current) => current.filter((_, filterIndex) => filterIndex !== index))}
                        >
                          <X />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold">Adicionar filtro</p>
                <div className="grid gap-2">
                  {filterOptions.map((filter) => (
                    <button
                      key={filter.join("-")}
                      className="grid grid-cols-[0.9fr_0.8fr_1fr] rounded-lg border bg-white p-2.5 text-left text-xs transition-colors hover:border-primary/50 hover:bg-primary/5"
                      onClick={() => setFilters((current) => [...current, filter])}
                    >
                      <span className="font-medium">{filter[0]}</span>
                      <span className="text-muted-foreground">{filter[1]}</span>
                      <span className="font-semibold text-primary">{filter[2]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Card>
                <CardHeader className="p-3 pb-2">
                  <CardTitle>Prévia da regra</CardTitle>
                  <CardDescription>Como o sistema interpretará este segmento</CardDescription>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="rounded-lg border bg-cyan-50 p-3 text-sm leading-5 text-cyan-950">
                    {segmentName || "Novo segmento"} incluirá pessoas que combinam os filtros atuais, com priorização por intenção de compra e potencial comercial.
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t bg-white p-4">
              <Button variant="outline" onClick={() => setIsSheetOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => setIsSheetOpen(false)}>
                <Save />
                Salvar segmento
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function BroadcastsView() {
  return (
    <OperationsListView
      icon={Radio}
      title="Transmissões"
      description="Envios controlados por opt-in, canal, janela e segmento"
      headers={["Nome", "Canal", "Status", "Audiência", "Agenda"]}
      rows={broadcasts}
      sideTitle="Checklist de envio"
      sideDescription="Validações antes de disparar uma transmissão"
      sideItems={[
        ["Opt-in", "Base elegível confirmada"],
        ["Janela", "Horário permitido do canal"],
        ["Mensagem", "Template aprovado"],
        ["Limite", "Volume dentro da reputação"],
      ]}
      expectedResult="Mensagem sugerida: Mariana, vi que sua equipe está avaliando CRM. Posso te mostrar em 15 min como conectar atendimento e vendas?"
      action="Preparar disparo"
    />
  )
}

export function CampaignsView() {
  return (
    <OperationsListView
      icon={Megaphone}
      title="Campanhas"
      description="Orçamento, público, canais, conversões e pipeline gerado"
      headers={["Campanha", "Objetivo", "Status", "Pipeline", "Resultado"]}
      rows={campaigns}
      sideTitle="Performance da campanha"
      sideDescription="Leitura rápida com apoio de IA"
      sideItems={[
        ["CPA estimado", "R$ 148"],
        ["Melhor canal", "WhatsApp"],
        ["Público vencedor", "Leads quentes CRM"],
        ["Ação sugerida", "Aumentar verba em 18%"],
      ]}
      expectedResult="Otimização sugerida: pausar variação B, manter CTA de demonstração e aumentar orçamento no segmento Leads quentes CRM."
      action="Otimizar campanha"
    />
  )
}

export function AIAuditsView() {
  const auditMetrics = [
    ["Conversas auditadas", "18.492", "+21%"],
    ["Score médio", "84/100", "+6 pts"],
    ["Risco alto", "38", "-12%"],
    ["Receita em risco", "R$ 214 mil", "prioritário"],
  ]
  const auditDimensions = [
    ["Qualidade", "Clareza, tom, completude e aderência ao script"],
    ["Comercial", "Objeções, oportunidade perdida e próxima ação"],
    ["Compliance", "Dados sensíveis, promessas e política comercial"],
    ["Operação", "SLA, transferência, reabertura e filas críticas"],
  ]

  return (
    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
      <div className="grid h-full min-w-[1220px] grid-cols-[300px_minmax(580px,1fr)_340px] gap-2.5 p-2.5 md:p-3">
        <aside className="min-h-0 overflow-y-auto rounded-lg border bg-white p-2 shadow-soft">
          <div className="border-b p-2">
            <p className="text-sm font-semibold">Modelos de auditoria</p>
            <p className="text-xs text-muted-foreground">Escolha a lente da análise</p>
          </div>
          <div className="mt-2 space-y-2">
            {auditDimensions.map(([title, description], index) => (
              <button
                key={title}
                className={cn(
                  "w-full rounded-lg border bg-white p-2.5 text-left hover:border-primary/50",
                  index === 1 && "border-primary/40 bg-primary/5 ring-2 ring-primary/10",
                )}
              >
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-4 text-muted-foreground">{description}</p>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white shadow-soft">
          <div className="flex shrink-0 flex-wrap items-center gap-3 border-b p-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-semibold">Central de inteligência e auditoria</h2>
              <p className="text-xs text-muted-foreground">Análise profunda de atendimento, vendas, compliance, risco e receita perdida</p>
            </div>
            <Button variant="outline" size="sm">
              <SlidersHorizontal />
              Filtros
            </Button>
            <Button size="sm">
              <Sparkles />
              Rodar auditoria
            </Button>
          </div>

          <div className="grid shrink-0 gap-2 border-b p-3 lg:grid-cols-4">
            {auditMetrics.map(([label, value, change]) => (
              <Card key={label}>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-lg font-semibold">{value}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{change}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid shrink-0 grid-cols-4 border-b bg-muted/45 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span>Conversa</span>
            <span>Score IA</span>
            <span>Risco</span>
            <span>Ação recomendada</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {auditAnalyses.map(([conversation, score, risk, action], index) => (
              <button
                key={conversation}
                className={cn(
                  "grid w-full grid-cols-4 items-center gap-3 border-b px-3 py-3 text-left transition-colors hover:bg-muted/45",
                  index === 0 && "bg-primary/5",
                )}
              >
                <span className="truncate text-sm font-semibold">{conversation}</span>
                <span className="text-sm font-semibold text-primary">{score}</span>
                <Badge variant={risk.includes("Alto") ? "danger" : risk.includes("médio") ? "warning" : "success"} className="w-fit">
                  {risk}
                </Badge>
                <span className="line-clamp-2 text-sm leading-5 text-muted-foreground">{action}</span>
              </button>
            ))}
          </div>
        </section>

        <aside className="min-h-0 space-y-3 overflow-y-auto pr-1">
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle>Achados críticos</CardTitle>
              <CardDescription>Exemplo de análise pesada da IA</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-3 pt-0">
              {[
                ["Resumo executivo", "Cliente demonstrou intenção alta, mas depende de integração CRM para avançar."],
                ["Objeção principal", "Medo de retrabalho na implantação e dúvida sobre escalabilidade."],
                ["Falha do atendimento", "Atendente não confirmou prazo de implantação nem próximos marcos."],
                ["Oportunidade escondida", "Cliente citou expansão futura para mais atendentes."],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border bg-white p-2.5">
                  <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
                  <p className="mt-1 text-xs leading-4">{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle>Tendências detectadas</CardTitle>
              <CardDescription>Padrões encontrados em múltiplas conversas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-3 pt-0">
              {[
                ["Objeção de preço", "27% das perdas"],
                ["SLA acima do ideal", "18% dos leads quentes"],
                ["Sem próxima ação", "41 conversas"],
                ["Expansão ignorada", "R$ 86 mil potenciais"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between border-b pb-2 last:border-b-0 last:pb-0">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-sm font-semibold">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle>Plano de ação IA</CardTitle>
              <CardDescription>Saída que o gestor receberia</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-3 pt-0">
              <div className="rounded-lg border bg-amber-50 p-3 text-sm leading-5 text-amber-950">
                Nesta semana, 27% das perdas vieram de objeções sobre preço sem prova social. Recomenda-se criar resposta padrão com cases e ROI.
              </div>
              <Button className="w-full">
                <FileText />
                Gerar relatório executivo
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

export function ReportsView() {
  const reportMetrics = [
    ["Receita prevista", "R$ 1,18 mi", "+14% vs período anterior"],
    ["Pipeline criado", "R$ 2,84 mi", "312 novas oportunidades"],
    ["Conversão geral", "18,6%", "+3,2 p.p."],
    ["SLA médio", "1m 48s", "22% mais rápido"],
  ]
  const funnelRows = [
    ["Leads capturados", "4.820", "100%", "+18%"],
    ["Qualificados por IA", "2.146", "44,5%", "+11%"],
    ["Demonstrações", "684", "14,2%", "+7%"],
    ["Propostas", "312", "6,4%", "+5%"],
    ["Fechamentos", "84", "1,7%", "+9%"],
  ]
  const channelRows = [
    ["WhatsApp", "2.918 leads", "21,4%", "R$ 740 mil"],
    ["Instagram", "1.124 leads", "13,8%", "R$ 280 mil"],
    ["Site", "604 leads", "16,2%", "R$ 190 mil"],
    ["Webhook CRM", "174 leads", "31,0%", "R$ 312 mil"],
  ]

  return (
    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
      <div className="grid h-full min-w-[1220px] grid-cols-[minmax(760px,1fr)_340px] gap-2.5 p-2.5 md:p-3">
        <section className="min-h-0 overflow-y-auto rounded-lg border bg-white p-3 shadow-soft">
          <div className="flex flex-wrap items-center gap-3 border-b pb-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Activity className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold">Relatório executivo</h2>
              <p className="text-xs text-muted-foreground">Receita, pipeline, canais, funil e produtividade da operação</p>
            </div>
            <Button variant="outline" size="sm">
              <CalendarDays />
              Maio/2026
            </Button>
            <Button size="sm">
              <FileText />
              Exportar
            </Button>
          </div>

          <div className="mt-3 grid gap-2 lg:grid-cols-4">
            {reportMetrics.map(([label, value, note]) => (
              <Card key={label}>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-lg font-semibold">{value}</p>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">{note}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            <Card>
              <CardHeader className="p-3 pb-2">
                <CardTitle>Funil comercial</CardTitle>
                <CardDescription>Volume, taxa e variação por etapa</CardDescription>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="grid grid-cols-[1fr_0.6fr_0.6fr_0.5fr] border-b bg-muted/45 px-3 py-2 text-xs font-medium text-muted-foreground">
                  <span>Etapa</span>
                  <span>Volume</span>
                  <span>Taxa</span>
                  <span>Variação</span>
                </div>
                {funnelRows.map(([stage, volume, rate, change]) => (
                  <div key={stage} className="grid grid-cols-[1fr_0.6fr_0.6fr_0.5fr] border-b px-3 py-2.5 text-sm last:border-b-0">
                    <span className="font-medium">{stage}</span>
                    <span>{volume}</span>
                    <span>{rate}</span>
                    <span className="font-semibold text-primary">{change}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3 pb-2">
                <CardTitle>Canais</CardTitle>
                <CardDescription>Leads, conversão e pipeline por origem</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 p-3 pt-0">
                {channelRows.map(([channel, leads, conversion, pipeline]) => (
                  <div key={channel} className="grid grid-cols-[1fr_0.8fr_0.5fr_0.7fr] items-center gap-2 border-b pb-2 last:border-b-0 last:pb-0">
                    <span className="text-sm font-medium">{channel}</span>
                    <span className="text-sm text-muted-foreground">{leads}</span>
                    <span className="text-sm">{conversion}</span>
                    <span className="text-sm font-semibold text-primary">{pipeline}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="mt-3">
            <CardHeader className="p-3 pb-2">
              <CardTitle>Produtividade das equipes</CardTitle>
              <CardDescription>Atendimento, conversão, SLA e pipeline por time</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 p-3 pt-0 lg:grid-cols-3">
              {salesTeams.map((team) => (
                <div key={team.name} className="rounded-lg border bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{team.name}</p>
                    <Badge variant="secondary">{team.conversion}</Badge>
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Meta</span>
                      <span className="font-medium">{team.target}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pipeline</span>
                      <span className="font-semibold text-primary">{team.pipeline}</span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <aside className="min-h-0 space-y-3 overflow-y-auto pr-1">
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle>Leitura IA</CardTitle>
              <CardDescription>Resumo executivo automático</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-3 pt-0">
              {[
                ["Principal ganho", "Webhook CRM converte 2,2x melhor que Instagram."],
                ["Gargalo", "Demonstrações estão represando propostas."],
                ["Risco", "R$ 214 mil parados há mais de 7 dias."],
                ["Recomendação", "Mover 2 SDRs para follow-up de propostas quentes."],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border bg-white p-2.5">
                  <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
                  <p className="mt-1 text-xs leading-4">{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle>Relatórios salvos</CardTitle>
              <CardDescription>Modelos recorrentes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-3 pt-0">
              {["Executivo semanal", "Performance por vendedor", "Campanhas e ROI", "Auditoria de perdas"].map((report) => (
                <button key={report} className="flex h-10 w-full items-center justify-between rounded-md border bg-white px-3 text-sm hover:bg-muted/45">
                  {report}
                  <ChevronDown className="size-4 text-muted-foreground" />
                </button>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

function OperationsListView({
  icon: Icon,
  title,
  description,
  headers,
  rows,
  sideTitle,
  sideDescription,
  sideItems,
  expectedResult,
  action,
}: {
  icon: typeof Layers3
  title: string
  description: string
  headers: string[]
  rows: string[][]
  sideTitle: string
  sideDescription: string
  sideItems: string[][]
  expectedResult: string
  action: string
}) {
  return (
    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
      <div className="grid h-full min-w-[1080px] grid-cols-[minmax(700px,1fr)_320px] gap-2.5 p-2.5 md:p-3">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white shadow-soft">
          <div className="flex shrink-0 flex-wrap items-center gap-3 border-b p-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-semibold">{title}</h2>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <div className="flex h-8 w-64 items-center gap-2 rounded-md border bg-white px-2">
              <Search className="size-3.5 text-muted-foreground" />
              <Input className="h-7 border-0 px-0 text-xs shadow-none focus-visible:ring-0" placeholder="Buscar" />
            </div>
            <Button variant="outline" size="sm">
              <SlidersHorizontal />
              Filtros
            </Button>
          </div>

          <div
            className="grid shrink-0 border-b bg-muted/45 px-3 py-2 text-xs font-medium text-muted-foreground"
            style={{ gridTemplateColumns: `repeat(${headers.length}, minmax(0, 1fr))` }}
          >
            {headers.map((header) => (
              <span key={header}>{header}</span>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {rows.map((row) => (
              <button
                key={row.join("-")}
                className="grid w-full items-center gap-3 border-b px-3 py-3 text-left transition-colors hover:bg-muted/45"
                style={{ gridTemplateColumns: `repeat(${headers.length}, minmax(0, 1fr))` }}
              >
                {row.map((cell, index) => (
                  <span key={`${cell}-${index}`} className={cn("truncate text-sm", index === 0 && "font-semibold", index === 2 && "text-primary")}>
                    {cell}
                  </span>
                ))}
              </button>
            ))}
          </div>
        </section>

        <aside className="min-h-0 space-y-3 overflow-y-auto pr-1">
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle>{sideTitle}</CardTitle>
              <CardDescription>{sideDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-3 pt-0">
              {sideItems.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between border-b pb-2 last:border-b-0 last:pb-0">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="max-w-40 text-right text-sm font-medium leading-5">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle>Análise IA</CardTitle>
              <CardDescription>Recomendação operacional</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-3 pt-0">
              <div className="rounded-lg border bg-cyan-50 p-3 text-sm leading-5 text-cyan-950">
                {expectedResult}
              </div>
              <Button className="w-full">
                <Sparkles />
                {action}
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

function PlaceholderView({ view }: { view: string }) {
  return (
    <div className="min-h-0 flex-1 p-4">
      <Card className="flex h-full items-center justify-center">
        <CardContent className="max-w-md p-6 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UserRound className="size-5" />
          </div>
          <CardTitle>{view}</CardTitle>
          <CardDescription className="mt-2">
            Estrutura reservada para manter a navegação completa enquanto priorizamos atendimento, quadros e fluxos.
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  )
}

// Views are exported individually above. No default export needed.
