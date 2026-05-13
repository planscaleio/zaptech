import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import {
  Radio, Plus, X, Users, Clock, Shield, Zap, AlertTriangle,
  CheckCircle2, Send, Loader2, Info, Sparkles, Timer, MessageSquare,
  ChevronRight, BarChart2, Pause, Play, Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetHeader, SheetContent } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Segment {
  id: string
  name: string
  customerCount: number
}

type DelayMode = "smart_short" | "smart_medium" | "smart_long" | "smart_xlarge"

interface Broadcast {
  id: string
  name: string
  variations: string[]   // 1–3 message variations (A/B/C test)
  segmentId: string
  segmentName: string
  audienceCount: number
  delay: DelayMode
  status: "RASCUNHO" | "AGENDADO" | "ENVIANDO" | "CONCLUIDO" | "PAUSADO"
  sentCount: number
  createdAt: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DELAY_OPTIONS: {
  id: DelayMode; label: string; range: string; seconds: [number, number]
  risk: "low" | "high"; desc: string
}[] = [
  { id: "smart_short",  label: "Rápido",       range: "5–15s",   seconds: [5, 15],    risk: "high", desc: "Maior velocidade, risco moderado de detecção pelo WhatsApp" },
  { id: "smart_medium", label: "Equilibrado",   range: "20–60s",  seconds: [20, 60],   risk: "low",  desc: "Recomendado — bom equilíbrio entre velocidade e segurança" },
  { id: "smart_long",   label: "Seguro",        range: "60–120s", seconds: [60, 120],  risk: "low",  desc: "Mais lento, muito seguro para bases maiores" },
  { id: "smart_xlarge", label: "Ultra seguro",  range: "2–5 min", seconds: [120, 300], risk: "low",  desc: "Ideal para bases acima de 1.000 contatos" },
]

function calcEstimate(count: number, delay: DelayMode) {
  const opt = DELAY_OPTIONS.find((d) => d.id === delay)!
  const minMin = Math.ceil((count * opt.seconds[0]) / 60)
  const maxMin = Math.ceil((count * opt.seconds[1]) / 60)
  const perHour = Math.floor(3600 / ((opt.seconds[0] + opt.seconds[1]) / 2))
  return { minMin, maxMin, perHour }
}

function fmtDur(m: number) {
  if (m < 60) return `${m}min`
  const h = Math.floor(m / 60); const r = m % 60
  return r > 0 ? `${h}h ${r}min` : `${h}h`
}

function safetyScore(d: DelayMode) {
  return d === "smart_short" ? 55 : d === "smart_medium" ? 80 : d === "smart_long" ? 92 : 98
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_MAP: Record<Broadcast["status"], { label: string; cls: string }> = {
  RASCUNHO:  { label: "Rascunho",  cls: "bg-slate-100 text-slate-600 border-slate-200" },
  AGENDADO:  { label: "Agendado",  cls: "bg-blue-50 text-blue-700 border-blue-200" },
  ENVIANDO:  { label: "Enviando",  cls: "bg-amber-50 text-amber-700 border-amber-200" },
  CONCLUIDO: { label: "Concluído", cls: "bg-green-50 text-green-700 border-green-200" },
  PAUSADO:   { label: "Pausado",   cls: "bg-red-50 text-red-600 border-red-200" },
}

// ─── Create Sheet ─────────────────────────────────────────────────────────────

interface CreateSheetProps {
  open: boolean
  segments: Segment[]
  editing?: Broadcast | null
  onClose: () => void
  onCreate: (b: Broadcast) => void
}

const VARIATION_LABELS = ["A", "B", "C"]
const VARIATION_COLORS = [
  "border-primary/40 bg-primary/5",
  "border-violet-300/60 bg-violet-50/60",
  "border-emerald-300/60 bg-emerald-50/60",
]
const VARIATION_HEADER_COLORS = [
  "text-primary bg-primary/8",
  "text-violet-700 bg-violet-50",
  "text-emerald-700 bg-emerald-50",
]

function CreateSheet({ open, segments, editing, onClose, onCreate }: CreateSheetProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [name, setName] = useState("")
  const [segmentId, setSegmentId] = useState("")
  const [variations, setVariations] = useState<string[]>([""])
  const [delay, setDelay] = useState<DelayMode>("smart_medium")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // AI generation state
  const [aiContext, setAiContext] = useState("")
  const [aiLoading, setAiLoading] = useState(false)
  const [aiMode, setAiMode] = useState(false)

  const seg = segments.find((s) => s.id === segmentId)
  const audience = seg?.customerCount ?? 0
  const estimate = audience > 0 ? calcEstimate(audience, delay) : null
  const score = safetyScore(delay)
  const perVariation = variations.length > 1 ? Math.floor(audience / variations.length) : audience

  useEffect(() => {
    if (open) {
      setStep(1); setError(null); setAiContext(""); setAiMode(false)
      if (editing) {
        setName(editing.name)
        setSegmentId(editing.segmentId)
        setVariations(editing.variations.length > 0 ? editing.variations : [""])
        setDelay(editing.delay)
      } else {
        setName(""); setSegmentId(""); setVariations([""]); setDelay("smart_medium")
      }
    }
  }, [open, editing?.id])

  function setVariation(i: number, val: string) {
    setVariations((prev) => prev.map((v, idx) => idx === i ? val : v))
  }
  function addVariation() {
    if (variations.length < 3) setVariations((prev) => [...prev, ""])
  }
  function removeVariation(i: number) {
    setVariations((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function generateWithAI() {
    if (!aiContext.trim()) return
    setAiLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/ai/broadcast-variations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: aiContext, segmentName: seg?.name ?? "clientes", count: 3 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Erro na IA")
      setVariations(data.variations)
      setAiMode(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao gerar")
    } finally {
      setAiLoading(false)
    }
  }

  const canProceedStep2 = variations.some((v) => v.trim().length >= 10)

  function save() {
    setSaving(true)
    setTimeout(() => {
      onCreate({
        id: editing?.id ?? `local-${Date.now()}`,
        name: name.trim(),
        variations: variations.filter((v) => v.trim().length > 0),
        segmentId, segmentName: seg?.name ?? "", audienceCount: audience,
        delay, status: "RASCUNHO",
        sentCount: editing?.sentCount ?? 0,
        createdAt: editing?.createdAt ?? new Date().toISOString(),
      })
      setSaving(false)
      onClose()
    }, 400)
  }

  return (
    <Sheet open={open} onClose={onClose}>
      {/* Header */}
      <SheetHeader>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Radio className="size-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{editing ? "Editar rascunho" : "Nova transmissão"}</p>
          <p className="text-xs text-muted-foreground">
            {step === 1 ? "Defina o público-alvo" : step === 2 ? "Escreva a mensagem" : "Configure a velocidade de envio"}
          </p>
        </div>
        {/* Step dots */}
        <div className="flex items-center gap-1.5 mr-2">
          {([1, 2, 3] as const).map((s) => (
            <div key={s} className={cn(
              "h-1.5 rounded-full transition-all duration-200",
              s < step ? "w-4 bg-primary/40" : s === step ? "w-5 bg-primary" : "w-1.5 bg-muted"
            )} />
          ))}
        </div>
        <button onClick={onClose} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 transition-colors">
          <X className="size-4" />
        </button>
      </SheetHeader>

      <SheetContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">

          {/* ── Step 1 ── */}
          {step === 1 && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nome da transmissão</label>
                <Input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Black Friday — Clientes VIP"
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Segmento de destino
                </label>
                {segments.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-6 text-center text-muted-foreground">
                    <Users className="size-6 opacity-30" />
                    <p className="text-xs">Nenhum segmento criado</p>
                    <p className="text-[11px] opacity-70">Crie um segmento na tela de Segmentação primeiro</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {segments.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSegmentId(s.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5",
                          segmentId === s.id ? "border-primary/40 bg-primary/5 ring-1 ring-primary/15" : "border-transparent"
                        )}
                      >
                        <div className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                          segmentId === s.id ? "border-primary bg-primary" : "border-muted-foreground/30"
                        )}>
                          {segmentId === s.id && <div className="size-1.5 rounded-full bg-white" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{s.name}</p>
                        </div>
                        <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                          <Users className="size-3" />{s.customerCount.toLocaleString("pt-BR")}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {seg && (
                <div className="flex items-center gap-3 rounded-xl border bg-primary/5 px-3 py-2.5">
                  <Users className="size-4 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-primary">{audience.toLocaleString("pt-BR")} pessoas receberão</p>
                    <p className="text-xs text-muted-foreground">Baseado no segmento "{seg.name}"</p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Step 2 ── */}
          {step === 2 && (
            <>
              {/* AI mode panel */}
              {aiMode ? (
                <div className="overflow-hidden rounded-xl border border-primary/30 bg-primary/5">
                  <div className="flex items-center gap-2 border-b border-primary/20 px-3 py-2.5">
                    <Sparkles className="size-3.5 text-primary" />
                    <p className="text-xs font-semibold text-primary">Gerar variações com IA</p>
                    <button onClick={() => setAiMode(false)} className="ml-auto text-muted-foreground hover:text-foreground">
                      <X className="size-3.5" />
                    </button>
                  </div>
                  <div className="p-3 space-y-3">
                    <p className="text-[12px] text-muted-foreground leading-4">
                      Descreva o objetivo da mensagem — produto, oferta, tom desejado — e a IA criará 3 variações distintas prontas para teste A/B/C.
                    </p>
                    <textarea
                      autoFocus
                      className="min-h-24 w-full resize-none rounded-lg border bg-white px-3 py-2.5 text-sm leading-5 outline-none focus:ring-2 focus:ring-ring"
                      placeholder={`Ex: Quero convidar clientes do segmento "${seg?.name ?? "selecionado"}" para uma demonstração gratuita do nosso produto. Tom: descontraído e direto.`}
                      value={aiContext}
                      onChange={(e) => setAiContext(e.target.value)}
                    />
                    {error && <p className="text-xs text-red-600">{error}</p>}
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={aiContext.trim().length < 15 || aiLoading}
                      onClick={generateWithAI}
                    >
                      {aiLoading
                        ? <><Loader2 className="size-3.5 animate-spin" /> Gerando variações…</>
                        : <><Sparkles className="size-3.5" /> Gerar 3 variações com IA</>}
                    </Button>
                  </div>
                </div>
              ) : (
                /* Toolbar: dicas + botão IA */
                <div className="flex items-center justify-between rounded-xl border bg-amber-50/60 px-3 py-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                    <CheckCircle2 className="size-3.5" /> Mensagens naturais têm maior entrega
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/5"
                    onClick={() => { setAiMode(true); setError(null) }}
                  >
                    <Sparkles className="size-3" /> Gerar com IA
                  </Button>
                </div>
              )}

              {/* Variation cards */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Variações{" "}
                    <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 font-normal normal-case text-[10px]">
                      {variations.length}/3
                    </span>
                  </label>
                  {variations.length < 3 && !aiMode && (
                    <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={addVariation}>
                      <Plus className="size-3" /> Adicionar variação
                    </Button>
                  )}
                </div>

                {variations.length > 1 && audience > 0 && (
                  <div className="flex items-center gap-1.5 rounded-lg border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
                    <Users className="size-3 shrink-0" />
                    Cada variação será enviada para ~{perVariation.toLocaleString("pt-BR")} contatos
                    <span className="ml-1 text-primary font-medium">({variations.length} grupos iguais)</span>
                  </div>
                )}

                {variations.map((v, i) => (
                  <div key={i} className={cn("overflow-hidden rounded-xl border", VARIATION_COLORS[i])}>
                    {/* Card header */}
                    <div className={cn("flex items-center justify-between px-3 py-1.5", VARIATION_HEADER_COLORS[i])}>
                      <span className="text-[11px] font-bold tracking-widest">VARIAÇÃO {VARIATION_LABELS[i]}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] opacity-60">{v.length}/1000</span>
                        {variations.length > 1 && (
                          <button onClick={() => removeVariation(i)} className="opacity-50 hover:opacity-100 transition-opacity">
                            <X className="size-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Textarea */}
                    <textarea
                      className="w-full resize-none bg-transparent px-3 py-2.5 text-sm leading-5 outline-none min-h-24"
                      placeholder={
                        i === 0 ? "Ex: Oi [Nome], tudo bem? Vi que você é cliente há um tempo e queria te mostrar uma novidade…"
                        : i === 1 ? "Ex: Uma dúvida rápida — você já conhece nossa nova funcionalidade? Muitos clientes estão adorando…"
                        : "Ex: [Nome], me permite te mostrar algo que pode fazer diferença pra você? Leva só 2 minutos…"
                      }
                      value={v}
                      maxLength={1000}
                      onChange={(e) => setVariation(i, e.target.value)}
                    />
                    {/* Preview bubble */}
                    {v.trim().length >= 10 && (
                      <div className="border-t bg-muted/20 px-3 py-2">
                        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Prévia</p>
                        <div className="flex justify-end">
                          <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[#dcf8c6] px-3 py-2 shadow-sm">
                            <p className="text-xs leading-5 text-gray-900 whitespace-pre-wrap">{v.trim()}</p>
                            <p className="mt-0.5 text-right text-[9px] text-gray-400">✓✓</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Tips */}
              <div className="space-y-1 rounded-xl border bg-muted/30 px-3 py-2.5">
                {[
                  "Use linguagem natural — evite tom de propaganda",
                  "Evite links encurtados (bit.ly) — use URLs diretas",
                  "Variações diferentes = maior proteção e dados de teste A/B",
                ].map((t) => (
                  <div key={t} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-primary" />{t}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Step 3 ── */}
          {step === 3 && (
            <>
              <div className="rounded-xl border bg-blue-50/50 p-3">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-blue-600" />
                  <p className="text-[12px] text-blue-700 leading-4">
                    O WhatsApp detecta envios em massa. Pausas aleatórias entre mensagens simulam comportamento humano e reduzem o risco de banimento do seu número.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Velocidade de envio</label>
                <div className="space-y-1.5">
                  {DELAY_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setDelay(opt.id)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5",
                        delay === opt.id ? "border-primary/40 bg-primary/5 ring-1 ring-primary/15" : "border-transparent"
                      )}
                    >
                      <div className={cn(
                        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                        delay === opt.id ? "border-primary bg-primary" : "border-muted-foreground/30"
                      )}>
                        {delay === opt.id && <div className="size-1.5 rounded-full bg-white" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{opt.label}</span>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">{opt.range}</span>
                          {opt.risk === "high" && (
                            <span className="flex items-center gap-0.5 text-[10px] font-medium text-amber-600">
                              <AlertTriangle className="size-3" />Risco moderado
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Safety bar */}
              <div className="overflow-hidden rounded-xl border p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">
                    {score >= 90 ? "Alta proteção" : score >= 75 ? "Boa proteção" : "Risco moderado"}
                  </span>
                  <span className="font-bold text-foreground">{score}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500",
                      score >= 90 ? "bg-emerald-500" : score >= 75 ? "bg-primary" : "bg-amber-500"
                    )}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>

              {/* Estimate */}
              {estimate && (
                <div className="overflow-hidden rounded-xl border">
                  <div className="bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Estimativa de envio
                  </div>
                  <div className="grid grid-cols-3 divide-x">
                    {[
                      { icon: Users,  label: "Destinatários",  value: audience.toLocaleString("pt-BR") },
                      { icon: Clock,  label: "Tempo estimado",  value: `${fmtDur(estimate.minMin)}–${fmtDur(estimate.maxMin)}` },
                      { icon: Zap,    label: "Por hora",        value: `~${estimate.perHour}` },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex flex-col items-center gap-1 px-3 py-3">
                        <Icon className="size-3.5 text-primary" />
                        <p className="text-sm font-bold">{value}</p>
                        <p className="text-[10px] text-muted-foreground text-center">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="overflow-hidden rounded-xl border">
                <div className="bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Resumo
                </div>
                {[
                  ["Nome", name],
                  ["Segmento", seg?.name ?? "—"],
                  ["Audiência", `${audience.toLocaleString("pt-BR")} contatos`],
                  ["Variações", `${variations.filter((v) => v.trim()).length} mensagem(ns) — teste ${variations.filter((v) => v.trim()).length > 1 ? "A/B/C" : "simples"}`],
                  ["Velocidade", DELAY_OPTIONS.find((d) => d.id === delay)?.label ?? "—"],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between border-t px-3 py-2 text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>

              {error && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs text-red-700">{error}</div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between gap-3 border-t bg-muted/20 px-4 py-3">
          <Button variant="outline" onClick={step === 1 ? onClose : () => setStep((s) => (s - 1) as 1 | 2 | 3)}>
            {step === 1 ? "Cancelar" : "← Voltar"}
          </Button>
          {step < 3 ? (
            <Button
              disabled={step === 1 ? (!name.trim() || !segmentId) : !canProceedStep2}
              onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
            >
              Continuar <ChevronRight className="size-3.5" />
            </Button>
          ) : (
            <Button disabled={saving} onClick={save}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              {editing ? "Salvar alterações" : "Salvar rascunho"}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TransmissaoPage() {
  const auth = useAuth()
  const companyId = auth?.companyId ?? ""

  const [segments, setSegments] = useState<Segment[]>([])
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [selected, setSelected] = useState<Broadcast | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingBroadcast, setEditingBroadcast] = useState<Broadcast | null>(null)

  useEffect(() => {
    if (!companyId) return
    fetch(`/api/segments?companyId=${companyId}`)
      .then((r) => r.json())
      .then((d: Segment[]) => setSegments(d))
      .catch(() => {})
  }, [companyId])

  function handleCreate(b: Broadcast) {
    setBroadcasts((prev) => {
      const idx = prev.findIndex((x) => x.id === b.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = b; return next }
      return [b, ...prev]
    })
    setSelected(b)
  }

  function updateStatus(id: string, status: Broadcast["status"]) {
    setBroadcasts((prev) => prev.map((b) => b.id === id ? { ...b, status } : b))
    setSelected((prev) => prev?.id === id ? { ...prev, status } : prev)
  }

  function deleteBroadcast(id: string) {
    if (!confirm("Excluir esta transmissão? Esta ação não pode ser desfeita.")) return
    setBroadcasts((prev) => prev.filter((b) => b.id !== id))
    setSelected((prev) => prev?.id === id ? null : prev)
  }

  const score = selected ? safetyScore(selected.delay) : null
  const estimate = selected && selected.audienceCount > 0 ? calcEstimate(selected.audienceCount, selected.delay) : null

  return (
    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
      <div className="grid h-full min-w-[1100px] grid-cols-[300px_minmax(500px,1fr)_280px] gap-2.5 p-2.5 md:p-3">

        {/* ── Left: list ── */}
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white shadow-soft">
          <div className="shrink-0 space-y-2 border-b p-3">
            <Button size="sm" className="w-full" onClick={() => { setEditingBroadcast(null); setSheetOpen(true) }}>
              <Plus className="size-3.5" /> Nova transmissão
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2 space-y-1">
            {broadcasts.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
                <Radio className="size-7 opacity-30" />
                <p className="text-xs">Nenhuma transmissão criada</p>
                <p className="text-[11px] opacity-60">Clique em "Nova transmissão" para começar</p>
              </div>
            )}
            {broadcasts.map((b) => {
              const st = STATUS_MAP[b.status]
              const progress = b.audienceCount > 0 ? Math.round((b.sentCount / b.audienceCount) * 100) : 0
              return (
                <button
                  key={b.id}
                  onClick={() => setSelected(b)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5",
                    selected?.id === b.id ? "border-primary/40 bg-primary/5 ring-1 ring-primary/15" : "border-transparent"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{b.name}</p>
                    <span className={cn("shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium", st.cls)}>{st.label}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{b.segmentName}</p>
                  <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Users className="size-2.5" />{b.audienceCount.toLocaleString("pt-BR")} contatos
                  </div>
                  {b.status === "ENVIANDO" && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{progress}%</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </aside>

        {/* ── Center: detail / empty state ── */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white shadow-soft">
          {selected ? (
            <>
              {/* Header */}
              <div className="flex shrink-0 items-center gap-3 border-b p-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
                  <Radio className="size-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-semibold">{selected.name}</h2>
                  <p className="text-xs text-muted-foreground">{selected.segmentName} · {selected.audienceCount.toLocaleString("pt-BR")} contatos</p>
                </div>
                <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", STATUS_MAP[selected.status].cls)}>
                  {STATUS_MAP[selected.status].label}
                </span>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">

                {/* Message variations preview */}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Mensagens{selected.variations.length > 1 && <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Teste {["A", "B", "C"].slice(0, selected.variations.length).join("/")}</span>}
                  </p>
                  <div className="space-y-2">
                    {selected.variations.map((v, i) => (
                      <div key={i} className={cn("overflow-hidden rounded-xl border", VARIATION_COLORS[i])}>
                        {selected.variations.length > 1 && (
                          <div className={cn("px-3 py-1 text-[10px] font-bold tracking-widest", VARIATION_HEADER_COLORS[i])}>
                            VARIAÇÃO {VARIATION_LABELS[i]}
                            {selected.audienceCount > 0 && <span className="ml-2 font-normal opacity-70">~{Math.floor(selected.audienceCount / selected.variations.length).toLocaleString("pt-BR")} contatos</span>}
                          </div>
                        )}
                        <div className="flex justify-end bg-muted/20 p-3">
                          <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[#dcf8c6] px-3.5 py-2.5 shadow-sm">
                            <p className="text-sm leading-5 text-gray-900 whitespace-pre-wrap">{v}</p>
                            <p className="mt-1 text-right text-[10px] text-gray-400">✓✓</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stats grid */}
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Métricas</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { icon: Users,  label: "Destinatários", value: selected.audienceCount.toLocaleString("pt-BR") },
                      { icon: Send,   label: "Enviadas",      value: selected.sentCount.toLocaleString("pt-BR") },
                      { icon: Clock,  label: "Duração est.", value: estimate ? `${fmtDur(estimate.minMin)}–${fmtDur(estimate.maxMin)}` : "—" },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex flex-col items-center gap-1 rounded-xl border bg-muted/30 px-3 py-3">
                        <Icon className="size-3.5 text-primary" />
                        <p className="text-base font-bold">{value}</p>
                        <p className="text-[10px] text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Safety bar */}
                {score !== null && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Índice de proteção anti-banimento</p>
                    <div className="overflow-hidden rounded-xl border p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{score >= 90 ? "Alta proteção" : score >= 75 ? "Boa proteção" : "Risco moderado"}</span>
                        <span className="font-bold">{score}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full transition-all", score >= 90 ? "bg-emerald-500" : score >= 75 ? "bg-primary" : "bg-amber-500")}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {DELAY_OPTIONS.find((d) => d.id === selected.delay)?.desc}
                      </p>
                    </div>
                  </div>
                )}

                {/* How it works */}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Como funciona o envio seguro</p>
                  <div className="overflow-hidden rounded-xl border divide-y">
                    {[
                      { icon: Users,        label: "Segmento selecionado",    desc: "Apenas contatos do segmento escolhido recebem" },
                      { icon: Timer,        label: "Pausas aleatórias",       desc: `Intervalo de ${DELAY_OPTIONS.find((d) => d.id === selected.delay)?.range} entre cada mensagem` },
                      { icon: MessageSquare,label: "Simulação humana",        desc: "O sistema varia o tempo para parecer digitação natural" },
                      { icon: Shield,       label: "Menor risco de banimento",desc: "Comportamento humano = menor detecção pelo WhatsApp" },
                    ].map(({ icon: Icon, label, desc }) => (
                      <div key={label} className="flex items-start gap-3 px-3 py-2.5">
                        <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <Icon className="size-3 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs font-medium">{label}</p>
                          <p className="text-[11px] text-muted-foreground">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions footer */}
              <div className="shrink-0 flex items-center gap-2 border-t bg-muted/20 p-3">
                {selected.status === "RASCUNHO" && (
                  <>
                    <Button size="sm" className="flex-1" onClick={() => updateStatus(selected.id, "ENVIANDO")}>
                      <Send className="size-3.5" /> Iniciar envio
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setEditingBroadcast(selected); setSheetOpen(true) }}>
                      Editar
                    </Button>
                    <Button
                      size="sm" variant="outline"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                      onClick={() => deleteBroadcast(selected.id)}
                    >
                      <Trash2 className="size-3.5" /> Excluir
                    </Button>
                  </>
                )}
                {selected.status === "ENVIANDO" && (
                  <>
                    <Button
                      size="sm" variant="outline"
                      className="flex-1 border-amber-200 text-amber-700 hover:bg-amber-50"
                      onClick={() => updateStatus(selected.id, "PAUSADO")}
                    >
                      <Pause className="size-3.5" /> Pausar envio
                    </Button>
                    <Button
                      size="sm" variant="outline"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                      onClick={() => deleteBroadcast(selected.id)}
                    >
                      <Trash2 className="size-3.5" /> Cancelar
                    </Button>
                  </>
                )}
                {selected.status === "PAUSADO" && (
                  <>
                    <Button size="sm" className="flex-1" onClick={() => updateStatus(selected.id, "ENVIANDO")}>
                      <Play className="size-3.5" /> Retomar envio
                    </Button>
                    <Button
                      size="sm" variant="outline"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                      onClick={() => deleteBroadcast(selected.id)}
                    >
                      <Trash2 className="size-3.5" /> Excluir
                    </Button>
                  </>
                )}
                {(selected.status === "CONCLUIDO" || selected.status === "AGENDADO") && (
                  <Button
                    size="sm" variant="outline"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                    onClick={() => deleteBroadcast(selected.id)}
                  >
                    <Trash2 className="size-3.5" /> Excluir
                  </Button>
                )}
              </div>
            </>
          ) : (
            /* Empty state */
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center text-muted-foreground p-8">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/50">
                <Radio className="size-7 opacity-30" />
              </div>
              <div>
                <p className="text-sm font-medium">Selecione uma transmissão</p>
                <p className="mt-0.5 text-xs opacity-70">ou crie uma nova para começar</p>
              </div>
              <Button size="sm" onClick={() => { setEditingBroadcast(null); setSheetOpen(true) }}>
                <Plus className="size-3.5" /> Nova transmissão
              </Button>
            </div>
          )}
        </section>

        {/* ── Right: info panel ── */}
        <aside className="min-h-0 space-y-3 overflow-y-auto pr-1">

          {/* Anti-ban guide */}
          <div className="overflow-hidden rounded-lg border bg-white shadow-soft">
            <div className="flex items-center gap-2 border-b bg-amber-50/60 px-3 py-2.5">
              <Shield className="size-3.5 text-amber-600" />
              <p className="text-xs font-semibold text-amber-800">Proteção anti-banimento</p>
            </div>
            <div className="divide-y">
              {[
                { icon: Clock,        title: "Limite diário",     desc: "Máx. 500–1.000 msgs/dia por número" },
                { icon: BarChart2,    title: "Horário ideal",     desc: "Envie entre 8h e 20h" },
                { icon: AlertTriangle,title: "Monitore a saúde",  desc: "Quedas na entrega indicam bloqueio" },
                { icon: MessageSquare,title: "Varie o texto",     desc: "Evite repetir exatamente a mesma msg" },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-2.5 px-3 py-2.5">
                  <div className="flex size-5 shrink-0 items-center justify-center rounded-md bg-amber-100">
                    <Icon className="size-3 text-amber-700" />
                  </div>
                  <div>
                    <p className="text-xs font-medium">{title}</p>
                    <p className="text-[11px] text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="overflow-hidden rounded-lg border bg-white shadow-soft">
            <div className="border-b px-3 py-2.5">
              <p className="text-xs font-semibold">Visão geral</p>
            </div>
            <div className="divide-y">
              {[
                ["Total de transmissões", String(broadcasts.length)],
                ["Total de contatos alcançados", broadcasts.reduce((a, b) => a + b.audienceCount, 0).toLocaleString("pt-BR")],
                ["Em envio agora", String(broadcasts.filter((b) => b.status === "ENVIANDO").length)],
                ["Concluídas", String(broadcasts.filter((b) => b.status === "CONCLUIDO").length)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between px-3 py-2 text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Info box */}
          <div className="overflow-hidden rounded-lg border bg-primary/5">
            <div className="flex items-start gap-2 p-3">
              <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <div>
                <p className="text-xs font-semibold text-primary">Pausas inteligentes</p>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                  O sistema aguarda um intervalo aleatório entre cada mensagem, simulando comportamento humano e reduzindo o risco de detecção pelo WhatsApp.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <CreateSheet
        open={sheetOpen}
        segments={segments}
        editing={editingBroadcast}
        onClose={() => { setSheetOpen(false); setEditingBroadcast(null) }}
        onCreate={handleCreate}
      />
    </div>
  )
}
