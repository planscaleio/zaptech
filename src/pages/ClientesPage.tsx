import { useEffect, useState, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Search, Plus, Star, Bot, Pencil, Phone, Mail, Building2,
  MapPin, FileText, Tag, GitBranch, CheckCircle2, MessageCircle, HelpCircle,
  Loader2, MoreHorizontal, Package, Users, Kanban, X, RefreshCw,
  ChevronRight, Calendar, DollarSign, LayoutGrid, ClipboardList,
  ExternalLink, Link2, Unlink,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Tag { id: string; name: string; color: string }

interface CustomerSummary {
  id: string
  name: string
  phone: string | null
  email: string | null
  status: string
  stage: string | null
  source: string | null
  lastContactAt: string | null
  value: string | null
  aiScore: number | null
  aiSentiment: string | null
  aiRisk: string | null
  isVip: boolean
  companyName: string | null
  city: string | null
  createdAt: string
  tags: Tag[]
  conversationCount: number
}

interface Product {
  id: string
  productName: string
  status: string
  price: string | null
  description: string | null
  createdAt: string
}

interface KanbanCardRef {
  id: string
  name: string
  priority: string
  score: number | null
  value: string | null
  expectedCloseAt: string | null
  createdAt: string
  column: { id: string; name: string; board: { id: string; name: string } }
}

interface QuoteRef {
  id: string
  number: number
  status: string
  validUntil: string
  total: string
  sentAt: string | null
  createdAt: string
  conversation: { id: string; channel: string } | null
  generatedBy: { id: string; name: string } | null
  events: { id: string; type: string; authorName: string; message: string | null; createdAt: string }[]
}

interface CustomerDetail extends CustomerSummary {
  document: string | null
  companyName: string | null
  segment: string | null
  lifetimeValue: string | null
  aiNextBestAction: string | null
  aiFindings: { id: string; text: string }[]
  owner: { id: string; name: string; role: string } | null
  products: Product[]
  quotes: QuoteRef[]
  attendants: { role: string; description: string | null; user: { id: string; name: string; role: string } }[]
  segments: { id: string; name: string }[]
  businessAccount: { id: string; name: string; status: string; industry: string | null } | null
  kanbanCards: KanbanCardRef[]
  conversations: {
    id: string; channel: string; status: string; preview: string | null
    lastMessageAt: string | null; createdAt: string
    messages: { text: string; role: string; createdAt: string }[]
  }[]
}

// ─── Label/Variant helpers ────────────────────────────────────────────────────

function stageLabel(stage: string | null): string {
  if (!stage) return "—"
  const map: Record<string, string> = {
    PROSPECCAO: "Prospecção", QUALIFICACAO: "Qualificação", DEMONSTRACAO: "Demonstração",
    PROPOSTA: "Proposta", NEGOCIACAO: "Negociação", FECHADO: "Fechado", POS_VENDA: "Pós-venda",
  }
  return map[stage] ?? stage
}

function statusVariant(status: string): "warning" | "success" | "secondary" | "outline" {
  const map: Record<string, "warning" | "success" | "secondary"> = {
    QUENTE: "warning", CLIENTE: "success", INATIVO: "secondary", PERDIDO: "secondary",
    NUTRICAO: "secondary", EM_ANALISE: "secondary",
  }
  return map[status] ?? "outline"
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    QUENTE: "Quente", NUTRICAO: "Nutrição", EM_ANALISE: "Em análise",
    CLIENTE: "Cliente", INATIVO: "Inativo", PERDIDO: "Perdido",
  }
  return map[status] ?? status
}

function channelLabel(ch: string): string {
  const m: Record<string, string> = { WHATSAPP: "WhatsApp", INSTAGRAM: "Instagram", EMAIL: "Email", WEBCHAT: "Web Chat", SMS: "SMS" }
  return m[ch] ?? ch
}

function convStatusLabel(s: string): string {
  const m: Record<string, string> = { ABERTO: "Aberto", EM_ATENDIMENTO: "Em atendimento", RESOLVIDO: "Resolvido", FECHADO: "Fechado" }
  return m[s] ?? s
}

function sourceLabel(s: string | null): string {
  if (!s) return "—"
  const m: Record<string, string> = {
    WHATSAPP: "WhatsApp", INSTAGRAM: "Instagram", SITE: "Site",
    CAMPANHA_CRM: "Campanha CRM", WEBHOOK: "Webhook", EMAIL: "Email",
    INDICACAO: "Indicação", ORGANICO: "Orgânico", OUTRO: "Outro",
  }
  return m[s] ?? s
}

function riskLabel(r: string | null): string {
  if (!r) return "—"
  const m: Record<string, string> = { BAIXO: "Baixo", MEDIO: "Médio", ALTO: "Alto", CRITICO: "Crítico" }
  return m[r] ?? r
}

function sentimentLabel(s: string | null): string {
  if (!s) return "—"
  const m: Record<string, string> = { POSITIVO: "Positivo", NEUTRO: "Neutro", NEGATIVO: "Negativo" }
  return m[s] ?? s
}

function quoteStatusLabel(status: string): string {
  const m: Record<string, string> = {
    RASCUNHO: "Rascunho", ENVIADO: "Enviado", ACEITO: "Aceito",
    RECUSADO: "Recusado", EXPIRADO: "Expirado", CANCELADO: "Cancelado",
  }
  return m[status] ?? status
}

function quoteStatusVariant(status: string): "warning" | "success" | "secondary" | "outline" {
  if (status === "ACEITO") return "success"
  if (status === "ENVIADO") return "warning"
  if (status === "RASCUNHO") return "outline"
  return "secondary"
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("")
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yy = String(d.getFullYear()).slice(2)
  return `${dd}/${mm}/${yy}`
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "—"
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "agora"
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d`
  return fmtDate(iso)
}

function fmtCurrency(val: string | null | undefined): string {
  if (!val) return "—"
  const n = Number(val)
  if (isNaN(n)) return "—"
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n)
}

function priorityDot(p: string): string {
  return p === "ALTA" ? "bg-rose-500" : p === "MEDIA" ? "bg-amber-400" : "bg-sky-400"
}

// ─── EditableField ─────────────────────────────────────────────────────────────

interface EditableFieldProps {
  label: string
  value: string | null | undefined
  onSave: (v: string) => Promise<void>
  icon?: React.ElementType
  type?: "text" | "email" | "tel"
}

function EditableField({ label, value, onSave, icon: Icon, type = "text" }: EditableFieldProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try { await onSave(draft) } finally { setSaving(false); setEditing(false) }
  }

  return (
    <div className="flex items-center gap-2 border-b pb-2.5 last:border-b-0 last:pb-0">
      {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        {editing ? (
          <div className="mt-0.5 flex items-center gap-1">
            <Input
              type={type}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-6 text-xs"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false) }}
            />
            <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="size-3 animate-spin" /> : "OK"}
            </Button>
            <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs" onClick={() => setEditing(false)}>
              <X className="size-3" />
            </Button>
          </div>
        ) : (
          <button
            onClick={() => { setDraft(value ?? ""); setEditing(true) }}
            className="flex w-full items-center gap-1 truncate text-sm font-medium hover:text-primary"
          >
            {value || <span className="text-muted-foreground">—</span>}
            <Pencil className="ml-auto size-3 shrink-0 opacity-0 group-hover:opacity-100" />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Hint tooltip ─────────────────────────────────────────────────────────────

function Hint({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="flex items-center text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        tabIndex={-1}
      >
        <HelpCircle className="size-3" />
      </button>
      {show && (
        <span className="absolute bottom-full left-1/2 z-50 mb-1.5 w-56 -translate-x-1/2 rounded-md border bg-white px-2.5 py-2 text-[11px] leading-4 text-foreground shadow-lg">
          {text}
        </span>
      )}
    </span>
  )
}

// ─── EditableSelect ────────────────────────────────────────────────────────────

interface EditableSelectProps {
  label: string
  hint?: string
  value: string | null | undefined
  options: { value: string; label: string }[]
  onSave: (v: string) => Promise<void>
  icon?: React.ElementType
}

function EditableSelect({ label, hint, value, options, onSave, icon: Icon }: EditableSelectProps) {
  const [saving, setSaving] = useState(false)

  async function handleChange(v: string) {
    setSaving(true)
    try { await onSave(v) } finally { setSaving(false) }
  }

  const current = options.find((o) => o.value === value)?.label ?? value ?? "—"

  return (
    <div className="flex items-center gap-2 border-b pb-2.5 last:border-b-0 last:pb-0">
      {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          {label}
          {hint && <Hint text={hint} />}
        </p>
        <Select value={value ?? ""} onValueChange={handleChange} disabled={saving}>
          <SelectTrigger className="mt-0.5 h-7 bg-white text-xs">
            <SelectValue>{current}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

// ─── AddProductForm ────────────────────────────────────────────────────────────

function AddProductForm({ customerId, onAdded }: { customerId: string; onAdded: (p: Product) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [price, setPrice] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/customers/${customerId}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName: name.trim(), price: price || null }),
      })
      if (!res.ok) throw new Error()
      const product = await res.json()
      onAdded(product)
      setName(""); setPrice(""); setOpen(false)
    } catch { /* noop */ } finally { setSaving(false) }
  }

  if (!open) return (
    <Button variant="ghost" size="sm" className="mt-1 h-7 gap-1 px-2 text-xs" onClick={() => setOpen(true)}>
      <Plus className="size-3" /> Adicionar produto
    </Button>
  )

  return (
    <div className="mt-2 rounded-lg border bg-muted/30 p-2 space-y-2">
      <Input placeholder="Nome do produto / serviço" value={name} onChange={(e) => setName(e.target.value)} className="h-7 text-xs" autoFocus />
      <Input placeholder="Preço (opcional)" value={price} onChange={(e) => setPrice(e.target.value)} className="h-7 text-xs" type="number" />
      <div className="flex gap-1.5">
        <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={saving}>
          {saving ? <Loader2 className="size-3 animate-spin" /> : "Salvar"}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
    </div>
  )
}

// ─── CreateCustomerSheet ───────────────────────────────────────────────────────

interface CreateCustomerSheetProps {
  open: boolean
  onClose: () => void
  companyId: string
  onCreated: (c: CustomerSummary) => void
}

function CreateCustomerSheet({ open, onClose, companyId, onCreated }: CreateCustomerSheetProps) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", companyName: "", city: "", stage: "QUALIFICACAO", status: "EM_ANALISE", source: "" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })) }

  async function handleCreate() {
    if (!form.name.trim()) { setError("Nome é obrigatório"); return }
    setSaving(true); setError("")
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, companyId }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      const created = await res.json()
      // fetch full summary
      const r2 = await fetch(`/api/customers?companyId=${companyId}&q=${encodeURIComponent(form.name)}`)
      const list: CustomerSummary[] = await r2.json()
      const found = list.find((c) => c.id === created.id) ?? { ...created, ...form, tags: [], conversationCount: 0, isVip: false, source: form.source || null, lastContactAt: null, aiScore: null, aiSentiment: null, aiRisk: null, email: form.email || null, companyName: form.companyName || null, city: form.city || null, createdAt: new Date().toISOString() }
      onCreated(found as CustomerSummary)
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao criar cliente")
    } finally { setSaving(false) }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Novo cliente</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3 overflow-y-auto pr-1">
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Nome *</label>
            <Input placeholder="Nome completo" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Telefone</label>
              <Input placeholder="+55 11..." value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <Input type="email" placeholder="email@..." value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Empresa</label>
              <Input placeholder="Nome da empresa" value={form.companyName} onChange={(e) => set("companyName", e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Cidade</label>
              <Input placeholder="Cidade" value={form.city} onChange={(e) => set("city", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Etapa</label>
              <Select value={form.stage} onValueChange={(v) => set("stage", v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[["PROSPECCAO","Prospecção"],["QUALIFICACAO","Qualificação"],["DEMONSTRACAO","Demonstração"],["PROPOSTA","Proposta"],["NEGOCIACAO","Negociação"],["FECHADO","Fechado"],["POS_VENDA","Pós-venda"]].map(([v,l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[["QUENTE","Quente"],["NUTRICAO","Nutrição"],["EM_ANALISE","Em análise"],["CLIENTE","Cliente"],["INATIVO","Inativo"],["PERDIDO","Perdido"]].map(([v,l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Origem</label>
            <Select value={form.source || "_none"} onValueChange={(v) => set("source", v === "_none" ? "" : v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Não informado —</SelectItem>
                {[["WHATSAPP","WhatsApp"],["INSTAGRAM","Instagram"],["SITE","Site"],["CAMPANHA_CRM","Campanha CRM"],["WEBHOOK","Webhook"],["EMAIL","Email"],["INDICACAO","Indicação"],["ORGANICO","Orgânico"],["OUTRO","Outro"]].map(([v,l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full" onClick={handleCreate} disabled={saving}>
            {saving ? <><Loader2 className="mr-2 size-4 animate-spin" />Criando…</> : "Criar cliente"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── ScoreDial ─────────────────────────────────────────────────────────────────

function ScoreDial({ score }: { score: number | null }) {
  if (score == null) return <div className="mx-auto flex size-20 items-center justify-center rounded-full border-4 border-muted bg-muted/30 text-xl font-bold text-muted-foreground">—</div>
  const color = score >= 70 ? "border-rose-500 text-rose-600" : score >= 40 ? "border-amber-400 text-amber-600" : "border-sky-400 text-sky-600"
  return (
    <div className={cn("mx-auto flex size-20 items-center justify-center rounded-full border-4 font-bold text-2xl", color)}>
      {score}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function ClientesPage() {
  const auth = useAuth()
  const companyId = auth?.companyId ?? ""
  const navigate = useNavigate()

  const [list, setList] = useState<CustomerSummary[]>([])
  const [selected, setSelected] = useState<CustomerDetail | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [analyzingAI, setAnalyzingAI] = useState(false)
  const [q, setQ] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [filterStage, setFilterStage] = useState("")
  const [filterVip, setFilterVip] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [linkBaOpen, setLinkBaOpen] = useState(false)
  const [linkBaSearch, setLinkBaSearch] = useState("")
  const [linkBaResults, setLinkBaResults] = useState<{ id: string; name: string; industry: string | null; status: string }[]>([])
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchList = useCallback((search = q, status = filterStatus, stage = filterStage, vip = filterVip) => {
    if (!companyId) return
    setLoadingList(true)
    const params = new URLSearchParams({ companyId })
    if (search.trim()) params.set("q", search.trim())
    if (status) params.set("status", status)
    if (stage) params.set("stage", stage)
    if (vip) params.set("isVip", vip)
    fetch(`/api/customers?${params}`)
      .then((r) => r.json())
      .then((data: CustomerSummary[]) => setList(data))
      .catch(console.error)
      .finally(() => setLoadingList(false))
  }, [companyId, q, filterStatus, filterStage, filterVip])

  useEffect(() => { fetchList() }, [companyId, filterStatus, filterStage, filterVip])

  function handleSearchChange(v: string) {
    setQ(v)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => fetchList(v, filterStatus, filterStage, filterVip), 400)
  }

  function loadDetail(id: string) {
    setLoadingDetail(true)
    fetch(`/api/customers/${id}`)
      .then((r) => r.json())
      .then((data: CustomerDetail) => setSelected(data))
      .catch(console.error)
      .finally(() => setLoadingDetail(false))
  }

  async function patchCustomer(id: string, data: Record<string, unknown>) {
    const res = await fetch(`/api/customers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error("Erro ao salvar")
    if (selected?.id === id) loadDetail(id)
    fetchList()
  }

  async function searchBa(sq: string) {
    if (!sq.trim() || !companyId) { setLinkBaResults([]); return }
    const params = new URLSearchParams({ companyId, q: sq.trim() })
    const res = await fetch(`/api/business-accounts?${params}`)
    if (res.ok) {
      const data = await res.json()
      setLinkBaResults(data.slice(0, 6).map((a: any) => ({ id: a.id, name: a.name, industry: a.industry, status: a.status })))
    }
  }

  async function linkBusinessAccount(accountId: string) {
    if (!selected) return
    await fetch(`/api/business-accounts/${accountId}/contacts/${selected.id}`, { method: "POST" })
    setLinkBaOpen(false)
    setLinkBaSearch("")
    setLinkBaResults([])
    loadDetail(selected.id)
  }

  async function unlinkBusinessAccount() {
    if (!selected?.businessAccount) return
    await fetch(`/api/business-accounts/${selected.businessAccount.id}/contacts/${selected.id}`, { method: "DELETE" })
    loadDetail(selected.id)
  }

  async function toggleVip(id: string, isVip: boolean) {
    await fetch(`/api/customers/${id}/vip`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isVip }),
    })
    if (selected?.id === id) setSelected((s) => s ? { ...s, isVip } : s)
    setList((l) => l.map((c) => c.id === id ? { ...c, isVip } : c))
  }

  async function analyzeWithAI() {
    if (!selected) return
    setAnalyzingAI(true)
    try {
      const res = await fetch(`/api/customers/${selected.id}/analyze`, { method: "POST" })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSelected((s) => s ? { ...s, ...data } : s)
      setList((l) => l.map((c) => c.id === selected.id ? { ...c, aiScore: data.aiScore, aiSentiment: data.aiSentiment, aiRisk: data.aiRisk } : c))
    } catch { /* show nothing */ } finally { setAnalyzingAI(false) }
  }

  async function deleteProduct(productId: string) {
    if (!selected) return
    await fetch(`/api/customers/${selected.id}/products/${productId}`, { method: "DELETE" })
    setSelected((s) => s ? { ...s, products: s.products.filter((p) => p.id !== productId) } : s)
  }

  const sc = selected

  return (
    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
      <div className="grid h-full min-w-[1100px] grid-cols-[300px_minmax(500px,1fr)_320px] gap-2.5 p-2.5 md:p-3">

        {/* ── Left: Customer list ─────────────────────────────────────────────── */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white shadow-sm">
          {/* Header */}
          <div className="shrink-0 border-b p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Clientes</h2>
              <Button size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => setCreateOpen(true)}>
                <Plus className="size-3" /> Novo
              </Button>
            </div>
            <div className="flex items-center gap-1.5 rounded-md border bg-white px-2 py-1">
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                placeholder="Buscar nome, telefone, empresa…"
                value={q}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
              {q && <button onClick={() => { setQ(""); fetchList("") }}><X className="size-3 text-muted-foreground" /></button>}
            </div>
            <div className="flex gap-1.5">
              <Select value={filterStatus || "_all"} onValueChange={(v) => setFilterStatus(v === "_all" ? "" : v)}>
                <SelectTrigger className="h-7 flex-1 bg-white text-[11px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all" className="text-xs">Todos status</SelectItem>
                  {[["QUENTE","Quente"],["NUTRICAO","Nutrição"],["EM_ANALISE","Em análise"],["CLIENTE","Cliente"],["INATIVO","Inativo"],["PERDIDO","Perdido"]].map(([v,l]) => (
                    <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterVip || "_all"} onValueChange={(v) => setFilterVip(v === "_all" ? "" : v)}>
                <SelectTrigger className="h-7 w-[80px] bg-white text-[11px]">
                  <SelectValue placeholder="VIP" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all" className="text-xs">Todos</SelectItem>
                  <SelectItem value="true" className="text-xs">⭐ VIP</SelectItem>
                  <SelectItem value="false" className="text-xs">Não VIP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Column headers */}
          <div className="grid shrink-0 grid-cols-[1fr_auto] border-b bg-muted/40 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
            <span>Cliente</span>
            <span>Score</span>
          </div>

          {/* List */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loadingList && <p className="py-8 text-center text-xs text-muted-foreground">Carregando…</p>}
            {!loadingList && list.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">Nenhum cliente encontrado.</p>
            )}
            {list.map((cust) => (
              <button
                key={cust.id}
                onClick={() => { setSelected(null); loadDetail(cust.id) }}
                className={cn(
                  "group grid w-full grid-cols-[1fr_auto] items-start gap-2 border-b px-3 py-2 text-left transition-colors hover:bg-muted/40",
                  selected?.id === cust.id && "bg-primary/5",
                )}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    {cust.isVip && (
                      <span className="shrink-0 rounded-sm bg-amber-400 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-white">VIP</span>
                    )}
                    <span className="truncate text-sm font-semibold">{cust.name}</span>
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">{cust.phone ?? cust.email ?? cust.companyName ?? "—"}</span>
                  <span className="mt-1 flex items-center gap-1.5">
                    <Badge variant={statusVariant(cust.status)} className="px-1.5 py-0 text-[10px]">{statusLabel(cust.status)}</Badge>
                    <span className="text-[10px] text-muted-foreground">{fmtRelative(cust.lastContactAt)}</span>
                  </span>
                </span>
                <span className={cn(
                  "mt-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold",
                  cust.aiScore != null
                    ? cust.aiScore >= 70 ? "bg-rose-500 text-white"
                    : cust.aiScore >= 40 ? "bg-amber-400 text-white"
                    : "bg-sky-400 text-white"
                    : "bg-muted text-muted-foreground",
                )}>
                  {cust.aiScore ?? "—"}
                </span>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground">
            {list.length} cliente{list.length !== 1 ? "s" : ""}
          </div>
        </section>

        {/* ── Center: Customer detail ─────────────────────────────────────────── */}
        <section className="min-h-0 overflow-y-auto rounded-lg border bg-white shadow-sm">
          {!sc ? (
            <div className="flex h-full items-center justify-center">
              {loadingDetail
                ? <div className="flex flex-col items-center gap-2 text-muted-foreground"><Loader2 className="size-6 animate-spin" /><span className="text-sm">Carregando…</span></div>
                : <div className="text-center text-sm text-muted-foreground"><Users className="mx-auto mb-2 size-8 opacity-40" />Selecione um cliente</div>
              }
            </div>
          ) : (
            <div className="p-4">
              {/* Header */}
              <div className="flex flex-wrap items-start gap-3 border-b pb-4">
                <Avatar className={cn("size-12 shrink-0", sc.isVip && "ring-2 ring-amber-400 ring-offset-1")}>
                  <AvatarFallback className={cn("text-sm font-bold", sc.isVip && "bg-amber-50 text-amber-700")}>
                    {initials(sc.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-base font-semibold">{sc.name}</p>
                    {sc.isVip && (
                      <span className="shrink-0 rounded-sm bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">VIP</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{sc.companyName ?? sc.phone ?? sc.email ?? "—"}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant={statusVariant(sc.status)}>{statusLabel(sc.status)}</Badge>
                    <Badge variant="outline" className="text-[10px]">{stageLabel(sc.stage)}</Badge>
                    {sc.tags.map((tag) => (
                      <span key={tag.id} className="rounded-full border px-1.5 py-0 text-[10px]" style={{ borderColor: tag.color, color: tag.color }}>#{tag.name}</span>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn("h-7 w-7 p-0", sc.isVip && "text-amber-400")}
                    onClick={() => toggleVip(sc.id, !sc.isVip)}
                    title={sc.isVip ? "Remover VIP" : "Marcar como VIP"}
                  >
                    <Star className={cn("size-4", sc.isVip && "fill-amber-400")} />
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs">
                    <MessageCircle className="size-3" /> Chat
                  </Button>
                </div>
              </div>

              {/* Tabs */}
              <Tabs defaultValue="perfil" className="mt-4">
                <TabsList className="h-8 text-xs">
                  <TabsTrigger value="perfil" className="text-xs">Perfil</TabsTrigger>
                  <TabsTrigger value="relacionamento" className="text-xs">Relacionamento</TabsTrigger>
                  <TabsTrigger value="pipelines" className="text-xs">Pipelines</TabsTrigger>
                  <TabsTrigger value="segmentos" className="text-xs">Segmentos</TabsTrigger>
                </TabsList>

                {/* ── Perfil ── */}
                <TabsContent value="perfil" className="mt-4 space-y-4">
                  <div className="rounded-lg border p-3">
                    <p className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contato</p>
                    <div className="space-y-0 group">
                      <EditableField label="Nome" value={sc.name} icon={Tag} onSave={(v) => patchCustomer(sc.id, { name: v })} />
                      <EditableField label="Telefone" value={sc.phone} icon={Phone} type="tel" onSave={(v) => patchCustomer(sc.id, { phone: v })} />
                      <EditableField label="Email" value={sc.email} icon={Mail} type="email" onSave={(v) => patchCustomer(sc.id, { email: v })} />
                      <EditableField label="Empresa" value={sc.companyName} icon={Building2} onSave={(v) => patchCustomer(sc.id, { companyName: v })} />
                      <EditableField label="Cidade" value={sc.city} icon={MapPin} onSave={(v) => patchCustomer(sc.id, { city: v })} />
                      <EditableField label="Documento" value={sc.document} icon={FileText} onSave={(v) => patchCustomer(sc.id, { document: v })} />
                    </div>
                  </div>

                  {/* Empresa vinculada */}
                  <div className="rounded-lg border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Empresa vinculada</p>
                      {!sc.businessAccount && (
                        <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[11px]" onClick={() => setLinkBaOpen(true)}>
                          <Link2 className="size-3" /> Vincular
                        </Button>
                      )}
                    </div>
                    {sc.businessAccount ? (
                      <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-2">
                        <Building2 className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{sc.businessAccount.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {sc.businessAccount.industry ?? ""}{sc.businessAccount.industry ? " · " : ""}
                            {sc.businessAccount.status}
                          </p>
                        </div>
                        <button
                          onClick={() => navigate(`/empresas?id=${sc.businessAccount!.id}`)}
                          title="Abrir empresa"
                          className="shrink-0 text-muted-foreground hover:text-primary"
                        >
                          <ExternalLink className="size-3.5" />
                        </button>
                        <button
                          onClick={() => unlinkBusinessAccount()}
                          title="Desvincular"
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                        >
                          <Unlink className="size-3.5" />
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Nenhuma empresa vinculada.</p>
                    )}
                  </div>

                  <div className="rounded-lg border p-3">
                    <p className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Comercial</p>
                    <div className="space-y-0 group">
                      <EditableSelect
                        label="Status"
                        hint="Estado geral do relacionamento com o cliente — ex: Quente indica interesse ativo, Cliente confirma que já comprou, Perdido encerra o ciclo. Independente dos pipelines."
                        value={sc.status}
                        icon={Tag}
                        options={[{value:"QUENTE",label:"Quente"},{value:"NUTRICAO",label:"Nutrição"},{value:"EM_ANALISE",label:"Em análise"},{value:"CLIENTE",label:"Cliente"},{value:"INATIVO",label:"Inativo"},{value:"PERDIDO",label:"Perdido"}]}
                        onSave={(v) => patchCustomer(sc.id, { status: v })}
                      />
                      <EditableSelect
                        label="Etapa"
                        hint="Etapa macro do funil comercial para este cliente como um todo. Cada oportunidade nos pipelines tem sua própria etapa — este campo representa o estágio geral do relacionamento."
                        value={sc.stage}
                        icon={GitBranch}
                        options={[{value:"PROSPECCAO",label:"Prospecção"},{value:"QUALIFICACAO",label:"Qualificação"},{value:"DEMONSTRACAO",label:"Demonstração"},{value:"PROPOSTA",label:"Proposta"},{value:"NEGOCIACAO",label:"Negociação"},{value:"FECHADO",label:"Fechado"},{value:"POS_VENDA",label:"Pós-venda"}]}
                        onSave={(v) => patchCustomer(sc.id, { stage: v })}
                      />
                      <EditableSelect
                        label="Origem"
                        value={sc.source}
                        icon={GitBranch}
                        options={[{value:"WHATSAPP",label:"WhatsApp"},{value:"INSTAGRAM",label:"Instagram"},{value:"SITE",label:"Site"},{value:"CAMPANHA_CRM",label:"Campanha CRM"},{value:"WEBHOOK",label:"Webhook"},{value:"EMAIL",label:"Email"},{value:"INDICACAO",label:"Indicação"},{value:"ORGANICO",label:"Orgânico"},{value:"OUTRO",label:"Outro"}]}
                        onSave={(v) => patchCustomer(sc.id, { source: v })}
                      />
                      <div className="flex items-center gap-2 border-b pb-2.5 last:border-b-0">
                        <DollarSign className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] text-muted-foreground">Valor estimado</p>
                          <p className="text-sm font-medium">{fmtCurrency(sc.value)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pb-0">
                        <DollarSign className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] text-muted-foreground">LTV (Lifetime Value)</p>
                          <p className="text-sm font-medium">{fmtCurrency(sc.lifetimeValue)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Products */}
                  <div className="rounded-lg border p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Produtos / Serviços</p>
                      <Package className="size-3.5 text-muted-foreground" />
                    </div>
                    {sc.products.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhum produto registrado.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {sc.products.map((p) => (
                          <div key={p.id} className="flex items-center gap-2 rounded-md border bg-muted/20 px-2.5 py-2">
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.productName}</span>
                            <Badge variant={p.status === "ATIVO" ? "success" : "secondary"} className="text-[10px]">{p.status}</Badge>
                            <span className="shrink-0 text-sm font-semibold text-primary">{fmtCurrency(p.price)}</span>
                            <button onClick={() => deleteProduct(p.id)} className="ml-1 text-muted-foreground hover:text-destructive">
                              <X className="size-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  <AddProductForm
                    customerId={sc.id}
                    onAdded={(p) => setSelected((s) => s ? { ...s, products: [p, ...s.products] } : s)}
                  />
                </div>

                  {/* Quotes */}
                  <div className="rounded-lg border p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Orçamentos</p>
                      <ClipboardList className="size-3.5 text-muted-foreground" />
                    </div>
                    {sc.quotes.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhum orçamento registrado.</p>
                    ) : (
                      <div className="space-y-2">
                        {sc.quotes.map((quote) => (
                          <div key={quote.id} className="rounded-md border bg-muted/20 p-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold">Orçamento #{quote.number}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  Validade {fmtDate(quote.validUntil)} · {quote.conversation ? channelLabel(quote.conversation.channel) : "Sem conversa"}
                                </p>
                              </div>
                              <div className="text-right">
                                <Badge variant={quoteStatusVariant(quote.status)} className="text-[10px]">{quoteStatusLabel(quote.status)}</Badge>
                                <p className="mt-1 text-sm font-bold text-primary">{fmtCurrency(quote.total)}</p>
                              </div>
                            </div>
                            {quote.events[0] && (
                              <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                                {quote.events[0].message ?? `${quote.events[0].type} por ${quote.events[0].authorName}`}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Attendants */}
                  {sc.attendants.length > 0 && (
                    <div className="rounded-lg border p-3">
                      <p className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Atendentes</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {sc.attendants.map((a) => (
                          <div key={a.user.id} className="rounded-md border bg-muted/20 p-2.5">
                            <p className="truncate text-sm font-semibold">{a.user.name}</p>
                            <p className="text-xs text-muted-foreground">{a.role}</p>
                            {a.description && <p className="mt-1.5 line-clamp-2 text-xs leading-4 text-muted-foreground">{a.description}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* ── Relacionamento ── */}
                <TabsContent value="relacionamento" className="mt-4 space-y-3">
                  {sc.conversations.length === 0 ? (
                    <div className="rounded-lg border bg-muted/20 py-8 text-center text-sm text-muted-foreground">
                      <MessageCircle className="mx-auto mb-2 size-7 opacity-40" />
                      Nenhuma conversa registrada.
                    </div>
                  ) : sc.conversations.map((conv) => (
                    <div key={conv.id} className="rounded-lg border bg-white p-3 hover:bg-muted/30 transition-colors cursor-pointer">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{channelLabel(conv.channel)}</span>
                          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">{convStatusLabel(conv.status)}</Badge>
                        </div>
                        <span className="text-[11px] text-muted-foreground">{fmtRelative(conv.lastMessageAt ?? conv.createdAt)}</span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-xs leading-4 text-muted-foreground">
                        {conv.messages[0]?.text ?? conv.preview ?? "—"}
                      </p>
                    </div>
                  ))}
                </TabsContent>

                {/* ── Pipelines ── */}
                <TabsContent value="pipelines" className="mt-4">
                  {sc.kanbanCards.length === 0 ? (
                    <div className="rounded-lg border bg-muted/20 py-8 text-center text-sm text-muted-foreground">
                      <Kanban className="mx-auto mb-2 size-7 opacity-40" />
                      Sem oportunidades em pipelines.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sc.kanbanCards.map((card) => (
                        <div key={card.id} className="rounded-lg border bg-white p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">{card.name}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">{card.column.board.name} → {card.column.name}</p>
                            </div>
                            {card.score != null && (
                              <span className={cn(
                                "shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-bold",
                                card.score >= 70 ? "bg-rose-500 text-white" : card.score >= 40 ? "bg-amber-400 text-white" : "bg-sky-400 text-white"
                              )}>
                                {card.score}
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-3">
                            <span className={cn("size-1.5 rounded-full shrink-0", priorityDot(card.priority))} />
                            {card.value && (
                              <span className="flex items-center gap-1 text-[11px] font-semibold text-primary">
                                <DollarSign className="size-2.5" />{fmtCurrency(card.value)}
                              </span>
                            )}
                            {card.expectedCloseAt && (
                              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Calendar className="size-2.5" />{fmtDate(card.expectedCloseAt)}
                              </span>
                            )}
                            <span className="ml-auto text-[10px] text-muted-foreground">{fmtDate(card.createdAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* ── Segmentos ── */}
                <TabsContent value="segmentos" className="mt-4">
                  {sc.segments.length === 0 ? (
                    <div className="rounded-lg border bg-muted/20 py-8 text-center text-sm text-muted-foreground">
                      <LayoutGrid className="mx-auto mb-2 size-7 opacity-40" />
                      Cliente não pertence a nenhum segmento.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {sc.segments.map((seg) => (
                        <div key={seg.id} className="flex items-center gap-2 rounded-full border bg-primary/5 px-3 py-1.5">
                          <LayoutGrid className="size-3.5 text-primary" />
                          <span className="text-sm font-medium">{seg.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </section>

        {/* ── Right: AI panel ─────────────────────────────────────────────────── */}
        <aside className="min-h-0 space-y-3 overflow-y-auto">
          {/* AI Evaluation */}
          <div className="rounded-lg border bg-white p-3 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Avaliação IA</p>
                <p className="text-[11px] text-muted-foreground">Score, risco e recomendação</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 px-2 text-xs"
                onClick={analyzeWithAI}
                disabled={!sc || analyzingAI}
              >
                {analyzingAI ? <Loader2 className="size-3 animate-spin" /> : <Bot className="size-3" />}
                {analyzingAI ? "Analisando…" : "Avaliar"}
              </Button>
            </div>

            {analyzingAI && (
              <div className="flex items-center gap-2 rounded-md bg-primary/5 px-3 py-2.5 text-xs text-primary">
                <Loader2 className="size-3.5 animate-spin" />
                A IA está analisando o perfil e histórico do cliente…
              </div>
            )}

            <ScoreDial score={sc?.aiScore ?? null} />
            <p className="mt-2 text-center text-xs text-muted-foreground">Score IA</p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-md border bg-muted/30 p-2">
                <p className="text-[10px] text-muted-foreground">Sentimento</p>
                <p className="mt-0.5 text-sm font-semibold">{sentimentLabel(sc?.aiSentiment ?? null)}</p>
              </div>
              <div className="rounded-md border bg-muted/30 p-2">
                <p className="text-[10px] text-muted-foreground">Risco</p>
                <p className={cn("mt-0.5 text-sm font-semibold",
                  sc?.aiRisk === "CRITICO" ? "text-rose-600" :
                  sc?.aiRisk === "ALTO" ? "text-amber-600" : ""
                )}>
                  {riskLabel(sc?.aiRisk ?? null)}
                </p>
              </div>
            </div>

            {sc?.aiNextBestAction && (
              <div className="mt-3 rounded-md bg-cyan-50 px-3 py-2.5 text-xs leading-5 text-cyan-900">
                <p className="mb-1 font-semibold text-cyan-700">Próxima ação recomendada</p>
                {sc.aiNextBestAction}
              </div>
            )}

            {(sc?.aiFindings ?? []).length > 0 && (
              <div className="mt-3 space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Insights</p>
                {sc!.aiFindings.map((f) => (
                  <div key={f.id} className="flex items-start gap-2 text-xs leading-4">
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                    <span>{f.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick stats */}
          {sc && (
            <div className="rounded-lg border bg-white p-3 shadow-sm">
              <p className="mb-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Resumo</p>
              <div className="space-y-2 text-sm">
                {[
                  ["Responsável", sc.owner?.name ?? "—"],
                  ["Conversas", String(sc.conversationCount)],
                  ["Segmentos", String(sc.segments.length)],
                  ["Oportunidades", String(sc.kanbanCards.length)],
                  ["Produtos", String(sc.products.length)],
                  ["Criado em", fmtDate(sc.createdAt)],
                  ["Último contato", fmtRelative(sc.lastContactAt)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Create Customer Sheet */}
      <CreateCustomerSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        companyId={companyId}
        onCreated={(c) => {
          setList((l) => [c, ...l])
          loadDetail(c.id)
        }}
      />

      {/* Link Business Account Sheet */}
      <Sheet open={linkBaOpen} onClose={() => { setLinkBaOpen(false); setLinkBaSearch(""); setLinkBaResults([]) }} className="w-[380px]">
        <SheetHeader>
          <SheetTitle>Vincular empresa</SheetTitle>
        </SheetHeader>
        <SheetContent>
          <div className="space-y-3">
            <Input
              placeholder="Buscar empresa por nome…"
              value={linkBaSearch}
              onChange={(e) => { setLinkBaSearch(e.target.value); searchBa(e.target.value) }}
            />
            <div className="space-y-1.5">
              {linkBaResults.length === 0 && linkBaSearch.trim() && (
                <p className="text-xs text-muted-foreground">Nenhuma empresa encontrada.</p>
              )}
              {linkBaResults.map((a) => (
                <button
                  key={a.id}
                  onClick={() => linkBusinessAccount(a.id)}
                  className="flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-2 text-left hover:bg-accent"
                >
                  <Building2 className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{a.industry ?? ""}{a.industry ? " · " : ""}{a.status}</p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
