import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import {
  Building2, Search, Plus, X, ChevronRight, Users, Phone, Mail,
  Globe, MapPin, DollarSign, Kanban, LifeBuoy, MessageCircle,
  ExternalLink, Link2, Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/hooks/useAuth"

// ─── Types ───────────────────────────────────────────────────────────────────

interface BusinessAccountSummary {
  id: string
  name: string
  cnpj: string | null
  industry: string | null
  size: string | null
  status: string
  city: string | null
  state: string | null
  value: string | null
  createdAt: string
  updatedAt: string
  _count: { contacts: number }
}

interface ContactRef {
  id: string
  name: string
  phone: string | null
  email: string | null
  status: string | null
  stage: string | null
  aiScore: number | null
  lastContactAt: string | null
  isVip: boolean
  kanbanCards: {
    id: string
    name: string
    priority: string
    score: number | null
    value: string | null
    expectedCloseAt: string | null
    column: { id: string; name: string; board: { id: string; name: string } }
  }[]
}

interface KanbanCardAgg {
  id: string
  name: string
  priority: string
  score: number | null
  value: string | null
  expectedCloseAt: string | null
  contactName: string
  contactId: string
  column: { id: string; name: string; board: { id: string; name: string } }
}

interface ConversationRef {
  id: string
  channel: string
  status: string
  preview: string | null
  lastMessageAt: string | null
  createdAt: string
  customer: { id: string; name: string }
}

interface TicketRef {
  id: string
  code: string
  title: string
  status: string
  priority: string
  slaState: string | null
  slaDueAt: string | null
  customer: string
  createdAt: string
}

interface BusinessAccountDetail extends BusinessAccountSummary {
  website: string | null
  phone: string | null
  email: string | null
  ltv: string | null
  notes: string | null
  contacts: ContactRef[]
  kanbanCards: KanbanCardAgg[]
  recentConversations: ConversationRef[]
  supportTickets: TicketRef[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const API = "/api"

function fmtCurrency(v: string | number | null | undefined) {
  if (v == null) return "—"
  const n = typeof v === "string" ? parseFloat(v) : v
  if (isNaN(n)) return "—"
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function fmtDate(v: string | null | undefined) {
  if (!v) return "—"
  return new Date(v).toLocaleDateString("pt-BR")
}

function fmtRelative(v: string | null | undefined) {
  if (!v) return "—"
  const diff = Date.now() - new Date(v).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "agora"
  if (m < 60) return `${m}min atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d atrás`
  return fmtDate(v)
}

const statusColor: Record<string, string> = {
  Prospect:  "bg-blue-100 text-blue-700",
  Ativa:     "bg-green-100 text-green-700",
  Inativa:   "bg-gray-100 text-gray-600",
  Parceira:  "bg-purple-100 text-purple-700",
}

const priorityColor: Record<string, string> = {
  ALTA:   "bg-red-100 text-red-700",
  MEDIA:  "bg-yellow-100 text-yellow-700",
  BAIXA:  "bg-gray-100 text-gray-600",
}

// ─── Editable field ───────────────────────────────────────────────────────────

function EF({
  label, value, icon: Icon, type = "text",
  onSave,
}: {
  label: string
  value: string | null | undefined
  icon: React.ElementType
  type?: string
  onSave: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? "")

  function commit() {
    setEditing(false)
    if (draft !== (value ?? "")) onSave(draft)
  }

  return (
    <div className="flex items-start gap-2 border-b pb-2.5 last:border-b-0 group/ef">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        {editing ? (
          <Input
            autoFocus
            className="mt-0.5 h-7 text-sm"
            type={type}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false) }}
          />
        ) : (
          <p
            className="cursor-pointer text-sm font-medium hover:text-primary"
            onClick={() => { setDraft(value ?? ""); setEditing(true) }}
          >
            {value || <span className="font-normal text-muted-foreground">—</span>}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmpresasPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const companyId = auth?.companyId ?? ""

  const [list, setList] = useState<BusinessAccountSummary[]>([])
  const [selected, setSelected] = useState<BusinessAccountDetail | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [q, setQ] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [industryFilter, setIndustryFilter] = useState("all")

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({
    name: "", cnpj: "", website: "", phone: "", email: "", city: "", state: "",
    industry: "", size: "", status: "Prospect", value: "", notes: "",
  })
  const [saving, setSaving] = useState(false)

  const [linkOpen, setLinkOpen] = useState(false)
  const [linkSearch, setLinkSearch] = useState("")
  const [linkResults, setLinkResults] = useState<{ id: string; name: string; phone: string | null; email: string | null }[]>([])

  // ── Fetch list ────────────────────────────────────────────────────────────
  const fetchList = useCallback(async () => {
    if (!companyId) return
    setLoadingList(true)
    const params = new URLSearchParams({ companyId })
    if (q.trim()) params.set("q", q.trim())
    if (statusFilter !== "all") params.set("status", statusFilter)
    if (industryFilter !== "all") params.set("industry", industryFilter)
    const res = await fetch(`${API}/business-accounts?${params}`)
    if (res.ok) setList(await res.json())
    setLoadingList(false)
  }, [companyId, q, statusFilter, industryFilter])

  useEffect(() => { fetchList() }, [fetchList])

  // ── Fetch detail ──────────────────────────────────────────────────────────
  async function fetchDetail(id: string) {
    setLoadingDetail(true)
    const res = await fetch(`${API}/business-accounts/${id}`)
    if (res.ok) setSelected(await res.json())
    setLoadingDetail(false)
  }

  // ── Create ────────────────────────────────────────────────────────────────
  async function handleCreate() {
    if (!form.name.trim()) return
    setSaving(true)
    const res = await fetch(`${API}/business-accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, companyId }),
    })
    if (res.ok) {
      const created = await res.json()
      setCreateOpen(false)
      setForm({ name: "", cnpj: "", website: "", phone: "", email: "", city: "", state: "", industry: "", size: "", status: "Prospect", value: "", notes: "" })
      await fetchList()
      fetchDetail(created.id)
    }
    setSaving(false)
  }

  // ── Patch ─────────────────────────────────────────────────────────────────
  async function patchAccount(id: string, data: Record<string, unknown>) {
    const res = await fetch(`${API}/business-accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const updated = await res.json()
      setSelected((prev) => prev ? { ...prev, ...updated } : prev)
      setList((prev) => prev.map((a) => a.id === id ? { ...a, ...updated } : a))
    }
  }

  // ── Unlink contact ────────────────────────────────────────────────────────
  async function unlinkContact(customerId: string) {
    if (!selected) return
    await fetch(`${API}/business-accounts/${selected.id}/contacts/${customerId}`, { method: "DELETE" })
    fetchDetail(selected.id)
  }

  // ── Link contact ──────────────────────────────────────────────────────────
  async function searchContacts(sq: string) {
    if (!sq.trim() || !companyId) { setLinkResults([]); return }
    const params = new URLSearchParams({ companyId, q: sq.trim() })
    const res = await fetch(`${API}/customers?${params}`)
    if (res.ok) {
      const data = await res.json()
      setLinkResults(data.slice(0, 8).map((c: any) => ({ id: c.id, name: c.name, phone: c.phone, email: c.email })))
    }
  }

  async function linkContact(customerId: string) {
    if (!selected) return
    await fetch(`${API}/business-accounts/${selected.id}/contacts/${customerId}`, { method: "POST" })
    setLinkOpen(false)
    setLinkSearch("")
    setLinkResults([])
    fetchDetail(selected.id)
  }

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = selected ? {
    contacts: selected.contacts.length,
    value: selected.value,
    opportunities: selected.kanbanCards.length,
    atRisk: selected.supportTickets.filter((t) => t.slaState && t.slaState !== "No prazo").length,
    lastContact: selected.contacts.reduce<string | null>((acc, c) => {
      if (!c.lastContactAt) return acc
      if (!acc || c.lastContactAt > acc) return c.lastContactAt
      return acc
    }, null),
  } : null

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
      <div className="grid h-full min-w-[1100px] grid-cols-[300px_minmax(500px,1fr)_320px] gap-2.5 p-2.5 md:p-3">
      {/* ── Left panel — List ─────────────────────────────────────────── */}
      <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="shrink-0 space-y-2 border-b p-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Empresas</h2>
            <Button size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3" /> Nova
            </Button>
          </div>
          <div className="flex items-center gap-1.5 rounded-md border bg-white px-2 py-1">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              placeholder="Buscar nome ou CNPJ…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && <button onClick={() => setQ("")}><X className="size-3 text-muted-foreground" /></button>}
          </div>
          <div className="flex gap-1.5">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-7 flex-1 bg-white text-[11px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todos status</SelectItem>
                <SelectItem value="Prospect" className="text-xs">Prospect</SelectItem>
                <SelectItem value="Ativa" className="text-xs">Ativa</SelectItem>
                <SelectItem value="Inativa" className="text-xs">Inativa</SelectItem>
                <SelectItem value="Parceira" className="text-xs">Parceira</SelectItem>
              </SelectContent>
            </Select>
            <Select value={industryFilter} onValueChange={setIndustryFilter}>
              <SelectTrigger className="h-7 flex-1 bg-white text-[11px]"><SelectValue placeholder="Setor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todos setores</SelectItem>
                {["Tecnologia","Saúde","Varejo","Serviços","Indústria","Educação","Outros"].map((o) => (
                  <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-[1fr_auto] border-b bg-muted/40 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
          <span>Empresa</span>
          <span>Contatos</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loadingList && <p className="py-8 text-center text-xs text-muted-foreground">Carregando…</p>}
          {!loadingList && list.length === 0 && (
            <p className="py-8 text-center text-xs text-muted-foreground">Nenhuma empresa encontrada.</p>
          )}
          {list.map((acc) => (
            <button
              key={acc.id}
              onClick={() => fetchDetail(acc.id)}
              className={cn(
                "group grid w-full grid-cols-[1fr_auto] items-start gap-2 border-b px-3 py-2 text-left transition-colors hover:bg-muted/40",
                selected?.id === acc.id && "bg-primary/5",
              )}
            >
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold">{acc.name}</span>
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {acc.industry ?? acc.city ?? acc.cnpj ?? "—"}
                </span>
                <span className="mt-1 flex items-center gap-1.5">
                  <span className={cn("rounded px-1.5 py-0 text-[10px] font-medium", statusColor[acc.status] ?? "bg-gray-100 text-gray-600")}>
                    {acc.status}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{fmtCurrency(acc.value)}</span>
                </span>
              </span>
              <span className="mt-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-bold text-muted-foreground">
                {acc._count.contacts}
              </span>
            </button>
          ))}
        </div>

        <div className="shrink-0 border-t bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground">
          {list.length} empresa{list.length !== 1 ? "s" : ""}
        </div>
      </section>

      {/* ── Center panel — Detail ─────────────────────────────────────── */}
      <section className="min-h-0 overflow-y-auto rounded-lg border bg-white shadow-sm">
        {!selected ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            {loadingDetail ? <Loader2 className="size-6 animate-spin" /> : <Building2 className="size-10 opacity-30" />}
            <p className="text-sm">{loadingDetail ? "Carregando…" : "Selecione uma empresa"}</p>
          </div>
        ) : loadingDetail ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" /> Carregando…
          </div>
        ) : (
          <div className="p-4">
            {/* Header */}
            <div className="flex flex-wrap items-start gap-3 border-b pb-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <Building2 className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold">{selected.name}</p>
                <p className="text-sm text-muted-foreground">
                  {selected.industry ?? selected.cnpj ?? "—"}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className={cn("rounded px-1.5 py-0 text-[10px] font-medium", statusColor[selected.status] ?? "bg-gray-100 text-gray-600")}>
                    {selected.status}
                  </span>
                  {selected.size && <Badge variant="outline" className="text-[10px]">{selected.size}</Badge>}
                  {(selected.city || selected.state) && (
                    <Badge variant="outline" className="text-[10px]">{[selected.city, selected.state].filter(Boolean).join(" / ")}</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="perfil" className="mt-4">
              <TabsList className="h-8 text-xs">
                <TabsTrigger value="perfil" className="text-xs">Perfil</TabsTrigger>
                <TabsTrigger value="contatos" className="text-xs">
                  Contatos
                  <span className="ml-1 rounded bg-muted px-1 text-[10px]">{selected.contacts.length}</span>
                </TabsTrigger>
                <TabsTrigger value="oportunidades" className="text-xs">
                  Oportunidades
                  <span className="ml-1 rounded bg-muted px-1 text-[10px]">{selected.kanbanCards.length}</span>
                </TabsTrigger>
                <TabsTrigger value="historico" className="text-xs">Histórico</TabsTrigger>
              </TabsList>

              {/* ── Perfil ── */}
              <TabsContent value="perfil" className="mt-4">
                <div className="space-y-3">
                  <div className="rounded-lg border p-3">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contato</p>
                    <div className="space-y-2.5 group">
                      <EF label="Website" value={selected.website} icon={Globe} onSave={(v) => patchAccount(selected.id, { website: v })} />
                      <EF label="Telefone" value={selected.phone} icon={Phone} type="tel" onSave={(v) => patchAccount(selected.id, { phone: v })} />
                      <EF label="E-mail" value={selected.email} icon={Mail} type="email" onSave={(v) => patchAccount(selected.id, { email: v })} />
                      <EF label="Cidade" value={selected.city} icon={MapPin} onSave={(v) => patchAccount(selected.id, { city: v })} />
                      <EF label="Estado" value={selected.state} icon={MapPin} onSave={(v) => patchAccount(selected.id, { state: v })} />
                      <EF label="CNPJ" value={selected.cnpj} icon={Building2} onSave={(v) => patchAccount(selected.id, { cnpj: v })} />
                    </div>
                  </div>

                  <div className="rounded-lg border p-3">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Comercial</p>
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2 border-b pb-2.5">
                        <Building2 className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] text-muted-foreground">Setor</p>
                          <Select value={selected.industry ?? ""} onValueChange={(v) => patchAccount(selected.id, { industry: v })}>
                            <SelectTrigger className="mt-0.5 h-7 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              {["Tecnologia","Saúde","Varejo","Serviços","Indústria","Educação","Outros"].map((o) => (
                                <SelectItem key={o} value={o}>{o}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 border-b pb-2.5">
                        <Users className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] text-muted-foreground">Porte</p>
                          <Select value={selected.size ?? ""} onValueChange={(v) => patchAccount(selected.id, { size: v })}>
                            <SelectTrigger className="mt-0.5 h-7 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              {["MEI","Micro","Pequena","Média","Grande"].map((o) => (
                                <SelectItem key={o} value={o}>{o}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 border-b pb-2.5">
                        <Building2 className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] text-muted-foreground">Status</p>
                          <Select value={selected.status} onValueChange={(v) => patchAccount(selected.id, { status: v })}>
                            <SelectTrigger className="mt-0.5 h-7 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {["Prospect","Ativa","Inativa","Parceira"].map((o) => (
                                <SelectItem key={o} value={o}>{o}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 border-b pb-2.5">
                        <DollarSign className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] text-muted-foreground">Valor estimado</p>
                          <p className="text-sm font-medium">{fmtCurrency(selected.value)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] text-muted-foreground">LTV</p>
                          <p className="text-sm font-medium">{fmtCurrency(selected.ltv)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notas</p>
                    <textarea
                      className="w-full resize-none rounded-md border bg-transparent p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      rows={4}
                      defaultValue={selected.notes ?? ""}
                      onBlur={(e) => patchAccount(selected.id, { notes: e.target.value })}
                      placeholder="Observações internas sobre esta empresa…"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* ── Contatos ── */}
              <TabsContent value="contatos" className="mt-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contatos vinculados</p>
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setLinkOpen(true)}>
                    <Link2 className="size-3.5" /> Vincular
                  </Button>
                </div>

                {selected.contacts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum contato vinculado.</p>
                ) : (
                  <div className="space-y-2">
                    {selected.contacts.map((c) => (
                      <div key={c.id} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-xs uppercase">
                          {c.name[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{c.name}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {c.phone ?? c.email ?? "—"}
                          </p>
                        </div>
                        {c.aiScore != null && (
                          <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                            {c.aiScore}
                          </span>
                        )}
                        <button
                          onClick={() => navigate(`/clientes?id=${c.id}`)}
                          title="Abrir no CRM"
                          className="shrink-0 text-muted-foreground hover:text-primary"
                        >
                          <ExternalLink className="size-3.5" />
                        </button>
                        <button
                          onClick={() => unlinkContact(c.id)}
                          title="Desvincular"
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ── Oportunidades ── */}
              <TabsContent value="oportunidades" className="mt-4">
                {selected.kanbanCards.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma oportunidade encontrada.</p>
                ) : (
                  <div className="space-y-2">
                    {selected.kanbanCards.map((card) => (
                      <div key={card.id} className="rounded-lg border bg-card px-3 py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium">{card.name}</p>
                          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${priorityColor[card.priority] ?? "bg-gray-100 text-gray-600"}`}>
                            {card.priority}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1"><Kanban className="size-3" />{card.column.board.name} / {card.column.name}</span>
                          <span>·</span>
                          <span>{card.contactName}</span>
                          {card.value && <><span>·</span><span className="font-semibold text-foreground">{fmtCurrency(card.value)}</span></>}
                          {card.expectedCloseAt && <><span>·</span><span>Fecha {fmtDate(card.expectedCloseAt)}</span></>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ── Histórico ── */}
              <TabsContent value="historico" className="mt-4 space-y-4">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conversas recentes (48h)</p>
                  {selected.recentConversations.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma conversa recente.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {selected.recentConversations.map((conv) => (
                        <div key={conv.id} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
                          <MessageCircle className="size-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium">{conv.customer.name}</p>
                            <p className="truncate text-[11px] text-muted-foreground">{conv.preview ?? "—"}</p>
                          </div>
                          <span className="shrink-0 text-[10px] text-muted-foreground">{fmtRelative(conv.lastMessageAt)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Chamados abertos</p>
                  {selected.supportTickets.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum chamado em aberto.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {selected.supportTickets.map((t) => (
                        <div key={t.id} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
                          <LifeBuoy className="size-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1 text-xs">
                              <span className="font-mono text-muted-foreground">#{t.code}</span>
                              <span className="font-medium">{t.title}</span>
                            </p>
                            <p className="text-[11px] text-muted-foreground">{t.customer} · {t.status}</p>
                          </div>
                          {t.slaState && t.slaState !== "No prazo" && (
                            <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                              {t.slaState}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </section>

      {/* ── Right panel — KPIs ───────────────────────────────────────── */}
      <aside className="min-h-0 space-y-3 overflow-y-auto">
        <div className="rounded-lg border bg-white p-3 shadow-sm">
          <div className="mb-3">
            <p className="text-sm font-semibold">Visão consolidada</p>
            <p className="text-[11px] text-muted-foreground">Conta, relacionamento e SLA</p>
          </div>
          {selected && kpis ? (
          <div className="space-y-3">
            {[
              { label: "Contatos",       value: String(kpis.contacts),               icon: Users },
              { label: "Valor estimado", value: fmtCurrency(kpis.value),             icon: DollarSign },
              { label: "Oportunidades",  value: String(kpis.opportunities),           icon: Kanban },
              { label: "SLA em risco",   value: String(kpis.atRisk),                 icon: LifeBuoy },
              { label: "Último contato", value: fmtRelative(kpis.lastContact),       icon: MessageCircle },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Icon className="size-3.5" />
                  <span>{label}</span>
                </div>
                <p className="mt-1 text-lg font-semibold leading-tight">{value}</p>
              </div>
            ))}
          </div>
          ) : (
            <div className="rounded-lg border bg-muted/20 py-8 text-center text-sm text-muted-foreground">
              <Building2 className="mx-auto mb-2 size-7 opacity-40" />
              Selecione uma empresa
            </div>
          )}
        </div>
      </aside>
      </div>

      {/* ── Sheet: Nova empresa ──────────────────────────────────────── */}
      <Sheet open={createOpen} onClose={() => setCreateOpen(false)} className="w-[440px]">
        <SheetHeader>
          <SheetTitle>Nova empresa</SheetTitle>
        </SheetHeader>
        <SheetContent>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nome *</label>
              <Input className="mt-1" placeholder="Razão social ou nome comercial" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">CNPJ</label>
              <Input className="mt-1" placeholder="00.000.000/0000-00" value={form.cnpj} onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Website</label>
                <Input className="mt-1" placeholder="https://…" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Telefone</label>
                <Input className="mt-1" type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">E-mail</label>
              <Input className="mt-1" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Cidade</label>
                <Input className="mt-1" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Estado (UF)</label>
                <Input className="mt-1" maxLength={2} placeholder="SP" value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value.toUpperCase() }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Setor</label>
                <Select value={form.industry} onValueChange={(v) => setForm((f) => ({ ...f, industry: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {["Tecnologia","Saúde","Varejo","Serviços","Indústria","Educação","Outros"].map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Porte</label>
                <Select value={form.size} onValueChange={(v) => setForm((f) => ({ ...f, size: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {["MEI","Micro","Pequena","Média","Grande"].map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Prospect","Ativa","Inativa","Parceira"].map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Valor estimado (R$)</label>
                <Input className="mt-1" type="number" placeholder="0,00" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Notas</label>
              <textarea className="mt-1 w-full resize-none rounded-md border bg-transparent p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" rows={3} placeholder="Observações…" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving || !form.name.trim()}>
              {saving ? "Salvando…" : "Criar empresa"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Sheet: Vincular contato ──────────────────────────────────── */}
      <Sheet open={linkOpen} onClose={() => { setLinkOpen(false); setLinkSearch(""); setLinkResults([]) }} className="w-[380px]">
        <SheetHeader>
          <SheetTitle>Vincular contato</SheetTitle>
        </SheetHeader>
        <SheetContent>
          <div className="space-y-3">
            <Input
              placeholder="Buscar por nome, telefone ou e-mail…"
              value={linkSearch}
              onChange={(e) => { setLinkSearch(e.target.value); searchContacts(e.target.value) }}
            />
            <div className="space-y-1.5">
              {linkResults.length === 0 && linkSearch.trim() && (
                <p className="text-xs text-muted-foreground">Nenhum resultado.</p>
              )}
              {linkResults.map((c) => (
                <button
                  key={c.id}
                  onClick={() => linkContact(c.id)}
                  className="flex w-full items-center gap-3 rounded-lg border bg-card px-3 py-2 text-left hover:bg-accent"
                >
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-xs uppercase">
                    {c.name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{c.phone ?? c.email ?? "—"}</p>
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
