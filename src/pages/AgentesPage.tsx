import React, { useState, useEffect, useCallback, useRef } from "react"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { LucideIcon } from "lucide-react"
import {
  Bot, BrainCircuit, Sparkles, Zap, Shield, Star,
  MessageCircle, Cpu, Rocket, Headphones, Heart, Eye, Activity,
  Search, Plus, Trash2, Save, Check, Loader2, ChevronDown,
  MessageSquare, Send, RefreshCw, RotateCcw, Copy,
  AlertCircle, ChevronRight, Settings2, BookOpen,
  Target, List, AlignLeft, Volume2, Ban, Info,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentStatus = "ONLINE" | "BUSY" | "OFFLINE"

interface AgentConfig {
  objetivo:          string
  instrucoesDiretas: string
  formatoResposta:   string
  tomDeVoz:          string
  restricoes:        string
  mensagemInicial:   string
  contexto:          string
}

interface AgentSummary {
  id: string
  name: string
  iconName: string | null
  status: AgentStatus
  description: string | null
  modelId: string | null
  temperatura: number
  createdAt: string
  _count: { conversations: number }
}

interface ConvPreview {
  id: string; channel: string; status: string
  preview: string | null; lastMessageAt: string | null
  customer: { id: string; name: string } | null
}

interface AgentDetail extends AgentSummary {
  instructions: string | null
  config: AgentConfig | null
  updatedAt: string
  conversations: ConvPreview[]
}

interface ChatMessage {
  role: "user" | "assistant" | "error"
  content: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  Bot, BrainCircuit, Sparkles, Zap, Shield, Star,
  MessageCircle, Cpu, Rocket, Headphones, Heart, Eye, Activity,
}
const ICON_KEYS = Object.keys(ICON_MAP)

const OLLAMA_MODELS = [
  "gemma4:latest", "llama3.2", "llama3.1", "mistral",
  "phi3", "codellama", "qwen2.5", "deepseek-r1",
]

const TOM_OPTIONS = [
  "Formal e profissional",
  "Consultivo e orientado a soluções",
  "Amigável e empático",
  "Assertivo e direto",
  "Técnico e preciso",
  "Descontraído e acessível",
]

const FORMATO_OPTIONS = [
  "Texto corrido (prosa clara e objetiva)",
  "Tópicos e bullet points",
  "Resposta estruturada com seções",
  "Respostas curtas e diretas (máx. 3 frases)",
  "Perguntas de qualificação antes de responder",
]

const STATUS_CFG: Record<AgentStatus, {
  label: string; dot: string; ring: string; bg: string; text: string; border: string
}> = {
  ONLINE:  { label: "Online",  dot: "bg-emerald-500", ring: "ring-emerald-200/70", bg: "bg-emerald-50",  text: "text-emerald-700", border: "border-emerald-200" },
  BUSY:    { label: "Ocupado", dot: "bg-amber-500",   ring: "ring-amber-200/70",   bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200"   },
  OFFLINE: { label: "Offline", dot: "bg-slate-400",   ring: "ring-slate-200/70",   bg: "bg-slate-50",   text: "text-slate-500",   border: "border-slate-200"   },
}

const CHANNEL_LABEL: Record<string, string> = {
  WHATSAPP: "WhatsApp", EMAIL: "E-mail", INSTAGRAM: "Instagram",
  TELEGRAM: "Telegram", CHAT: "Chat", MANUAL: "Manual",
}

const EMPTY_CONFIG: AgentConfig = {
  objetivo: "", instrucoesDiretas: "", formatoResposta: "",
  tomDeVoz: "", restricoes: "", mensagemInicial: "", contexto: "",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function DynIcon({ name, className }: { name: string | null; className?: string }) {
  const Icon = ICON_MAP[name ?? "Bot"] ?? Bot
  return <Icon className={className} />
}

function fmtRel(iso: string | null) {
  if (!iso) return "—"
  const d = Date.now() - new Date(iso).getTime()
  const m = Math.floor(d / 60000), h = Math.floor(d / 3600000), dy = Math.floor(d / 86400000)
  if (m < 2) return "Agora"
  if (m < 60) return `${m}min`
  if (h < 24) return `${h}h`
  return `${dy}d`
}

// ─── AgentesPage ──────────────────────────────────────────────────────────────

export default function AgentesPage() {
  const auth      = useAuth()
  const companyId = auth?.companyId ?? ""
  const token     = localStorage.getItem("zv_token") ?? ""

  const [agents,        setAgents]        = useState<AgentSummary[]>([])
  const [selected,      setSelected]      = useState<AgentDetail | null>(null)
  const [isNew,         setIsNew]         = useState(false)
  const [loadingList,   setLoadingList]   = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [saved,         setSaved]         = useState(false)
  const [dirty,         setDirty]         = useState(false)
  const [search,        setSearch]        = useState("")
  const [statusFilter,  setStatusFilter]  = useState<"" | AgentStatus>("")

  // Form state
  const [name,        setName]        = useState("")
  const [description, setDescription] = useState("")
  const [iconName,    setIconName]    = useState("Bot")
  const [status,      setStatus]      = useState<AgentStatus>("ONLINE")
  const [modelId,     setModelId]     = useState(OLLAMA_MODELS[0])
  const [temperatura, setTemperatura] = useState(0.3)
  const [config,      setConfig]      = useState<AgentConfig>(EMPTY_CONFIG)

  // Test chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput,    setChatInput]    = useState("")
  const [chatLoading,  setChatLoading]  = useState(false)
  const [showPrompt,   setShowPrompt]   = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // ─── Fetchers ───────────────────────────────────────────────────────────────

  const fetchAgents = useCallback(async () => {
    if (!companyId) return
    setLoadingList(true)
    const p = new URLSearchParams({ companyId })
    if (statusFilter) p.set("status", statusFilter)
    if (search.trim()) p.set("q", search.trim())
    const r = await fetch(`/api/agents?${p}`, { headers: { Authorization: `Bearer ${token}` } })
    setAgents(await r.json())
    setLoadingList(false)
  }, [companyId, token, statusFilter, search])

  const fetchDetail = useCallback(async (id: string) => {
    setLoadingDetail(true)
    const r = await fetch(`/api/agents/${id}`, { headers: { Authorization: `Bearer ${token}` } })
    const d: AgentDetail = await r.json()
    setSelected(d)
    setName(d.name)
    setDescription(d.description ?? "")
    setIconName(d.iconName ?? "Bot")
    setStatus(d.status)
    setModelId(d.modelId ?? OLLAMA_MODELS[0])
    setTemperatura(d.temperatura ?? 0.3)
    setConfig(d.config ? { ...EMPTY_CONFIG, ...d.config } : EMPTY_CONFIG)
    setDirty(false)
    setLoadingDetail(false)
    setChatMessages([])
  }, [token])

  useEffect(() => { fetchAgents() }, [fetchAgents])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [chatMessages])

  // ─── Form helpers ────────────────────────────────────────────────────────────

  function mark() { setDirty(true); setSaved(false) }

  function setField<K extends keyof AgentConfig>(k: K, v: AgentConfig[K]) {
    setConfig((c) => ({ ...c, [k]: v })); mark()
  }

  function resetForm() {
    setName(""); setDescription(""); setIconName("Bot")
    setStatus("ONLINE"); setModelId(OLLAMA_MODELS[0]); setTemperatura(0.3)
    setConfig(EMPTY_CONFIG); setDirty(false); setSaved(false)
    setChatMessages([])
  }

  function openNew() {
    setSelected(null); setIsNew(true); resetForm()
  }

  function selectAgent(a: AgentSummary) {
    setIsNew(false); fetchDetail(a.id)
  }

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    const body = { name, description, iconName, status, modelId, temperatura, config, companyId }

    if (isNew) {
      const r = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const created: AgentDetail = await r.json()
      setSaving(false); setSaved(true); setDirty(false)
      setIsNew(false)
      await fetchAgents()
      fetchDetail(created.id)
    } else if (selected) {
      await fetch(`/api/agents/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, description, iconName, status, modelId, temperatura, config }),
      })
      setSaving(false); setSaved(true); setDirty(false)
      await fetchAgents()
      fetchDetail(selected.id)
    }
    setTimeout(() => setSaved(false), 2500)
  }

  async function handleDelete() {
    if (!selected) return
    if (!confirm(`Remover "${selected.name}"? As conversas vinculadas serão desvinculadas.`)) return
    await fetch(`/api/agents/${selected.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
    setSelected(null); setIsNew(false); resetForm(); fetchAgents()
  }

  // ─── Test chat ───────────────────────────────────────────────────────────────

  async function sendTestMessage() {
    if (!chatInput.trim() || chatLoading || !selected) return
    const userMsg: ChatMessage = { role: "user", content: chatInput.trim() }
    const history = [...chatMessages, userMsg]
    setChatMessages(history)
    setChatInput("")
    setChatLoading(true)

    try {
      const apiMessages = history
        .filter((m) => m.role !== "error")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))

      const r = await fetch(`/api/agents/${selected.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: apiMessages }),
      })
      const d = await r.json() as { content?: string; error?: string }
      if (!r.ok || d.error) throw new Error(d.error ?? "Erro desconhecido")
      setChatMessages((prev) => [...prev, { role: "assistant", content: d.content! }])
    } catch (e) {
      setChatMessages((prev) => [...prev, { role: "error", content: String(e) }])
    } finally {
      setChatLoading(false)
    }
  }

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const sc          = STATUS_CFG[status]
  const showStudio  = isNew || selected !== null || loadingDetail
  const canTest     = !isNew && selected !== null && !dirty
  const assembled   = buildPromptPreview(config)

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
      <div className="grid h-full min-w-[960px] grid-cols-[240px_minmax(460px,1fr)_340px] gap-2.5 p-2.5 md:p-3">

        {/* ══ Col 1: Agent list ════════════════════════════════════════════════ */}
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-white shadow-soft">
          <div className="shrink-0 px-3 pt-3 pb-2">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Agentes IA</p>
          </div>

          <div className="shrink-0 space-y-1.5 border-b px-2 pb-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar…" className="h-7 pl-7 text-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-0.5">
              {(["", "ONLINE", "BUSY", "OFFLINE"] as const).map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={cn("flex-1 rounded px-1 py-0.5 text-[10px] font-medium transition-colors",
                    statusFilter === s ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/40"
                  )}>
                  {s === "" ? "Todos" : STATUS_CFG[s].label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-1.5 space-y-0.5">
            {loadingList ? (
              <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /><span className="text-xs">Carregando…</span>
              </div>
            ) : agents.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                <Bot className="size-6 opacity-20" /><p className="text-xs">Nenhum agente</p>
              </div>
            ) : agents.map((a) => {
              const asc = STATUS_CFG[a.status]
              const isSel = !isNew && selected?.id === a.id
              return (
                <button key={a.id} onClick={() => selectAgent(a)}
                  className={cn("w-full rounded-lg border px-2.5 py-2 text-left transition-colors",
                    isSel ? "border-primary/30 bg-primary/5 ring-1 ring-primary/10"
                          : "border-transparent hover:border-muted hover:bg-muted/30"
                  )}>
                  <div className="flex items-center gap-2">
                    <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md border ring-1", asc.bg, asc.border, asc.ring)}>
                      <DynIcon name={a.iconName} className={cn("size-3.5", asc.text)} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">{a.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{a._count.conversations} conv. · {asc.label}</p>
                    </div>
                    <span className={cn("size-1.5 shrink-0 rounded-full", asc.dot)} />
                  </div>
                </button>
              )
            })}
          </div>

          <div className="shrink-0 border-t p-1.5">
            <Button className="w-full gap-1.5 h-8" size="sm" onClick={openNew}>
              <Plus className="size-3.5" /> Novo agente
            </Button>
          </div>
        </aside>

        {/* ══ Col 2: Studio ════════════════════════════════════════════════════ */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-white shadow-soft">
          {!showStudio ? (
            <EmptyStudio onNew={openNew} />
          ) : loadingDetail ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /><span className="text-sm">Carregando…</span>
            </div>
          ) : (
            <>
              {/* Studio header */}
              <div className="flex shrink-0 items-center gap-3 border-b bg-gradient-to-r from-primary/5 to-transparent px-4 py-2.5">
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg border-2 ring-2", sc.bg, sc.border, sc.ring)}>
                  <DynIcon name={iconName} className={cn("size-4", sc.text)} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("size-1.5 rounded-full", sc.dot)} />
                    <p className="text-sm font-bold">{name || (isNew ? "Novo agente" : "—")}</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {isNew ? "Configurando novo agente" : `${sc.label} · ${modelId || "sem modelo"}`}
                  </p>
                </div>
                {!isNew && (
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-red-600 hover:bg-red-50 hover:text-red-700" onClick={handleDelete}>
                    <Trash2 className="size-3" />
                  </Button>
                )}
                <Button size="sm" className="h-8 gap-1.5" onClick={handleSave} disabled={saving || (!dirty && !isNew)}>
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : saved ? <Check className="size-3.5" /> : <Save className="size-3.5" />}
                  {isNew ? "Criar" : saved ? "Salvo!" : "Salvar"}
                </Button>
              </div>

              {/* Studio body — scrollable sections */}
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="space-y-0 divide-y">

                  {/* ── Identidade ─────────────────────────────────────────── */}
                  <StudioSection icon={Settings2} title="Identidade" subtitle="Nome, ícone e status operacional">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="field-label">Nome <span className="text-red-500">*</span></label>
                        <Input value={name} onChange={(e) => { setName(e.target.value); mark() }} placeholder="Ex: Assistente Comercial B2B" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="field-label">Descrição curta</label>
                        <Input value={description} onChange={(e) => { setDescription(e.target.value); mark() }} placeholder="Ex: Qualifica e converte leads B2B" />
                      </div>
                    </div>

                    {/* Status */}
                    <div className="space-y-1.5">
                      <label className="field-label">Status</label>
                      <div className="flex gap-2">
                        {(["ONLINE", "BUSY", "OFFLINE"] as AgentStatus[]).map((s) => {
                          const ssc = STATUS_CFG[s]
                          return (
                            <button key={s} onClick={() => { setStatus(s); mark() }}
                              className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg border-2 py-1.5 text-xs font-semibold transition-all",
                                status === s ? `${ssc.bg} ${ssc.border} ${ssc.text} ring-2 ${ssc.ring}` : "border-muted text-muted-foreground hover:bg-muted/30"
                              )}>
                              <span className={cn("size-1.5 rounded-full", status === s ? ssc.dot : "bg-muted-foreground/30")} />
                              {ssc.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Icon picker */}
                    <div className="space-y-1.5">
                      <label className="field-label">Ícone</label>
                      <div className="flex flex-wrap gap-1.5">
                        {ICON_KEYS.map((k) => {
                          const Icon = ICON_MAP[k]
                          return (
                            <button key={k} onClick={() => { setIconName(k); mark() }} title={k}
                              className={cn("flex size-9 items-center justify-center rounded-lg border-2 transition-all",
                                iconName === k ? "border-primary bg-primary/5 text-primary ring-2 ring-primary/20" : "border-muted text-muted-foreground hover:border-border hover:bg-muted/30"
                              )}>
                              <Icon className="size-4" />
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </StudioSection>

                  {/* ── Objetivo ──────────────────────────────────────────── */}
                  <StudioSection icon={Target} title="Objetivo" subtitle="O que este agente deve alcançar em cada interação">
                    <ConfigTextarea
                      placeholder={`Descreva o objetivo principal deste agente.\n\nEx: Qualificar leads B2B que chegam pelo WhatsApp, identificar o porte da empresa, produto de interesse e nível de urgência. Conduzir naturalmente para o agendamento de uma demonstração com o time comercial.`}
                      value={config.objetivo}
                      onChange={(v) => setField("objetivo", v)}
                      rows={5}
                    />
                    <FieldHint>Seja específico sobre o resultado esperado — não apenas o que o agente faz, mas o que ele precisa conseguir ao final de cada conversa.</FieldHint>
                  </StudioSection>

                  {/* ── Contexto ──────────────────────────────────────────── */}
                  <StudioSection icon={BookOpen} title="Contexto & Conhecimento" subtitle="Informações de background que o agente deve ter">
                    <ConfigTextarea
                      placeholder={`Descreva o contexto da empresa, produto ou área de atuação.\n\nEx: Somos uma plataforma SaaS de gestão de vendas para PMEs. Nosso produto custa a partir de R$299/mês. Temos planos Starter, Growth e Enterprise. O time comercial atende de seg a sex das 9h às 18h.`}
                      value={config.contexto}
                      onChange={(v) => setField("contexto", v)}
                      rows={4}
                    />
                    <FieldHint>Inclua preços, horários, produtos, políticas e qualquer informação que o agente precisaria consultar durante uma conversa.</FieldHint>
                  </StudioSection>

                  {/* ── Instruções Diretas ────────────────────────────────── */}
                  <StudioSection icon={List} title="Instruções Diretas" subtitle="Passo a passo de como o agente deve se comportar">
                    <ConfigTextarea
                      placeholder={`Liste as instruções operacionais em ordem de prioridade.\n\nEx:\n1. Sempre cumprimente pelo nome quando disponível\n2. Pergunte sobre o porte da empresa antes de apresentar preços\n3. Se o lead tiver mais de 50 funcionários, priorize o plano Enterprise\n4. Não revele a tabela de preços completa — direcione para uma conversa com o consultor\n5. Se houver interesse claro, ofereça o agendamento de uma demo`}
                      value={config.instrucoesDiretas}
                      onChange={(v) => setField("instrucoesDiretas", v)}
                      rows={7}
                    />
                    <FieldHint>Use numeração e seja diretivo. Estas são as regras que o agente seguirá na automação — quanto mais precisas, melhor o resultado.</FieldHint>
                  </StudioSection>

                  {/* ── Tom de Voz ────────────────────────────────────────── */}
                  <StudioSection icon={Volume2} title="Tom de Voz" subtitle="Como o agente deve se comunicar">
                    <div className="flex flex-wrap gap-1.5">
                      {TOM_OPTIONS.map((opt) => (
                        <button key={opt} onClick={() => setField("tomDeVoz", opt)}
                          className={cn("rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
                            config.tomDeVoz === opt ? "border-primary/40 bg-primary/5 text-primary" : "border-muted text-muted-foreground hover:border-border hover:bg-muted/30"
                          )}>
                          {opt}
                        </button>
                      ))}
                    </div>
                    <ConfigTextarea
                      placeholder="Ou descreva o tom com suas próprias palavras…"
                      value={TOM_OPTIONS.includes(config.tomDeVoz) ? "" : config.tomDeVoz}
                      onChange={(v) => setField("tomDeVoz", v)}
                      rows={2}
                    />
                  </StudioSection>

                  {/* ── Formato de Resposta ───────────────────────────────── */}
                  <StudioSection icon={AlignLeft} title="Formato de Resposta" subtitle="Como as respostas devem ser estruturadas">
                    <div className="flex flex-wrap gap-1.5">
                      {FORMATO_OPTIONS.map((opt) => (
                        <button key={opt} onClick={() => setField("formatoResposta", opt)}
                          className={cn("rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
                            config.formatoResposta === opt ? "border-primary/40 bg-primary/5 text-primary" : "border-muted text-muted-foreground hover:border-border hover:bg-muted/30"
                          )}>
                          {opt}
                        </button>
                      ))}
                    </div>
                    <ConfigTextarea
                      placeholder="Ou descreva o formato esperado em detalhes…"
                      value={FORMATO_OPTIONS.includes(config.formatoResposta) ? "" : config.formatoResposta}
                      onChange={(v) => setField("formatoResposta", v)}
                      rows={2}
                    />
                    <FieldHint>Para WhatsApp, prefira respostas curtas. Para e-mail, estrutura com seções pode ser mais adequada.</FieldHint>
                  </StudioSection>

                  {/* ── Restrições ────────────────────────────────────────── */}
                  <StudioSection icon={Ban} title="Restrições & Guardrails" subtitle="O que o agente jamais deve fazer ou dizer">
                    <ConfigTextarea
                      placeholder={`Liste explicitamente o que é proibido.\n\nEx:\n- Nunca prometa prazos de entrega sem confirmação do time\n- Nunca ofereça desconto sem aprovação do gestor\n- Não discuta assuntos políticos ou religiosos\n- Não revele informações de outros clientes\n- Se o cliente perguntar sobre concorrentes, redirecione para os diferenciais do nosso produto`}
                      value={config.restricoes}
                      onChange={(v) => setField("restricoes", v)}
                      rows={5}
                    />
                    <FieldHint>Guardrails são críticos para compliance. Seja explícito — o que não está proibido pode ser interpretado como permitido.</FieldHint>
                  </StudioSection>

                  {/* ── Mensagem Inicial ──────────────────────────────────── */}
                  <StudioSection icon={MessageCircle} title="Mensagem Inicial" subtitle="Como o agente deve se apresentar ao iniciar uma conversa">
                    <ConfigTextarea
                      placeholder={`Ex: Olá! 👋 Sou o assistente virtual da [Empresa]. Estou aqui para entender melhor o que você precisa e conectar você com a solução certa.\n\nPara começar, pode me contar um pouco sobre o seu negócio?`}
                      value={config.mensagemInicial}
                      onChange={(v) => setField("mensagemInicial", v)}
                      rows={4}
                    />
                  </StudioSection>

                  {/* ── Configuração técnica ──────────────────────────────── */}
                  <StudioSection icon={Cpu} title="Configuração do Modelo" subtitle="Parâmetros do LLM Ollama">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="field-label">Modelo Ollama</label>
                        <div className="relative">
                          <select
                            className="h-9 w-full appearance-none rounded-md border bg-white px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                            value={OLLAMA_MODELS.includes(modelId) ? modelId : "__custom"}
                            onChange={(e) => { if (e.target.value !== "__custom") { setModelId(e.target.value); mark() } }}
                          >
                            {OLLAMA_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                            {!OLLAMA_MODELS.includes(modelId) && modelId && <option value="__custom">{modelId}</option>}
                            <option value="__custom">Outro…</option>
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        </div>
                        {!OLLAMA_MODELS.includes(modelId) && (
                          <Input className="h-8 text-sm font-mono" placeholder="modelo:tag" value={modelId} onChange={(e) => { setModelId(e.target.value); mark() }} />
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="field-label">Temperatura</label>
                          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] font-semibold">{temperatura.toFixed(2)}</span>
                        </div>
                        <input
                          type="range" min="0" max="1" step="0.05"
                          value={temperatura}
                          onChange={(e) => { setTemperatura(Number(e.target.value)); mark() }}
                          className="w-full accent-primary"
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>Preciso e consistente</span>
                          <span>Criativo e variado</span>
                        </div>
                      </div>
                    </div>
                  </StudioSection>

                  {/* ── System prompt preview ─────────────────────────────── */}
                  {assembled && (
                    <div className="px-4 py-3">
                      <button
                        onClick={() => setShowPrompt((v) => !v)}
                        className="flex w-full items-center gap-2 text-left"
                      >
                        <Info className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="flex-1 text-xs font-medium text-muted-foreground">
                          System prompt montado ({assembled.length.toLocaleString("pt-BR")} caracteres)
                        </span>
                        {showPrompt ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
                      </button>
                      {showPrompt && (
                        <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 font-mono text-[11px] leading-5 text-muted-foreground">
                          {assembled}
                        </pre>
                      )}
                    </div>
                  )}

                </div>
              </div>
            </>
          )}
        </section>

        {/* ══ Col 3: Test Studio ═══════════════════════════════════════════════ */}
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-white shadow-soft">
          <div className="shrink-0 border-b px-3 py-2.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Studio de Teste</p>
                <p className="text-[11px] text-muted-foreground">
                  {canTest ? `Testando: ${name}` : isNew ? "Salve o agente para testar" : dirty ? "Salve as alterações primeiro" : "Selecione um agente"}
                </p>
              </div>
              {chatMessages.length > 0 && (
                <button
                  onClick={() => setChatMessages([])}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  title="Limpar chat"
                >
                  <RotateCcw className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-3">
            {!canTest ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
                <div className="flex size-12 items-center justify-center rounded-xl bg-muted/40">
                  <MessageSquare className="size-5 opacity-40" />
                </div>
                <p className="text-xs leading-5">
                  {isNew
                    ? "Crie e salve o agente para iniciar o teste."
                    : dirty
                    ? "Salve as alterações para testar com as configurações atuais."
                    : "Selecione um agente para começar a testar."}
                </p>
              </div>
            ) : chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-muted-foreground">
                <div className={cn("flex size-10 items-center justify-center rounded-xl border-2 ring-2", sc.bg, sc.border, sc.ring)}>
                  <DynIcon name={iconName} className={cn("size-5", sc.text)} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">{name}</p>
                  {config.mensagemInicial ? (
                    <p className="mt-1 rounded-xl rounded-tl-sm bg-muted/50 px-3 py-2 text-left text-xs leading-5">
                      {config.mensagemInicial}
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px]">Digite uma mensagem para iniciar.</p>
                  )}
                </div>
              </div>
            ) : (
              chatMessages.map((m, i) => (
                <ChatBubble key={i} message={m} agentIcon={iconName} agentStatus={status} />
              ))
            )}
            {chatLoading && (
              <div className="flex items-center gap-2 px-2">
                <div className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border", sc.bg, sc.border)}>
                  <DynIcon name={iconName} className={cn("size-3", sc.text)} />
                </div>
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 border-t p-2">
            <div className="flex gap-1.5">
              <input
                className="flex-1 rounded-lg border bg-muted/20 px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
                placeholder={canTest ? "Digite uma mensagem…" : "Salve o agente para testar"}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendTestMessage() } }}
                disabled={!canTest || chatLoading}
              />
              <Button
                size="icon"
                className="size-9 shrink-0"
                onClick={sendTestMessage}
                disabled={!canTest || chatLoading || !chatInput.trim()}
              >
                {chatLoading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </Button>
            </div>
            {canTest && (
              <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
                Enter para enviar · usando {modelId || "modelo padrão"}
              </p>
            )}
          </div>
        </aside>

      </div>
    </div>
  )
}

// ─── Studio Section ───────────────────────────────────────────────────────────

function StudioSection({ icon: Icon, title, subtitle, children }: {
  icon: LucideIcon; title: string; subtitle: string; children: React.ReactNode
}) {
  return (
    <div className="px-4 py-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/8">
          <Icon className="size-3.5 text-primary" />
        </span>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

// ─── Config Textarea ─────────────────────────────────────────────────────────

function ConfigTextarea({ value, onChange, placeholder, rows = 4 }: {
  value: string; onChange: (v: string) => void; placeholder: string; rows?: number
}) {
  return (
    <div className="relative">
      <textarea
        className="w-full resize-none rounded-xl border bg-muted/20 px-3.5 py-3 text-sm leading-6 placeholder:text-muted-foreground/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition-colors"
        style={{ minHeight: `${rows * 24 + 24}px` }}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <span className="absolute bottom-2 right-2.5 text-[10px] tabular-nums text-muted-foreground/60">
          {charCount(value)}
        </span>
      )}
    </div>
  )
}

// ─── Field Hint ──────────────────────────────────────────────────────────────

function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-[11px] leading-5 text-muted-foreground">
      <Info className="mt-0.5 size-3 shrink-0" />
      {children}
    </p>
  )
}

// ─── Chat Bubble ─────────────────────────────────────────────────────────────

function ChatBubble({ message, agentIcon, agentStatus }: {
  message: ChatMessage; agentIcon: string; agentStatus: AgentStatus
}) {
  const [copied, setCopied] = useState(false)
  const sc = STATUS_CFG[agentStatus]

  function copyText() {
    navigator.clipboard.writeText(message.content)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  if (message.role === "error") {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
        <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
        <span>{message.content}</span>
      </div>
    )
  }

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-xl rounded-tr-sm bg-primary px-3.5 py-2.5 text-xs leading-5 text-primary-foreground">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2">
      <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border", sc.bg, sc.border)}>
        <DynIcon name={agentIcon} className={cn("size-3", sc.text)} />
      </span>
      <div className="group max-w-[88%] space-y-1">
        <div className="rounded-xl rounded-tl-sm border bg-muted/40 px-3.5 py-2.5 text-xs leading-5">
          <pre className="whitespace-pre-wrap font-sans">{message.content}</pre>
        </div>
        <button
          onClick={copyText}
          className="flex items-center gap-1 text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
        >
          {copied ? <Check className="size-2.5" /> : <Copy className="size-2.5" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  )
}

// ─── Empty Studio ─────────────────────────────────────────────────────────────

function EmptyStudio({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8 text-center">
      <div className="relative">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/5 ring-2 ring-primary/10">
          <Bot className="size-8 text-primary/50" />
        </div>
        <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
          AI
        </span>
      </div>
      <div>
        <p className="font-semibold">Estúdio de Agentes IA</p>
        <p className="mt-1.5 max-w-[280px] text-sm leading-6 text-muted-foreground">
          Configure agentes que executam automações, respondem clientes e conduzem fluxos de conversa com inteligência.
        </p>
      </div>
      <Button onClick={onNew} className="gap-2">
        <Plus className="size-4" /> Criar primeiro agente
      </Button>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        {[
          { icon: Target, label: "Objetivos claros" },
          { icon: List, label: "Instruções precisas" },
          { icon: MessageSquare, label: "Teste ao vivo" },
        ].map((f) => (
          <div key={f.label} className="rounded-xl border bg-muted/20 px-3 py-2.5">
            <f.icon className="mx-auto mb-1 size-4 text-primary/60" />
            <p className="text-[11px] font-medium text-muted-foreground">{f.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function charCount(s: string) {
  return s.length > 0 ? `${s.length.toLocaleString("pt-BR")} car.` : ""
}

function buildPromptPreview(config: AgentConfig): string {
  const sections: [string, string][] = [
    ["OBJETIVO",            config.objetivo],
    ["CONTEXTO",            config.contexto],
    ["INSTRUÇÕES",          config.instrucoesDiretas],
    ["FORMATO DE RESPOSTA", config.formatoResposta],
    ["TOM DE VOZ",          config.tomDeVoz],
    ["RESTRIÇÕES",          config.restricoes],
  ]
  return sections.filter(([, v]) => v.trim()).map(([k, v]) => `# ${k}\n${v.trim()}`).join("\n\n")
}
