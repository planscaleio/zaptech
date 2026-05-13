import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/hooks/useAuth"
import {
  Plus, Trash2, Pencil, X, Loader2,
  LayoutDashboard, ChevronRight, MoreHorizontal, Check,
  Settings, SlidersHorizontal, Kanban, Search,
  CircleDot, Sparkles, Wand2, ArrowLeft, Clock, Info,
  RefreshCw, ChevronDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Sheet, SheetHeader, SheetContent } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface PipelineColumn {
  id: string
  name: string
  color: string
  sortOrder: number
  probability: number | null
  slaHours: number | null
}

interface Pipeline {
  id: string
  name: string
  sortOrder: number
  columns: PipelineColumn[]
}

interface AiColumn {
  name: string
  color: string
  description: string
  sla_days: number | null
  sla_label: string | null
}

interface AiSuggestion {
  name: string
  rationale: string
  columns: AiColumn[]
}

// ─── Color palette ────────────────────────────────────────────────────────────

const COLOR_OPTIONS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
  "#64748b", "#78716c",
]

const DEFAULT_COLUMNS = [
  { name: "Prospecção",   color: "#6366f1" },
  { name: "Qualificação", color: "#8b5cf6" },
  { name: "Proposta",     color: "#f97316" },
  { name: "Negociação",   color: "#eab308" },
  { name: "Fechado",      color: "#22c55e" },
]

// ─── AI Sheet (3-step flow) ───────────────────────────────────────────────────

type AiStep = "input" | "generating" | "review"

interface AiSheetProps {
  open: boolean
  onClose: () => void
  onApply: (suggestion: AiSuggestion) => void
}

function AiPipelineSheet({ open, onClose, onApply }: AiSheetProps) {
  const [step, setStep] = useState<AiStep>("input")
  const [description, setDescription] = useState("")
  const [suggestion, setSuggestion] = useState<AiSuggestion | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dots, setDots] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Animate dots while generating
  useEffect(() => {
    if (step !== "generating") return
    const t = setInterval(() => setDots((d) => (d + 1) % 4), 500)
    return () => clearInterval(t)
  }, [step])

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep("input")
      setDescription("")
      setSuggestion(null)
      setError(null)
    }
  }, [open])

  async function generate() {
    if (!description.trim()) return
    setStep("generating")
    setError(null)
    try {
      const res = await fetch("/api/pipelines/ai-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? "Erro ao gerar sugestão")
      }
      const data: AiSuggestion = await res.json()
      setSuggestion(data)
      setStep("review")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro desconhecido")
      setStep("input")
    }
  }

  function handleApply() {
    if (!suggestion) return
    onApply(suggestion)
    onClose()
  }

  const EXAMPLE_PROMPTS = [
    "Pipeline de vendas B2B para software SaaS com ciclo longo",
    "Funil de pós-venda e sucesso do cliente",
    "Pipeline de recrutamento e seleção de talentos",
    "Processo de prospecção outbound com SDR e AE",
  ]

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Wand2 className="size-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Criar pipeline com IA</p>
          <p className="text-xs text-muted-foreground">
            {step === "input" && "Descreva o objetivo e a IA monta as etapas"}
            {step === "generating" && "Analisando e estruturando seu pipeline…"}
            {step === "review" && "Revise a proposta antes de criar"}
          </p>
        </div>
        {step !== "generating" && (
          <button
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 transition-colors"
          >
            <X className="size-4" />
          </button>
        )}
      </SheetHeader>

      <SheetContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">

        {/* ── Step: Input ── */}
        {step === "input" && (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 gap-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Descreva o objetivo do pipeline
              </label>
              <textarea
                ref={textareaRef}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate() }}
                placeholder="Ex: Precisamos de um pipeline para gestão de leads inbound do marketing, com qualificação de perfil, demos e negociação. Nosso ciclo médio é de 30 dias e trabalhamos com contratos anuais…"
                className="w-full resize-none rounded-xl border bg-white px-3.5 py-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/10"
                rows={5}
                autoFocus
              />
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground">Quanto mais detalhes, melhor a proposta · ⌘+Enter para gerar</p>
                <span className={cn("text-[11px]", description.length > 500 ? "text-amber-500" : "text-muted-foreground")}>
                  {description.length}/600
                </span>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-700">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                {error}
              </div>
            )}

            {/* Example prompts */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Exemplos de uso</p>
              <div className="grid grid-cols-1 gap-1.5">
                {EXAMPLE_PROMPTS.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setDescription(ex)}
                    className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-left text-xs text-foreground/70 transition-colors hover:bg-muted/60 hover:text-foreground"
                  >
                    <ChevronRight className="size-3 shrink-0 text-primary/60" />
                    {ex}
                  </button>
                ))}
              </div>
            </div>

            {/* Info box */}
            <div className="rounded-xl border bg-primary/5 p-3">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                <div>
                  <p className="text-xs font-semibold text-primary">O que a IA vai propor</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Etapas com nome, cor, descrição e SLA recomendado. Você poderá revisar e ajustar tudo antes de criar.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step: Generating ── */}
        {step === "generating" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
            <div className="relative">
              <div className="flex size-20 items-center justify-center rounded-2xl bg-primary/10">
                <Sparkles className="size-9 text-primary" />
              </div>
              <div className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-white border-2 border-primary/20">
                <Loader2 className="size-3.5 text-primary animate-spin" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold">Analisando seu processo{".".repeat(dots)}</p>
              <p className="mt-1.5 max-w-xs text-xs leading-5 text-muted-foreground">
                A IA está estruturando as etapas, definindo cores e calculando SLAs com base na descrição fornecida.
              </p>
            </div>
            <div className="flex gap-1.5">
              {["Estruturando etapas", "Definindo SLAs", "Escolhendo cores"].map((label, i) => (
                <div
                  key={label}
                  className="rounded-full bg-muted/60 px-2.5 py-1 text-[11px] text-muted-foreground animate-pulse"
                  style={{ animationDelay: `${i * 0.3}s` }}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Step: Review ── */}
        {step === "review" && suggestion && (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 gap-5">
            {/* Pipeline name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Nome do pipeline
              </label>
              <Input
                value={suggestion.name}
                onChange={(e) => setSuggestion({ ...suggestion, name: e.target.value })}
                className="text-sm font-medium"
              />
            </div>

            {/* Rationale */}
            <div className="flex items-start gap-2.5 rounded-xl border bg-cyan-50 p-3">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-cyan-600" />
              <p className="text-xs leading-5 text-cyan-900">{suggestion.rationale}</p>
            </div>

            {/* Columns */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Etapas propostas <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 font-normal">{suggestion.columns.length}</span>
                </label>
                <button
                  onClick={() => { setStep("input") }}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted/60 transition-colors"
                >
                  <RefreshCw className="size-3" /> Regerar
                </button>
              </div>

              <div className="space-y-2">
                {suggestion.columns.map((col, idx) => (
                  <div key={idx} className="overflow-hidden rounded-xl border bg-white shadow-sm">
                    {/* Column header */}
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      {/* Color + order */}
                      <div className="relative group/color shrink-0">
                        <button
                          style={{ background: col.color }}
                          className="flex size-7 items-center justify-center rounded-lg border-2 border-white shadow ring-1 ring-black/10 text-white font-bold text-[11px]"
                        >
                          {idx + 1}
                        </button>
                        <div className="absolute left-0 top-full z-50 mt-1.5 hidden grid-cols-6 gap-1 rounded-xl border bg-white p-2 shadow-xl group-focus-within/color:grid group-hover/color:grid">
                          {COLOR_OPTIONS.map((c) => (
                            <button
                              key={c}
                              onClick={() => {
                                const cols = [...suggestion.columns]
                                cols[idx] = { ...cols[idx], color: c }
                                setSuggestion({ ...suggestion, columns: cols })
                              }}
                              style={{ background: c }}
                              className={cn(
                                "size-5 rounded-full border-2 transition-transform hover:scale-110",
                                col.color === c ? "border-white ring-2 ring-primary" : "border-transparent"
                              )}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Name */}
                      <Input
                        value={col.name}
                        onChange={(e) => {
                          const cols = [...suggestion.columns]
                          cols[idx] = { ...cols[idx], name: e.target.value }
                          setSuggestion({ ...suggestion, columns: cols })
                        }}
                        className="h-7 flex-1 border-0 px-1 text-sm font-medium shadow-none focus-visible:ring-0"
                      />

                      {/* SLA badge */}
                      {col.sla_label && (
                        <div className="flex shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5">
                          <Clock className="size-2.5 text-amber-500" />
                          <span className="text-[10px] font-medium text-amber-700">{col.sla_label}</span>
                        </div>
                      )}

                      {/* Remove */}
                      <button
                        onClick={() => {
                          setSuggestion({ ...suggestion, columns: suggestion.columns.filter((_, i) => i !== idx) })
                        }}
                        disabled={suggestion.columns.length <= 2}
                        className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-20"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>

                    {/* Description */}
                    {col.description && (
                      <div className="border-t bg-muted/20 px-3 py-2">
                        <p className="text-[11px] leading-4 text-muted-foreground">{col.description}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add column */}
              <button
                onClick={() => {
                  const idx = suggestion.columns.length % COLOR_OPTIONS.length
                  setSuggestion({
                    ...suggestion,
                    columns: [...suggestion.columns, {
                      name: "Nova etapa",
                      color: COLOR_OPTIONS[idx],
                      description: "",
                      sla_days: null,
                      sla_label: null,
                    }],
                  })
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-2.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
              >
                <Plus className="size-3.5" /> Adicionar etapa
              </button>
            </div>

            {/* Funnel preview */}
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Prévia do funil</p>
              <div className="flex items-center overflow-x-auto rounded-xl border bg-muted/30 p-2 gap-0">
                {suggestion.columns.map((col, idx) => (
                  <div key={idx} className="flex items-center shrink-0">
                    <div className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 shadow-sm">
                      <span className="size-2 rounded-full shrink-0" style={{ background: col.color }} />
                      <span className="whitespace-nowrap text-xs font-medium">{col.name || "…"}</span>
                    </div>
                    {idx < suggestion.columns.length - 1 && (
                      <ChevronRight className="mx-0.5 size-3.5 shrink-0 text-muted-foreground/40" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* SLA notice */}
            <div className="rounded-xl border bg-amber-50 p-3">
              <div className="flex items-start gap-2">
                <Clock className="mt-0.5 size-4 shrink-0 text-amber-500" />
                <div>
                  <p className="text-xs font-semibold text-amber-700">SLAs por etapa</p>
                  <p className="mt-0.5 text-xs text-amber-600/80">
                    Os SLAs propostos são uma referência. Você poderá configurar alertas e automações por etapa após a criação do pipeline.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        {step !== "generating" && (
          <div className="shrink-0 flex items-center justify-between gap-3 border-t bg-muted/20 px-4 py-3">
            {step === "review" ? (
              <>
                <Button variant="outline" onClick={() => setStep("input")}>
                  <ArrowLeft className="size-3.5" /> Voltar
                </Button>
                <Button
                  disabled={!suggestion || suggestion.columns.length === 0 || !suggestion.name.trim()}
                  onClick={handleApply}
                  className="gap-2"
                >
                  <Check className="size-3.5" /> Criar pipeline
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={onClose}>Cancelar</Button>
                <Button
                  disabled={!description.trim() || description.length > 600}
                  onClick={generate}
                  className="gap-2"
                >
                  <Wand2 className="size-3.5" /> Gerar com IA
                </Button>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

export default function PipelinesPage() {
  const { companyId } = useAuth() ?? {}
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Pipeline | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [aiSheetOpen, setAiSheetOpen] = useState(false)
  const [editingPipeline, setEditingPipeline] = useState<Pipeline | null>(null)
  const [saving, setSaving] = useState(false)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const menuRef = useRef<HTMLDivElement>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  const createMenuRef = useRef<HTMLDivElement>(null)

  // Sheet form
  const [pipelineName, setPipelineName] = useState("")
  const [columns, setColumns] = useState<{ id: string; name: string; color: string; probability: number | null; slaHours: number | null }[]>([])

  // Load
  useEffect(() => {
    if (!companyId) return
    setLoading(true)
    fetch(`/api/pipelines?companyId=${companyId}`)
      .then((r) => r.json())
      .then((d: Pipeline[]) => { setPipelines(d); if (d.length > 0) setSelected(d[0]) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [companyId])

  // Close menus on outside click
  useEffect(() => {
    function h(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(null)
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) setCreateMenuOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  const filtered = pipelines.filter((p) =>
    !search.trim() || p.name.toLowerCase().includes(search.toLowerCase())
  )

  function openCreate() {
    setEditingPipeline(null)
    setPipelineName("")
    setColumns(DEFAULT_COLUMNS.map((c, i) => ({ id: `new-${i}`, name: c.name, color: c.color, probability: null, slaHours: null })))
    setSheetOpen(true)
    setCreateMenuOpen(false)
  }

  function openAiCreate() {
    setAiSheetOpen(true)
    setCreateMenuOpen(false)
  }

  function openEdit(p: Pipeline) {
    setEditingPipeline(p)
    setPipelineName(p.name)
    setColumns(p.columns.map((c) => ({ id: c.id, name: c.name, color: c.color, probability: c.probability, slaHours: c.slaHours })))
    setMenuOpen(null)
    setSheetOpen(true)
  }

  function addColumn() {
    const idx = columns.length % COLOR_OPTIONS.length
    setColumns((prev) => [...prev, { id: `new-${Date.now()}`, name: "Nova coluna", color: COLOR_OPTIONS[idx], probability: null, slaHours: null }])
  }

  function updateColumn(id: string, field: string, value: string | number | null) {
    setColumns((prev) => prev.map((c) => c.id === id ? { ...c, [field]: value } : c))
  }

  function removeColumn(id: string) {
    setColumns((prev) => prev.filter((c) => c.id !== id))
  }

  function moveColumn(idx: number, dir: -1 | 1) {
    const next = idx + dir
    if (next < 0 || next >= columns.length) return
    setColumns((prev) => {
      const arr = [...prev]
      ;[arr[idx], arr[next]] = [arr[next], arr[idx]]
      return arr
    })
  }

  async function savePipeline() {
    if (!pipelineName.trim() || !companyId) return
    setSaving(true)
    try {
      if (editingPipeline) {
        await fetch(`/api/pipelines/boards/${editingPipeline.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: pipelineName.trim() }),
        })
        // Persist column changes for existing columns
        await Promise.all(
          columns
            .filter((c) => !c.id.startsWith("new-"))
            .map((c) =>
              fetch(`/api/pipelines/columns/${c.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: c.name, color: c.color, probability: c.probability, slaHours: c.slaHours }),
              })
            )
        )
        const updated: Pipeline = {
          ...editingPipeline,
          name: pipelineName.trim(),
          columns: columns.map((c, i) => ({ id: c.id, name: c.name, color: c.color, sortOrder: i, probability: c.probability, slaHours: c.slaHours })),
        }
        setPipelines((prev) => prev.map((p) => p.id === editingPipeline.id ? updated : p))
        if (selected?.id === editingPipeline.id) setSelected(updated)
      } else {
        const res = await fetch("/api/pipelines/boards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId,
            name: pipelineName.trim(),
            columns: columns.map((c, i) => ({ name: c.name, color: c.color, sortOrder: i, probability: c.probability, slaHours: c.slaHours })),
          }),
        })
        if (res.ok) {
          const created: Pipeline = await res.json()
          setPipelines((prev) => [...prev, created])
          setSelected(created)
        }
      }
      setSheetOpen(false)
    } catch {} finally {
      setSaving(false)
    }
  }

  async function handleAiApply(suggestion: AiSuggestion) {
    if (!companyId) return
    setSaving(true)
    try {
      const res = await fetch("/api/pipelines/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          name: suggestion.name,
          columns: suggestion.columns.map((c, i) => ({
            name: c.name,
            color: c.color,
            sortOrder: i,
            probability: null,
            slaHours: c.sla_days != null ? c.sla_days * 24 : null,
          })),
        }),
      })
      if (res.ok) {
        const created: Pipeline = await res.json()
        setPipelines((prev) => [...prev, created])
        setSelected(created)
      }
    } catch {} finally {
      setSaving(false)
    }
  }

  async function deletePipeline(id: string) {
    if (!confirm("Excluir este pipeline? Todos os cards serão removidos.")) return
    setDeletingId(id)
    setMenuOpen(null)
    await fetch(`/api/pipelines/boards/${id}`, { method: "DELETE" }).catch(() => {})
    setPipelines((prev) => {
      const next = prev.filter((p) => p.id !== id)
      setSelected(next[0] ?? null)
      return next
    })
    setDeletingId(null)
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
      <div className="grid h-full min-w-[1080px] grid-cols-[minmax(640px,1fr)_320px] gap-2.5 p-2.5 md:p-3">

        {/* ── Main section ── */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white shadow-soft">
          {/* Section header */}
          <div className="flex shrink-0 flex-wrap items-center gap-3 border-b p-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <LayoutDashboard className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-semibold">Pipelines comerciais</h2>
              <p className="text-xs text-muted-foreground">Crie e gerencie funis de venda com etapas, cores e automações</p>
            </div>
            <div className="flex h-8 w-56 items-center gap-2 rounded-md border bg-white px-2">
              <Search className="size-3.5 text-muted-foreground" />
              <Input
                className="h-7 border-0 px-0 text-xs shadow-none focus-visible:ring-0"
                placeholder="Buscar pipeline…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="sm">
              <SlidersHorizontal />
              Filtros
            </Button>

            {/* Split button: Novo pipeline + dropdown */}
            <div className="relative flex" ref={createMenuRef}>
              <Button size="sm" className="rounded-r-none border-r-0 pr-3" onClick={openCreate}>
                <Plus />
                Novo pipeline
              </Button>
              <button
                onClick={() => setCreateMenuOpen((v) => !v)}
                className="flex items-center justify-center rounded-r-md border border-l-0 bg-primary px-1.5 text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <ChevronDown className="size-3.5" />
              </button>
              {createMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-xl border bg-white shadow-xl">
                  <button
                    onClick={openCreate}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm transition-colors hover:bg-muted/50"
                  >
                    <div className="flex size-6 items-center justify-center rounded-md bg-muted">
                      <Plus className="size-3.5 text-muted-foreground" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-medium">Manual</p>
                      <p className="text-[11px] text-muted-foreground">Configure você mesmo</p>
                    </div>
                  </button>
                  <div className="mx-2 border-t" />
                  <button
                    onClick={openAiCreate}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm transition-colors hover:bg-primary/5"
                  >
                    <div className="flex size-6 items-center justify-center rounded-md bg-primary/10">
                      <Sparkles className="size-3.5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-medium text-primary">Criar com IA</p>
                      <p className="text-[11px] text-muted-foreground">Descreva e a IA monta</p>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Table header */}
          <div className="grid shrink-0 grid-cols-[minmax(0,2fr)_minmax(0,3fr)_80px_100px] border-b bg-muted/45 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span>Nome</span>
            <span>Colunas</span>
            <span>Cards</span>
            <span>Ações</span>
          </div>

          {/* Table body */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                <span className="text-sm">Carregando pipelines…</span>
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-4 py-16 text-center text-muted-foreground">
                <div className="flex size-12 items-center justify-center rounded-xl bg-muted/50">
                  <LayoutDashboard className="size-5 opacity-40" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {search ? "Nenhum resultado" : "Nenhum pipeline criado"}
                  </p>
                  <p className="mt-0.5 text-xs opacity-70">
                    {search ? "Tente outro termo" : "Crie manualmente ou deixe a IA propor as etapas"}
                  </p>
                </div>
                {!search && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={openCreate}>
                      <Plus className="size-3.5" /> Manual
                    </Button>
                    <Button size="sm" onClick={openAiCreate}>
                      <Sparkles className="size-3.5" /> Criar com IA
                    </Button>
                  </div>
                )}
              </div>
            )}

            {filtered.map((pipeline) => (
              <div
                key={pipeline.id}
                onClick={() => setSelected(pipeline)}
                className={cn(
                  "grid w-full cursor-pointer grid-cols-[minmax(0,2fr)_minmax(0,3fr)_80px_100px] items-center gap-3 border-b px-3 py-3 text-left transition-colors hover:bg-muted/45",
                  selected?.id === pipeline.id && "bg-primary/5 hover:bg-primary/5"
                )}
              >
                {/* Name */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Kanban className="size-3.5 text-primary" />
                  </div>
                  <span className="truncate text-sm font-semibold">{pipeline.name}</span>
                </div>

                {/* Column pills */}
                <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                  {pipeline.columns.slice(0, 4).map((col) => (
                    <div key={col.id} className="flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5">
                      <span className="size-1.5 rounded-full" style={{ background: col.color }} />
                      <span className="max-w-[80px] truncate text-[11px] text-foreground/70">{col.name}</span>
                    </div>
                  ))}
                  {pipeline.columns.length > 4 && (
                    <span className="shrink-0 text-[11px] text-muted-foreground">+{pipeline.columns.length - 4}</span>
                  )}
                </div>

                {/* Card count placeholder */}
                <span className="text-sm text-muted-foreground">—</span>

                {/* Row actions */}
                <div
                  className="relative flex items-center gap-1"
                  ref={menuOpen === pipeline.id ? menuRef : undefined}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => openEdit(pipeline)}
                    className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors"
                    title="Editar"
                  >
                    <Pencil className="size-3" />
                  </button>
                  <button
                    onClick={() => setMenuOpen(menuOpen === pipeline.id ? null : pipeline.id)}
                    className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <MoreHorizontal className="size-3" />
                  </button>
                  {menuOpen === pipeline.id && (
                    <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border bg-white shadow-xl">
                      <a
                        href="/quadros"
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-muted/50"
                      >
                        <Kanban className="size-3.5 text-muted-foreground" /> Abrir quadro
                      </a>
                      <button
                        onClick={() => openEdit(pipeline)}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-muted/50"
                      >
                        <Pencil className="size-3.5 text-muted-foreground" /> Editar
                      </button>
                      <button
                        onClick={() => deletePipeline(pipeline.id)}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50"
                      >
                        {deletingId === pipeline.id
                          ? <Loader2 className="size-3.5 animate-spin" />
                          : <Trash2 className="size-3.5" />}
                        Excluir
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Aside ── */}
        <aside className="min-h-0 space-y-3 overflow-y-auto pr-1">
          {/* Pipeline detail card */}
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle>{selected ? selected.name : "Selecione um pipeline"}</CardTitle>
              <CardDescription>
                {selected ? `${selected.columns.length} etapas configuradas` : "Clique em um pipeline para ver os detalhes"}
              </CardDescription>
            </CardHeader>
            {selected && (
              <CardContent className="space-y-2 p-3 pt-0">
                {selected.columns.map((col, idx) => (
                  <div key={col.id} className="flex items-center gap-2 border-b pb-2 last:border-b-0 last:pb-0">
                    <span
                      className="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ background: col.color }}
                    >
                      {idx + 1}
                    </span>
                    <span className="flex-1 truncate text-sm">{col.name}</span>
                    {col.probability != null && (
                      <span className="shrink-0 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                        {col.probability}%
                      </span>
                    )}
                    {col.slaHours != null && (
                      <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5">
                        <Clock className="size-2.5 text-amber-500" />
                        <span className="text-[10px] font-medium text-amber-700">{col.slaHours}h</span>
                      </div>
                    )}
                  </div>
                ))}
                <div className="pt-1 flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => openEdit(selected)}>
                    <Pencil className="size-3" /> Editar
                  </Button>
                  <a href="/quadros" className="flex-1">
                    <Button size="sm" className="w-full text-xs">
                      <Kanban className="size-3" /> Abrir quadro
                    </Button>
                  </a>
                </div>
              </CardContent>
            )}
          </Card>

          {/* AI creation card */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader className="p-3 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <CardTitle className="text-primary">Criar com IA</CardTitle>
              </div>
              <CardDescription>Descreva o processo e a IA propõe as etapas, cores e SLAs</CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <Button className="w-full" size="sm" onClick={openAiCreate}>
                <Wand2 className="size-3.5" /> Gerar pipeline com IA
              </Button>
            </CardContent>
          </Card>

          {/* Stats card */}
          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle>Visão geral</CardTitle>
              <CardDescription>Resumo dos pipelines ativos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 p-3 pt-0">
              {[
                ["Total de pipelines", String(pipelines.length)],
                ["Total de etapas", String(pipelines.reduce((a, p) => a + p.columns.length, 0))],
                ["Cards ativos", "—"],
                ["Valor em pipeline", "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between border-b pb-2 last:border-b-0 last:pb-0">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-right text-sm font-medium">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* ── Sheet: Create / Edit Pipeline (manual) ── */}
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <SheetHeader>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <LayoutDashboard className="size-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{editingPipeline ? "Editar pipeline" : "Novo pipeline"}</p>
            <p className="text-xs text-muted-foreground">
              {editingPipeline ? "Ajuste nome e etapas do funil" : "Configure nome e etapas do funil"}
            </p>
          </div>
          <button
            onClick={() => setSheetOpen(false)}
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
                Nome do pipeline
              </label>
              <Input
                value={pipelineName}
                onChange={(e) => setPipelineName(e.target.value)}
                placeholder="Ex: Pipeline Comercial, Pós-venda…"
                className="text-sm"
                autoFocus
              />
            </div>

            {/* Columns */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Etapas do funil <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 font-normal">{columns.length}</span>
                </label>
                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={addColumn}>
                  <Plus className="size-3" /> Adicionar etapa
                </Button>
              </div>
              <div className="flex items-center justify-end gap-4 pr-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                <span className="w-[52px] text-center">Prob. %</span>
                <span className="w-[52px] text-center">SLA (h)</span>
                <span className="w-4" />
                <span className="w-6" />
              </div>

              <div className="space-y-2">
                {columns.map((col, idx) => (
                  <div key={col.id} className="flex items-center gap-2 rounded-xl border bg-white p-2.5 shadow-sm">
                    {/* Order buttons */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveColumn(idx, -1)}
                        disabled={idx === 0}
                        className="flex size-4 items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-20"
                        title="Mover para cima"
                      >
                        <svg viewBox="0 0 8 8" className="size-2.5 fill-current"><path d="M4 1L7 6H1z" /></svg>
                      </button>
                      <button
                        onClick={() => moveColumn(idx, 1)}
                        disabled={idx === columns.length - 1}
                        className="flex size-4 items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-20"
                        title="Mover para baixo"
                      >
                        <svg viewBox="0 0 8 8" className="size-2.5 fill-current"><path d="M4 7L1 2H7z" /></svg>
                      </button>
                    </div>

                    {/* Color picker */}
                    <div className="group/color relative">
                      <button
                        style={{ background: col.color }}
                        className="size-5 rounded-full border-2 border-white shadow ring-1 ring-black/10 transition-transform hover:scale-110"
                        title="Escolher cor"
                      />
                      <div className="absolute left-0 top-full z-50 mt-1.5 hidden grid-cols-6 gap-1 rounded-xl border bg-white p-2 shadow-xl group-focus-within/color:grid group-hover/color:grid">
                        {COLOR_OPTIONS.map((c) => (
                          <button
                            key={c}
                            onClick={() => updateColumn(col.id, "color", c)}
                            style={{ background: c }}
                            className={cn(
                              "size-5 rounded-full border-2 transition-transform hover:scale-110",
                              col.color === c ? "border-white ring-2 ring-primary" : "border-transparent"
                            )}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Name input */}
                    <Input
                      value={col.name}
                      onChange={(e) => updateColumn(col.id, "name", e.target.value)}
                      className="h-7 flex-1 border-0 px-1 text-sm shadow-none focus-visible:ring-0"
                    />

                    {/* Probability */}
                    <div className="flex shrink-0 items-center gap-0.5">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={col.probability ?? ""}
                        onChange={(e) => updateColumn(col.id, "probability", e.target.value === "" ? null : Number(e.target.value))}
                        placeholder="—"
                        title="Probabilidade de fechamento (%)"
                        className="h-7 w-10 rounded border bg-muted/40 px-1 text-center text-xs font-medium outline-none focus:border-primary focus:bg-white"
                      />
                      <span className="text-[10px] text-muted-foreground">%</span>
                    </div>

                    {/* SLA */}
                    <div className="flex shrink-0 items-center gap-0.5">
                      <input
                        type="number"
                        min={1}
                        value={col.slaHours ?? ""}
                        onChange={(e) => updateColumn(col.id, "slaHours", e.target.value === "" ? null : Number(e.target.value))}
                        placeholder="—"
                        title="SLA máximo em horas nesta etapa"
                        className="h-7 w-10 rounded border bg-muted/40 px-1 text-center text-xs font-medium outline-none focus:border-primary focus:bg-white"
                      />
                      <Clock className="size-3 text-muted-foreground" />
                    </div>

                    {/* Stage index */}
                    <span className="shrink-0 text-[10px] font-medium text-muted-foreground">#{idx + 1}</span>

                    {/* Remove */}
                    <button
                      onClick={() => removeColumn(col.id)}
                      disabled={columns.length <= 1}
                      className="flex size-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-20"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Funnel preview */}
              {columns.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Prévia do funil</p>
                  <div className="flex items-center overflow-x-auto rounded-xl border bg-muted/30 p-2 gap-0">
                    {columns.map((col, idx) => (
                      <div key={col.id} className="flex items-center shrink-0">
                        <div className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 shadow-sm">
                          <span className="size-2 rounded-full shrink-0" style={{ background: col.color }} />
                          <span className="whitespace-nowrap text-xs font-medium">{col.name || "…"}</span>
                        </div>
                        {idx < columns.length - 1 && (
                          <ChevronRight className="mx-0.5 size-3.5 shrink-0 text-muted-foreground/40" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="rounded-xl border bg-primary/5 p-3">
              <div className="flex items-start gap-2">
                <Settings className="mt-0.5 size-4 shrink-0 text-primary" />
                <div>
                  <p className="text-xs font-semibold text-primary">Automações por etapa</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Após criar o pipeline, configure automações por coluna — notificações, tarefas e integrações.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 flex items-center justify-between gap-3 border-t bg-muted/20 px-4 py-3">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancelar</Button>
            <Button
              disabled={!pipelineName.trim() || columns.length === 0 || saving}
              onClick={savePipeline}
              className="gap-2"
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              {editingPipeline ? "Salvar alterações" : "Criar pipeline"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Sheet: AI Pipeline ── */}
      <AiPipelineSheet
        open={aiSheetOpen}
        onClose={() => setAiSheetOpen(false)}
        onApply={handleAiApply}
      />
    </div>
  )
}
