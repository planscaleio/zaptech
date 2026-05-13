import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle, CheckCircle2, Clock3, Filter, Inbox, LifeBuoy, MessageSquare,
  Plus, Search, ShieldAlert, Tag, UserRound, Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useAuth } from "@/hooks/useAuth"
import { supportCategories, supportPriorities, supportTeams, type TicketSlaState, type TicketStatus } from "@/lib/supportTickets"

// ─── Types ────────────────────────────────────────────────────────────────────

interface TicketActivity {
  id: string
  authorName: string
  text: string
  createdAt: string
}

interface Ticket {
  id: string
  code: string
  title: string
  customer: string
  contact: string
  channel: string
  conversationId: string | null
  category: string
  priority: string
  status: string
  team: string
  assignee: string | null
  slaState: string
  slaDueAt: string
  summary: string | null
  tags: string[]
  createdAt: string
  updatedAt: string
  activity: TicketActivity[]
}

interface SupportUser {
  id: string
  name: string
  email: string
  role: string
}

const CHANNELS = ["WhatsApp", "E-mail", "Telefone", "Chat"] as const
const STATUSES: TicketStatus[] = ["Novo", "Triagem", "Em atendimento", "Aguardando cliente", "Resolvido"]

// ─── Helpers ─────────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  Novo: "border-blue-200 bg-blue-50 text-blue-700",
  Triagem: "border-violet-200 bg-violet-50 text-violet-700",
  "Em atendimento": "border-cyan-200 bg-cyan-50 text-cyan-700",
  "Aguardando cliente": "border-amber-200 bg-amber-50 text-amber-700",
  Resolvido: "border-emerald-200 bg-emerald-50 text-emerald-700",
}

const slaColors: Record<string, string> = {
  Vencido: "border-red-200 bg-red-50 text-red-700",
  "Em risco": "border-amber-200 bg-amber-50 text-amber-700",
  "No prazo": "border-emerald-200 bg-emerald-50 text-emerald-700",
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))
}

function computeTimeLeft(slaDueAt: string): string {
  const diff = new Date(slaDueAt).getTime() - Date.now()
  const abs = Math.abs(diff)
  const h = Math.floor(abs / 3_600_000)
  const m = Math.floor((abs % 3_600_000) / 60_000)
  const sign = diff < 0 ? "-" : ""
  if (h > 0) return `${sign}${h}h ${m}min`
  return `${sign}${m}min`
}

function todayPlusHours(h: number) {
  return new Date(Date.now() + h * 3_600_000).toISOString().slice(0, 16)
}

function prioritySlaHours(priority: string) {
  if (priority === "Crítica") return 1
  if (priority === "Alta") return 4
  if (priority === "Baixa") return 72
  return 24
}

function AssigneePicker({
  value,
  users,
  onChange,
  placeholder = "Buscar responsável...",
}: {
  value: string
  users: SupportUser[]
  onChange: (value: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false)
        setSearch("")
      }
    }

    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const options = useMemo(() => {
    const term = search.trim().toLowerCase()
    const base = users.map((user) => user.name).filter(Boolean)
    const unique = Array.from(new Set(value && !base.includes(value) ? [value, ...base] : base))

    return unique.filter((name) => !term || name.toLowerCase().includes(term))
  }, [search, users, value])

  function selectAssignee(name: string) {
    onChange(name)
    setOpen(false)
    setSearch("")
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="flex h-7 w-full items-center justify-between gap-2 rounded-md border bg-white px-2 text-left text-xs transition-colors hover:bg-muted/30"
        onClick={() => setOpen((current) => !current)}
      >
        <span className={cn("min-w-0 flex-1 truncate", !value && "text-muted-foreground")}>
          {value || "Sem responsável"}
        </span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-lg border bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b px-2 py-1.5">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              className="h-7 min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              placeholder={placeholder}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            <button
              type="button"
              className={cn(
                "flex w-full items-center px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50",
                !value && "font-semibold text-primary",
              )}
              onClick={() => selectAssignee("")}
            >
              Sem responsável
            </button>
            {options.map((name) => (
              <button
                key={name}
                type="button"
                className={cn(
                  "flex w-full items-center px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50",
                  value === name && "font-semibold text-primary",
                )}
                onClick={() => selectAssignee(name)}
              >
                <span className="truncate">{name}</span>
              </button>
            ))}
            {options.length === 0 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">Nenhuma pessoa encontrada.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

const emptyForm = {
  customer: "",
  contact: "",
  title: "",
  channel: "WhatsApp" as string,
  category: "Técnico" as string,
  priority: "Média" as string,
  team: "Suporte N1" as string,
  assignee: "",
  slaDueAt: todayPlusHours(24),
  summary: "",
}

export default function SuportePage() {
  const auth = useAuth()
  const companyId = auth?.companyId ?? ""

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [users, setUsers] = useState<SupportUser[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string>("")
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "Todos">("Todos")
  const [slaFilter, setSlaFilter] = useState<TicketSlaState | "Todos">("Todos")

  // New ticket sheet
  const [sheetOpen, setSheetOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState("")
  const [formSaving, setFormSaving] = useState(false)

  // Edit controls for selected ticket
  const [editStatus, setEditStatus] = useState("")
  const [editPriority, setEditPriority] = useState("")
  const [editTeam, setEditTeam] = useState("")
  const [editAssignee, setEditAssignee] = useState("")
  const [saving, setSaving] = useState(false)

  // Activity note
  const [note, setNote] = useState("")
  const [addingNote, setAddingNote] = useState(false)

  async function loadTickets() {
    if (!companyId) return
    setLoading(true)
    try {
      const data = await fetch(`/api/support-tickets?companyId=${companyId}`).then((r) => r.json())
      setTickets(Array.isArray(data) ? data : [])
    } catch {
      // silently ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadTickets() }, [companyId])

  useEffect(() => {
    if (!companyId) return
    fetch(`/api/teams/users?companyId=${companyId}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: SupportUser[]) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]))
  }, [companyId])

  const filteredTickets = useMemo(() => {
    const term = query.trim().toLowerCase()
    return tickets
      .filter((t) => statusFilter === "Todos" || t.status === statusFilter)
      .filter((t) => slaFilter === "Todos" || t.slaState === slaFilter)
      .filter((t) => !term || [t.code, t.title, t.customer, t.contact, t.category, t.team, t.assignee ?? "", t.summary ?? "", ...t.tags].some((v) => v.toLowerCase().includes(term)))
  }, [tickets, query, statusFilter, slaFilter])

  const selected = useMemo(
    () => tickets.find((t) => t.id === selectedId) ?? null,
    [tickets, selectedId],
  )

  useEffect(() => {
    if (!selected) return
    setEditStatus(selected.status)
    setEditPriority(selected.priority)
    setEditTeam(selected.team)
    setEditAssignee(selected.assignee ?? "")
  }, [selected?.id])

  const totals = useMemo(() => ({
    open: tickets.filter((t) => t.status !== "Resolvido").length,
    overdue: tickets.filter((t) => t.slaState === "Vencido").length,
    risk: tickets.filter((t) => t.slaState === "Em risco").length,
    total: tickets.length,
  }), [tickets])

  async function createTicket() {
    if (!form.title.trim() || !form.customer.trim()) {
      setFormError("Título e cliente são obrigatórios.")
      return
    }
    setFormError("")
    setFormSaving(true)
    try {
      const res = await fetch("/api/support-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, ...form }),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.error ?? "Erro ao criar ticket"); return }
      setForm(emptyForm)
      setSheetOpen(false)
      setSelectedId(data.id)
      await loadTickets()
    } finally {
      setFormSaving(false)
    }
  }

  async function saveEdits() {
    if (!selected) return
    setSaving(true)
    try {
      const res = await fetch(`/api/support-tickets/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editStatus,
          priority: editPriority,
          team: editTeam,
          assignee: editAssignee,
          authorName: auth?.name ?? "Atendente",
        }),
      })
      const data = await res.json()
      if (!res.ok) return
      setTickets((prev) => prev.map((t) => (t.id === data.id ? data : t)))
    } finally {
      setSaving(false)
    }
  }

  function updateFormPriority(priority: string) {
    setForm((current) => ({
      ...current,
      priority,
      slaDueAt: todayPlusHours(prioritySlaHours(priority)),
    }))
  }

  async function addNote() {
    if (!selected || !note.trim()) return
    setAddingNote(true)
    try {
      const res = await fetch(`/api/support-tickets/${selected.id}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorName: auth?.name ?? "Atendente", text: note.trim() }),
      })
      const data = await res.json()
      if (!res.ok) return
      setNote("")
      setTickets((prev) => prev.map((t) => (t.id === data.id ? data : t)))
    } finally {
      setAddingNote(false)
    }
  }

  const isDirty = selected && (
    editStatus !== selected.status ||
    editPriority !== selected.priority ||
    editTeam !== selected.team ||
    editAssignee !== (selected.assignee ?? "")
  )

  return (
    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
      <div className="grid h-full min-w-[1180px] grid-cols-[340px_minmax(520px,1fr)_300px] gap-2.5 p-2.5 md:p-3">

        {/* ─── Left: list ─────────────────────────────────────────────────── */}
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white shadow-soft">
          <div className="shrink-0 space-y-2 border-b p-3">
            <Button className="h-8 w-full gap-1.5 text-xs" onClick={() => { setForm(emptyForm); setFormError(""); setSheetOpen(true) }}>
              <Plus className="size-3.5" /> Novo ticket
            </Button>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                ["Abertos", totals.open],
                ["Vencidos", totals.overdue],
                ["Risco", totals.risk],
                ["Total", totals.total],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border bg-muted/25 px-2 py-1.5 text-center">
                  <p className="text-sm font-bold">{value}</p>
                  <p className="text-[9px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            <div className="flex h-8 items-center gap-2 rounded-md border bg-white px-2">
              <Search className="size-3.5 text-muted-foreground" />
              <Input
                className="h-7 border-0 px-0 text-xs shadow-none focus-visible:ring-0"
                placeholder="Buscar ticket, cliente, equipe..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                className="h-8 rounded-md border bg-white px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as TicketStatus | "Todos")}
              >
                <option value="Todos">Todos status</option>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                className="h-8 rounded-md border bg-white px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
                value={slaFilter}
                onChange={(e) => setSlaFilter(e.target.value as TicketSlaState | "Todos")}
              >
                {(["Todos", "Vencido", "Em risco", "No prazo"] as const).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {loading && <p className="py-6 text-center text-xs text-muted-foreground">Carregando…</p>}
            {!loading && filteredTickets.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
                <Filter className="size-7 opacity-30" />
                <p className="text-xs">Nenhum ticket encontrado</p>
              </div>
            )}
            {filteredTickets.map((ticket) => {
              const active = selected?.id === ticket.id
              return (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedId(ticket.id)}
                  className={cn(
                    "mb-1.5 w-full rounded-lg border px-2.5 py-2 text-left transition-colors hover:border-primary/40 hover:bg-primary/5",
                    active ? "border-primary/40 bg-primary/5 ring-1 ring-primary/15" : "border-transparent",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold">{ticket.code} · {ticket.customer}</p>
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{ticket.title}</p>
                    </div>
                    <Badge className="shrink-0 px-1.5 py-0 text-[10px]" variant="outline">{ticket.priority}</Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-2">
                    <span className={cn("truncate rounded-full border px-1.5 py-0.5 text-[10px] font-medium", slaColors[ticket.slaState] ?? "")}>
                      {ticket.slaState} · {computeTimeLeft(ticket.slaDueAt)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{ticket.team}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        {/* ─── Center: detail ──────────────────────────────────────────────── */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white shadow-soft">
          {selected ? (
            <>
              <div className="flex shrink-0 items-center gap-3 border-b p-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <LifeBuoy className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-base font-semibold">{selected.title}</h2>
                    <Badge className={cn("shrink-0", statusColors[selected.status] ?? "")} variant="outline">{selected.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{selected.code} · {selected.customer} · {selected.channel}</p>
                </div>
                <Badge className={slaColors[selected.slaState] ?? ""} variant="outline">{selected.slaState}</Badge>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {/* Edit bar */}
                <div className="mb-4 rounded-xl border bg-muted/20 p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Atendimento</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div>
                      <p className="mb-1 text-[10px] text-muted-foreground">Status</p>
                      <Select value={editStatus} onValueChange={setEditStatus}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] text-muted-foreground">Prioridade</p>
                      <Select value={editPriority} onValueChange={setEditPriority}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {supportPriorities.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] text-muted-foreground">Equipe</p>
                      <Select value={editTeam} onValueChange={setEditTeam}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {supportTeams.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] text-muted-foreground">Responsável</p>
                      <AssigneePicker value={editAssignee} users={users} onChange={setEditAssignee} />
                    </div>
                  </div>
                  {isDirty && (
                    <Button size="sm" className="mt-2 h-7 text-xs" onClick={saveEdits} disabled={saving}>
                      {saving ? "Salvando…" : "Salvar alterações"}
                    </Button>
                  )}
                </div>

                {/* Info cards */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { icon: Clock3, label: "SLA", value: computeTimeLeft(selected.slaDueAt) },
                    { icon: ShieldAlert, label: "Prioridade", value: selected.priority },
                    { icon: Users, label: "Equipe", value: selected.team },
                    { icon: UserRound, label: "Responsável", value: selected.assignee ?? "—" },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="min-w-0 rounded-lg border bg-muted/25 p-3 text-center">
                      <Icon className="mx-auto size-3.5 text-primary" />
                      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>

                {selected.summary && (
                  <div className="mt-4 rounded-xl border">
                    <div className="border-b bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Resumo do chamado
                    </div>
                    <div className="space-y-3 p-3">
                      <p className="text-sm leading-6">{selected.summary}</p>
                      {selected.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {selected.tags.map((tag) => (
                            <span key={tag} className="inline-flex items-center gap-1 rounded-full border bg-white px-2 py-0.5 text-[11px] text-muted-foreground">
                              <Tag className="size-2.5" />{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Activity */}
                <div className="mt-4 rounded-xl border">
                  <div className="border-b bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Atividade
                  </div>
                  {/* Add note */}
                  <div className="border-b p-3">
                    <textarea
                      className="min-h-16 w-full resize-none rounded-md border bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring"
                      placeholder="Adicionar nota interna..."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                    <Button
                      size="sm"
                      className="mt-2 h-7 text-xs"
                      disabled={!note.trim() || addingNote}
                      onClick={addNote}
                    >
                      {addingNote ? "Adicionando…" : "Adicionar nota"}
                    </Button>
                  </div>
                  <div className="divide-y">
                    {selected.activity.length === 0 && (
                      <p className="px-3 py-4 text-center text-xs text-muted-foreground">Nenhuma nota ainda.</p>
                    )}
                    {selected.activity.map((entry) => (
                      <div key={entry.id} className="flex gap-3 px-3 py-3">
                        <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold">
                            {entry.authorName}{" "}
                            <span className="font-normal text-muted-foreground">· {formatDateTime(entry.createdAt)}</span>
                          </p>
                          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{entry.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
              <LifeBuoy className="size-8 opacity-20" />
              <p className="text-sm">Selecione um ticket ou crie um novo</p>
            </div>
          )}
        </section>

        {/* ─── Right: sidebar ─────────────────────────────────────────────── */}
        <aside className="min-h-0 space-y-3 overflow-y-auto pr-1">
          {selected && (
            <>
              <div className="overflow-hidden rounded-lg border bg-white shadow-soft">
                <div className="flex items-center gap-2 border-b px-3 py-2.5">
                  <AlertTriangle className="size-3.5 text-primary" />
                  <p className="text-xs font-semibold">SLA e classificação</p>
                </div>
                <div className="divide-y">
                  {[
                    ["SLA limite", formatDateTime(selected.slaDueAt)],
                    ["Estado SLA", selected.slaState],
                    ["Categoria", selected.category],
                    ["Prioridade", selected.priority],
                    ["Última atualização", formatDateTime(selected.updatedAt)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="truncate font-semibold">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border bg-white shadow-soft">
                <div className="flex items-center gap-2 border-b px-3 py-2.5">
                  <Inbox className="size-3.5 text-primary" />
                  <p className="text-xs font-semibold">Origem</p>
                </div>
                <div className="space-y-2 p-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Cliente</p>
                    <p className="font-semibold">{selected.customer}</p>
                    <p className="truncate text-muted-foreground">{selected.contact}</p>
                  </div>
                  {selected.conversationId && (
                    <div>
                      <p className="text-muted-foreground">Conversa</p>
                      <p className="font-mono text-[11px]">{selected.conversationId}</p>
                    </div>
                  )}
                  <Button size="sm" variant="outline" className="w-full">
                    <MessageSquare className="size-3.5" /> Ver conversa
                  </Button>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border bg-white shadow-soft">
                <div className="flex items-center gap-2 border-b px-3 py-2.5">
                  <CheckCircle2 className="size-3.5 text-primary" />
                  <p className="text-xs font-semibold">Equipes com suporte ativo</p>
                </div>
                <div className="divide-y">
                  {supportTeams.map((team) => (
                    <div key={team} className="flex items-center justify-between px-3 py-2 text-xs">
                      <span>{team}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                        <span className="size-1.5 rounded-full bg-emerald-500" />Ativo
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* ─── New ticket sheet ──────────────────────────────────────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader className="mb-4">
            <SheetTitle>Novo ticket de suporte</SheetTitle>
          </SheetHeader>
          <div className="space-y-3">
            {formError && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{formError}</div>
            )}
            <div>
              <label className="mb-1 block text-xs font-medium">Cliente *</label>
              <Input placeholder="Nome do cliente" value={form.customer} onChange={(e) => setForm((f) => ({ ...f, customer: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Contato</label>
              <Input placeholder="E-mail ou telefone" value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Título *</label>
              <Input placeholder="Descreva o problema" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Canal</label>
                <Select value={form.channel} onValueChange={(v) => setForm((f) => ({ ...f, channel: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Categoria</label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{supportCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Prioridade</label>
                <Select value={form.priority} onValueChange={updateFormPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{supportPriorities.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Equipe</label>
                <Select value={form.team} onValueChange={(v) => setForm((f) => ({ ...f, team: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{supportTeams.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Responsável</label>
              <AssigneePicker
                value={form.assignee}
                users={users}
                onChange={(assignee) => setForm((current) => ({ ...current, assignee }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Vencimento do SLA</label>
              <Input type="datetime-local" value={form.slaDueAt} onChange={(e) => setForm((f) => ({ ...f, slaDueAt: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Resumo</label>
              <textarea
                className="min-h-24 w-full resize-none rounded-md border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="Descreva o contexto do chamado..."
                value={form.summary}
                onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setSheetOpen(false)}>Cancelar</Button>
              <Button className="flex-1" disabled={formSaving} onClick={createTicket}>
                {formSaving ? "Criando…" : "Criar ticket"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
