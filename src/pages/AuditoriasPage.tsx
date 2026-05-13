import React, { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetHeader,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  BrainCircuit,
  ShieldCheck,
  Sparkles,
  MessageCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  Search,
  X,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Users,
  FileDown,
  Lightbulb,
  Clock,
  Zap,
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditFinding { id: string; text: string }

interface Audit {
  id: string
  companyId: string
  conversationId: string | null
  conversationName: string | null
  category: "TECNICA" | "SOFT_SKILLS" | null
  dimension: string | null
  score: number | null
  riskLevel: "BAIXO" | "MEDIO" | "ALTO" | "CRITICO"
  sentiment: "POSITIVO" | "NEUTRO" | "NEGATIVO"
  recommendation: string | null
  suggestions: Suggestion[] | null
  suggestionsSummary: string | null
  findings: AuditFinding[]
  strengths: AuditFinding[]
  gaps: AuditFinding[]
  attendant: { id: string; name: string; avatarUrl: string | null } | null
  conversation: { id: string; channel: string; customer: { name: string } | null } | null
  createdAt: string
}

interface Stats {
  byDimension: { dimension: string | null; category: string | null; _avg: { score: number | null }; _count: { id: number } }[]
  byRisk: { riskLevel: string; _count: { id: number } }[]
  trend: { date: string; avgScore: number }[]
  total: number
  avgScore: number | null
}

interface Conversation {
  id: string
  channel: string
  status: string
  preview: string | null
  customer: { name: string } | null
  lastMessageAt: string | null
}

interface Collaborator {
  id: string
  name: string
  email: string
  role: string
  avatarUrl: string | null
}

interface Team {
  id: string
  name: string
  manager: { id: string; name: string } | null
  members: { user: { id: string; name: string } }[]
}

interface Suggestion {
  title: string
  description: string
  timeframe: string
  impact: string
}

// ─── Dimension metadata ───────────────────────────────────────────────────────

const DIMS = {
  "qualidade":              { label: "Qualidade",            category: "TECNICA"     as const },
  "comercial":              { label: "Comercial",            category: "TECNICA"     as const },
  "compliance":             { label: "Compliance",           category: "TECNICA"     as const },
  "operacao":               { label: "Operação",             category: "TECNICA"     as const },
  "comunicacao":            { label: "Comunicação",          category: "SOFT_SKILLS" as const },
  "inteligencia-emocional": { label: "Inteligência Emocional", category: "SOFT_SKILLS" as const },
  "gestao-conflito":        { label: "Gestão de Conflito",   category: "SOFT_SKILLS" as const },
  "negociacao":             { label: "Negociação",           category: "SOFT_SKILLS" as const },
  "lideranca":              { label: "Liderança",            category: "SOFT_SKILLS" as const },
} as const

type DimKey = keyof typeof DIMS

const TECH_DIMS = Object.entries(DIMS).filter(([, v]) => v.category === "TECNICA")    as [DimKey, typeof DIMS[DimKey]][]
const SOFT_DIMS = Object.entries(DIMS).filter(([, v]) => v.category === "SOFT_SKILLS") as [DimKey, typeof DIMS[DimKey]][]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RISK_STYLE: Record<string, string> = {
  BAIXO:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  MEDIO:   "bg-amber-50 text-amber-700 border-amber-200",
  ALTO:    "bg-orange-50 text-orange-700 border-orange-200",
  CRITICO: "bg-red-50 text-red-700 border-red-200",
}
const RISK_LABEL: Record<string, string> = {
  BAIXO: "Baixo", MEDIO: "Médio", ALTO: "Alto", CRITICO: "Crítico",
}
const CHANNEL_LABEL: Record<string, string> = {
  WHATSAPP: "WhatsApp", EMAIL: "E-mail", INSTAGRAM: "Instagram",
  TELEGRAM: "Telegram", CHAT: "Chat", MANUAL: "Manual",
}

function scoreColor(s: number) {
  if (s >= 80) return "#22c55e"
  if (s >= 60) return "#f59e0b"
  if (s >= 40) return "#f97316"
  return "#ef4444"
}

function scoreBarClass(s: number) {
  if (s >= 80) return "bg-emerald-500"
  if (s >= 60) return "bg-amber-500"
  if (s >= 40) return "bg-orange-500"
  return "bg-red-500"
}

function accent(category: string | null | undefined) {
  return category === "SOFT_SKILLS"
    ? { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200", dot: "bg-violet-500" }
    : { bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200",   dot: "bg-blue-500"   }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

function md2html(text: string): string {
  const lines = text.split("\n")
  const out: string[] = []
  let inList = false

  for (const raw of lines) {
    const escaped = raw
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
    const formatted = escaped
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/_(.+?)_/g, "<em>$1</em>")

    const isBullet = /^[\-•*]\s+/.test(raw)
    if (isBullet) {
      if (!inList) { out.push('<ul style="margin:6px 0 6px 16px;padding:0">'); inList = true }
      out.push(`<li style="margin-bottom:3px">${formatted.replace(/^[\-•*]\s+/, "")}</li>`)
    } else {
      if (inList) { out.push("</ul>"); inList = false }
      if (formatted.trim() === "") {
        out.push('<br style="line-height:0.5"/>')
      } else {
        out.push(`<span>${formatted}</span><br/>`)
      }
    }
  }
  if (inList) out.push("</ul>")
  return out.join("")
}

// ─── ScoreDonut ───────────────────────────────────────────────────────────────

function ScoreDonut({ score, size = 88 }: { score: number | null; size?: number }) {
  const s = score ?? 0
  const r = size * 0.41, cx = size / 2, cy = size / 2, circ = 2 * Math.PI * r
  const color = scoreColor(s)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={size * 0.091} />
      <circle
        cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={size * 0.091}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - s / 100)}
        strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text x={cx} y={cy + 2} textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.205} fontWeight={700} fill={color}>{s}</text>
      <text x={cx} y={cy + size * 0.193} textAnchor="middle" fontSize={size * 0.102} fill="#94a3b8">/100</text>
    </svg>
  )
}

// ─── ScoreBar ─────────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number | null }) {
  const s = score ?? 0
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", scoreBarClass(s))} style={{ width: `${s}%` }} />
      </div>
      <span className="w-6 text-right text-xs font-semibold tabular-nums">{s}</span>
    </div>
  )
}

// ─── SentimentIcon ────────────────────────────────────────────────────────────

function SentimentIcon({ s }: { s: string }) {
  if (s === "POSITIVO") return <TrendingUp  className="size-3.5 text-emerald-600" />
  if (s === "NEGATIVO") return <TrendingDown className="size-3.5 text-red-500" />
  return <Minus className="size-3.5 text-slate-400" />
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

function exportToPdf(audit: Audit) {
  const isSoft = audit.category === "SOFT_SKILLS"
  const accentColor = isSoft ? "#7c3aed" : "#1d4ed8"
  const subjectName = audit.conversationId
    ? (audit.conversation?.customer?.name ?? "Auditoria")
    : (audit.attendant?.name ?? "Colaborador")
  const dimLabel = audit.conversationName ?? audit.dimension ?? "—"
  const categoryLabel = isSoft ? "Soft Skills" : "Técnica"

  const strengthsHtml = isSoft && (audit.strengths?.length ?? 0) > 0
    ? `<section>
        <h3 style="color:#047857;font-size:11px;text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px">Pontos fortes observados</h3>
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px">
          ${audit.strengths.map((s) => `<li style="background:#ecfdf5;border-radius:8px;padding:8px 12px;font-size:13px;color:#065f46">${md2html(s.text)}</li>`).join("")}
        </ul>
      </section>` : ""

  const gapsHtml = isSoft && (audit.gaps?.length ?? 0) > 0
    ? `<section>
        <h3 style="color:#c2410c;font-size:11px;text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px">Lacunas de desenvolvimento</h3>
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px">
          ${audit.gaps.map((g) => `<li style="background:#fff7ed;border-radius:8px;padding:8px 12px;font-size:13px;color:#7c2d12">${md2html(g.text)}</li>`).join("")}
        </ul>
      </section>` : ""

  const findingsHtml = audit.findings.length > 0
    ? `<section>
        <h3 style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px">Insights da análise</h3>
        <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px">
          ${audit.findings.map((f) => `<li style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;font-size:13px;color:#334155">${md2html(f.text)}</li>`).join("")}
        </ul>
      </section>` : ""

  const recommendationHtml = audit.recommendation
    ? isSoft
      ? `<section style="background:linear-gradient(135deg,#f5f3ff,#eef2ff);border:1px solid #ddd6fe;border-radius:12px;padding:16px">
          <h3 style="color:#6d28d9;font-size:11px;text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px">Orientação de coaching</h3>
          <div style="font-style:italic;color:#4c1d95;font-size:13px;line-height:1.6;margin:0">${md2html(audit.recommendation)}</div>
        </section>`
      : `<section style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px">
          <h3 style="color:#475569;font-size:11px;text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px">Recomendação</h3>
          <div style="font-size:13px;line-height:1.6;margin:0;color:#1e293b">${md2html(audit.recommendation)}</div>
        </section>`
    : ""

  const riskColors: Record<string, string> = {
    BAIXO: "#059669", MEDIO: "#d97706", ALTO: "#ea580c", CRITICO: "#dc2626",
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório de Auditoria — ${subjectName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1e293b; padding: 40px; max-width: 720px; margin: 0 auto; }
  h1 { font-size: 22px; font-weight: 700; color: #0f172a; }
  h2 { font-size: 14px; font-weight: 600; color: #475569; margin-bottom: 4px; }
  section { display: flex; flex-direction: column; gap: 0; }
  .stack { display: flex; flex-direction: column; gap: 20px; }
  @media print { body { padding: 24px; } }
</style>
</head>
<body>
<div class="stack">
  <header style="border-bottom:2px solid ${accentColor};padding-bottom:16px;display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:${accentColor};font-weight:600;margin-bottom:6px">${categoryLabel} · ${dimLabel}</p>
      <h1>${subjectName}</h1>
      <p style="font-size:12px;color:#64748b;margin-top:4px">${fmtDate(audit.createdAt)}</p>
    </div>
    <div style="text-align:center;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 20px">
      <p style="font-size:36px;font-weight:800;color:${scoreColor(audit.score ?? 0)};line-height:1">${audit.score ?? 0}</p>
      <p style="font-size:10px;color:#94a3b8;margin-top:2px">/100</p>
      <p style="font-size:11px;font-weight:600;color:${riskColors[audit.riskLevel] ?? "#475569"};margin-top:6px">Risco ${RISK_LABEL[audit.riskLevel]}</p>
    </div>
  </header>
  ${recommendationHtml}
  ${strengthsHtml}
  ${gapsHtml}
  ${findingsHtml}
  <footer style="border-top:1px solid #e2e8f0;padding-top:16px;font-size:10px;color:#94a3b8;text-align:center">
    Gerado por ZapVendas Auditorias & Análises · IA
  </footer>
</div>
</body>
</html>`

  const win = window.open("", "_blank")
  if (!win) return
  win.document.write(html)
  win.document.close()
  setTimeout(() => win.print(), 400)
}

// ─── AuditoriasPage ───────────────────────────────────────────────────────────

export default function AuditoriasPage() {
  const auth      = useAuth()
  const companyId = auth?.companyId ?? ""
  const token     = localStorage.getItem("zv_token") ?? ""

  const [audits,      setAudits]      = useState<Audit[]>([])
  const [total,       setTotal]       = useState(0)
  const [stats,       setStats]       = useState<Stats | null>(null)
  const [selected,    setSelected]    = useState<Audit | null>(null)
  const [reportOpen,  setReportOpen]  = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [modalOpen,   setModalOpen]   = useState(false)
  const [activeDim,   setActiveDim]   = useState<DimKey | "">("")
  const [page,        setPage]        = useState(1)
  const [pageSize,    setPageSize]    = useState(20)
  const [sortCol,     setSortCol]     = useState<"createdAt" | "score" | "riskLevel" | "dimension">("createdAt")
  const [sortDir,     setSortDir]     = useState<"asc" | "desc">("desc")
  const [filters,     setFilters]     = useState({
    category: "", dimension: "", riskLevel: "", search: "",
  })

  // ─── Fetchers ───────────────────────────────────────────────────────────────

  const fetchAudits = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    try {
      const p = new URLSearchParams({
        companyId,
        limit:    String(pageSize),
        offset:   String((page - 1) * pageSize),
        orderBy:  sortCol,
        orderDir: sortDir,
      })
      if (filters.category)  p.set("category",  filters.category)
      if (filters.dimension) p.set("dimension", filters.dimension)
      if (filters.riskLevel) p.set("riskLevel", filters.riskLevel)
      if (filters.search)    p.set("search",    filters.search)
      const res = await fetch(`/api/auditorias?${p}`, { headers: { Authorization: `Bearer ${token}` } })
      const d   = await res.json()
      setAudits(d.audits ?? [])
      setTotal(d.total  ?? 0)
    } finally {
      setLoading(false)
    }
  }, [companyId, token, page, pageSize, sortCol, sortDir, filters.category, filters.dimension, filters.riskLevel, filters.search])

  const fetchStats = useCallback(async () => {
    if (!companyId) return
    const res = await fetch(`/api/auditorias/stats?companyId=${companyId}`, { headers: { Authorization: `Bearer ${token}` } })
    setStats(await res.json())
  }, [companyId, token])

  useEffect(() => { fetchAudits() }, [fetchAudits])
  useEffect(() => { fetchStats()  }, [fetchStats])

  // ─── Actions ────────────────────────────────────────────────────────────────

  function selectDim(key: DimKey) {
    const next = activeDim === key ? "" : key
    setActiveDim(next)
    setPage(1)
    setFilters((f) => ({ ...f, dimension: next, category: next ? DIMS[next].category : "" }))
  }

  function clearFilters() {
    setActiveDim("")
    setPage(1)
    setFilters({ category: "", dimension: "", riskLevel: "", search: "" })
  }

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"))
    } else {
      setSortCol(col)
      setSortDir("desc")
    }
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  function openReport(audit: Audit) {
    setSelected(audit)
    setReportOpen(true)
  }

  // ─── Derived ────────────────────────────────────────────────────────────────

  function dimAvgScore(key: DimKey): number | null {
    const stat = stats?.byDimension.find((d) => d.dimension === key)
    return stat?._avg.score ?? null
  }

  const riskCounts = Object.fromEntries((stats?.byRisk ?? []).map((r) => [r.riskLevel, r._count.id]))

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
      <div className="grid h-full min-w-[900px] grid-cols-[280px_minmax(540px,1fr)] gap-2.5 p-2.5 md:p-3">

        {/* ── Left: dimension picker ─────────────────────────────────────────── */}
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white shadow-soft">
          <div className="shrink-0 border-b p-3">
            <p className="text-sm font-semibold">Dimensões de análise</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Selecione para filtrar por lente</p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto space-y-3 p-2">
            <div>
              <p className="px-1 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-widest text-blue-600">Técnico</p>
              <div className="space-y-1">
                {TECH_DIMS.map(([key, dim]) => {
                  const avg = dimAvgScore(key)
                  const isActive = activeDim === key
                  return (
                    <button key={key} onClick={() => selectDim(key)}
                      className={cn(
                        "w-full rounded-lg border px-2.5 py-2 text-left transition-colors",
                        isActive
                          ? "border-blue-300 bg-blue-50 ring-1 ring-blue-100"
                          : "border-transparent hover:border-blue-200 hover:bg-blue-50/40",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn("truncate text-xs font-semibold", isActive ? "text-blue-900" : "text-foreground")}>{dim.label}</p>
                        {avg !== null && (
                          <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums", isActive ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground")}>
                            {Math.round(avg)}
                          </span>
                        )}
                      </div>
                      <p className={cn("mt-0.5 text-[10px]", isActive ? "text-blue-600" : "text-muted-foreground")}>
                        {isActive ? "Filtro ativo" : "Análise técnica"}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="px-1 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-widest text-violet-600">Comportamental</p>
              <div className="space-y-1">
                {SOFT_DIMS.map(([key, dim]) => {
                  const avg = dimAvgScore(key)
                  const isActive = activeDim === key
                  return (
                    <button key={key} onClick={() => selectDim(key)}
                      className={cn(
                        "w-full rounded-lg border px-2.5 py-2 text-left transition-colors",
                        isActive
                          ? "border-violet-300 bg-violet-50 ring-1 ring-violet-100"
                          : "border-transparent hover:border-violet-200 hover:bg-violet-50/40",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn("truncate text-xs font-semibold", isActive ? "text-violet-900" : "text-foreground")}>{dim.label}</p>
                        {avg !== null && (
                          <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums", isActive ? "bg-violet-100 text-violet-700" : "bg-muted text-muted-foreground")}>
                            {Math.round(avg)}
                          </span>
                        )}
                      </div>
                      <p className={cn("mt-0.5 text-[10px]", isActive ? "text-violet-600" : "text-muted-foreground")}>
                        {isActive ? "Filtro ativo" : "Soft skill"}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t p-2">
            <Button className="w-full gap-2" size="sm" onClick={() => setModalOpen(true)}>
              <Sparkles className="size-3.5" />
              Nova auditoria
            </Button>
          </div>
        </aside>

        {/* ── Center: list ───────────────────────────────────────────────────── */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white shadow-soft">

          {/* Stats strip */}
          <div className="grid shrink-0 grid-cols-4 divide-x border-b">
            {[
              { label: "Total de auditorias", value: stats?.total ?? "—",     icon: ShieldCheck,  color: "text-slate-600"   },
              { label: "Score médio",          value: stats?.avgScore ? `${Math.round(stats.avgScore)}/100` : "—", icon: TrendingUp, color: "text-emerald-600" },
              { label: "Alto / crítico",        value: ((riskCounts.ALTO ?? 0) + (riskCounts.CRITICO ?? 0)), icon: AlertTriangle, color: "text-orange-500" },
              { label: "Baixo risco",            value: riskCounts.BAIXO ?? 0, icon: CheckCircle2, color: "text-emerald-500" },
            ].map((c) => (
              <div key={c.label} className="flex items-center gap-2.5 p-3">
                <c.icon className={cn("size-4 shrink-0", c.color)} />
                <div>
                  <p className="text-[11px] text-muted-foreground">{c.label}</p>
                  <p className="text-lg font-bold leading-none">{String(c.value)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Filter bar */}
          <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente..."
                className="h-8 pl-8 text-sm"
                value={filters.search}
                onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, search: e.target.value })) }}
              />
            </div>

            <select
              className="h-8 rounded-md border bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={filters.riskLevel}
              onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, riskLevel: e.target.value })) }}
            >
              <option value="">Todos os riscos</option>
              <option value="BAIXO">Baixo</option>
              <option value="MEDIO">Médio</option>
              <option value="ALTO">Alto</option>
              <option value="CRITICO">Crítico</option>
            </select>

            <select
              className="h-8 rounded-md border bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={filters.category}
              onChange={(e) => {
                setActiveDim("")
                setPage(1)
                setFilters((f) => ({ ...f, category: e.target.value, dimension: "" }))
              }}
            >
              <option value="">Todas as categorias</option>
              <option value="TECNICA">Técnicas</option>
              <option value="SOFT_SKILLS">Soft Skills</option>
            </select>

            {(filters.category || filters.dimension || filters.riskLevel || filters.search) && (
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={clearFilters}>
                <X className="size-3" />
                Limpar
              </Button>
            )}
          </div>

          {/* Table */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                <span className="text-sm">Carregando auditorias…</span>
              </div>
            ) : audits.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
                <ShieldCheck className="size-8 opacity-30" />
                <p className="text-sm">Nenhuma auditoria encontrada.</p>
                <Button size="sm" variant="outline" onClick={() => setModalOpen(true)}>
                  Criar primeira auditoria
                </Button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/60 backdrop-blur">
                  <tr className="text-left">
                    <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Conversa / Cliente
                    </th>
                    {(
                      [
                        { label: "Dimensão",  col: "dimension"  },
                        { label: "Score",     col: "score"      },
                        { label: "Risco",     col: "riskLevel"  },
                        { label: "Data",      col: "createdAt"  },
                      ] as const
                    ).map(({ label, col }) => (
                      <th key={col} className="px-3 py-2">
                        <button
                          onClick={() => toggleSort(col)}
                          className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {label}
                          {sortCol === col
                            ? sortDir === "desc"
                              ? <ArrowDown className="size-3" />
                              : <ArrowUp   className="size-3" />
                            : <ArrowUpDown className="size-3 opacity-40" />
                          }
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {audits.map((audit) => {
                    const ac = accent(audit.category)
                    const isSelected = selected?.id === audit.id && reportOpen
                    return (
                      <tr
                        key={audit.id}
                        onClick={() => openReport(audit)}
                        className={cn("cursor-pointer transition-colors hover:bg-muted/40", isSelected && "bg-muted/60")}
                      >
                        <td className="px-3 py-2.5">
                          {audit.conversationId ? (
                            <>
                              <p className="max-w-[200px] truncate font-medium">{audit.conversation?.customer?.name ?? "—"}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {audit.conversation ? (CHANNEL_LABEL[audit.conversation.channel] ?? audit.conversation.channel) : "—"}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="max-w-[200px] truncate font-medium">{audit.attendant?.name ?? "Colaborador"}</p>
                              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Users className="size-2.5" />
                                Auditoria de colaborador
                              </p>
                            </>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium", ac.bg, ac.text, ac.border)}>
                            <span className={cn("size-1 rounded-full", ac.dot)} />
                            {audit.conversationName ?? audit.dimension ?? "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5"><ScoreBar score={audit.score} /></td>
                        <td className="px-3 py-2.5">
                          <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium", RISK_STYLE[audit.riskLevel])}>
                            {RISK_LABEL[audit.riskLevel]}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-muted-foreground">
                          {fmtDate(audit.createdAt)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {total > 0 && (
            <div className="flex shrink-0 items-center justify-between gap-3 border-t bg-muted/20 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">
                  {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} de {total}
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
                  className="h-7 rounded-md border bg-white px-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {[10, 20, 50].map((n) => <option key={n} value={n}>{n} por página</option>)}
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  className="flex size-7 items-center justify-center rounded-md border bg-white text-muted-foreground transition-colors hover:bg-muted/50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronsLeft className="size-3.5" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex size-7 items-center justify-center rounded-md border bg-white text-muted-foreground transition-colors hover:bg-muted/50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="size-3.5" />
                </button>

                {/* page number pills */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | "…")[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…")
                    acc.push(p)
                    return acc
                  }, [])
                  .map((p, i) =>
                    p === "…" ? (
                      <span key={`ellipsis-${i}`} className="flex size-7 items-center justify-center text-xs text-muted-foreground">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p as number)}
                        className={cn(
                          "flex size-7 items-center justify-center rounded-md border text-xs font-medium transition-colors",
                          page === p
                            ? "border-primary bg-primary text-primary-foreground"
                            : "bg-white text-muted-foreground hover:bg-muted/50",
                        )}
                      >
                        {p}
                      </button>
                    )
                  )
                }

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex size-7 items-center justify-center rounded-md border bg-white text-muted-foreground transition-colors hover:bg-muted/50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="size-3.5" />
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  className="flex size-7 items-center justify-center rounded-md border bg-white text-muted-foreground transition-colors hover:bg-muted/50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronsRight className="size-3.5" />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ── Audit Report Sheet ──────────────────────────────────────────────── */}
      {selected && (
        <AuditReportSheet
          audit={selected}
          open={reportOpen}
          onClose={() => setReportOpen(false)}
        />
      )}

      <NewAuditModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        companyId={companyId}
        token={token}
        onCreated={async () => {
          setModalOpen(false)
          await Promise.all([fetchAudits(), fetchStats()])
        }}
      />
    </div>
  )
}

// ─── AuditReportSheet ─────────────────────────────────────────────────────────

function AuditReportSheet({ audit, open, onClose }: {
  audit: Audit
  open: boolean
  onClose: () => void
}) {
  const ac     = accent(audit.category)
  const isSoft = audit.category === "SOFT_SKILLS"

  const subjectName = audit.conversationId
    ? (audit.conversation?.customer?.name ?? "Auditoria")
    : (audit.attendant?.name ?? "Colaborador")
  const dimLabel = audit.conversationName ?? audit.dimension ?? "—"

  const TIMEFRAME_STYLE: Record<string, string> = {
    "imediato":    "bg-red-50 text-red-700 border-red-200",
    "esta semana": "bg-amber-50 text-amber-700 border-amber-200",
    "este mês":    "bg-blue-50 text-blue-700 border-blue-200",
  }

  return (
    <Sheet open={open} onClose={onClose} className="w-[680px]">
      <SheetHeader>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg border", ac.bg, ac.border)}>
            {isSoft
              ? <BrainCircuit className={cn("size-4", ac.text)} />
              : <ShieldCheck  className={cn("size-4", ac.text)} />}
          </span>
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate">{subjectName}</SheetTitle>
            <SheetDescription className="mt-0 truncate">
              <span className={cn("font-medium", ac.text)}>{dimLabel}</span>
              {!audit.conversationId && <span className="text-muted-foreground"> · auditoria de colaborador</span>}
            </SheetDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 text-xs"
            onClick={() => exportToPdf(audit)}
          >
            <FileDown className="size-3.5" />
            Exportar PDF
          </Button>
        </div>
      </SheetHeader>

      <SheetContent>
        <div className="space-y-6">

          {/* ── Score header ──────────────────────────────────────────────────── */}
          <div className={cn("flex items-center gap-5 rounded-xl border p-4", isSoft ? "bg-gradient-to-br from-violet-50/60 to-indigo-50/60 border-violet-100" : "bg-blue-50/40 border-blue-100")}>
            <ScoreDonut score={audit.score} size={100} />
            <div className="space-y-2.5">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Pontuação</p>
                <p className="text-2xl font-extrabold leading-none" style={{ color: scoreColor(audit.score ?? 0) }}>
                  {audit.score ?? 0}<span className="text-sm font-normal text-muted-foreground">/100</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", RISK_STYLE[audit.riskLevel])}>
                  Risco {RISK_LABEL[audit.riskLevel]}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-1 text-xs text-muted-foreground">
                  <SentimentIcon s={audit.sentiment} />
                  {audit.sentiment === "POSITIVO" ? "Positivo" : audit.sentiment === "NEGATIVO" ? "Negativo" : "Neutro"}
                </span>
              </div>
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Calendar className="size-3" />
                {fmtDate(audit.createdAt)}
              </p>
            </div>
          </div>

          {/* ── Attendant info ────────────────────────────────────────────────── */}
          {audit.attendant && (
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {audit.attendant.name.split(" ").slice(0, 2).map((w) => w[0]).join("")}
              </div>
              <div>
                <p className="text-sm font-semibold">{audit.attendant.name}</p>
                <p className="text-[11px] text-muted-foreground">Atendente auditado</p>
              </div>
            </div>
          )}

          {/* ── Coaching / Recommendation ─────────────────────────────────────── */}
          {audit.recommendation && (
            isSoft ? (
              <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-violet-100">
                    <BrainCircuit className="size-3.5 text-violet-600" />
                  </span>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-violet-700">Orientação de coaching</p>
                </div>
                <div
                  className="italic text-sm leading-7 text-violet-900/80 [&_strong]:font-semibold [&_ul]:mt-1 [&_ul]:space-y-1 [&_li]:list-disc [&_li]:ml-4"
                  dangerouslySetInnerHTML={{ __html: md2html(audit.recommendation) }}
                />
              </div>
            ) : (
              <div className="rounded-xl border bg-muted/40 p-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recomendação</p>
                <div
                  className="text-sm leading-7 [&_strong]:font-semibold [&_ul]:mt-1 [&_ul]:space-y-1 [&_li]:list-disc [&_li]:ml-4"
                  dangerouslySetInnerHTML={{ __html: md2html(audit.recommendation) }}
                />
              </div>
            )
          )}

          {/* ── Strengths — soft skills only ──────────────────────────────────── */}
          {isSoft && (audit.strengths?.length ?? 0) > 0 && (
            <div>
              <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-emerald-700">
                <CheckCircle2 className="size-3.5" />
                Pontos fortes observados
              </p>
              <ul className="space-y-1.5">
                {audit.strengths.map((s) => (
                  <li key={s.id} className="flex items-start gap-2.5 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-500" />
                    <div
                      className="[&_strong]:font-semibold"
                      dangerouslySetInnerHTML={{ __html: md2html(s.text) }}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Gaps — soft skills only ───────────────────────────────────────── */}
          {isSoft && (audit.gaps?.length ?? 0) > 0 && (
            <div>
              <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-orange-700">
                <AlertTriangle className="size-3.5" />
                Lacunas de desenvolvimento
              </p>
              <ul className="space-y-1.5">
                {audit.gaps.map((g) => (
                  <li key={g.id} className="flex items-start gap-2.5 rounded-lg bg-orange-50 px-3 py-2.5 text-sm text-orange-900">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-orange-400" />
                    <div
                      className="[&_strong]:font-semibold"
                      dangerouslySetInnerHTML={{ __html: md2html(g.text) }}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Findings ─────────────────────────────────────────────────────── */}
          {audit.findings.length > 0 && (
            <div>
              <p className="mb-2.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Insights da análise</p>
              <ul className="space-y-1.5">
                {audit.findings.map((f) => (
                  <li key={f.id} className="flex items-start gap-2.5 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
                    <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <div
                      className="flex-1 [&_strong]:font-semibold [&_ul]:mt-1 [&_ul]:space-y-0.5 [&_li]:list-disc [&_li]:ml-4"
                      dangerouslySetInnerHTML={{ __html: md2html(f.text) }}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Improvement Plan ─────────────────────────────────────────────── */}
          {(audit.suggestions && audit.suggestions.length > 0) && (
            <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Lightbulb className="size-4 text-primary" />
                <p className="text-sm font-semibold">Plano de melhoria</p>
              </div>
              <div className="space-y-4">
                {audit.suggestionsSummary && (
                  <p className="text-sm leading-6 text-muted-foreground">{audit.suggestionsSummary}</p>
                )}
                <div className="space-y-3">
                  {audit.suggestions.map((sug, i) => (
                    <div key={i} className="rounded-lg border bg-white p-3.5 shadow-sm">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <p className="flex-1 text-sm font-semibold">{sug.title}</p>
                        <div className="flex items-center gap-1.5">
                          <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", TIMEFRAME_STYLE[sug.timeframe] ?? "bg-muted text-muted-foreground border-border")}>
                            <Clock className="size-2.5" />
                            {sug.timeframe}
                          </span>
                          <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                            sug.impact === "alto" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-600 border-slate-200"
                          )}>
                            <Zap className="size-2.5" />
                            Impacto {sug.impact}
                          </span>
                        </div>
                      </div>
                      <p className="text-[13px] leading-5.5 text-muted-foreground">{sug.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── NewAuditModal ────────────────────────────────────────────────────────────

type AuditMode = "atendimento" | "colaborador" | "equipe"
type ModalStep = "mode" | "pick" | "dimension"

function NewAuditModal({ open, onClose, companyId, token, onCreated }: {
  open: boolean
  onClose: () => void
  companyId: string
  token: string
  onCreated: () => Promise<void>
}) {
  const [mode,           setMode]           = useState<AuditMode>("atendimento")
  const [step,           setStep]           = useState<ModalStep>("mode")
  const [convs,          setConvs]          = useState<Conversation[]>([])
  const [collabs,        setCollabs]        = useState<Collaborator[]>([])
  const [teams,          setTeams]          = useState<Team[]>([])
  const [loadingList,    setLoadingList]    = useState(false)
  const [selectedConv,   setSelectedConv]   = useState<Conversation | null>(null)
  const [selectedCollab, setSelectedCollab] = useState<Collaborator | null>(null)
  const [selectedTeam,   setSelectedTeam]   = useState<Team | null>(null)
  const [selectedDim,    setSelectedDim]    = useState<DimKey | "">("")
  const [creating,       setCreating]       = useState(false)
  const [error,          setError]          = useState("")
  const [search,         setSearch]         = useState("")

  useEffect(() => {
    if (!open) {
      setMode("atendimento"); setStep("mode")
      setSelectedConv(null); setSelectedCollab(null); setSelectedTeam(null); setSelectedDim("")
      setError(""); setSearch("")
    }
  }, [open])

  useEffect(() => {
    if (step !== "pick" || !companyId) return
    setLoadingList(true)
    if (mode === "atendimento") {
      fetch(`/api/conversations?companyId=${companyId}&limit=80`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((d) => setConvs(Array.isArray(d) ? d : (d.conversations ?? [])))
        .catch(console.error)
        .finally(() => setLoadingList(false))
    } else if (mode === "colaborador") {
      fetch(`/api/teams/users?companyId=${companyId}`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((d) => setCollabs(Array.isArray(d) ? d : []))
        .catch(console.error)
        .finally(() => setLoadingList(false))
    } else {
      fetch(`/api/teams?companyId=${companyId}`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((d) => setTeams(Array.isArray(d) ? d : []))
        .catch(console.error)
        .finally(() => setLoadingList(false))
    }
  }, [step, mode, companyId, token])

  async function handleCreate() {
    if (!selectedDim) return
    if (mode === "atendimento" && !selectedConv)   return
    if (mode === "colaborador"  && !selectedCollab) return
    if (mode === "equipe"       && !selectedTeam)   return

    setCreating(true); setError("")
    try {
      const body =
        mode === "atendimento" ? { conversationId: selectedConv!.id, dimension: selectedDim, companyId } :
        mode === "colaborador"  ? { attendantId: selectedCollab!.id,  dimension: selectedDim, companyId } :
                                  { teamId: selectedTeam!.id,         dimension: selectedDim, companyId }

      const res = await fetch("/api/auditorias", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(d.error ?? "Erro ao criar auditoria")
      }
      await onCreated()
    } catch (e) {
      setError(String(e))
    } finally {
      setCreating(false)
    }
  }

  const filteredConvs   = search ? convs.filter((c)   => c.customer?.name?.toLowerCase().includes(search.toLowerCase()) || c.preview?.toLowerCase().includes(search.toLowerCase())) : convs
  const filteredCollabs = search ? collabs.filter((u) => u.name.toLowerCase().includes(search.toLowerCase())) : collabs
  const filteredTeams   = search ? teams.filter((t)   => t.name.toLowerCase().includes(search.toLowerCase())) : teams

  const backLabel =
    mode === "atendimento" ? "Atendimento" :
    mode === "colaborador"  ? "Colaborador" : "Equipe"

  const pickPlaceholder =
    mode === "atendimento" ? "Buscar por cliente..." :
    mode === "colaborador"  ? "Buscar colaborador..." : "Buscar equipe..."

  const dimensionBackLabel =
    mode === "atendimento" ? `Conversa: ${selectedConv?.customer?.name ?? selectedConv?.id}` :
    mode === "colaborador"  ? `Colaborador: ${selectedCollab?.name}` :
                              `Equipe: ${selectedTeam?.name}`

  const currentStep = step === "mode" ? 1 : step === "pick" ? 2 : 3

  const MODE_CARDS: { mode: AuditMode; icon: React.ReactNode; label: string; desc: string; colorHover: string; colorActive: string }[] = [
    {
      mode: "atendimento",
      icon: <MessageCircle className="size-6 text-blue-600" />,
      label: "Atendimento",
      desc: "Analisa uma conversa específica com um cliente",
      colorHover: "hover:border-blue-300 hover:bg-blue-50",
      colorActive: "border-blue-300 bg-blue-50 ring-1 ring-blue-100",
    },
    {
      mode: "colaborador",
      icon: <Users className="size-6 text-violet-600" />,
      label: "Colaborador",
      desc: "Analisa os últimos atendimentos de um membro da equipe",
      colorHover: "hover:border-violet-300 hover:bg-violet-50",
      colorActive: "border-violet-300 bg-violet-50 ring-1 ring-violet-100",
    },
    {
      mode: "equipe",
      icon: <Users className="size-6 text-emerald-600" />,
      label: "Equipe completa",
      desc: "Avalia o desempenho coletivo analisando conversas de todos os membros",
      colorHover: "hover:border-emerald-300 hover:bg-emerald-50",
      colorActive: "border-emerald-300 bg-emerald-50 ring-1 ring-emerald-100",
    },
  ]

  return (
    <Sheet open={open} onClose={onClose} className="w-[max(520px,50vw)]">
      <SheetHeader>
        <div className="flex-1 min-w-0">
          <SheetTitle>Nova auditoria com IA</SheetTitle>
          <SheetDescription className="mt-0.5">
            Passo {currentStep} de 3 —{" "}
            {step === "mode" ? "Escolha o escopo" : step === "pick" ? `Selecione ${backLabel.toLowerCase()}` : "Selecione a dimensão"}
          </SheetDescription>
        </div>
      </SheetHeader>

      <SheetContent>

        {/* ── Step 1: mode ──────────────────────────────────────────────────── */}
        {step === "mode" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">O que você quer auditar?</p>
            <div className="flex flex-col gap-3">
              {MODE_CARDS.map((card) => (
                <button
                  key={card.mode}
                  onClick={() => { setMode(card.mode); setStep("pick"); setSearch("") }}
                  className={cn(
                    "flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all",
                    mode === card.mode ? card.colorActive : `border-muted ${card.colorHover}`,
                  )}
                >
                  <span className={cn(
                    "flex size-12 shrink-0 items-center justify-center rounded-full",
                    card.mode === "atendimento" ? "bg-blue-100" : card.mode === "colaborador" ? "bg-violet-100" : "bg-emerald-100",
                  )}>
                    {card.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{card.label}</p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground leading-5">{card.desc}</p>
                  </div>
                  <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 2: pick ──────────────────────────────────────────────────── */}
        {step === "pick" && (
          <div className="space-y-3">
            <button
              onClick={() => { setStep("mode"); setSearch("") }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronRight className="size-3 rotate-180" />
              {backLabel}
            </button>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder={pickPlaceholder} className="pl-8 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            {loadingList ? (
              <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /><span className="text-sm">Carregando…</span>
              </div>
            ) : mode === "atendimento" ? (
              <div className="max-h-[520px] space-y-1 overflow-y-auto">
                {filteredConvs.length === 0
                  ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma conversa encontrada.</p>
                  : filteredConvs.map((conv) => (
                    <button key={conv.id}
                      onClick={() => { setSelectedConv(conv); setStep("dimension") }}
                      className="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/40"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-100">
                        <MessageCircle className="size-4 text-blue-600" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{conv.customer?.name ?? "Sem cliente"}</p>
                        {conv.preview && <p className="truncate text-[11px] text-muted-foreground">{conv.preview}</p>}
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {CHANNEL_LABEL[conv.channel] ?? conv.channel}{conv.lastMessageAt && ` · ${fmtDate(conv.lastMessageAt)}`}
                        </p>
                      </div>
                      <ChevronRight className="mt-1 size-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  ))
                }
              </div>
            ) : mode === "colaborador" ? (
              <div className="max-h-[520px] space-y-1 overflow-y-auto">
                {filteredCollabs.length === 0
                  ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhum colaborador encontrado.</p>
                  : filteredCollabs.map((user) => (
                    <button key={user.id}
                      onClick={() => { setSelectedCollab(user); setStep("dimension") }}
                      className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:border-violet-200 hover:bg-violet-50/40"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                        {user.name.split(" ").slice(0, 2).map((w) => w[0]).join("")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{user.name}</p>
                        <p className="text-[11px] text-muted-foreground">{user.role}</p>
                      </div>
                      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  ))
                }
              </div>
            ) : (
              <div className="max-h-[520px] space-y-1 overflow-y-auto">
                {filteredTeams.length === 0
                  ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma equipe encontrada.</p>
                  : filteredTeams.map((team) => (
                    <button key={team.id}
                      onClick={() => { setSelectedTeam(team); setStep("dimension") }}
                      className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:border-emerald-200 hover:bg-emerald-50/40"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                        {team.name.split(" ").slice(0, 2).map((w) => w[0]).join("")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{team.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {team.members.length} membro{team.members.length !== 1 ? "s" : ""}
                          {team.manager ? ` · Gestor: ${team.manager.name}` : ""}
                        </p>
                      </div>
                      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  ))
                }
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: dimension ─────────────────────────────────────────────── */}
        {step === "dimension" && (
          <div className="space-y-4">
            <button
              onClick={() => { setStep("pick"); setSelectedDim("") }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronRight className="size-3 rotate-180" />
              {dimensionBackLabel}
            </button>

            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-blue-600">Técnico</p>
              <div className="grid grid-cols-2 gap-1.5">
                {TECH_DIMS.map(([key, dim]) => (
                  <button key={key} onClick={() => setSelectedDim(key)}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-left text-sm transition-all",
                      selectedDim === key ? "border-blue-300 bg-blue-50 font-medium text-blue-800 ring-2 ring-blue-100" : "hover:border-blue-200 hover:bg-blue-50/50",
                    )}
                  >{dim.label}</button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-violet-600">Comportamental (Soft Skills)</p>
              <div className="grid grid-cols-2 gap-1.5">
                {SOFT_DIMS.map(([key, dim]) => (
                  <button key={key} onClick={() => setSelectedDim(key)}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-left text-sm transition-all",
                      selectedDim === key ? "border-violet-300 bg-violet-50 font-medium text-violet-800 ring-2 ring-violet-100" : "hover:border-violet-200 hover:bg-violet-50/50",
                    )}
                  >{dim.label}</button>
                ))}
              </div>
            </div>

            {mode === "colaborador" && (
              <p className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-[11px] text-violet-700">
                A IA analisará as últimas 5 conversas do colaborador e entregará uma visão agregada de padrões comportamentais.
              </p>
            )}
            {mode === "equipe" && (
              <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
                A IA analisará até 15 conversas recentes de todos os membros da equipe e entregará uma avaliação coletiva de desempenho.
              </p>
            )}

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <Button className="w-full gap-2" disabled={!selectedDim || creating} onClick={handleCreate}>
              {creating
                ? <><Loader2 className="size-4 animate-spin" /> Analisando com IA…</>
                : <><Sparkles className="size-4" /> Iniciar análise</>
              }
            </Button>
            <p className="text-center text-[11px] text-muted-foreground">
              A análise pode levar alguns segundos dependendo do volume de mensagens.
            </p>
          </div>
        )}

      </SheetContent>
    </Sheet>
  )
}
