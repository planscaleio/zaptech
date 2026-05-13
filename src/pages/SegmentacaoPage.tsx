import { useState, useEffect, useRef, useCallback } from "react"
import { useAuth } from "@/hooks/useAuth"
import {
  Layers3, Plus, X, Search, Loader2, Users, Pencil,
  Trash2, Check, MoreHorizontal, ChevronRight,
  TrendingUp, Phone, Mail, RefreshCw, Filter, Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Sheet, SheetHeader, SheetContent } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

// ─── Filter definitions ───────────────────────────────────────────────────────

type FilterOperator = { value: string; label: string; inputType: "none" | "text" | "number" | "select" }

interface FilterField {
  value: string
  label: string
  operators: FilterOperator[]
  options?: { value: string; label: string }[]
}

const FILTER_FIELDS: FilterField[] = [
  {
    value: "status",
    label: "Status",
    operators: [{ value: "equals", label: "é", inputType: "select" }],
    options: [
      { value: "QUENTE",     label: "Quente" },
      { value: "NUTRICAO",   label: "Nutrição" },
      { value: "EM_ANALISE", label: "Em análise" },
      { value: "CLIENTE",    label: "Cliente" },
      { value: "INATIVO",    label: "Inativo" },
      { value: "PERDIDO",    label: "Perdido" },
    ],
  },
  {
    value: "stage",
    label: "Etapa",
    operators: [{ value: "equals", label: "é", inputType: "select" }],
    options: [
      { value: "PROSPECCAO",   label: "Prospecção" },
      { value: "QUALIFICACAO", label: "Qualificação" },
      { value: "DEMONSTRACAO", label: "Demonstração" },
      { value: "PROPOSTA",     label: "Proposta" },
      { value: "NEGOCIACAO",   label: "Negociação" },
      { value: "FECHADO",      label: "Fechado" },
      { value: "POS_VENDA",    label: "Pós-venda" },
    ],
  },
  {
    value: "source",
    label: "Origem",
    operators: [{ value: "equals", label: "é", inputType: "select" }],
    options: [
      { value: "WHATSAPP",     label: "WhatsApp" },
      { value: "INSTAGRAM",    label: "Instagram" },
      { value: "SITE",         label: "Site" },
      { value: "CAMPANHA_CRM", label: "Campanha CRM" },
      { value: "EMAIL",        label: "E-mail" },
      { value: "INDICACAO",    label: "Indicação" },
      { value: "ORGANICO",     label: "Orgânico" },
      { value: "OUTRO",        label: "Outro" },
    ],
  },
  {
    value: "aiSentiment",
    label: "Sentimento IA",
    operators: [{ value: "equals", label: "é", inputType: "select" }],
    options: [
      { value: "POSITIVO",  label: "Positivo" },
      { value: "NEUTRO",    label: "Neutro" },
      { value: "NEGATIVO",  label: "Negativo" },
    ],
  },
  {
    value: "aiRisk",
    label: "Risco IA",
    operators: [{ value: "equals", label: "é", inputType: "select" }],
    options: [
      { value: "BAIXO",   label: "Baixo" },
      { value: "MEDIO",   label: "Médio" },
      { value: "ALTO",    label: "Alto" },
      { value: "CRITICO", label: "Crítico" },
    ],
  },
  {
    value: "aiScore",
    label: "Score IA",
    operators: [
      { value: "gte", label: "maior ou igual a", inputType: "number" },
      { value: "lte", label: "menor ou igual a", inputType: "number" },
    ],
  },
  {
    value: "value",
    label: "Valor potencial (R$)",
    operators: [
      { value: "gte", label: "maior ou igual a", inputType: "number" },
      { value: "lte", label: "menor ou igual a", inputType: "number" },
    ],
  },
  {
    value: "lastContactAt",
    label: "Último contato",
    operators: [
      { value: "last_days",  label: "nos últimos X dias",  inputType: "number" },
      { value: "older_days", label: "há mais de X dias",   inputType: "number" },
    ],
  },
  {
    value: "createdAt",
    label: "Cadastrado",
    operators: [
      { value: "last_days", label: "nos últimos X dias", inputType: "number" },
    ],
  },
  {
    value: "hasEmail",
    label: "Tem e-mail",
    operators: [{ value: "equals", label: "é", inputType: "select" }],
    options: [
      { value: "true",  label: "Sim" },
      { value: "false", label: "Não" },
    ],
  },
  {
    value: "hasPhone",
    label: "Tem telefone",
    operators: [{ value: "equals", label: "é", inputType: "select" }],
    options: [
      { value: "true",  label: "Sim" },
      { value: "false", label: "Não" },
    ],
  },
  {
    value: "isVip",
    label: "Cliente VIP",
    operators: [{ value: "equals", label: "é", inputType: "select" }],
    options: [
      { value: "true",  label: "Sim" },
      { value: "false", label: "Não" },
    ],
  },
  {
    value: "isArchived",
    label: "Arquivado",
    operators: [{ value: "equals", label: "é", inputType: "select" }],
    options: [
      { value: "true",  label: "Sim (Inativo ou Perdido)" },
      { value: "false", label: "Não (ativo)" },
    ],
  },
  {
    value: "cardScore",
    label: "Score de lead (CRM)",
    operators: [
      { value: "gte", label: "maior ou igual a", inputType: "number" },
      { value: "lte", label: "menor ou igual a", inputType: "number" },
    ],
  },
  {
    value: "cardValue",
    label: "Valor de oportunidade (R$)",
    operators: [
      { value: "gte", label: "maior ou igual a", inputType: "number" },
      { value: "lte", label: "menor ou igual a", inputType: "number" },
    ],
  },
]

function fieldDef(field: string) {
  return FILTER_FIELDS.find((f) => f.value === field)
}
function operatorDef(field: string, op: string) {
  return fieldDef(field)?.operators.find((o) => o.value === op)
}
function defaultOperator(field: string) {
  return fieldDef(field)?.operators[0]?.value ?? "equals"
}
function defaultValue(field: string, op: string): string {
  const f = fieldDef(field)
  const opDef = operatorDef(field, op)
  if (opDef?.inputType === "select") return f?.options?.[0]?.value ?? ""
  if (opDef?.inputType === "number") return "30"
  return ""
}

function filterLabel(f: SegmentFilter): string {
  const fd = fieldDef(f.field)
  const od = operatorDef(f.field, f.operator)
  const vLabel = fd?.options?.find((o) => o.value === String(f.value))?.label ?? String(f.value)
  return `${fd?.label ?? f.field} ${od?.label ?? f.operator} ${vLabel}`
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SegmentFilter {
  field: string
  operator: string
  value: string | number
}

interface Segment {
  id: string
  name: string
  criteria: string | null
  filters: SegmentFilter[]
  customerCount: number
  createdAt: string
  updatedAt: string
}

interface SegmentCustomer {
  id: string
  name: string
  phone: string | null
  email: string | null
  status: string
  stage: string
  aiScore: number | null
  lastContactAt: string | null
  value: string | null
  segments: { id: string; name: string }[]
}

interface PreviewResult {
  count: number
  sample: { id: string; name: string; status: string; aiScore: number | null; phone: string | null }[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  QUENTE:     { label: "Quente",     cls: "bg-red-50 text-red-700 border-red-200" },
  NUTRICAO:   { label: "Nutrição",   cls: "bg-amber-50 text-amber-700 border-amber-200" },
  EM_ANALISE: { label: "Em análise", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  CLIENTE:    { label: "Cliente",    cls: "bg-green-50 text-green-700 border-green-200" },
  INATIVO:    { label: "Inativo",    cls: "bg-muted text-muted-foreground border-border" },
  PERDIDO:    { label: "Perdido",    cls: "bg-slate-50 text-slate-500 border-slate-200" },
}

const STAGE_LABEL: Record<string, string> = {
  PROSPECCAO: "Prospecção", QUALIFICACAO: "Qualificação", DEMONSTRACAO: "Demonstração",
  PROPOSTA: "Proposta", NEGOCIACAO: "Negociação", FECHADO: "Fechado", POS_VENDA: "Pós-venda",
}

function ScorePill({ score }: { score: number | null }) {
  if (score == null) return <span className="text-xs text-muted-foreground">—</span>
  const cls = score >= 70 ? "bg-green-50 text-green-700 border-green-200"
    : score >= 40 ? "bg-amber-50 text-amber-700 border-amber-200"
    : "bg-slate-50 text-slate-500 border-slate-200"
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] font-medium", cls)}>
      <TrendingUp className="size-2.5" />{score}
    </span>
  )
}

// ─── Filter row component ─────────────────────────────────────────────────────

interface FilterRowProps {
  filter: SegmentFilter
  index: number
  isLast: boolean
  onChange: (index: number, f: SegmentFilter) => void
  onRemove: (index: number) => void
}

function FilterRow({ filter, index, isLast, onChange, onRemove }: FilterRowProps) {
  const fd = fieldDef(filter.field)
  const od = operatorDef(filter.field, filter.operator)

  return (
    <div className="flex items-start gap-2">
      {/* AND label */}
      <div className="mt-2 w-8 shrink-0 text-right text-[10px] font-semibold uppercase text-muted-foreground">
        {index === 0 ? "SE" : "E"}
      </div>

      <div className="flex flex-1 flex-wrap items-center gap-1.5 rounded-xl border bg-white p-2 shadow-sm">
        {/* Field */}
        <select
          value={filter.field}
          onChange={(e) => {
            const newField = e.target.value
            const newOp = defaultOperator(newField)
            onChange(index, { field: newField, operator: newOp, value: defaultValue(newField, newOp) })
          }}
          className="h-7 rounded-md border bg-muted/30 px-2 text-xs font-medium outline-none focus:border-primary"
        >
          {FILTER_FIELDS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>

        {/* Operator */}
        {(fd?.operators.length ?? 0) > 1 && (
          <select
            value={filter.operator}
            onChange={(e) => {
              const newOp = e.target.value
              onChange(index, { ...filter, operator: newOp, value: defaultValue(filter.field, newOp) })
            }}
            className="h-7 rounded-md border bg-muted/30 px-2 text-xs text-muted-foreground outline-none focus:border-primary"
          >
            {fd?.operators.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}
        {(fd?.operators.length ?? 0) === 1 && (
          <span className="text-xs text-muted-foreground">{fd?.operators[0].label}</span>
        )}

        {/* Value */}
        {od?.inputType === "select" && (
          <select
            value={String(filter.value)}
            onChange={(e) => onChange(index, { ...filter, value: e.target.value })}
            className="h-7 rounded-md border bg-primary/5 px-2 text-xs font-semibold text-primary outline-none focus:border-primary"
          >
            {fd?.options?.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}
        {od?.inputType === "number" && (
          <input
            type="number"
            value={String(filter.value)}
            onChange={(e) => onChange(index, { ...filter, value: e.target.value })}
            className="h-7 w-20 rounded-md border bg-primary/5 px-2 text-xs font-semibold text-primary outline-none focus:border-primary"
            min={0}
          />
        )}
      </div>

      {/* Remove */}
      <button
        onClick={() => onRemove(index)}
        className="mt-2 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

// ─── Segment Sheet ────────────────────────────────────────────────────────────

interface SegmentSheetProps {
  open: boolean
  editing: Segment | null
  companyId: string
  onClose: () => void
  onSave: (segment: Segment) => void
}

function SegmentSheet({ open, editing, companyId, onClose, onSave }: SegmentSheetProps) {
  const [name, setName] = useState("")
  const [filters, setFilters] = useState<SegmentFilter[]>([])
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "")
      setFilters(editing?.filters ?? [])
      setPreview(null)
      setError(null)
    }
  }, [open, editing])

  // Auto-preview when filters change
  const runPreview = useCallback(async (currentFilters: SegmentFilter[]) => {
    if (!companyId || currentFilters.length === 0) { setPreview(null); return }
    setPreviewing(true)
    try {
      const segId = editing?.id ?? "_preview"
      const res = await fetch(`/api/segments/${segId}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, filters: currentFilters }),
      })
      if (res.ok) setPreview(await res.json())
    } catch {} finally {
      setPreviewing(false)
    }
  }, [companyId, editing?.id])

  useEffect(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current)
    previewTimer.current = setTimeout(() => runPreview(filters), 600)
    return () => { if (previewTimer.current) clearTimeout(previewTimer.current) }
  }, [filters, runPreview])

  function addFilter() {
    const field = FILTER_FIELDS[0].value
    const op = defaultOperator(field)
    setFilters((prev) => [...prev, { field, operator: op, value: defaultValue(field, op) }])
  }

  function updateFilter(index: number, f: SegmentFilter) {
    setFilters((prev) => prev.map((existing, i) => i === index ? f : existing))
  }

  function removeFilter(index: number) {
    setFilters((prev) => prev.filter((_, i) => i !== index))
  }

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const url = editing ? `/api/segments/${editing.id}` : "/api/segments"
      const method = editing ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, name: name.trim(), filters }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "Erro ao salvar")
      }
      onSave(await res.json())
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro desconhecido")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Layers3 className="size-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{editing ? "Editar segmento" : "Novo segmento"}</p>
          <p className="text-xs text-muted-foreground">
            Defina os filtros — clientes que derem match entram automaticamente
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 transition-colors"
        >
          <X className="size-4" />
        </button>
      </SheetHeader>

      <SheetContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-5">

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Nome do segmento
            </label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Clientes VIP, Leads novos, Inativos 90 dias…"
              className="text-sm"
            />
          </div>

          {/* Filter builder */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Filtros{" "}
                <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 font-normal normal-case">
                  {filters.length}
                </span>
              </label>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={addFilter}>
                <Plus className="size-3" /> Adicionar filtro
              </Button>
            </div>

            {filters.length === 0 && (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-6 text-center text-muted-foreground">
                <Filter className="size-6 opacity-30" />
                <p className="text-xs">Nenhum filtro adicionado</p>
                <p className="text-[11px] opacity-70">Sem filtros, nenhum cliente entra no segmento</p>
              </div>
            )}

            <div className="space-y-2">
              {filters.map((f, i) => (
                <FilterRow
                  key={i}
                  filter={f}
                  index={i}
                  isLast={i === filters.length - 1}
                  onChange={updateFilter}
                  onRemove={removeFilter}
                />
              ))}
            </div>
          </div>

          {/* Live preview */}
          {filters.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Prévia do segmento
                </label>
                {previewing && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
              </div>

              {preview ? (
                <div className="overflow-hidden rounded-xl border">
                  {/* Count banner */}
                  <div className="flex items-center justify-between bg-primary/5 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Users className="size-4 text-primary" />
                      <span className="text-sm font-semibold text-primary">{preview.count} clientes</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">correspondem aos filtros</span>
                  </div>
                  {/* Sample */}
                  {preview.sample.map((c) => {
                    const st = STATUS_LABEL[c.status]
                    return (
                      <div key={c.id} className="flex items-center gap-3 border-t px-3 py-2">
                        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">{c.name}</p>
                          {c.phone && <p className="text-[10px] text-muted-foreground">{c.phone}</p>}
                        </div>
                        {st && (
                          <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-medium", st.cls)}>
                            {st.label}
                          </span>
                        )}
                        <ScorePill score={c.aiScore} />
                      </div>
                    )
                  })}
                  {preview.count > 5 && (
                    <div className="border-t bg-muted/30 px-3 py-2 text-[11px] text-center text-muted-foreground">
                      + {preview.count - 5} outros clientes
                    </div>
                  )}
                </div>
              ) : !previewing ? (
                <div className="rounded-xl border bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
                  Nenhum cliente corresponde a estes filtros
                </div>
              ) : null}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Info */}
          <div className="rounded-xl border bg-primary/5 p-3">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <p className="text-xs font-semibold text-primary">Segmento dinâmico</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Os filtros são avaliados ao salvar e a lista é atualizada automaticamente. Todos os filtros são combinados com lógica E (AND).
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 flex items-center justify-between gap-3 border-t bg-muted/20 px-4 py-3">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!name.trim() || saving} onClick={save}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            {editing ? "Salvar e re-sincronizar" : "Criar segmento"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SegmentacaoPage() {
  const { companyId } = useAuth() ?? {}

  const [segments, setSegments] = useState<Segment[]>([])
  const [loadingSegments, setLoadingSegments] = useState(true)
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null)
  const [segSearch, setSegSearch] = useState("")

  const [customers, setCustomers] = useState<SegmentCustomer[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [custSearch, setCustSearch] = useState("")
  const [custRefresh, setCustRefresh] = useState(0)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null)

  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    if (!companyId) return
    setLoadingSegments(true)
    fetch(`/api/segments?companyId=${companyId}`)
      .then((r) => r.json())
      .then((d: Segment[]) => { setSegments(d); if (d.length > 0) setSelectedSegment(d[0]) })
      .catch(() => {})
      .finally(() => setLoadingSegments(false))
  }, [companyId])

  useEffect(() => {
    if (!selectedSegment) { setCustomers([]); return }
    setLoadingCustomers(true)
    setCustSearch("")
    fetch(`/api/segments/${selectedSegment.id}/customers`)
      .then((r) => r.json())
      .then((d: SegmentCustomer[]) => setCustomers(d))
      .catch(() => {})
      .finally(() => setLoadingCustomers(false))
  }, [selectedSegment?.id, custRefresh])

  useEffect(() => {
    function h(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(null)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  const filteredSegments = segments.filter(
    (s) => !segSearch.trim() || s.name.toLowerCase().includes(segSearch.toLowerCase())
  )

  const filteredCustomers = customers.filter(
    (c) => !custSearch.trim() || c.name.toLowerCase().includes(custSearch.toLowerCase())
  )

  function openCreate() {
    setEditingSegment(null)
    setSheetOpen(true)
  }

  function openEdit(s: Segment) {
    setEditingSegment(s)
    setMenuOpen(null)
    setSheetOpen(true)
  }

  function handleSaved(segment: Segment) {
    setSegments((prev) => {
      const idx = prev.findIndex((s) => s.id === segment.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = segment
        return next
      }
      return [...prev, segment]
    })
    setSelectedSegment(segment)
    setCustRefresh((n) => n + 1)
  }

  async function resync(seg: Segment) {
    if (!companyId || seg.filters.length === 0) return
    setSyncing(true)
    try {
      const res = await fetch(`/api/segments/${seg.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, name: seg.name, filters: seg.filters }),
      })
      if (res.ok) {
        const updated: Segment = await res.json()
        handleSaved(updated)
        // Reload customers
        const custRes = await fetch(`/api/segments/${seg.id}/customers`)
        if (custRes.ok) setCustomers(await custRes.json())
      }
    } catch {} finally {
      setSyncing(false)
    }
  }

  async function deleteSegment(id: string) {
    if (!confirm("Excluir este segmento? Os clientes não serão removidos.")) return
    setDeletingId(id)
    setMenuOpen(null)
    await fetch(`/api/segments/${id}`, { method: "DELETE" }).catch(() => {})
    setSegments((prev) => {
      const next = prev.filter((s) => s.id !== id)
      if (selectedSegment?.id === id) setSelectedSegment(next[0] ?? null)
      return next
    })
    setDeletingId(null)
  }

  return (
    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
      <div className="grid h-full min-w-[1100px] grid-cols-[280px_minmax(560px,1fr)_280px] gap-2.5 p-2.5 md:p-3">

        {/* ── Left sidebar: segment list ── */}
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white shadow-soft">
          <div className="shrink-0 space-y-2 border-b p-3">
            <div className="flex h-8 items-center gap-2 rounded-md border bg-white px-2">
              <Search className="size-3.5 text-muted-foreground" />
              <Input
                className="h-7 border-0 px-0 text-xs shadow-none focus-visible:ring-0"
                placeholder="Buscar segmento…"
                value={segSearch}
                onChange={(e) => setSegSearch(e.target.value)}
              />
            </div>
            <Button size="sm" className="w-full" onClick={openCreate}>
              <Plus className="size-3.5" /> Novo segmento
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2 space-y-1">
            {loadingSegments && (
              <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
              </div>
            )}
            {!loadingSegments && filteredSegments.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
                <Layers3 className="size-7 opacity-30" />
                <p className="text-xs">{segSearch ? "Nenhum resultado" : "Nenhum segmento criado"}</p>
              </div>
            )}
            {filteredSegments.map((seg) => (
              <button
                key={seg.id}
                onClick={() => setSelectedSegment(seg)}
                className={cn(
                  "w-full rounded-lg border px-2.5 py-2 text-left transition-colors hover:border-primary/40 hover:bg-primary/5",
                  selectedSegment?.id === seg.id
                    ? "border-primary/40 bg-primary/5 ring-1 ring-primary/15"
                    : "border-transparent"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-semibold">{seg.name}</p>
                  <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {seg.customerCount}
                  </span>
                </div>
                {seg.filters.length > 0 ? (
                  <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-1">
                    {seg.filters.map(filterLabel).join(" · ")}
                  </p>
                ) : (
                  <p className="mt-0.5 text-[10px] text-muted-foreground/50 italic">Sem filtros</p>
                )}
              </button>
            ))}
          </div>
        </aside>

        {/* ── Main section ── */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white shadow-soft">
          {/* Header */}
          <div className="flex shrink-0 flex-wrap items-center gap-2.5 border-b p-2.5">
            {selectedSegment ? (
              <>
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Layers3 className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-semibold">{selectedSegment.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {selectedSegment.filters.length > 0
                      ? `${selectedSegment.filters.length} filtro${selectedSegment.filters.length > 1 ? "s" : ""} · ${selectedSegment.customerCount} clientes`
                      : "Nenhum filtro configurado"}
                  </p>
                </div>
                <div className="flex h-8 w-44 items-center gap-2 rounded-md border bg-white px-2">
                  <Search className="size-3.5 text-muted-foreground" />
                  <Input
                    className="h-7 border-0 px-0 text-xs shadow-none focus-visible:ring-0"
                    placeholder="Buscar cliente…"
                    value={custSearch}
                    onChange={(e) => setCustSearch(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={syncing || selectedSegment.filters.length === 0}
                  onClick={() => resync(selectedSegment)}
                  title="Re-sincronizar membros com os filtros atuais"
                >
                  <RefreshCw className={cn("size-3.5", syncing && "animate-spin")} />
                  Re-sincronizar
                </Button>
                <Button size="sm" onClick={() => openEdit(selectedSegment)}>
                  <Filter className="size-3.5" /> Filtros
                </Button>
              </>
            ) : (
              <>
                <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Layers3 className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-semibold text-muted-foreground">Selecione um segmento</h2>
                  <p className="text-xs text-muted-foreground">Clique em um segmento ao lado para ver os clientes</p>
                </div>
                <Button size="sm" onClick={openCreate}>
                  <Plus className="size-3.5" /> Novo segmento
                </Button>
              </>
            )}
          </div>

          {/* Active filters strip */}
          {selectedSegment && selectedSegment.filters.length > 0 && (
            <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b bg-muted/30 px-3 py-2">
              <span className="text-[11px] font-semibold text-muted-foreground">Filtros:</span>
              {selectedSegment.filters.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full border bg-white px-2 py-0.5 text-[11px] text-foreground/70">
                  <span className="size-1.5 rounded-full bg-primary/50" />
                  {filterLabel(f)}
                </span>
              ))}
            </div>
          )}

          {/* Table header */}
          <div className="grid shrink-0 grid-cols-[minmax(0,2fr)_140px_120px_100px_120px_60px] border-b bg-muted/45 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span>Cliente</span>
            <span>Contato</span>
            <span>Status</span>
            <span>Etapa</span>
            <span>Outros segmentos</span>
            <span>Ações</span>
          </div>

          {/* Table body */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loadingCustomers && (
              <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                <span className="text-sm">Carregando clientes…</span>
              </div>
            )}
            {!loadingCustomers && !selectedSegment && (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-muted-foreground">
                <Layers3 className="size-10 opacity-20" />
                <p className="text-sm">Selecione um segmento na lista ao lado</p>
              </div>
            )}
            {!loadingCustomers && selectedSegment && filteredCustomers.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
                <div className="flex size-12 items-center justify-center rounded-xl bg-muted/50">
                  <Users className="size-5 opacity-40" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {custSearch ? "Nenhum cliente encontrado" : "Segmento vazio"}
                  </p>
                  <p className="mt-0.5 text-xs opacity-70">
                    {custSearch
                      ? "Tente outro nome"
                      : selectedSegment.filters.length === 0
                        ? "Adicione filtros para popular o segmento automaticamente"
                        : "Nenhum cliente corresponde aos filtros atuais"}
                  </p>
                </div>
                {!custSearch && (
                  <Button size="sm" onClick={() => openEdit(selectedSegment)}>
                    <Filter className="size-3.5" /> Configurar filtros
                  </Button>
                )}
              </div>
            )}

            {filteredCustomers.map((customer) => {
              const st = STATUS_LABEL[customer.status] ?? { label: customer.status, cls: "bg-muted text-muted-foreground border-border" }
              const otherSegs = customer.segments.filter((s) => s.id !== selectedSegment?.id)
              return (
                <div
                  key={customer.id}
                  className="grid grid-cols-[minmax(0,2fr)_140px_120px_100px_120px_60px] items-center gap-3 border-b px-3 py-1.5 hover:bg-muted/45"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      {customer.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{customer.name}</p>
                      <ScorePill score={customer.aiScore} />
                    </div>
                  </div>

                  <div className="space-y-0.5 min-w-0">
                    {customer.phone && (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Phone className="size-2.5 shrink-0" />
                        <span className="truncate">{customer.phone}</span>
                      </div>
                    )}
                    {customer.email && (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Mail className="size-2.5 shrink-0" />
                        <span className="truncate">{customer.email}</span>
                      </div>
                    )}
                    {!customer.phone && !customer.email && <span className="text-xs text-muted-foreground">—</span>}
                  </div>

                  <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium", st.cls)}>
                    {st.label}
                  </span>

                  <span className="text-xs text-muted-foreground">{STAGE_LABEL[customer.stage] ?? customer.stage}</span>

                  <div className="flex flex-wrap gap-1">
                    {otherSegs.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                    {otherSegs.slice(0, 2).map((s) => (
                      <span key={s.id} className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {s.name}
                      </span>
                    ))}
                    {otherSegs.length > 2 && (
                      <span className="text-[10px] text-muted-foreground">+{otherSegs.length - 2}</span>
                    )}
                  </div>

                  <div
                    className="relative flex items-center"
                    ref={menuOpen === customer.id ? menuRef : undefined}
                  >
                    <button
                      onClick={() => setMenuOpen(menuOpen === customer.id ? null : customer.id)}
                      className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors"
                    >
                      <MoreHorizontal className="size-3" />
                    </button>
                    {menuOpen === customer.id && (
                      <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border bg-white shadow-xl">
                        <a
                          href={`/clientes`}
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-muted/50"
                        >
                          <Users className="size-3.5 text-muted-foreground" /> Ver cliente
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Right aside ── */}
        <aside className="min-h-0 space-y-3 overflow-y-auto pr-1">
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle>{selectedSegment?.name ?? "Nenhum selecionado"}</CardTitle>
              <CardDescription>
                {selectedSegment
                  ? `Criado em ${new Date(selectedSegment.createdAt).toLocaleDateString("pt-BR")}`
                  : "Selecione um segmento"}
              </CardDescription>
            </CardHeader>
            {selectedSegment && (
              <CardContent className="space-y-2 p-3 pt-0">
                {[
                  ["Clientes", String(selectedSegment.customerCount)],
                  ["Filtros ativos", String(selectedSegment.filters.length)],
                  ["Atualizado", new Date(selectedSegment.updatedAt).toLocaleDateString("pt-BR")],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between border-b pb-2 last:border-b-0 last:pb-0">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <span className="text-sm font-medium">{value}</span>
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => openEdit(selectedSegment)}>
                    <Pencil className="size-3" /> Editar filtros
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => deleteSegment(selectedSegment.id)}
                    disabled={!!deletingId}
                  >
                    {deletingId === selectedSegment.id
                      ? <Loader2 className="size-3 animate-spin" />
                      : <Trash2 className="size-3" />}
                    Excluir
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle>Visão geral</CardTitle>
              <CardDescription>Todos os segmentos ativos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-3 pt-0">
              {[
                ["Total de segmentos", String(segments.length)],
                ["Total de clientes", String(segments.reduce((a, s) => a + s.customerCount, 0))],
                ["Maior segmento", segments.length > 0
                  ? segments.reduce((a, b) => a.customerCount >= b.customerCount ? a : b).name
                  : "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 border-b pb-2 last:border-b-0 last:pb-0">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-right text-sm font-medium truncate max-w-[120px]">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {segments.length > 0 && (
            <Card>
              <CardHeader className="p-3 pb-2">
                <CardTitle>Todos os segmentos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 p-3 pt-0">
                {segments.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSegment(s)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/50",
                      selectedSegment?.id === s.id && "bg-primary/5"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ChevronRight className={cn("size-3 shrink-0 text-muted-foreground/40", selectedSegment?.id === s.id && "text-primary")} />
                      <span className="truncate text-xs">{s.name}</span>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{s.customerCount}</span>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </aside>
      </div>

      <SegmentSheet
        open={sheetOpen}
        editing={editingSegment}
        companyId={companyId ?? ""}
        onClose={() => setSheetOpen(false)}
        onSave={handleSaved}
      />
    </div>
  )
}
