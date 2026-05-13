import { useState, useEffect, useMemo } from "react"
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BadgeDollarSign,
  Bell,
  Building2,
  Check,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Crown,
  Edit2,
  ExternalLink,
  FileText,
  Globe,
  LayoutDashboard,
  Loader2,
  Lock,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  Settings,
  Shield,
  TrendingUp,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Sheet, SheetHeader, SheetContent } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminView = "dashboard" | "empresas" | "planos" | "financeiro" | "usuarios" | "configuracoes"

interface Company {
  id: string; name: string; slug: string; status: string
  plan: string; planId: string; planColor: string
  mrr: string; mrrRaw: number
  users: number; maxUsers: number
  chats: number; maxChats: number
  agents: number; maxAgents: number
  owner: string; email: string; phone: string; cnpj: string; city: string
  createdAt: string; nextBilling: string; daysLeft: number; health: "good" | "warning" | "critical"
}

interface PlanFeature { label: string; value: string; included: boolean }
interface PlanExtra   { label: string; price: string }

interface Plan {
  id: string; name: string; slug: string; color: string
  price: number; billing: string; highlight: boolean; description: string | null
  maxUsers: number | null; maxChats: number | null; maxAgents: number | null; maxBoards: number | null
  companies: number; mrr: number
  features: PlanFeature[]; extras: PlanExtra[]
}

interface CompanyUser {
  id: string; name: string; email: string; role: string; status: string
  lastSeen: string; company: string; plan: string; planColor: string
}

interface MrrRow { plan: string; color: string; value: number; total: number }
interface ActivityItem { action: string; subject: string; time: string; type: "new" | "upgrade" | "alert" }

interface Stats {
  totalMrr: number; totalMrrFmt: string
  activeCompanies: number; totalCompanies: number
  totalUsers: number; totalChats: number
  delinquent: number; trialExpiring: number
  mrrByPlan: MrrRow[]; recentActivity: ActivityItem[]
}

interface Invoice { id: string; company: string; plan: string; amount: string; method: string; date: string; status: string }
interface AdminUser { id: string; name: string; email: string; role: string; lastSeen: string | null }
interface PlatformConfig { name: string; domain: string; supportEmail: string; timezone: string; gateway: string; currency: string; trialDays: number }

// ─── Status / role helpers ────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  ATIVA:        { label: "Ativa",        cls: "bg-emerald-50 text-emerald-700" },
  TRIAL:        { label: "Trial",        cls: "bg-blue-50 text-blue-600" },
  INADIMPLENTE: { label: "Inadimplente", cls: "bg-red-50 text-red-700" },
  SUSPENSA:     { label: "Suspensa",     cls: "bg-orange-50 text-orange-700" },
  ATIVO:        { label: "Ativo",        cls: "bg-emerald-50 text-emerald-700" },
  BLOQUEADO:    { label: "Bloqueado",    cls: "bg-red-50 text-red-700" },
  Pago:         { label: "Pago",         cls: "bg-emerald-50 text-emerald-700" },
  Pendente:     { label: "Pendente",     cls: "bg-amber-50 text-amber-700" },
  Vencido:      { label: "Vencido",      cls: "bg-red-50 text-red-700" },
}

const ROLE_CFG: Record<string, string> = {
  OWNER:     "bg-amber-50 text-amber-700",
  ADMIN:     "bg-blue-50 text-blue-700",
  GESTOR:    "bg-purple-50 text-purple-700",
  ATENDENTE: "bg-zinc-100 text-zinc-600",
  SUPER_ADMIN: "bg-amber-50 text-amber-700",
  FINANCEIRO:  "bg-zinc-100 text-zinc-600",
}

// ─── Helper components ────────────────────────────────────────────────────────

function PlanBadge({ plan, color }: { plan: string; color: string }) {
  const colors: Record<string, string> = {
    gray:   "bg-zinc-100 text-zinc-700",
    blue:   "bg-blue-50 text-blue-700",
    purple: "bg-purple-50 text-purple-700",
    amber:  "bg-amber-50 text-amber-700",
  }
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", colors[color] ?? colors.gray)}>
      {plan === "Enterprise" && <Crown className="size-3" />}
      {plan}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status]
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", cfg?.cls ?? "bg-zinc-100 text-zinc-600")}>
      {cfg?.label ?? status}
    </span>
  )
}

function HealthDot({ health }: { health: string }) {
  return (
    <span className={cn("size-2 rounded-full shrink-0", {
      "bg-emerald-500": health === "good",
      "bg-amber-400":   health === "warning",
      "bg-red-500":     health === "critical",
    })} />
  )
}

function UsageBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100))
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", pct >= 100 ? "bg-red-500" : pct >= 85 ? "bg-amber-400" : "bg-emerald-500")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right text-[11px] text-muted-foreground">{pct}%</span>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function DashboardView({ stats, companies }: { stats: Stats; companies: Company[] }) {
  const kpis = [
    { label: "MRR Total",         value: stats.totalMrrFmt,                           delta: `${stats.activeCompanies} empresas ativas`,       icon: CircleDollarSign, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Empresas ativas",   value: String(stats.activeCompanies),                delta: `${stats.totalCompanies} cadastradas`,             icon: Building2,        color: "text-blue-600",    bg: "bg-blue-50"    },
    { label: "Usuários totais",   value: stats.totalUsers.toLocaleString("pt-BR"),     delta: "em todas as empresas",                            icon: Users,            color: "text-purple-600",  bg: "bg-purple-50"  },
    { label: "Chats processados", value: stats.totalChats.toLocaleString("pt-BR"),     delta: "acumulado do período",                            icon: MessageSquare,    color: "text-cyan-600",    bg: "bg-cyan-50"    },
    { label: "Inadimplentes",     value: String(stats.delinquent),                     delta: "empresas em atraso",                              icon: AlertCircle,      color: "text-red-600",     bg: "bg-red-50"     },
    { label: "Trial expirando",   value: String(stats.trialExpiring),                  delta: "próximos 7 dias",                                 icon: Zap,              color: "text-amber-600",   bg: "bg-amber-50"   },
  ]

  const totalMrr = stats.totalMrr

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className="mt-1 text-2xl font-bold tracking-tight">{kpi.value}</p>
                <p className={cn("mt-0.5 text-xs font-medium", kpi.color)}>{kpi.delta}</p>
              </div>
              <div className={cn("flex size-9 items-center justify-center rounded-lg", kpi.bg)}>
                <kpi.icon className={cn("size-4", kpi.color)} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="p-4 pb-3">
            <CardTitle className="text-sm">MRR por plano</CardTitle>
            <CardDescription>Receita mensal recorrente acumulada</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0">
            {stats.mrrByPlan.map((row) => (
              <div key={row.plan} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{row.plan}</span>
                  <span className="text-muted-foreground">R$ {row.value.toLocaleString("pt-BR")}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", {
                      "bg-zinc-400":   row.color === "gray",
                      "bg-blue-500":   row.color === "blue",
                      "bg-purple-500": row.color === "purple",
                      "bg-amber-500":  row.color === "amber",
                    })}
                    style={{ width: totalMrr > 0 ? `${(row.value / totalMrr) * 100}%` : "0%" }}
                  />
                </div>
              </div>
            ))}
            <div className="mt-4 flex items-center justify-between border-t pt-3">
              <span className="text-sm font-semibold">Total MRR</span>
              <span className="text-sm font-bold text-emerald-600">{stats.totalMrrFmt}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-3">
            <CardTitle className="text-sm">Empresas recentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0">
            {stats.recentActivity.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-emerald-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">{item.action}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{item.subject}</p>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">{item.time}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="p-4 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Empresas — visão geral</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Empresa</th>
                  <th className="px-4 py-2 text-left font-medium">Plano</th>
                  <th className="px-4 py-2 text-left font-medium">MRR</th>
                  <th className="px-4 py-2 text-left font-medium">Usuários</th>
                  <th className="px-4 py-2 text-left font-medium">Chats</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {companies.slice(0, 5).map((c) => (
                  <tr key={c.id} className="border-b last:border-b-0 hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <HealthDot health={c.health} />
                        <span className="font-medium">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5"><PlanBadge plan={c.plan} color={c.planColor} /></td>
                    <td className="px-4 py-2.5 font-medium">{c.mrr}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.users}/{c.maxUsers}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.chats.toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Companies ────────────────────────────────────────────────────────────────

function CompaniesView({ companies, plans, token, onRefresh }: {
  companies: Company[]; plans: Plan[]; token: string; onRefresh: () => void
}) {
  const [selected, setSelected]   = useState<Company | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [search, setSearch]       = useState("")
  const [saving, setSaving]       = useState(false)

  const filtered = companies.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.plan.toLowerCase().includes(search.toLowerCase()) ||
    c.owner.toLowerCase().includes(search.toLowerCase()),
  )

  async function handleStatusChange(companyId: string, newStatus: string) {
    setSaving(true)
    await fetch(`/api/admin/companies/${companyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: newStatus }),
    })
    setSaving(false)
    onRefresh()
    setSheetOpen(false)
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-md border bg-white px-3">
          <Search className="size-4 text-muted-foreground" />
          <Input
            className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
            placeholder="Buscar empresa, plano ou responsável..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((company) => (
          <button
            key={company.id}
            onClick={() => { setSelected(company); setSheetOpen(true) }}
            className={cn(
              "rounded-xl border bg-white p-4 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md",
              selected?.id === company.id && sheetOpen && "border-primary/50 ring-2 ring-primary/10",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <HealthDot health={company.health} />
                <div>
                  <p className="font-semibold text-sm">{company.name}</p>
                  <p className="text-xs text-muted-foreground">{company.owner}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <PlanBadge plan={company.plan} color={company.planColor} />
                <StatusBadge status={company.status} />
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Usuários</span>
                <span>{company.users}/{company.maxUsers}</span>
              </div>
              <UsageBar value={company.users} max={company.maxUsers} />
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Chats/mês</span>
                <span>{company.chats.toLocaleString("pt-BR")}/{company.maxChats.toLocaleString("pt-BR")}</span>
              </div>
              <UsageBar value={company.chats} max={company.maxChats} />
            </div>

            <div className="mt-3 flex items-center justify-between border-t pt-3">
              <span className="text-xs text-muted-foreground">MRR</span>
              <span className="text-sm font-bold text-emerald-600">{company.mrr}</span>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
          <SheetHeader>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50">
              <Building2 className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{selected.name}</p>
              <p className="text-xs text-muted-foreground">{selected.slug}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSheetOpen(false)} aria-label="Fechar"><X /></Button>
          </SheetHeader>

          <SheetContent className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <HealthDot health={selected.health} />
              <PlanBadge plan={selected.plan} color={selected.planColor} />
              <StatusBadge status={selected.status} />
              {selected.daysLeft < 0 && (
                <span className="text-xs text-red-600 font-medium">{Math.abs(selected.daysLeft)} dias vencido</span>
              )}
            </div>

            <Card>
              <CardHeader className="p-3 pb-2"><CardTitle className="text-sm">Dados da empresa</CardTitle></CardHeader>
              <CardContent className="space-y-2 p-3 pt-0">
                {([
                  ["Responsável", selected.owner],
                  ["E-mail",      selected.email],
                  ["Telefone",    selected.phone],
                  ["CNPJ",        selected.cnpj],
                  ["Cidade",      selected.city],
                  ["Criada em",   selected.createdAt],
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-3 border-b pb-2 last:border-b-0 last:pb-0">
                    <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
                    <span className="text-right text-xs font-medium">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3 pb-2"><CardTitle className="text-sm">Uso do plano</CardTitle></CardHeader>
              <CardContent className="space-y-3 p-3 pt-0">
                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted-foreground">Usuários</span>
                    <span>{selected.users}/{selected.maxUsers}</span>
                  </div>
                  <UsageBar value={selected.users} max={selected.maxUsers} />
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted-foreground">Chats/mês</span>
                    <span>{selected.chats.toLocaleString("pt-BR")}/{selected.maxChats.toLocaleString("pt-BR")}</span>
                  </div>
                  <UsageBar value={selected.chats} max={selected.maxChats} />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Agentes IA</span>
                  <span>{selected.agents}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3 pb-2"><CardTitle className="text-sm">Faturamento</CardTitle></CardHeader>
              <CardContent className="space-y-2 p-3 pt-0">
                {([
                  ["MRR",                   selected.mrr],
                  ["Próximo vencimento",     selected.nextBilling],
                  ["Dias",                  selected.daysLeft < 0 ? `${Math.abs(selected.daysLeft)} dias vencido` : `${selected.daysLeft} dias`],
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between border-b pb-2 last:border-b-0 last:pb-0">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className={cn("text-xs font-medium", label === "Dias" && selected.daysLeft < 0 && "text-red-600")}>{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="space-y-2">
              {selected.status !== "ATIVA" && (
                <Button className="w-full" size="sm" onClick={() => handleStatusChange(selected.id, "ATIVA")} disabled={saving}>
                  <Check className="size-3.5" /> Ativar empresa
                </Button>
              )}
              {selected.status !== "SUSPENSA" && (
                <Button className="w-full" variant="destructive" size="sm" onClick={() => handleStatusChange(selected.id, "SUSPENSA")} disabled={saving}>
                  <Lock className="size-3.5" /> Suspender acesso
                </Button>
              )}
              <Button className="w-full" variant="outline" size="sm">
                <CreditCard className="size-3.5" /> Ver faturas
              </Button>
              <Button className="w-full" variant="outline" size="sm">
                <ArrowUpRight className="size-3.5" /> Acessar como empresa
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}

// ─── Plans ────────────────────────────────────────────────────────────────────

function PlansView({ plans }: { plans: Plan[] }) {
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const [sheetOpen, setSheetOpen]     = useState(false)

  const planColorMap: Record<string, string> = {
    gray:   "border-zinc-200",
    blue:   "border-blue-200",
    purple: "border-purple-400 ring-2 ring-purple-100",
    amber:  "border-amber-200",
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Gerencie os planos disponíveis e configure preços, limites e extras.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => (
          <div key={plan.id} className={cn("relative flex flex-col rounded-xl border bg-white p-5 shadow-sm", planColorMap[plan.color])}>
            {plan.highlight && (
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                <span className="rounded-full bg-purple-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">Mais popular</span>
              </div>
            )}
            <div className="flex items-start justify-between">
              <PlanBadge plan={plan.name} color={plan.color} />
              <button onClick={() => { setEditingPlan(plan); setSheetOpen(true) }} className="text-muted-foreground hover:text-foreground transition-colors">
                <Edit2 className="size-3.5" />
              </button>
            </div>

            <div className="mt-3">
              {plan.price > 0 ? (
                <p className="text-2xl font-bold">
                  R$ {plan.price.toLocaleString("pt-BR")}
                  <span className="text-sm font-normal text-muted-foreground">/mês</span>
                </p>
              ) : (
                <p className="text-2xl font-bold">Sob consulta</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
            </div>

            <ul className="mt-4 space-y-2 flex-1">
              {plan.features.map((f) => (
                <li key={f.label} className="flex items-center gap-2 text-xs">
                  {f.included ? <Check className="size-3.5 shrink-0 text-emerald-500" /> : <X className="size-3.5 shrink-0 text-muted-foreground/40" />}
                  <span className={cn(f.included ? "text-foreground" : "text-muted-foreground")}>{f.label}</span>
                  <span className="ml-auto font-medium text-muted-foreground">{f.value}</span>
                </li>
              ))}
            </ul>

            <div className="mt-4 space-y-1 border-t pt-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Extras</p>
              {plan.extras.map((e) => (
                <div key={e.label} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{e.label}</span>
                  <span className="font-medium">{e.price}</span>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between border-t pt-3">
              <span className="text-xs text-muted-foreground">
                {plan.companies} empresa{plan.companies !== 1 ? "s" : ""}
                {plan.mrr > 0 && ` · R$ ${plan.mrr.toLocaleString("pt-BR")}`}
              </span>
            </div>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader className="p-4 pb-3">
          <CardTitle className="text-sm">Lógica de cobrança</CardTitle>
          <CardDescription>Como o sistema calcula o valor da fatura mensal</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 pt-0 md:grid-cols-3">
          {[
            { icon: Users,         title: "Por usuários",   desc: "Cobrança base pelo número de assentos inclusos no plano. Cada usuário extra é cobrado separadamente.",            color: "text-blue-600 bg-blue-50"   },
            { icon: MessageSquare, title: "Por chats",      desc: "Volume de conversas iniciadas no mês. Ao ultrapassar o limite, pacotes adicionais de 1.000 chats são cobrados.", color: "text-purple-600 bg-purple-50" },
            { icon: Zap,           title: "Por agentes IA", desc: "Quantidade de agentes IA simultâneos. Planos Enterprise permitem agentes ilimitados com custo negociado.",         color: "text-amber-600 bg-amber-50"  },
          ].map((item) => (
            <div key={item.title} className="rounded-lg border p-3">
              <div className={cn("mb-2 flex size-8 items-center justify-center rounded-md", item.color)}>
                <item.icon className="size-4" />
              </div>
              <p className="text-sm font-semibold">{item.title}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {editingPlan && (
        <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
          <SheetHeader>
            <PlanBadge plan={editingPlan.name} color={editingPlan.color} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Editar plano {editingPlan.name}</p>
              <p className="text-xs text-muted-foreground">{editingPlan.companies} empresas ativas</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSheetOpen(false)}><X /></Button>
          </SheetHeader>
          <SheetContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Nome do plano</label>
                <Input defaultValue={editingPlan.name} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Preço mensal (R$)</label>
                <Input defaultValue={editingPlan.price || ""} placeholder="Sob consulta" type="number" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Descrição</label>
                <Input defaultValue={editingPlan.description ?? ""} />
              </div>
            </div>
            <Button className="w-full">Salvar alterações</Button>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}

// ─── Financial ────────────────────────────────────────────────────────────────

function FinancialView({ invoices, stats }: { invoices: Invoice[]; stats: Stats }) {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const paid    = invoices.filter((i) => i.status === "Pago").length
  const overdue = invoices.filter((i) => i.status === "Vencido").length

  const summary = [
    { label: "MRR Total",         value: stats.totalMrrFmt,          delta: `${stats.activeCompanies} empresas ativas`, positive: true  },
    { label: "Faturas pagas",     value: String(paid),                delta: `de ${invoices.length} emitidas`,           positive: true  },
    { label: "Inadimplentes",     value: String(stats.delinquent),    delta: "empresas em atraso",                       positive: false },
    { label: "Faturas vencidas",  value: String(overdue),             delta: "aguardando pagamento",                     positive: false },
  ]

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {summary.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-xl font-bold">{s.value}</p>
            <p className={cn("mt-0.5 text-xs font-medium", s.positive ? "text-emerald-600" : "text-red-500")}>{s.delta}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="p-4 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Faturas</CardTitle>
            <Button variant="outline" size="sm" className="text-xs"><FileText className="size-3.5" /> Exportar</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma fatura encontrada</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">Nº</th>
                    <th className="px-4 py-2.5 text-left font-medium">Empresa</th>
                    <th className="px-4 py-2.5 text-left font-medium">Plano</th>
                    <th className="px-4 py-2.5 text-left font-medium">Valor</th>
                    <th className="px-4 py-2.5 text-left font-medium">Método</th>
                    <th className="px-4 py-2.5 text-left font-medium">Data</th>
                    <th className="px-4 py-2.5 text-left font-medium">Status</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      onClick={() => { setSelectedInvoice(inv); setSheetOpen(true) }}
                      className={cn("cursor-pointer border-b last:border-b-0 transition-colors hover:bg-muted/20", selectedInvoice?.id === inv.id && sheetOpen && "bg-primary/5")}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{inv.id.slice(0, 8)}…</td>
                      <td className="px-4 py-2.5 font-medium">{inv.company}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{inv.plan}</td>
                      <td className="px-4 py-2.5 font-semibold">{inv.amount}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{inv.method}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{inv.date}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={inv.status} /></td>
                      <td className="px-4 py-2.5">
                        <Button variant="ghost" size="icon" className="size-6"><MoreHorizontal className="size-3.5" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedInvoice && (
        <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
          <SheetHeader>
            <div className="flex size-9 items-center justify-center rounded-lg border bg-muted/50">
              <FileText className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{selectedInvoice.id.slice(0, 12)}…</p>
              <p className="text-xs text-muted-foreground">{selectedInvoice.company}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSheetOpen(false)}><X /></Button>
          </SheetHeader>
          <SheetContent className="space-y-4">
            <StatusBadge status={selectedInvoice.status} />
            <Card>
              <CardContent className="space-y-2 p-3">
                {([
                  ["Empresa", selectedInvoice.company],
                  ["Plano",   selectedInvoice.plan],
                  ["Valor",   selectedInvoice.amount],
                  ["Método",  selectedInvoice.method],
                  ["Data",    selectedInvoice.date],
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label} className="flex justify-between border-b pb-2 last:border-b-0 last:pb-0">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className="text-xs font-medium">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <div className="space-y-2">
              <Button className="w-full" variant="outline" size="sm"><ExternalLink className="size-3.5" /> Ver fatura completa</Button>
              {selectedInvoice.status === "Vencido" && (
                <Button className="w-full" size="sm"><BadgeDollarSign className="size-3.5" /> Reenviar cobrança</Button>
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}

// ─── Users ────────────────────────────────────────────────────────────────────

function UsersView({ users }: { users: CompanyUser[] }) {
  const [selectedUser, setSelectedUser] = useState<CompanyUser | null>(null)
  const [sheetOpen, setSheetOpen]       = useState(false)
  const [search, setSearch]             = useState("")

  const filtered = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.company.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-md border bg-white px-3">
          <Search className="size-4 text-muted-foreground" />
          <Input
            className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
            placeholder="Buscar usuário, empresa ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Usuário</th>
                  <th className="px-4 py-2.5 text-left font-medium">Empresa</th>
                  <th className="px-4 py-2.5 text-left font-medium">Plano</th>
                  <th className="px-4 py-2.5 text-left font-medium">Perfil</th>
                  <th className="px-4 py-2.5 text-left font-medium">Último acesso</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr
                    key={user.id}
                    onClick={() => { setSelectedUser(user); setSheetOpen(true) }}
                    className={cn("cursor-pointer border-b last:border-b-0 transition-colors hover:bg-muted/20", selectedUser?.id === user.id && sheetOpen && "bg-primary/5")}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-7">
                          <AvatarFallback className="text-xs">{user.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium leading-none">{user.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{user.company}</td>
                    <td className="px-4 py-2.5"><PlanBadge plan={user.plan} color={user.planColor} /></td>
                    <td className="px-4 py-2.5">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", ROLE_CFG[user.role] ?? "bg-zinc-100 text-zinc-600")}>{user.role}</span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{user.lastSeen}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={user.status} /></td>
                    <td className="px-4 py-2.5">
                      <Button variant="ghost" size="icon" className="size-6"><MoreHorizontal className="size-3.5" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {selectedUser && (
        <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
          <SheetHeader>
            <Avatar className="size-9">
              <AvatarFallback>{selectedUser.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{selectedUser.name}</p>
              <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSheetOpen(false)}><X /></Button>
          </SheetHeader>
          <SheetContent className="space-y-4">
            <div className="flex gap-2">
              <StatusBadge status={selectedUser.status} />
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", ROLE_CFG[selectedUser.role] ?? "bg-zinc-100 text-zinc-600")}>{selectedUser.role}</span>
            </div>
            <Card>
              <CardContent className="space-y-2 p-3">
                {([
                  ["Empresa",        selectedUser.company],
                  ["Plano",          selectedUser.plan],
                  ["Perfil",         selectedUser.role],
                  ["Último acesso",  selectedUser.lastSeen],
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label} className="flex justify-between border-b pb-2 last:border-b-0 last:pb-0">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className="text-xs font-medium">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}

// ─── Admin Settings ───────────────────────────────────────────────────────────

function AdminSettingsView({ platformConfig, adminUsers }: { platformConfig: PlatformConfig | null; adminUsers: AdminUser[] }) {
  const sections = platformConfig ? [
    {
      title: "Identidade da plataforma",
      items: [
        ["Nome da plataforma", platformConfig.name],
        ["Domínio",            platformConfig.domain],
        ["E-mail de suporte",  platformConfig.supportEmail],
        ["Fuso horário",       platformConfig.timezone],
      ],
    },
    {
      title: "Integração de pagamentos",
      items: [
        ["Gateway",         platformConfig.gateway],
        ["Moeda padrão",    platformConfig.currency],
        ["Período de trial", `${platformConfig.trialDays} dias`],
      ],
    },
  ] : []

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.title}>
            <CardHeader className="p-4 pb-3">
              <CardTitle className="text-sm">{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {section.items.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between border-b pb-2 last:border-b-0 last:pb-0">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className="text-xs font-medium">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        <Card className="lg:col-span-2">
          <CardHeader className="p-4 pb-3">
            <CardTitle className="text-sm">Acesso de administradores</CardTitle>
            <CardDescription>Usuários com acesso ao painel administrativo</CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-2">
              {adminUsers.map((admin) => (
                <div key={admin.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs">{admin.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{admin.name}</p>
                    <p className="text-xs text-muted-foreground">{admin.email}</p>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", ROLE_CFG[admin.role] ?? "bg-zinc-100 text-zinc-600")}>
                    {admin.role === "SUPER_ADMIN" ? "Super Admin" : "Financeiro"}
                  </span>
                  <Button variant="ghost" size="icon" className="size-7"><MoreHorizontal className="size-3.5" /></Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── Root Admin ───────────────────────────────────────────────────────────────

export default function Admin() {
  const [activeView, setActiveView] = useState<AdminView>("dashboard")

  // ── Auth guard ──────────────────────────────────────────────────────────────
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [token, setToken]           = useState("")
  const [adminName, setAdminName]   = useState("Admin")

  useEffect(() => {
    const storedToken = localStorage.getItem("zv_token")
    const storedUser  = localStorage.getItem("zv_user")
    if (!storedToken || !storedUser) { window.location.href = "/login"; return }
    try {
      const user = JSON.parse(storedUser)
      if (user.type !== "admin") { window.location.href = "/"; return }
      setToken(storedToken)
      setAdminName(user.name ?? "Admin")
      setAuthorized(true)
    } catch {
      window.location.href = "/login"
    }
  }, [])

  // ── Data ────────────────────────────────────────────────────────────────────
  const [stats,          setStats]          = useState<Stats | null>(null)
  const [companies,      setCompanies]      = useState<Company[]>([])
  const [plans,          setPlans]          = useState<Plan[]>([])
  const [users,          setUsers]          = useState<CompanyUser[]>([])
  const [invoices,       setInvoices]       = useState<Invoice[]>([])
  const [adminUsers,     setAdminUsers]     = useState<AdminUser[]>([])
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig | null>(null)
  const [loading,        setLoading]        = useState(true)

  async function fetchAll(tok: string) {
    setLoading(true)
    const h = { Authorization: `Bearer ${tok}` }
    try {
      const [sRes, cRes, pRes, uRes, iRes, aRes, cfRes] = await Promise.all([
        fetch("/api/admin/stats",           { headers: h }),
        fetch("/api/admin/companies",       { headers: h }),
        fetch("/api/admin/plans",           { headers: h }),
        fetch("/api/admin/users",           { headers: h }),
        fetch("/api/admin/invoices",        { headers: h }),
        fetch("/api/admin/admin-users",     { headers: h }),
        fetch("/api/admin/platform-config", { headers: h }),
      ])
      const [sd, cd, pd, ud, id_, ad, cfd] = await Promise.all([
        sRes.json(), cRes.json(), pRes.json(), uRes.json(), iRes.json(), aRes.json(), cfRes.json(),
      ])
      setStats(sd); setCompanies(cd); setPlans(pd)
      setUsers(ud); setInvoices(id_); setAdminUsers(ad); setPlatformConfig(cfd)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authorized && token) fetchAll(token)
  }, [authorized, token])

  // ── Nav badges ──────────────────────────────────────────────────────────────
  const navItems = useMemo(() => [
    { id: "dashboard"    as AdminView, label: "Dashboard",     icon: LayoutDashboard },
    { id: "empresas"     as AdminView, label: "Empresas",      icon: Building2,   badge: stats ? String(stats.totalCompanies) : undefined },
    { id: "planos"       as AdminView, label: "Planos",        icon: Package },
    { id: "financeiro"   as AdminView, label: "Financeiro",    icon: Wallet,      badge: stats?.delinquent ? String(stats.delinquent) : undefined },
    { id: "usuarios"     as AdminView, label: "Usuários",      icon: Users },
    { id: "configuracoes"as AdminView, label: "Configurações", icon: Settings },
  ], [stats])

  const viewMeta: Record<AdminView, { title: string; subtitle: string }> = {
    dashboard:     { title: "Dashboard",       subtitle: "Visão geral da plataforma e métricas em tempo real" },
    empresas:      { title: "Empresas",        subtitle: "Gerencie todas as empresas cadastradas na plataforma" },
    planos:        { title: "Planos & Preços", subtitle: "Configure planos, limites e política de cobranças" },
    financeiro:    { title: "Financeiro",      subtitle: "Faturas, receitas e controle de inadimplência" },
    usuarios:      { title: "Usuários",        subtitle: "Todos os usuários cadastrados em todas as empresas" },
    configuracoes: { title: "Configurações",   subtitle: "Configurações globais da plataforma" },
  }

  // ── Guard states ────────────────────────────────────────────────────────────
  if (authorized === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const meta = viewMeta[activeView]

  return (
    <main className="min-h-screen overflow-hidden bg-zinc-50">
      <div className="flex h-screen min-h-0">

        {/* Sidebar */}
        <aside className="hidden w-56 shrink-0 flex-col border-r bg-white px-2.5 py-4 shadow-sm lg:flex">
          <div className="flex items-center gap-3 px-2 pb-4 border-b">
            <div className="flex size-8 items-center justify-center rounded-lg bg-zinc-900 text-white">
              <Shield className="size-4" />
            </div>
            <div>
              <p className="text-sm font-bold">Admin</p>
              <p className="text-[11px] text-muted-foreground">Zap Tech</p>
            </div>
          </div>

          <nav className="mt-4 space-y-0.5 flex-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={cn(
                  "flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                  activeView === item.id ? "bg-zinc-900 text-white" : "text-muted-foreground hover:bg-zinc-100 hover:text-foreground",
                )}
              >
                <item.icon className="size-3.5 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", activeView === item.id ? "bg-white/20 text-white" : "bg-muted text-muted-foreground")}>
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="space-y-1 border-t pt-3">
            <a href="/" className="flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-zinc-100 hover:text-foreground">
              <Globe className="size-3.5" /> Voltar ao app
            </a>
            <button
              onClick={() => { localStorage.removeItem("zv_token"); localStorage.removeItem("zv_user"); window.location.href = "/login" }}
              className="flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-zinc-100 hover:text-foreground"
            >
              <LogOut className="size-3.5" /> Sair
            </button>
          </div>
        </aside>

        {/* Main */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="shrink-0 border-b bg-white px-5 py-3">
            <div className="flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-bold">{meta.title}</h1>
                <p className="text-xs text-muted-foreground">{meta.subtitle}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" aria-label="Atualizar" onClick={() => fetchAll(token)} disabled={loading}>
                  {loading ? <Loader2 className="size-4 animate-spin" /> : <Activity className="size-4" />}
                </Button>
                <Avatar className="size-8">
                  <AvatarFallback className="text-xs bg-zinc-900 text-white">
                    {adminName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {loading && !stats ? (
              <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                <span className="text-sm">Carregando dados…</span>
              </div>
            ) : (
              <>
                {activeView === "dashboard"     && stats && <DashboardView stats={stats} companies={companies} />}
                {activeView === "empresas"      && <CompaniesView companies={companies} plans={plans} token={token} onRefresh={() => fetchAll(token)} />}
                {activeView === "planos"        && <PlansView plans={plans} />}
                {activeView === "financeiro"    && stats && <FinancialView invoices={invoices} stats={stats} />}
                {activeView === "usuarios"      && <UsersView users={users} />}
                {activeView === "configuracoes" && <AdminSettingsView platformConfig={platformConfig} adminUsers={adminUsers} />}
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
