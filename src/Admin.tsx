import { useState } from "react"
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BadgeDollarSign,
  Bell,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Command,
  CreditCard,
  Crown,
  Edit2,
  ExternalLink,
  FileText,
  Globe,
  LayoutDashboard,
  Lock,
  LogOut,
  MessageSquare,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  Settings,
  Shield,
  Sparkles,
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

// ─── Static data ──────────────────────────────────────────────────────────────

const navItems: { id: AdminView; label: string; icon: React.ElementType; badge?: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "empresas", label: "Empresas", icon: Building2, badge: "38" },
  { id: "planos", label: "Planos", icon: Package },
  { id: "financeiro", label: "Financeiro", icon: Wallet, badge: "3" },
  { id: "usuarios", label: "Usuários", icon: Users },
  { id: "configuracoes", label: "Configurações", icon: Settings },
]

const companies = [
  {
    id: "cia-001",
    name: "Clínica Aquarela",
    slug: "clinica-aquarela",
    plan: "Scale",
    planColor: "purple",
    status: "Ativa",
    mrr: "R$ 3.200",
    users: 18,
    maxUsers: 20,
    chats: 4200,
    maxChats: 5000,
    agents: 3,
    createdAt: "12/01/2025",
    owner: "Mariana Costa",
    email: "mariana@aquarela.com.br",
    phone: "+55 31 99123-4567",
    cnpj: "12.345.678/0001-90",
    nextBilling: "01/06/2025",
    daysLeft: 25,
    health: "good",
  },
  {
    id: "cia-002",
    name: "RL Distribuidora",
    slug: "rl-distribuidora",
    plan: "Growth",
    planColor: "blue",
    status: "Ativa",
    mrr: "R$ 1.490",
    users: 7,
    maxUsers: 10,
    chats: 1800,
    maxChats: 2000,
    agents: 1,
    createdAt: "03/02/2025",
    owner: "Rafael Lima",
    email: "rafael@rldistribuidora.com",
    phone: "+55 31 98876-5432",
    cnpj: "98.765.432/0001-11",
    nextBilling: "03/06/2025",
    daysLeft: 27,
    health: "warning",
  },
  {
    id: "cia-003",
    name: "Solo Arquitetura",
    slug: "solo-arquitetura",
    plan: "Starter",
    planColor: "gray",
    status: "Trial",
    mrr: "R$ 0",
    users: 2,
    maxUsers: 3,
    chats: 210,
    maxChats: 500,
    agents: 0,
    createdAt: "28/04/2025",
    owner: "Camila Torres",
    email: "camila@soloarq.com.br",
    phone: "+55 11 97654-3210",
    cnpj: "—",
    nextBilling: "28/05/2025",
    daysLeft: 3,
    health: "critical",
  },
  {
    id: "cia-004",
    name: "Vendramine & Co.",
    slug: "vendramine",
    plan: "Enterprise",
    planColor: "amber",
    status: "Ativa",
    mrr: "R$ 9.800",
    users: 54,
    maxUsers: 100,
    chats: 18400,
    maxChats: 50000,
    agents: 8,
    createdAt: "10/09/2024",
    owner: "Bruno Vendramine",
    email: "bruno@vendramine.com",
    phone: "+55 11 91234-5678",
    cnpj: "45.678.901/0001-22",
    nextBilling: "10/06/2025",
    daysLeft: 34,
    health: "good",
  },
  {
    id: "cia-005",
    name: "MedCenter SP",
    slug: "medcenter-sp",
    plan: "Scale",
    planColor: "purple",
    status: "Inadimplente",
    mrr: "R$ 3.200",
    users: 22,
    maxUsers: 20,
    chats: 5100,
    maxChats: 5000,
    agents: 3,
    createdAt: "15/11/2024",
    owner: "Dr. Paulo Siqueira",
    email: "paulo@medcentersp.com.br",
    phone: "+55 11 93456-7890",
    cnpj: "67.890.123/0001-33",
    nextBilling: "15/05/2025",
    daysLeft: -7,
    health: "critical",
  },
]

const plans = [
  {
    id: "starter",
    name: "Starter",
    color: "gray",
    price: 297,
    billing: "mensal",
    companies: 8,
    highlight: false,
    description: "Para times pequenos começando com automação.",
    features: [
      { label: "Usuários", value: "3", included: true },
      { label: "Chats/mês", value: "500", included: true },
      { label: "Agentes IA", value: "1", included: true },
      { label: "Quadros kanban", value: "1", included: true },
      { label: "Transmissões", value: "—", included: false },
      { label: "API de webhooks", value: "—", included: false },
      { label: "Relatórios avançados", value: "—", included: false },
      { label: "Suporte prioritário", value: "—", included: false },
    ],
    extras: [
      { label: "Usuário adicional", price: "R$ 49/mês" },
      { label: "1.000 chats extras", price: "R$ 79/mês" },
    ],
  },
  {
    id: "growth",
    name: "Growth",
    color: "blue",
    price: 897,
    billing: "mensal",
    companies: 14,
    highlight: false,
    description: "Para equipes em crescimento que precisam de escala.",
    features: [
      { label: "Usuários", value: "10", included: true },
      { label: "Chats/mês", value: "2.000", included: true },
      { label: "Agentes IA", value: "3", included: true },
      { label: "Quadros kanban", value: "5", included: true },
      { label: "Transmissões", value: "Ilimitadas", included: true },
      { label: "API de webhooks", value: "Incluído", included: true },
      { label: "Relatórios avançados", value: "—", included: false },
      { label: "Suporte prioritário", value: "—", included: false },
    ],
    extras: [
      { label: "Usuário adicional", price: "R$ 39/mês" },
      { label: "1.000 chats extras", price: "R$ 59/mês" },
    ],
  },
  {
    id: "scale",
    name: "Scale",
    color: "purple",
    price: 1990,
    billing: "mensal",
    companies: 12,
    highlight: true,
    description: "Para operações maduras que exigem performance e controle.",
    features: [
      { label: "Usuários", value: "20", included: true },
      { label: "Chats/mês", value: "5.000", included: true },
      { label: "Agentes IA", value: "5", included: true },
      { label: "Quadros kanban", value: "Ilimitados", included: true },
      { label: "Transmissões", value: "Ilimitadas", included: true },
      { label: "API de webhooks", value: "Incluído", included: true },
      { label: "Relatórios avançados", value: "Incluído", included: true },
      { label: "Suporte prioritário", value: "—", included: false },
    ],
    extras: [
      { label: "Usuário adicional", price: "R$ 29/mês" },
      { label: "1.000 chats extras", price: "R$ 39/mês" },
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    color: "amber",
    price: 0,
    billing: "negociado",
    companies: 4,
    highlight: false,
    description: "Contratos personalizados para grandes operações.",
    features: [
      { label: "Usuários", value: "Ilimitados", included: true },
      { label: "Chats/mês", value: "Ilimitados", included: true },
      { label: "Agentes IA", value: "Ilimitados", included: true },
      { label: "Quadros kanban", value: "Ilimitados", included: true },
      { label: "Transmissões", value: "Ilimitadas", included: true },
      { label: "API de webhooks", value: "Incluído", included: true },
      { label: "Relatórios avançados", value: "Incluído", included: true },
      { label: "Suporte prioritário", value: "Incluído", included: true },
    ],
    extras: [
      { label: "SLA dedicado", price: "Incluído" },
      { label: "Infraestrutura isolada", price: "Sob consulta" },
    ],
  },
]

const invoices = [
  { id: "INV-0042", company: "Vendramine & Co.", plan: "Enterprise", amount: "R$ 9.800", status: "Pago", date: "10/05/2025", method: "Boleto" },
  { id: "INV-0041", company: "Clínica Aquarela", plan: "Scale", amount: "R$ 3.200", status: "Pago", date: "01/05/2025", method: "Cartão" },
  { id: "INV-0040", company: "MedCenter SP", plan: "Scale", amount: "R$ 3.200", status: "Vencido", date: "15/04/2025", method: "Boleto" },
  { id: "INV-0039", company: "RL Distribuidora", plan: "Growth", amount: "R$ 1.490", status: "Pago", date: "03/05/2025", method: "Cartão" },
  { id: "INV-0038", company: "Solo Arquitetura", plan: "Starter", amount: "R$ 297", status: "Trial", date: "—", method: "—" },
  { id: "INV-0037", company: "Vendramine & Co.", plan: "Enterprise", amount: "R$ 9.800", status: "Pago", date: "10/04/2025", method: "Boleto" },
  { id: "INV-0036", company: "Clínica Aquarela", plan: "Scale", amount: "R$ 3.200", status: "Pago", date: "01/04/2025", method: "Cartão" },
]

const allUsers = [
  { id: "u-001", name: "Mariana Costa", email: "mariana@aquarela.com.br", company: "Clínica Aquarela", role: "Admin", status: "Ativo", lastSeen: "agora", plan: "Scale" },
  { id: "u-002", name: "Rafael Lima", email: "rafael@rldistribuidora.com", company: "RL Distribuidora", role: "Admin", status: "Ativo", lastSeen: "2 min", plan: "Growth" },
  { id: "u-003", name: "Camila Torres", email: "camila@soloarq.com.br", company: "Solo Arquitetura", role: "Admin", status: "Trial", lastSeen: "1 hora", plan: "Starter" },
  { id: "u-004", name: "Bruno Vendramine", email: "bruno@vendramine.com", company: "Vendramine & Co.", role: "Owner", status: "Ativo", lastSeen: "5 min", plan: "Enterprise" },
  { id: "u-005", name: "Dr. Paulo Siqueira", email: "paulo@medcentersp.com.br", company: "MedCenter SP", role: "Admin", status: "Bloqueado", lastSeen: "7 dias", plan: "Scale" },
  { id: "u-006", name: "Ana Paula Rocha", email: "ana@aquarela.com.br", company: "Clínica Aquarela", role: "Atendente", status: "Ativo", lastSeen: "30 min", plan: "Scale" },
  { id: "u-007", name: "Daniel Fachin", email: "daniel@vendramine.com", company: "Vendramine & Co.", role: "Gestor", status: "Ativo", lastSeen: "10 min", plan: "Enterprise" },
  { id: "u-008", name: "Leticia Moura", email: "leticia@rldistribuidora.com", company: "RL Distribuidora", role: "Atendente", status: "Ativo", lastSeen: "1 hora", plan: "Growth" },
]

// ─── Helper components ────────────────────────────────────────────────────────

function PlanBadge({ plan, color }: { plan: string; color: string }) {
  const colors: Record<string, string> = {
    gray: "bg-zinc-100 text-zinc-700",
    blue: "bg-blue-50 text-blue-700",
    purple: "bg-purple-50 text-purple-700",
    amber: "bg-amber-50 text-amber-700",
  }
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", colors[color] ?? colors.gray)}>
      {plan === "Enterprise" && <Crown className="size-3" />}
      {plan}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Ativa: "bg-emerald-50 text-emerald-700",
    Trial: "bg-blue-50 text-blue-600",
    Inadimplente: "bg-red-50 text-red-700",
    Ativo: "bg-emerald-50 text-emerald-700",
    Bloqueado: "bg-red-50 text-red-700",
    Pago: "bg-emerald-50 text-emerald-700",
    Vencido: "bg-red-50 text-red-700",
  }
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", map[status] ?? "bg-zinc-100 text-zinc-600")}>
      {status}
    </span>
  )
}

function HealthDot({ health }: { health: string }) {
  return (
    <span className={cn("size-2 rounded-full shrink-0", {
      "bg-emerald-500": health === "good",
      "bg-amber-400": health === "warning",
      "bg-red-500": health === "critical",
    })} />
  )
}

function UsageBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
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

// ─── Views ────────────────────────────────────────────────────────────────────

function DashboardView() {
  const kpis = [
    { label: "MRR Total", value: "R$ 17.690", delta: "+12,4%", icon: CircleDollarSign, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Empresas ativas", value: "38", delta: "+3 este mês", icon: Building2, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Usuários totais", value: "312", delta: "+28 este mês", icon: Users, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Chats processados", value: "94.200", delta: "+18% vs. abril", icon: MessageSquare, color: "text-cyan-600", bg: "bg-cyan-50" },
    { label: "Inadimplentes", value: "2", delta: "R$ 6.400 em risco", icon: AlertCircle, color: "text-red-600", bg: "bg-red-50" },
    { label: "Trial expirando", value: "4", delta: "próximos 7 dias", icon: Zap, color: "text-amber-600", bg: "bg-amber-50" },
  ]

  const recentActivity = [
    { action: "Nova empresa criada", subject: "Solo Arquitetura", time: "há 2 horas", type: "new" },
    { action: "Plano atualizado", subject: "Clínica Aquarela — Growth → Scale", time: "há 1 dia", type: "upgrade" },
    { action: "Fatura vencida", subject: "MedCenter SP — R$ 3.200", time: "há 7 dias", type: "alert" },
    { action: "Novo usuário", subject: "Leticia Moura — RL Distribuidora", time: "há 2 dias", type: "new" },
    { action: "Trial expirou", subject: "Agência Fênix — convertida", time: "há 3 dias", type: "upgrade" },
  ]

  const mrrByPlan = [
    { plan: "Starter", value: 2376, total: 17690, color: "bg-zinc-400" },
    { plan: "Growth", value: 3976, total: 17690, color: "bg-blue-500" },
    { plan: "Scale", value: 3200, total: 17690, color: "bg-purple-500" },
    { plan: "Enterprise", value: 8138, total: 17690, color: "bg-amber-500" },
  ]

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
            <CardDescription>Receita mensal recorrente — maio 2025</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0">
            {mrrByPlan.map((row) => (
              <div key={row.plan} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{row.plan}</span>
                  <span className="text-muted-foreground">R$ {row.value.toLocaleString("pt-BR")}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", row.color)} style={{ width: `${(row.value / row.total) * 100}%` }} />
                </div>
              </div>
            ))}
            <div className="mt-4 flex items-center justify-between border-t pt-3">
              <span className="text-sm font-semibold">Total MRR</span>
              <span className="text-sm font-bold text-emerald-600">R$ 17.690</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-3">
            <CardTitle className="text-sm">Atividade recente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0">
            {recentActivity.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className={cn("mt-0.5 size-1.5 shrink-0 rounded-full", {
                  "bg-emerald-500": item.type === "new",
                  "bg-blue-500": item.type === "upgrade",
                  "bg-red-500": item.type === "alert",
                })} />
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
            <Button variant="ghost" size="sm" className="text-xs">Ver todas <ChevronRight className="size-3" /></Button>
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

function CompaniesView() {
  const [selected, setSelected] = useState<typeof companies[0] | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [search, setSearch] = useState("")

  const filtered = companies.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.plan.toLowerCase().includes(search.toLowerCase()),
  )

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
        <Button variant="outline" size="sm"><SlidersHorizontalIcon /></Button>
        <Button size="sm"><Plus className="size-4" /> Nova empresa</Button>
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
            <Button variant="ghost" size="icon" aria-label="Mais opções"><MoreHorizontal /></Button>
            <Button variant="ghost" size="icon" onClick={() => setSheetOpen(false)} aria-label="Fechar"><X /></Button>
          </SheetHeader>

          <SheetContent className="space-y-4">
            <div className="flex items-center gap-2">
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
                {[
                  ["Responsável", selected.owner],
                  ["E-mail", selected.email],
                  ["Telefone", selected.phone],
                  ["CNPJ", selected.cnpj],
                  ["Criada em", selected.createdAt],
                ].map(([label, value]) => (
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
                <div>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted-foreground">Agentes IA</span>
                    <span>{selected.agents}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3 pb-2"><CardTitle className="text-sm">Faturamento</CardTitle></CardHeader>
              <CardContent className="space-y-2 p-3 pt-0">
                {[
                  ["MRR", selected.mrr],
                  ["Próximo vencimento", selected.nextBilling],
                  ["Dias para vencimento", selected.daysLeft < 0 ? `${Math.abs(selected.daysLeft)} dias vencido` : `${selected.daysLeft} dias`],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between border-b pb-2 last:border-b-0 last:pb-0">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className={cn("text-xs font-medium", label === "Dias para vencimento" && selected.daysLeft < 0 && "text-red-600")}>{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Button className="w-full" variant="outline" size="sm">
                <Edit2 className="size-3.5" /> Editar empresa
              </Button>
              <Button className="w-full" variant="outline" size="sm">
                <ArrowUpRight className="size-3.5" /> Acessar como empresa
              </Button>
              <Button className="w-full" variant="outline" size="sm">
                <CreditCard className="size-3.5" /> Ver faturas
              </Button>
              <Button className="w-full" variant="destructive" size="sm">
                <Lock className="size-3.5" /> Suspender acesso
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}

function PlansView() {
  const [editingPlan, setEditingPlan] = useState<typeof plans[0] | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const planColorMap: Record<string, string> = {
    gray: "border-zinc-200",
    blue: "border-blue-200",
    purple: "border-purple-400 ring-2 ring-purple-100",
    amber: "border-amber-200",
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Gerencie os planos disponíveis e configure preços, limites e extras.</p>
        </div>
        <Button size="sm"><Plus className="size-4" /> Novo plano</Button>
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
              <button
                onClick={() => { setEditingPlan(plan); setSheetOpen(true) }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
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
                  {f.included ? (
                    <Check className="size-3.5 shrink-0 text-emerald-500" />
                  ) : (
                    <X className="size-3.5 shrink-0 text-muted-foreground/40" />
                  )}
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
              <span className="text-xs text-muted-foreground">{plan.companies} empresa{plan.companies !== 1 ? "s" : ""}</span>
              <Button variant="outline" size="sm" className="h-7 text-xs">Gerenciar</Button>
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
            {
              icon: Users,
              title: "Por usuários",
              desc: "Cobrança base pelo número de assentos inclusos no plano. Cada usuário extra é cobrado separadamente conforme a tabela do plano.",
              color: "text-blue-600 bg-blue-50",
            },
            {
              icon: MessageSquare,
              title: "Por chats",
              desc: "Volume de conversas iniciadas no mês. Ao ultrapassar o limite do plano, pacotes adicionais de 1.000 chats são cobrados automaticamente.",
              color: "text-purple-600 bg-purple-50",
            },
            {
              icon: Zap,
              title: "Por agentes IA",
              desc: "Quantidade de agentes IA simultâneos ativos. Planos Enterprise permitem agentes ilimitados com custo negociado por volume.",
              color: "text-amber-600 bg-amber-50",
            },
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
                <Input defaultValue={editingPlan.description} />
              </div>
            </div>

            <Card>
              <CardHeader className="p-3 pb-2"><CardTitle className="text-sm">Limites inclusos</CardTitle></CardHeader>
              <CardContent className="space-y-2 p-3 pt-0">
                {editingPlan.features.map((f) => (
                  <div key={f.label} className="flex items-center justify-between gap-3">
                    <label className="text-xs text-muted-foreground">{f.label}</label>
                    <Input className="h-7 w-24 text-xs" defaultValue={f.value === "—" ? "" : f.value} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3 pb-2"><CardTitle className="text-sm">Preço de extras</CardTitle></CardHeader>
              <CardContent className="space-y-2 p-3 pt-0">
                {editingPlan.extras.map((e) => (
                  <div key={e.label} className="flex items-center justify-between gap-3">
                    <label className="text-xs text-muted-foreground">{e.label}</label>
                    <Input className="h-7 w-28 text-xs" defaultValue={e.price} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Button className="w-full">Salvar alterações</Button>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}

function FinancialView() {
  const [selectedInvoice, setSelectedInvoice] = useState<typeof invoices[0] | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const summary = [
    { label: "Receita maio", value: "R$ 17.690", delta: "+12,4%", positive: true },
    { label: "Faturas pagas", value: "12", delta: "de 15 emitidas", positive: true },
    { label: "Inadimplência", value: "R$ 3.200", delta: "1 empresa", positive: false },
    { label: "Churn MRR", value: "R$ 897", delta: "1 cancelamento", positive: false },
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
                    className={cn(
                      "cursor-pointer border-b last:border-b-0 transition-colors hover:bg-muted/20",
                      selectedInvoice?.id === inv.id && sheetOpen && "bg-primary/5",
                    )}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{inv.id}</td>
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
        </CardContent>
      </Card>

      {selectedInvoice && (
        <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
          <SheetHeader>
            <div className="flex size-9 items-center justify-center rounded-lg border bg-muted/50">
              <FileText className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{selectedInvoice.id}</p>
              <p className="text-xs text-muted-foreground">{selectedInvoice.company}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSheetOpen(false)}><X /></Button>
          </SheetHeader>
          <SheetContent className="space-y-4">
            <div className="flex gap-2">
              <StatusBadge status={selectedInvoice.status} />
            </div>
            <Card>
              <CardContent className="space-y-2 p-3">
                {[
                  ["Empresa", selectedInvoice.company],
                  ["Plano", selectedInvoice.plan],
                  ["Valor", selectedInvoice.amount],
                  ["Método", selectedInvoice.method],
                  ["Data de pagamento", selectedInvoice.date],
                ].map(([label, value]) => (
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

function UsersView() {
  const [selectedUser, setSelectedUser] = useState<typeof allUsers[0] | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [search, setSearch] = useState("")

  const filtered = allUsers.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.company.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()),
  )

  const roleColors: Record<string, string> = {
    Owner: "bg-amber-50 text-amber-700",
    Admin: "bg-blue-50 text-blue-700",
    Gestor: "bg-purple-50 text-purple-700",
    Atendente: "bg-zinc-100 text-zinc-600",
  }

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
        <Button size="sm"><Plus className="size-4" /> Novo usuário</Button>
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
                    className={cn(
                      "cursor-pointer border-b last:border-b-0 transition-colors hover:bg-muted/20",
                      selectedUser?.id === user.id && sheetOpen && "bg-primary/5",
                    )}
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
                    <td className="px-4 py-2.5"><PlanBadge plan={user.plan} color={user.plan === "Enterprise" ? "amber" : user.plan === "Scale" ? "purple" : user.plan === "Growth" ? "blue" : "gray"} /></td>
                    <td className="px-4 py-2.5">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", roleColors[user.role])}>{user.role}</span>
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
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", roleColors[selectedUser.role] ?? "bg-zinc-100 text-zinc-600")}>{selectedUser.role}</span>
            </div>
            <Card>
              <CardContent className="space-y-2 p-3">
                {[
                  ["Empresa", selectedUser.company],
                  ["Plano", selectedUser.plan],
                  ["Perfil", selectedUser.role],
                  ["Último acesso", selectedUser.lastSeen],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between border-b pb-2 last:border-b-0 last:pb-0">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <span className="text-xs font-medium">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <div className="space-y-2">
              <Button className="w-full" variant="outline" size="sm"><Edit2 className="size-3.5" /> Editar usuário</Button>
              <Button className="w-full" variant="outline" size="sm"><Shield className="size-3.5" /> Alterar permissões</Button>
              {selectedUser.status === "Bloqueado" ? (
                <Button className="w-full" size="sm"><Check className="size-3.5" /> Reativar acesso</Button>
              ) : (
                <Button className="w-full" variant="destructive" size="sm"><Lock className="size-3.5" /> Bloquear usuário</Button>
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}

function AdminSettingsView() {
  const sections = [
    {
      title: "Identidade da plataforma",
      items: [
        ["Nome da plataforma", "Zap Tech"],
        ["Domínio", "app.zaptech.com.br"],
        ["E-mail de suporte", "suporte@zaptech.com.br"],
        ["Fuso horário padrão", "America/Sao_Paulo"],
      ],
    },
    {
      title: "Integração de pagamentos",
      items: [
        ["Gateway", "Stripe"],
        ["Webhook", "Configurado"],
        ["Moeda padrão", "BRL"],
        ["Período de trial", "14 dias"],
      ],
    },
    {
      title: "Notificações automáticas",
      items: [
        ["Trial expirando", "3 dias antes"],
        ["Fatura vencida", "No vencimento + 3 dias"],
        ["Limite de chats atingido", "Em 90% do uso"],
        ["Novo cadastro de empresa", "Imediato"],
      ],
    },
  ]

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.title}>
            <CardHeader className="p-4 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">{section.title}</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs h-7"><Edit2 className="size-3" /> Editar</Button>
              </div>
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
              {[
                { name: "Allan Torres", email: "allan@zaptech.com.br", role: "Super Admin" },
                { name: "Daniel Fachin", email: "daniel@zaptech.com.br", role: "Financeiro" },
              ].map((admin) => (
                <div key={admin.email} className="flex items-center gap-3 rounded-lg border p-3">
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs">{admin.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{admin.name}</p>
                    <p className="text-xs text-muted-foreground">{admin.email}</p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{admin.role}</span>
                  <Button variant="ghost" size="icon" className="size-7"><MoreHorizontal className="size-3.5" /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full mt-2"><Plus className="size-3.5" /> Adicionar admin</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Workaround: icon component not imported above
function SlidersHorizontalIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="21" y1="4" x2="14" y2="4" />
      <line x1="10" y1="4" x2="3" y2="4" />
      <line x1="21" y1="12" x2="12" y2="12" />
      <line x1="8" y1="12" x2="3" y2="12" />
      <line x1="21" y1="20" x2="16" y2="20" />
      <line x1="12" y1="20" x2="3" y2="20" />
      <line x1="14" y1="2" x2="14" y2="6" />
      <line x1="8" y1="10" x2="8" y2="14" />
      <line x1="16" y1="18" x2="16" y2="22" />
    </svg>
  )
}

// ─── View metadata ────────────────────────────────────────────────────────────

const viewMeta: Record<AdminView, { title: string; subtitle: string; action?: string }> = {
  dashboard: { title: "Dashboard", subtitle: "Visão geral da plataforma e métricas em tempo real" },
  empresas: { title: "Empresas", subtitle: "Gerencie todas as empresas cadastradas na plataforma", action: "Nova empresa" },
  planos: { title: "Planos & Preços", subtitle: "Configure planos, limites e política de cobranças", action: "Novo plano" },
  financeiro: { title: "Financeiro", subtitle: "Faturas, receitas e controle de inadimplência" },
  usuarios: { title: "Usuários", subtitle: "Todos os usuários cadastrados em todas as empresas", action: "Novo usuário" },
  configuracoes: { title: "Configurações", subtitle: "Configurações globais da plataforma" },
}

// ─── Root Admin component ─────────────────────────────────────────────────────

export default function Admin() {
  const [activeView, setActiveView] = useState<AdminView>("dashboard")
  const meta = viewMeta[activeView]

  const roleColors: Record<string, string> = {
    Owner: "bg-amber-50 text-amber-700",
    Admin: "bg-blue-50 text-blue-700",
    Gestor: "bg-purple-50 text-purple-700",
    Atendente: "bg-zinc-100 text-zinc-600",
  }

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
                  activeView === item.id
                    ? "bg-zinc-900 text-white"
                    : "text-muted-foreground hover:bg-zinc-100 hover:text-foreground",
                )}
              >
                <item.icon className="size-3.5 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <span className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                    activeView === item.id ? "bg-white/20 text-white" : "bg-muted text-muted-foreground",
                  )}>
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="space-y-1 border-t pt-3">
            <a
              href="/"
              className="flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-zinc-100 hover:text-foreground"
            >
              <Globe className="size-3.5" />
              Voltar ao app
            </a>
            <button className="flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-zinc-100 hover:text-foreground">
              <LogOut className="size-3.5" />
              Sair
            </button>
          </div>
        </aside>

        {/* Main */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* Header */}
          <header className="shrink-0 border-b bg-white px-5 py-3">
            <div className="flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-bold">{meta.title}</h1>
                <p className="text-xs text-muted-foreground">{meta.subtitle}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" aria-label="Notificações" className="relative">
                  <Bell className="size-4" />
                  <span className="absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">3</span>
                </Button>
                <Avatar className="size-8">
                  <AvatarFallback className="text-xs bg-zinc-900 text-white">AT</AvatarFallback>
                </Avatar>
              </div>
            </div>
          </header>

          {/* Content */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {activeView === "dashboard" && <DashboardView />}
            {activeView === "empresas" && <CompaniesView />}
            {activeView === "planos" && <PlansView />}
            {activeView === "financeiro" && <FinancialView />}
            {activeView === "usuarios" && <UsersView />}
            {activeView === "configuracoes" && <AdminSettingsView />}
          </div>
        </section>
      </div>
    </main>
  )
}
