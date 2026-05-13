import { useMemo, useState } from "react"
import {
  CheckCircle2,
  ClipboardList,
  Copy,
  Loader2,
  Mail,
  MessageCircle,
  Plus,
  Save,
  Search,
  Smartphone,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  createBlankRop,
  loadRops,
  ropCategories,
  ropChannelLabel,
  ropChannels,
  saveRops,
  type Rop,
  type RopChannel,
} from "@/lib/rops"

const channelIcon: Record<RopChannel, typeof MessageCircle> = {
  BOTH: ClipboardList,
  WHATSAPP: MessageCircle,
  EMAIL: Mail,
}

const channelTone: Record<RopChannel, { icon: string; pill: string; text: string }> = {
  BOTH: {
    icon: "bg-violet-50 text-violet-700 ring-violet-100",
    pill: "border-violet-200 bg-violet-50 text-violet-700",
    text: "text-violet-700",
  },
  WHATSAPP: {
    icon: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    pill: "border-emerald-200 bg-emerald-50 text-emerald-700",
    text: "text-emerald-700",
  },
  EMAIL: {
    icon: "bg-sky-50 text-sky-700 ring-sky-100",
    pill: "border-sky-200 bg-sky-50 text-sky-700",
    text: "text-sky-700",
  },
}

export default function RopsPage() {
  const [rops, setRops] = useState<Rop[]>(() => loadRops())
  const [selectedId, setSelectedId] = useState(() => rops[0]?.id ?? "")
  const [query, setQuery] = useState("")
  const [channel, setChannel] = useState<RopChannel | "ALL">("ALL")
  const [aiPrompt, setAiPrompt] = useState("")
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [savedPulse, setSavedPulse] = useState(false)

  const selected = rops.find((rop) => rop.id === selectedId) ?? rops[0] ?? null

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return rops.filter((rop) => {
      const matchesChannel = channel === "ALL" || rop.channel === channel || rop.channel === "BOTH"
      const matchesQuery = !term || [rop.title, rop.shortcut, rop.category, rop.text].some((value) => value.toLowerCase().includes(term))
      return matchesChannel && matchesQuery
    })
  }, [rops, query, channel])

  function persist(next: Rop[]) {
    setRops(next)
    saveRops(next)
  }

  function showSaved() {
    setSavedPulse(true)
    window.setTimeout(() => setSavedPulse(false), 1400)
  }

  function updateSelected(patch: Partial<Rop>) {
    if (!selected) return
    persist(rops.map((rop) => (
      rop.id === selected.id ? { ...rop, ...patch, updatedAt: new Date().toISOString() } : rop
    )))
  }

  function createRop() {
    const next = createBlankRop()
    persist([next, ...rops])
    setSelectedId(next.id)
  }

  function duplicateRop(rop: Rop) {
    const copy = {
      ...rop,
      id: `rop-${Date.now()}`,
      title: `${rop.title} (cópia)`,
      updatedAt: new Date().toISOString(),
    }
    persist([copy, ...rops])
    setSelectedId(copy.id)
  }

  function deleteRop(id: string) {
    const next = rops.filter((rop) => rop.id !== id)
    persist(next)
    if (selectedId === id) setSelectedId(next[0]?.id ?? "")
  }

  function saveSelected() {
    if (!selected) return
    updateSelected({ updatedAt: new Date().toISOString() })
    showSaved()
  }

  function normalizeShortcut(value: string) {
    return `/${value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 22) || "rop"}`
  }

  function generateAiRop() {
    const prompt = aiPrompt.trim()
    if (!prompt) return

    setAiGenerating(true)
    window.setTimeout(() => {
      const targetChannel = selected?.channel ?? "BOTH"
      const title = prompt.length > 52 ? `${prompt.slice(0, 49)}...` : prompt
      const generated: Rop = {
        id: `rop-ai-${Date.now()}`,
        title: title.charAt(0).toUpperCase() + title.slice(1),
        shortcut: normalizeShortcut(prompt),
        category: selected?.category ?? "Suporte",
        channel: targetChannel,
        active: true,
        updatedAt: new Date().toISOString(),
        text: targetChannel === "EMAIL"
          ? `Olá,\n\nObrigado pelo retorno. Sobre ${prompt.toLowerCase()}, já registrei a solicitação e vou conduzir os próximos passos por aqui.\n\nPara seguirmos com segurança, peço que confirme os dados principais e qualquer detalhe adicional que ajude na análise.\n\nAtenciosamente,`
          : `Olá! Sobre ${prompt.toLowerCase()}, já registrei sua solicitação por aqui. Vou verificar os dados e te retorno com o próximo passo. Se puder, me envie qualquer detalhe adicional para acelerar a análise.`,
      }

      persist([generated, ...rops])
      setSelectedId(generated.id)
      setAiPrompt("")
      setAiGenerating(false)
      setAiPanelOpen(false)
      showSaved()
    }, 700)
  }

  return (
    <div className="flex min-h-0 flex-1 gap-4 overflow-hidden p-4">
      <aside className="flex w-[390px] shrink-0 flex-col overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="border-b p-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar ROP, atalho ou categoria"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <Button size="icon" onClick={createRop} aria-label="Nova ROP">
              <Plus />
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[
              { value: "ALL", label: "Todas" },
              ...ropChannels,
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setChannel(item.value as RopChannel | "ALL")}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted",
                  item.value !== "ALL" && channelTone[item.value as RopChannel].pill,
                  channel === item.value && "ring-2 ring-primary/15",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {filtered.map((rop) => {
            const Icon = channelIcon[rop.channel]
            const tone = channelTone[rop.channel]
            return (
              <button
                key={rop.id}
                type="button"
                onClick={() => setSelectedId(rop.id)}
                className={cn(
                  "flex w-full gap-3 border-b px-3 py-3 text-left transition-colors hover:bg-muted/45",
                  selected?.id === rop.id && "bg-primary/5",
                )}
              >
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md ring-1", tone.icon)}>
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">{rop.title || "ROP sem título"}</span>
                    {!rop.active && <Badge variant="secondary">Inativa</Badge>}
                  </span>
                  <span className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                    <span className={cn("font-medium", tone.text)}>{ropChannelLabel(rop.channel)}</span>
                    <span>{rop.shortcut} · {rop.category}</span>
                  </span>
                  <span className="mt-1 line-clamp-2 text-xs leading-4 text-muted-foreground">{rop.text || "Sem conteúdo definido."}</span>
                </span>
              </button>
            )
          })}
          {filtered.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma ROP encontrada.</div>
          )}
        </div>
      </aside>

      <section className="min-w-0 flex-1 overflow-y-auto rounded-lg border bg-white shadow-sm">
        {selected ? (
          <div className="p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <ClipboardList className="size-5 text-primary" />
                  <h2 className="text-lg font-semibold">Resposta operacional padronizada</h2>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Cadastre textos aprovados para atendimento rápido e consistente.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => setAiPanelOpen((open) => !open)}
                  className={cn(aiPanelOpen && "bg-primary/90")}
                >
                  <Sparkles className="size-4" />
                  Criar com IA
                </Button>
                <Button variant="outline" onClick={saveSelected}>
                  <Save className="size-4" />
                  Salvar
                </Button>
                <Button variant="outline" onClick={() => duplicateRop(selected)}>
                  <Copy className="size-4" />
                  Duplicar
                </Button>
                <Button variant="destructive" onClick={() => deleteRop(selected.id)}>
                  <Trash2 className="size-4" />
                  Excluir
                </Button>
              </div>
            </div>

            {savedPulse && (
              <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                ROP salva e disponível no atendimento.
              </div>
            )}

            {aiPanelOpen && (
              <Card className="mb-4 border-primary/20 bg-primary/5">
                <CardContent className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                  <label className="grid gap-1.5 text-xs font-medium">
                    Criar ROP com IA
                    <textarea
                      className="min-h-20 resize-none rounded-md border bg-white px-3 py-2 text-sm leading-5 outline-none focus:ring-2 focus:ring-ring"
                      placeholder="Ex.: resposta para pedir dados de integração, avisar cliente sobre SLA, follow-up pós-proposta..."
                      value={aiPrompt}
                      onChange={(event) => setAiPrompt(event.target.value)}
                    />
                  </label>
                  <Button onClick={generateAiRop} disabled={!aiPrompt.trim() || aiGenerating}>
                    {aiGenerating ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
                    Gerar e salvar
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="grid gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Configuração da ROP</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                      <label className="grid gap-1.5 text-xs font-medium">
                        Título
                        <Input value={selected.title} onChange={(event) => updateSelected({ title: event.target.value })} />
                      </label>
                      <label className="grid gap-1.5 text-xs font-medium">
                        Atalho
                        <Input value={selected.shortcut} onChange={(event) => updateSelected({ shortcut: event.target.value })} />
                      </label>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <label className="grid gap-1.5 text-xs font-medium">
                        Canal
                        <select
                          className="h-9 rounded-md border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                          value={selected.channel}
                          onChange={(event) => updateSelected({ channel: event.target.value as RopChannel })}
                        >
                          {ropChannels.map((item) => (
                            <option key={item.value} value={item.value}>{item.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1.5 text-xs font-medium">
                        Categoria
                        <select
                          className="h-9 rounded-md border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                          value={selected.category}
                          onChange={(event) => updateSelected({ category: event.target.value })}
                        >
                          {ropCategories.map((item) => (
                            <option key={item} value={item}>{item}</option>
                          ))}
                        </select>
                      </label>
                      <label className="flex items-end gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs font-medium">
                        <input
                          type="checkbox"
                          checked={selected.active}
                          onChange={(event) => updateSelected({ active: event.target.checked })}
                          className="accent-primary"
                        />
                        ROP ativa para uso no atendimento
                      </label>
                    </div>

                    <label className="grid gap-1.5 text-xs font-medium">
                      Texto padronizado
                      <textarea
                        className="min-h-72 resize-y rounded-md border bg-white px-3 py-2 text-sm leading-5 outline-none focus:ring-2 focus:ring-ring"
                        value={selected.text}
                        onChange={(event) => updateSelected({ text: event.target.value })}
                      />
                    </label>

                    <div className="rounded-lg border bg-muted/25 p-3">
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold">
                        <CheckCircle2 className="size-4 text-emerald-600" />
                        Preview operacional
                      </div>
                      <div className="rounded-md bg-white p-3 text-sm leading-6 shadow-sm">
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium", channelTone[selected.channel].pill)}>
                            {(() => {
                              const Icon = channelIcon[selected.channel]
                              return <Icon className="size-3" />
                            })()}
                            {ropChannelLabel(selected.channel)}
                          </span>
                          <Badge variant="secondary">{selected.category}</Badge>
                          <Badge variant={selected.active ? "success" : "secondary"}>{selected.active ? "Ativa" : "Inativa"}</Badge>
                        </div>
                        <p className="whitespace-pre-wrap">{selected.text || "Digite o texto da resposta padronizada."}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {(selected.channel === "WHATSAPP" || selected.channel === "BOTH") && (
                <aside className="rounded-lg border bg-slate-950 p-3 shadow-sm">
                <div className="mx-auto w-full max-w-[300px] rounded-[2rem] border border-slate-700 bg-slate-900 p-2 shadow-2xl">
                  <div className="overflow-hidden rounded-[1.55rem] bg-[#e7ddd2]">
                    <div className="flex items-center gap-2 bg-[#075e54] px-3 py-2 text-white">
                      <span className="flex size-8 items-center justify-center rounded-full bg-white/20">
                        <Smartphone className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">Cliente</span>
                        <span className="block text-[11px] text-white/75">online</span>
                      </span>
                    </div>
                    <div className="min-h-[420px] px-3 py-4">
                      <div className="ml-auto max-w-[88%] rounded-lg bg-[#dcf8c6] px-3 py-2 text-[13px] leading-5 text-slate-900 shadow-sm">
                        <p className="whitespace-pre-wrap">{selected.text || "Digite o texto para visualizar como o cliente receberia no WhatsApp."}</p>
                        <p className="mt-1 text-right text-[10px] text-slate-500">12:48</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-[#f0f0f0] px-3 py-2">
                      <div className="h-8 flex-1 rounded-full bg-white" />
                      <div className="size-8 rounded-full bg-[#128c7e]" />
                    </div>
                  </div>
                </div>
              </aside>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Crie a primeira ROP para começar.</div>
        )}
      </section>
    </div>
  )
}
