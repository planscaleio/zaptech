import { useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowUpRight,
  BellRing,
  CheckCircle2,
  Clock3,
  Gauge,
  Mail,
  MessageCircle,
  ShieldAlert,
  TimerReset,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type SlaPolicy = {
  id: string
  name: string
  category: string
  priority: "Crítica" | "Alta" | "Média" | "Baixa"
  channel: "WhatsApp" | "E-mail" | "Todos"
  firstResponse: string
  resolution: string
  riskAlert: string
  escalation: string
  team: string
  active: boolean
  compliance: number
  breached: number
}

type SlaState = "No prazo" | "Em risco" | "Vencido"

const policies: SlaPolicy[] = [
  {
    id: "critical-tech",
    name: "Incidente crítico técnico",
    category: "Técnico",
    priority: "Crítica",
    channel: "Todos",
    firstResponse: "10 min",
    resolution: "4h",
    riskAlert: "50% do prazo",
    escalation: "Gestor de suporte",
    team: "Suporte Técnico",
    active: true,
    compliance: 84,
    breached: 3,
  },
  {
    id: "finance-high",
    name: "Financeiro alta prioridade",
    category: "Financeiro",
    priority: "Alta",
    channel: "E-mail",
    firstResponse: "30 min",
    resolution: "8h",
    riskAlert: "75% do prazo",
    escalation: "Financeiro CS",
    team: "Financeiro CS",
    active: true,
    compliance: 91,
    breached: 2,
  },
  {
    id: "onboarding-mid",
    name: "Implantação padrão",
    category: "Implantação",
    priority: "Média",
    channel: "Todos",
    firstResponse: "2h",
    resolution: "24h",
    riskAlert: "70% do prazo",
    escalation: "Coordenação CS",
    team: "Implantação",
    active: true,
    compliance: 96,
    breached: 1,
  },
  {
    id: "commercial-mid",
    name: "Solicitação comercial",
    category: "Comercial",
    priority: "Média",
    channel: "WhatsApp",
    firstResponse: "1h",
    resolution: "12h",
    riskAlert: "80% do prazo",
    escalation: "Gestor comercial",
    team: "Comercial",
    active: true,
    compliance: 88,
    breached: 4,
  },
  {
    id: "low-general",
    name: "Baixa prioridade geral",
    category: "Geral",
    priority: "Baixa",
    channel: "Todos",
    firstResponse: "4h",
    resolution: "48h",
    riskAlert: "85% do prazo",
    escalation: "Suporte N1",
    team: "Suporte N1",
    active: false,
    compliance: 98,
    breached: 0,
  },
]

const stateExamples: Array<{
  id: string
  state: SlaState
  ticket: string
  customer: string
  elapsed: string
  remaining: string
  tone: string
}> = [
  {
    id: "ok",
    state: "No prazo",
    ticket: "SUP-1052",
    customer: "Helena Duarte",
    elapsed: "38 min",
    remaining: "6h 22min",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  {
    id: "risk",
    state: "Em risco",
    ticket: "SUP-1048",
    customer: "Carolina Mendes",
    elapsed: "6h 30min",
    remaining: "1h 30min",
    tone: "border-amber-200 bg-amber-50 text-amber-700",
  },
  {
    id: "late",
    state: "Vencido",
    ticket: "SUP-1047",
    customer: "Gustavo Pires",
    elapsed: "4h 28min",
    remaining: "-28 min",
    tone: "border-red-200 bg-red-50 text-red-700",
  },
]

const priorityTone: Record<SlaPolicy["priority"], string> = {
  Crítica: "border-red-200 bg-red-50 text-red-700",
  Alta: "border-amber-200 bg-amber-50 text-amber-700",
  Média: "border-cyan-200 bg-cyan-50 text-cyan-700",
  Baixa: "border-slate-200 bg-slate-50 text-slate-600",
}

export default function SupportSlaPage() {
  const [selectedId, setSelectedId] = useState(policies[0]?.id ?? "")
  const [channelFilter, setChannelFilter] = useState<SlaPolicy["channel"] | "Todos filtros">("Todos filtros")
  const [priorityFilter, setPriorityFilter] = useState<SlaPolicy["priority"] | "Todas">("Todas")

  const filtered = useMemo(() => policies
    .filter((policy) => channelFilter === "Todos filtros" || policy.channel === channelFilter || policy.channel === "Todos")
    .filter((policy) => priorityFilter === "Todas" || policy.priority === priorityFilter),
  [channelFilter, priorityFilter])

  const selected = policies.find((policy) => policy.id === selectedId) ?? filtered[0] ?? policies[0]
  const metrics = {
    active: policies.filter((policy) => policy.active).length,
    compliance: Math.round(policies.reduce((sum, policy) => sum + policy.compliance, 0) / policies.length),
    breached: policies.reduce((sum, policy) => sum + policy.breached, 0),
  }

  return (
    <div className="min-h-0 flex-1 overflow-hidden p-4">
      <div className="grid h-full min-w-[1140px] grid-cols-[360px_minmax(0,1fr)_320px] gap-3">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white shadow-soft">
          <div className="space-y-3 border-b p-3">
            <div className="grid grid-cols-3 gap-2">
              {[
                ["Políticas", metrics.active],
                ["SLA médio", `${metrics.compliance}%`],
                ["Vencidos", metrics.breached],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border bg-muted/25 px-2 py-2 text-center">
                  <p className="text-base font-bold">{value}</p>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                className="h-8 rounded-md border bg-white px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value as SlaPolicy["priority"] | "Todas")}
              >
                {["Todas", "Crítica", "Alta", "Média", "Baixa"].map((priority) => <option key={priority}>{priority}</option>)}
              </select>
              <select
                className="h-8 rounded-md border bg-white px-2 text-xs outline-none focus:ring-2 focus:ring-ring"
                value={channelFilter}
                onChange={(event) => setChannelFilter(event.target.value as SlaPolicy["channel"] | "Todos filtros")}
              >
                {["Todos filtros", "Todos", "WhatsApp", "E-mail"].map((channel) => <option key={channel}>{channel}</option>)}
              </select>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {filtered.map((policy) => {
              const active = selected.id === policy.id
              const ChannelIcon = policy.channel === "WhatsApp" ? MessageCircle : policy.channel === "E-mail" ? Mail : TimerReset
              return (
                <button
                  key={policy.id}
                  type="button"
                  onClick={() => setSelectedId(policy.id)}
                  className={cn(
                    "mb-2 w-full rounded-lg border px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5",
                    active ? "border-primary/40 bg-primary/5 ring-1 ring-primary/15" : "border-transparent",
                  )}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <ChannelIcon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{policy.name}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{policy.category} · {policy.team}</span>
                    </span>
                    <Badge className={priorityTone[policy.priority]} variant="outline">{policy.priority}</Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
                    <span>1ª resposta: <strong className="text-foreground">{policy.firstResponse}</strong></span>
                    <span>Resolução: <strong className="text-foreground">{policy.resolution}</strong></span>
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
                <p className="mt-1 text-sm text-muted-foreground">
                  {selected.category} · {selected.channel} · destino preferencial {selected.team}
                </p>
              </div>
              <Button variant="outline">Simular ticket</Button>
            </div>
          </div>

          <div className="grid gap-4 p-4 lg:grid-cols-4">
            {[
              { icon: Clock3, label: "Primeira resposta", value: selected.firstResponse },
              { icon: Gauge, label: "Resolução", value: selected.resolution },
              { icon: BellRing, label: "Alerta de risco", value: selected.riskAlert },
              { icon: ArrowUpRight, label: "Escalação", value: selected.escalation },
            ].map(({ icon: Icon, label, value }) => (
              <Card key={label}>
                <CardContent className="p-4 text-center">
                  <Icon className="mx-auto size-4 text-primary" />
                  <p className="mt-2 truncate text-sm font-semibold">{value}</p>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 px-4 pb-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Estados operacionais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {stateExamples.map((example) => (
                  <div key={example.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{example.ticket} · {example.customer}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Tempo corrido {example.elapsed}</p>
                      </div>
                      <Badge className={example.tone} variant="outline">{example.state}</Badge>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          example.state === "No prazo" && "w-1/3 bg-emerald-500",
                          example.state === "Em risco" && "w-4/5 bg-amber-500",
                          example.state === "Vencido" && "w-full bg-red-500",
                        )}
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">Tempo restante: {example.remaining}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Linha de automação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { icon: CheckCircle2, label: "Ticket criado", text: `Categoria ${selected.category}` },
                  { icon: Clock3, label: "Relógio inicia", text: `Resposta em ${selected.firstResponse}` },
                  { icon: AlertTriangle, label: "Alerta", text: `Dispara em ${selected.riskAlert}` },
                  { icon: ShieldAlert, label: "Escalação", text: selected.escalation },
                ].map(({ icon: Icon, label, text }) => (
                  <div key={label} className="flex gap-3 rounded-md border bg-muted/20 p-3">
                    <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold">{label}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{text}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>

        <aside className="min-h-0 space-y-3 overflow-y-auto">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Users className="size-4 text-primary" />
                Equipes e cobertura
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {["Suporte N1", "Suporte Técnico", "Financeiro CS", "Implantação", "Comercial"].map((team) => (
                <div key={team} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span>{team}</span>
                  <span className={cn(
                    "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                    team === selected.team ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-500",
                  )}>
                    <span className={cn("size-1.5 rounded-full", team === selected.team ? "bg-emerald-500" : "bg-slate-400")} />
                    {team === selected.team ? "Destino" : "Reserva"}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <TimerReset className="size-4 text-primary" />
                Próxima fase
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs leading-5 text-muted-foreground">
              <p>Este mock define o shape visual das políticas antes de persistir SLA em banco.</p>
              <p>A integração real deve calcular prazos em tickets e disparar alertas por equipe.</p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
