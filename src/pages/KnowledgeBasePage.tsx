import { useEffect, useMemo, useRef, useState } from "react"
import {
  Bold,
  BookOpenText,
  CheckCircle2,
  Copy,
  Heading2,
  Italic,
  Link,
  List,
  ListOrdered,
  Loader2,
  Plus,
  Quote,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  createBlankKnowledgeArticle,
  formatKnowledgeChannels,
  htmlToPlainText,
  knowledgeCategories,
  knowledgeChannels,
  knowledgeStatusLabel,
  normalizeTagInput,
  type KnowledgeArticle,
  type KnowledgeChannel,
  type KnowledgeStatus,
} from "@/lib/knowledge"

const statusTone: Record<KnowledgeStatus, "success" | "secondary" | "outline"> = {
  PUBLICADO: "success",
  RASCUNHO: "secondary",
  ARQUIVADO: "outline",
}

function RichHtmlEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value
    }
  }, [value])

  function command(commandName: string, commandValue?: string) {
    ref.current?.focus()
    document.execCommand(commandName, false, commandValue)
    onChange(ref.current?.innerHTML ?? "")
  }

  function createLink() {
    const url = window.prompt("URL do link")
    if (!url) return
    command("createLink", url)
  }

  const tools = [
    { label: "Negrito", icon: Bold, action: () => command("bold") },
    { label: "Itálico", icon: Italic, action: () => command("italic") },
    { label: "Título", icon: Heading2, action: () => command("formatBlock", "h3") },
    { label: "Lista", icon: List, action: () => command("insertUnorderedList") },
    { label: "Numerada", icon: ListOrdered, action: () => command("insertOrderedList") },
    { label: "Citação", icon: Quote, action: () => command("formatBlock", "blockquote") },
    { label: "Link", icon: Link, action: createLink },
    { label: "Limpar", icon: X, action: () => command("removeFormat") },
  ]

  return (
    <div className="overflow-hidden rounded-lg border bg-white">
      <div className="flex flex-wrap gap-1 border-b bg-muted/30 p-2">
        {tools.map((tool) => (
          <button
            key={tool.label}
            type="button"
            title={tool.label}
            onClick={tool.action}
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white hover:text-foreground"
          >
            <tool.icon className="size-4" />
          </button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        className="prose prose-sm min-h-80 max-w-none overflow-y-auto px-4 py-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-ring [&_blockquote]:border-l-4 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_h3]:text-base [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
        data-placeholder="Descreva o procedimento, critérios, mensagens de apoio e passos que o atendente deve seguir."
      />
    </div>
  )
}

export default function KnowledgeBasePage() {
  const auth = useAuth()
  const companyId = auth?.companyId ?? ""
  const [articles, setArticles] = useState<KnowledgeArticle[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [draft, setDraft] = useState<KnowledgeArticle | null>(null)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<KnowledgeStatus | "ALL">("ALL")
  const [channelFilter, setChannelFilter] = useState<KnowledgeChannel | "ALL">("ALL")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedPulse, setSavedPulse] = useState(false)
  const [error, setError] = useState("")

  const selected = useMemo(
    () => articles.find((article) => article.id === selectedId) ?? null,
    [articles, selectedId],
  )

  const possibleParents = useMemo(
    () => articles.filter((article) => article.id && article.id !== draft?.id && article.status !== "ARQUIVADO"),
    [articles, draft?.id],
  )

  useEffect(() => {
    if (!companyId) return
    loadArticles()
  }, [companyId])

  useEffect(() => {
    if (selected) setDraft(selected)
  }, [selected])

  async function loadArticles() {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({ companyId })
      const res = await fetch(`/api/knowledge?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Erro ao carregar base")
      setArticles(data)
      setSelectedId((current) => current || data[0]?.id || "")
      if (data.length === 0) setDraft(createBlankKnowledgeArticle(companyId, auth?.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar base")
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return articles.filter((article) => {
      const matchesStatus = statusFilter === "ALL" || article.status === statusFilter
      const matchesChannel = channelFilter === "ALL" || article.channels.length === 0 || article.channels.includes(channelFilter)
      const text = htmlToPlainText(article.content)
      const matchesQuery = !term || [
        article.title,
        article.category,
        text,
        article.tags.join(" "),
        article.parent?.title ?? "",
        formatKnowledgeChannels(article.channels),
      ].some((value) => value.toLowerCase().includes(term))
      return matchesStatus && matchesChannel && matchesQuery
    })
  }, [articles, channelFilter, query, statusFilter])

  function showSaved() {
    setSavedPulse(true)
    window.setTimeout(() => setSavedPulse(false), 1400)
  }

  function createNew() {
    const next = createBlankKnowledgeArticle(companyId, auth?.id)
    setSelectedId("")
    setDraft(next)
  }

  function updateDraft(patch: Partial<KnowledgeArticle>) {
    setDraft((current) => current ? { ...current, ...patch, updatedAt: new Date().toISOString() } : current)
  }

  function toggleChannel(channel: KnowledgeChannel) {
    if (!draft) return
    updateDraft({
      channels: draft.channels.includes(channel)
        ? draft.channels.filter((item) => item !== channel)
        : [...draft.channels, channel],
    })
  }

  async function saveDraft(publish = false) {
    if (!draft || !companyId || saving) return
    if (!draft.title.trim() || !htmlToPlainText(draft.content).trim()) {
      setError("Título e conteúdo são obrigatórios.")
      return
    }

    setSaving(true)
    setError("")
    const payload = {
      companyId,
      createdById: auth?.id ?? null,
      parentId: draft.parentId ?? null,
      title: draft.title.trim(),
      category: draft.category.trim() || "Geral",
      content: draft.content.trim(),
      tags: draft.tags,
      channels: draft.channels,
      status: publish ? "PUBLICADO" : "RASCUNHO",
    }

    try {
      const res = await fetch(draft.id ? `/api/knowledge/${draft.id}` : "/api/knowledge", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar procedimento")
      setArticles((current) => draft.id
        ? current.map((article) => article.id === draft.id ? data : article)
        : [data, ...current])
      setSelectedId(data.id)
      setDraft(data)
      showSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar procedimento")
    } finally {
      setSaving(false)
    }
  }

  function duplicateArticle(article: KnowledgeArticle) {
    const copy: KnowledgeArticle = {
      ...article,
      id: "",
      title: `${article.title} (cópia)`,
      status: "RASCUNHO",
      publishedVersionId: null,
      draftVersionId: null,
      publishedVersion: null,
      draftVersion: null,
      versions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setSelectedId("")
    setDraft(copy)
  }

  async function archiveArticle(article: KnowledgeArticle) {
    if (!article.id) return
    const res = await fetch(`/api/knowledge/${article.id}`, { method: "DELETE" })
    const data = await res.json()
    if (res.ok) {
      setArticles((current) => current.map((item) => item.id === article.id ? data : item))
      setDraft(data)
      showSaved()
    }
  }

  return (
    <div className="flex min-h-0 flex-1 gap-4 overflow-hidden p-4">
      <aside className="flex w-[410px] shrink-0 flex-col overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="border-b p-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar procedimento, tag ou conteúdo"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <Button size="icon" onClick={createNew} aria-label="Novo procedimento">
              <Plus />
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[
              { value: "ALL", label: "Todos" },
              { value: "PUBLICADO", label: "Publicados" },
              { value: "RASCUNHO", label: "Rascunhos" },
              { value: "ARQUIVADO", label: "Arquivados" },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setStatusFilter(item.value as KnowledgeStatus | "ALL")}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted",
                  statusFilter === item.value && "border-primary/30 bg-primary/10 text-primary",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[{ value: "ALL", label: "Todos canais" }, ...knowledgeChannels].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setChannelFilter(item.value as KnowledgeChannel | "ALL")}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted",
                  channelFilter === item.value && "border-sky-200 bg-sky-50 text-sky-700",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Nenhum procedimento encontrado.</div>
          ) : (
            filtered.map((article) => (
              <button
                key={article.id}
                type="button"
                onClick={() => setSelectedId(article.id)}
                className={cn(
                  "flex w-full gap-3 border-b px-3 py-3 text-left transition-colors hover:bg-muted/45",
                  draft?.id === article.id && "bg-primary/5",
                )}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-sky-50 text-sky-700 ring-1 ring-sky-100">
                  <BookOpenText className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">{article.title}</span>
                    <Badge variant={statusTone[article.status]}>{knowledgeStatusLabel(article.status)}</Badge>
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {article.parent ? `${article.parent.title} / ` : ""}{article.category} · {formatKnowledgeChannels(article.channels)}
                  </span>
                  <span className="mt-1 line-clamp-2 text-xs leading-4 text-muted-foreground">{htmlToPlainText(article.content)}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="min-w-0 flex-1 overflow-y-auto rounded-lg border bg-white shadow-sm">
        {draft ? (
          <div className="p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <BookOpenText className="size-5 text-primary" />
                  <h2 className="text-lg font-semibold">Procedimento de atendimento</h2>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Salve rascunhos sem afetar o atendimento. Ao publicar, uma nova versão substitui a oficial.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => saveDraft(true)} disabled={saving}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  Publicar versão
                </Button>
                <Button variant="outline" onClick={() => saveDraft(false)} disabled={saving}>
                  <Save className="size-4" />
                  Salvar rascunho
                </Button>
                <Button variant="outline" onClick={() => duplicateArticle(draft)} disabled={!draft.id}>
                  <Copy className="size-4" />
                  Duplicar
                </Button>
                <Button variant="destructive" onClick={() => archiveArticle(draft)} disabled={!draft.id}>
                  <Trash2 className="size-4" />
                  Arquivar
                </Button>
              </div>
            </div>

            {savedPulse && (
              <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                Procedimento salvo.
              </div>
            )}
            {error && (
              <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Conteúdo</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                    <label className="grid gap-1.5 text-xs font-medium">
                      Título
                      <Input value={draft.title} onChange={(event) => updateDraft({ title: event.target.value })} />
                    </label>
                    <label className="grid gap-1.5 text-xs font-medium">
                      Procedimento pai
                      <select
                        className="h-9 rounded-md border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                        value={draft.parentId ?? ""}
                        onChange={(event) => updateDraft({ parentId: event.target.value || null })}
                      >
                        <option value="">Sem procedimento pai</option>
                        {possibleParents.map((article) => (
                          <option key={article.id} value={article.id}>{article.title}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                    <label className="grid gap-1.5 text-xs font-medium">
                      Categoria
                      <select
                        className="h-9 rounded-md border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                        value={draft.category}
                        onChange={(event) => updateDraft({ category: event.target.value })}
                      >
                        {knowledgeCategories.map((category) => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1.5 text-xs font-medium">
                      Tags
                      <Input
                        value={draft.tags.join(", ")}
                        onChange={(event) => updateDraft({ tags: normalizeTagInput(event.target.value) })}
                        placeholder="sla, reembolso, implantação"
                      />
                    </label>
                  </div>

                  <div className="grid gap-1.5 text-xs font-medium">
                    Canais aplicáveis
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => updateDraft({ channels: [] })}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                          draft.channels.length === 0 ? "border-primary bg-primary/10 text-primary" : "border-muted text-muted-foreground hover:border-primary/40",
                        )}
                      >
                        Todos os canais
                      </button>
                      {knowledgeChannels.map((channel) => (
                        <button
                          key={channel.value}
                          type="button"
                          onClick={() => toggleChannel(channel.value)}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                            draft.channels.includes(channel.value)
                              ? "border-sky-200 bg-sky-50 text-sky-700"
                              : "border-muted text-muted-foreground hover:border-sky-200 hover:text-sky-700",
                          )}
                        >
                          {channel.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="grid gap-1.5 text-xs font-medium">
                    Procedimento
                    <RichHtmlEditor value={draft.content} onChange={(content) => updateDraft({ content })} />
                  </label>
                </CardContent>
              </Card>

              <aside className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Estado</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant={statusTone[draft.status]}>{knowledgeStatusLabel(draft.status)}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Publicada</span>
                      <span className="font-medium">{draft.publishedVersion?.version ? `v${draft.publishedVersion.version}` : "—"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Rascunho</span>
                      <span className="font-medium">{draft.draftVersion?.version ? `v${draft.draftVersion.version}` : "—"}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Versões</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {draft.versions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhuma versão salva ainda.</p>
                    ) : (
                      draft.versions.map((version) => (
                        <div key={version.id} className="rounded-md border bg-muted/20 px-3 py-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold">v{version.version}</span>
                            <Badge variant={statusTone[version.status]}>{knowledgeStatusLabel(version.status)}</Badge>
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {version.publishedAt ? new Date(version.publishedAt).toLocaleString("pt-BR") : new Date(version.updatedAt).toLocaleString("pt-BR")}
                          </p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </aside>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Crie o primeiro procedimento da base de conhecimento.
          </div>
        )}
      </section>
    </div>
  )
}
