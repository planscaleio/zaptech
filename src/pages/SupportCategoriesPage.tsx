import { useMemo, useState } from "react"
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Mail,
  MessageCircle,
  MonitorSmartphone,
  Phone,
  Search,
  Tags,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type SupportCategory = {
  id: string
  name: string
  description: string
  defaultPriority: "Crítica" | "Alta" | "Média" | "Baixa"
  team: string
  channels: Array<"WhatsApp" | "E-mail" | "Site" | "Telefone">
  defaultSla: string
  volume: number
  risk: number
  active: boolean
  tags: string[]
}

const channelIcon = {
  WhatsApp: MessageCircle,
  "E-mail": Mail,
  Site: MonitorSmartphone,
  Telefone: Phone,
}

const priorityTone: Record<SupportCategory["defaultPriority"], string> = {
  Crítica: "border-red-200 bg-red-50 text-red-700",
  Alta: "border-amber-200 bg-amber-50 text-amber-700",
  Média: "border-cyan-200 bg-cyan-50 text-cyan-700",
  Baixa: "border-slate-200 bg-slate-50 text-slate-600",
}

const initialCategories: SupportCategory[] = [
  {
    id: "financeiro",
    name: "Financeiro",
    description: "Cobrança, faturas, contrato, reembolso, upgrade e dúvidas de plano.",
    defaultPriority: "Alta",
    team: "Financeiro CS",
    channels: ["E-mail", "WhatsApp"],
    defaultSla: "1ª resposta 30 min · resolução 8h",
    volume: 42,
    risk: 18,
    active: true,
    tags: ["fatura", "plano", "cobranca"],
  },
  {
    id: "tecnico",
    name: "Técnico",
    description: "Incidentes de integração, API, webhook, conectores e erros operacionais.",
    defaultPriority: "Crítica",
    team: "Suporte Técnico",
    channels: ["E-mail", "Site", "WhatsApp"],
    defaultSla: "1ª resposta 10 min · resolução 4h",
    volume: 31,
    risk: 27,
    active: true,
    tags: ["api", "webhook", "erro"],
  },
  {
    id: "implantacao",
    name: "Implantação",
    description: "Configuração inicial, usuários, treinamento, importação e go-live.",
    defaultPriority: "Média",
    team: "Implantação",
    channels: ["E-mail", "Telefone"],
    defaultSla: "1ª resposta 2h · resolução 24h",
    volume: 19,
    risk: 9,
    active: true,
    tags: ["onboarding", "usuarios", "setup"],
  },
  {
    id: "comercial",
    name: "Comercial",
    description: "Expansão, negociação, dúvidas enterprise e oportunidades vindas do suporte.",
    defaultPriority: "Média",
    team: "Comercial",
    channels: ["WhatsApp", "E-mail", "Telefone"],
    defaultSla: "1ª resposta 1h · resolução 12h",
    volume: 24,
    risk: 11,
    active: true,
    tags: ["enterprise", "upsell", "proposta"],
  },
  {
    id: "dados",
    name: "Dados e LGPD",
    description: "Solicitações de exportação, correção, remoção e auditoria de dados.",
    defaultPriority: "Alta",
    team: "Suporte N1",
    channels: ["E-mail", "Site"],
    defaultSla: "1ª resposta 4h · resolução 48h",
    volume: 7,
    risk: 4,
    active: false,
    tags: ["lgpd", "exportacao", "auditoria"],
  },
]

export default function SupportCategoriesPage() {
  const [categories, setCategories] = useState(initialCategories)
  const [selectedId, setSelectedId] = useState(initialCategories[0]?.id ?? "")
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return categories.filter((category) => !term || [
      category.name,
      category.description,
      category.team,
      category.defaultPriority,
      category.defaultSla,
      ...category.tags,
    ].some((value) => value.toLowerCase().includes(term)))
  }, [categories, query])

  const selected = categories.find((category) => category.id === selectedId) ?? filtered[0] ?? categories[0]
  const totals = {
    active: categories.filter((category) => category.active).length,
    volume: categories.reduce((sum, category) => sum + category.volume, 0),
    risk: categories.reduce((sum, category) => sum + category.risk, 0),
  }

  function updateSelected(patch: Partial<SupportCategory>) {
    setCategories((current) => current.map((category) => (
      category.id === selected.id ? { ...category, ...patch } : category
    )))
  }

  return (
    <div className="min-h-0 flex-1 overflow-hidden p-4">
      <div className="grid h-full min-w-[1120px] grid-cols-[360px_minmax(0,1fr)_300px] gap-3">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white shadow-soft">
          <div className="space-y-3 border-b p-3">
            <div className="grid grid-cols-3 gap-2">
              {[
                ["Ativas", totals.active],
                ["Volume", totals.volume],
                ["Risco", totals.risk],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border bg-muted/25 px-2 py-2 text-center">
                  <p className="text-base font-bold">{value}</p>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            <div className="flex h-9 items-center gap-2 rounded-md border bg-white px-2">
              <Search className="size-4 text-muted-foreground" />
              <Input
                className="h-8 border-0 px-0 text-xs shadow-none focus-visible:ring-0"
                placeholder="Buscar categoria, equipe ou tag"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {filtered.map((category) => {
              const active = selected.id === category.id
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedId(category.id)}
                  className={cn(
                    "mb-2 w-full rounded-lg border px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5",
                    active ? "border-primary/40 bg-primary/5 ring-1 ring-primary/15" : "border-transparent",
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Tags className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">{category.name}</span>
                        <span className={cn("size-1.5 rounded-full", category.active ? "bg-emerald-500" : "bg-slate-300")} />
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{category.team}</span>
                    </span>
                    <Badge className={priorityTone[category.defaultPriority]} variant="outline">
                      {category.defaultPriority}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{category.defaultSla}</span>
                    <span>{category.volume} tickets</span>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="min-h-0 overflow-y-auto rounded-lg border bg-white shadow-soft">
          <div className="border-b p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">{selected.name}</h2>
                  <Badge variant={selected.active ? "success" : "secondary"}>{selected.active ? "Ativa" : "Inativa"}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{selected.description}</p>
              </div>
              <Button
                variant={selected.active ? "outline" : "default"}
                onClick={() => updateSelected({ active: !selected.active })}
              >
                {selected.active ? "Desativar" : "Ativar"}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 p-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Configuração local</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <label className="grid gap-1.5 text-xs font-medium">
                  Nome
                  <Input value={selected.name} onChange={(event) => updateSelected({ name: event.target.value })} />
                </label>
                <label className="grid gap-1.5 text-xs font-medium">
                  Descrição
                  <textarea
                    className="min-h-24 rounded-md border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                    value={selected.description}
                    onChange={(event) => updateSelected({ description: event.target.value })}
                  />
                </label>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-1.5 text-xs font-medium">
                    Prioridade padrão
                    <select
                      className="h-9 rounded-md border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      value={selected.defaultPriority}
                      onChange={(event) => updateSelected({ defaultPriority: event.target.value as SupportCategory["defaultPriority"] })}
                    >
                      {["Crítica", "Alta", "Média", "Baixa"].map((priority) => <option key={priority}>{priority}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-xs font-medium">
                    Equipe sugerida
                    <select
                      className="h-9 rounded-md border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      value={selected.team}
                      onChange={(event) => updateSelected({ team: event.target.value })}
                    >
                      {["Suporte N1", "Suporte Técnico", "Financeiro CS", "Implantação", "Comercial"].map((team) => <option key={team}>{team}</option>)}
                    </select>
                  </label>
                </div>
                <label className="grid gap-1.5 text-xs font-medium">
                  SLA padrão
                  <Input value={selected.defaultSla} onChange={(event) => updateSelected({ defaultSla: event.target.value })} />
                </label>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Canais e sinais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {(["WhatsApp", "E-mail", "Site", "Telefone"] as const).map((channel) => {
                    const Icon = channelIcon[channel]
                    const enabled = selected.channels.includes(channel)
                    return (
                      <button
                        key={channel}
                        type="button"
                        onClick={() => updateSelected({
                          channels: enabled
                            ? selected.channels.filter((item) => item !== channel)
                            : [...selected.channels, channel],
                        })}
                        className={cn(
                          "flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                          enabled ? "border-primary/30 bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
                        )}
                      >
                        <Icon className="size-3.5" />
                        {channel}
                      </button>
                    )
                  })}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { icon: BarChart3, label: "Volume", value: selected.volume },
                    { icon: AlertTriangle, label: "Risco", value: selected.risk },
                    { icon: Clock3, label: "SLA", value: selected.defaultSla.split("·")[0].trim() },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="min-w-0 rounded-lg border bg-muted/25 p-3 text-center">
                      <Icon className="mx-auto size-4 text-primary" />
                      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {selected.tags.map((tag) => (
                    <span key={tag} className="rounded-full border bg-white px-2 py-0.5 text-[11px] text-muted-foreground">#{tag}</span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <aside className="min-h-0 overflow-y-auto space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Users className="size-4 text-primary" />
                Roteamento sugerido
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {["Suporte N1", "Suporte Técnico", "Financeiro CS", "Implantação", "Comercial"].map((team) => (
                <div key={team} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span>{team}</span>
                  {team === selected.team ? (
                    <Badge variant="success">Preferencial</Badge>
                  ) : (
                    <span className="text-muted-foreground">Disponível</span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="size-4 text-primary" />
                Próxima fase
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs leading-5 text-muted-foreground">
              <p>Este mock prepara a futura tabela de categorias, políticas de roteamento e vínculos com SLA.</p>
              <p>As mudanças feitas aqui são locais na sessão da tela e ainda não persistem no backend.</p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
