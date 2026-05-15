import { useEffect, useState } from "react"
import { Outlet, NavLink, useLocation, Navigate } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { useUnreadCount, useEmailUnreadCount } from "@/hooks/useUnreadCount"
import { clearStoredAuth, redirectToLogin } from "@/lib/auth"
import { navItems, viewCopy, type ViewId } from "@/lib/nav"
import {
  Bot,
  BrainCircuit,
  Command,
  Inbox,
  LifeBuoy,
  LogOut,
  MessageCircle,
  Plus,
  Sparkles,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

const agents = [
  { name: "Triagem",      icon: Inbox,         scope: "Cadastro e entrada", status: "on"  },
  { name: "Qualificador", icon: BrainCircuit,  scope: "Análise de lead",    status: "on"  },
  { name: "Vendas",       icon: MessageCircle, scope: "Texto e proposta",   status: "off" },
  { name: "Suporte",      icon: LifeBuoy,      scope: "Pós-venda",          status: "on"  },
]

const ROLE_LABEL: Record<string, string> = {
  OWNER:     "Proprietário",
  ADMIN:     "Admin",
  GESTOR:    "Gestor",
  ATENDENTE: "Atendente",
}

const ROLE_COLOR: Record<string, string> = {
  OWNER:     "bg-primary text-primary-foreground",
  ADMIN:     "bg-violet-600 text-white",
  GESTOR:    "bg-cyan-600 text-white",
  ATENDENTE: "bg-slate-500 text-white",
}

const navGroups: Array<{ label: string; items: ViewId[] }> = [
  { label: "Operação", items: ["atendimento", "emails", "quadros"] },
  { label: "CRM & Comercial", items: ["empresas", "clientes", "orcamentos", "produtos", "segmentacao", "pipelines"] },
  { label: "Suporte", items: ["suporte", "base-conhecimento", "suporte-categorias", "suporte-sla"] },
  { label: "Automação", items: ["agentes", "rops", "automacoes"] },
  { label: "Marketing", items: ["transmissao", "campanhas"] },
  { label: "Gestão", items: ["equipes", "distribuicao", "auditorias", "relatorios", "configuracoes"] },
]

const NAV_GROUPS_STORAGE_KEY = "zapvendas:sidebar:nav-groups"

function getInitialNavGroupState() {
  const fallback = Object.fromEntries(navGroups.map((group) => [group.label, true]))

  if (typeof window === "undefined") return fallback

  try {
    const stored = window.localStorage.getItem(NAV_GROUPS_STORAGE_KEY)
    if (!stored) return fallback

    return {
      ...fallback,
      ...(JSON.parse(stored) as Record<string, boolean>),
    }
  } catch {
    return fallback
  }
}

async function doLogout() {
  const token = localStorage.getItem("zv_token")
  await fetch("/api/auth/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${token ?? ""}` },
  }).catch(() => {})
  clearStoredAuth()
  window.location.href = "/login"
}

function SidebarBrand() {
  const { open } = useSidebar()

  return (
    <div className={cn("flex items-center gap-3 px-2", !open && "justify-center px-0")}>
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Command className="size-4" />
      </div>
      {open && (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Zap Tech</p>
          <p className="truncate text-xs text-muted-foreground">Operação IA</p>
        </div>
      )}
    </div>
  )
}

function SidebarNavigation({
  currentId,
  unreadCount,
  emailUnreadCount,
}: {
  currentId: ViewId
  unreadCount: number
  emailUnreadCount: number
}) {
  const { open, setMobileOpen } = useSidebar()
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(getInitialNavGroupState)
  const itemById = new Map(navItems.map((item) => [item.id, item]))

  function toggleGroup(label: string) {
    setExpandedGroups((current) => {
      const next = {
        ...current,
        [label]: !(current[label] ?? true),
      }

      window.localStorage.setItem(NAV_GROUPS_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  return (
    <div className="space-y-4">
      {navGroups.map((group) => (
        <SidebarGroup key={group.label}>
          {open && (
            <button
              type="button"
              className="flex h-6 w-full items-center gap-2 rounded-md px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80 transition-colors hover:bg-muted/70 hover:text-foreground"
              onClick={() => toggleGroup(group.label)}
              aria-expanded={expandedGroups[group.label] ?? true}
            >
              <ChevronRight
                className={cn(
                  "size-3 transition-transform",
                  (expandedGroups[group.label] ?? true) && "rotate-90",
                )}
              />
              <span className="flex-1 text-left">{group.label}</span>
            </button>
          )}
          {(!open || expandedGroups[group.label] !== false) && (
            <SidebarMenu>
              {group.items.map((id) => {
                const item = itemById.get(id)
                if (!item) return null

                const badgeCount = item.id === "atendimento" ? unreadCount : item.id === "emails" ? emailUnreadCount : 0
                const showBadge = badgeCount > 0

                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={currentId === item.id}
                      className={cn(!open && "justify-center px-0")}
                    >
                      <NavLink
                        to={`/${item.id}`}
                        onClick={() => setMobileOpen(false)}
                        title={!open ? item.label : undefined}
                      >
                        <item.icon className="size-4 shrink-0" />
                        {open && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                        {showBadge && open && (
                          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                            {badgeCount > 99 ? "99+" : badgeCount}
                          </span>
                        )}
                        {showBadge && !open && (
                          <span className="absolute right-2 top-1.5 size-1.5 rounded-full bg-amber-500" />
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          )}
        </SidebarGroup>
      ))}
    </div>
  )
}

function SidebarPlanCard() {
  const { open } = useSidebar()

  if (!open) {
    return (
      <div className="flex justify-center rounded-lg border bg-muted/40 p-2">
        <Sparkles className="size-4 text-amber-600" />
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-muted/40 p-2.5">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="size-4 text-amber-600" />
        Plano interno
      </div>
      <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
        6 agentes ativos, 12 ferramentas conectadas e 94% de SLA no dia.
      </p>
    </div>
  )
}

export default function AppLayout() {
  const auth = useAuth()
  const [agentsOpen, setAgentsOpen] = useState(false)
  const { count: unreadCount } = useUnreadCount()
  const { count: emailUnreadCount } = useEmailUnreadCount()
  const location = useLocation()

  useEffect(() => {
    if (!auth) return

    let cancelled = false

    async function validateSession() {
      try {
        const response = await fetch("/api/auth/me")
        if (!cancelled && response.status === 401) {
          redirectToLogin("expired")
        }
      } catch {
        // Falha de rede não deve deslogar o usuário; o interceptor trata 401 reais.
      }
    }

    validateSession()

    window.addEventListener("focus", validateSession)
    document.addEventListener("visibilitychange", validateSession)

    return () => {
      cancelled = true
      window.removeEventListener("focus", validateSession)
      document.removeEventListener("visibilitychange", validateSession)
    }
  }, [auth?.id])

  // Auth guard
  if (!auth) return <Navigate to="/login" replace />

  // Derive current view id from pathname  e.g. "/quadros" → "quadros"
  const currentId = (location.pathname.slice(1) || "atendimento") as ViewId
  const currentView = viewCopy[currentId] ?? viewCopy["atendimento"]
  const isBuilder = currentId === "agentes" || currentId === "automacoes"
  const activeAgents = agents.filter((agent) => agent.status === "on").length

  return (
    <SidebarProvider defaultOpen storageKey="zapvendas:app-sidebar:open">
      <main className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.10),_transparent_28rem),linear-gradient(180deg,_#f8fafc_0%,_#eef4f7_100%)]">
        <div className="flex h-screen min-h-0">
          <Sidebar>
            <SidebarHeader>
              <SidebarBrand />
            </SidebarHeader>
            <SidebarContent>
              <SidebarNavigation currentId={currentId} unreadCount={unreadCount} emailUnreadCount={emailUnreadCount} />
            </SidebarContent>
            <SidebarFooter>
              <SidebarPlanCard />
            </SidebarFooter>
          </Sidebar>

          <SidebarInset>
            <header className="shrink-0 border-b bg-white/88 px-4 py-2.5 backdrop-blur md:px-5">
              <div className="flex items-center gap-3">
                <SidebarTrigger />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h1 className="truncate text-lg font-semibold">{currentView.title}</h1>
                    <Badge variant={currentId === "quadros" ? "secondary" : "success"}>
                      {currentId === "quadros" ? "Pipeline" : isBuilder ? "Editor" : "Ao vivo"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{currentView.subtitle}</p>
                </div>
                <div className="relative ml-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-12 gap-2.5 rounded-lg border-primary/20 bg-white px-2.5 py-2 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5",
                      agentsOpen && "border-primary/40 bg-primary/5",
                    )}
                    onClick={() => setAgentsOpen((open) => !open)}
                    aria-expanded={agentsOpen}
                    title="Ver agentes de automação"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Bot className="size-3.5" />
                    </span>
                    <span className="hidden sm:inline">Agentes</span>
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      {activeAgents}/{agents.length}
                    </span>
                    <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", agentsOpen && "rotate-180")} />
                  </Button>

                  {agentsOpen && (
                    <div className="absolute right-0 top-14 z-50 w-[360px] rounded-lg border bg-white shadow-xl">
                      <div className="border-b px-3.5 py-3">
                        <p className="text-xs font-semibold">Agentes de automação</p>
                        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">Usados por gatilhos em Agentes e Automações.</p>
                      </div>
                      <div className="max-h-[320px] divide-y overflow-y-auto">
                        {agents.map((agent) => (
                          <div key={agent.name} className="flex min-h-14 items-center gap-2.5 px-3.5 py-2.5">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary">
                              <agent.icon className="size-3.5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-semibold">{agent.name}</span>
                              <span className="block truncate text-[11px] text-muted-foreground">{agent.scope}</span>
                            </span>
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                                agent.status === "on"
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-slate-200 bg-slate-50 text-slate-500",
                              )}
                            >
                              <span className={cn("size-1.5 rounded-full", agent.status === "on" ? "bg-emerald-500" : "bg-slate-400")} />
                              {agent.status === "on" ? "Ligado" : "Desligado"}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2 border-t bg-muted/20 p-3">
                        <NavLink
                          to="/agentes"
                          onClick={() => setAgentsOpen(false)}
                          className="inline-flex h-8 items-center justify-center rounded-md border bg-white px-3 text-xs font-medium transition-colors hover:bg-muted"
                        >
                          Ver agentes
                        </NavLink>
                        <NavLink
                          to="/agentes?novo=agente"
                          onClick={() => setAgentsOpen(false)}
                          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                        >
                          <Plus className="size-3" />
                          Novo agente
                        </NavLink>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex min-w-0 items-center gap-2.5 rounded-lg border bg-white px-2.5 py-2 shadow-sm">
                  <div className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${ROLE_COLOR[auth.role] ?? "bg-slate-500 text-white"}`}>
                    {auth.name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("")}
                  </div>
                  <div className="hidden min-w-0 sm:block">
                    <p className="max-w-40 truncate text-xs font-semibold">{auth.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{ROLE_LABEL[auth.role] ?? auth.role}</p>
                  </div>
                  <button
                    onClick={doLogout}
                    title="Sair"
                    className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <LogOut className="size-3.5" />
                  </button>
                </div>
              </div>
            </header>

            {/* Page content rendered here */}
            <Outlet />
          </SidebarInset>
        </div>
      </main>
    </SidebarProvider>
  )
}
