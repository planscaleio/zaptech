import React, { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Building2,
  Users,
  Plug,
  Shuffle,
  BrainCircuit,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Loader2,
  Plus,
  Trash2,
  Save,
  ChevronRight,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  Check,
  Wifi,
  WifiOff,
  Activity,
  Shield,
  Settings,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompanyData {
  id: string
  name: string
  slug: string
  status: string
  ownerName: string | null
  email: string | null
  phone: string | null
  cnpj: string | null
  city: string | null
  mrr: string | number
  trialEndsAt: string | null
  nextBilling: string | null
  currentUsers: number
  currentChats: number
  currentAgents: number
  plan: { id: string; name: string; maxUsers: number | null }
}

interface UserData {
  id: string
  name: string
  email: string
  role: "OWNER" | "ADMIN" | "GESTOR" | "ATENDENTE"
  status: "ATIVO" | "BLOQUEADO"
  avatarUrl: string | null
  lastSeen: string | null
  createdAt: string
}

interface ConnectorData {
  id: string
  name: string
  type: "CANAL" | "CRM" | "ENTRADA" | "AGENDA" | "PAGAMENTO" | "OUTRO"
  status: "CONECTADO" | "ATIVO" | "REVISAR" | "DESCONECTADO" | "ERRO"
  details: string | null
  config: Record<string, unknown> | null
  lastEventAt: string | null
  createdAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Section = "empresa" | "usuarios" | "canais" | "integracoes" | "ia"

const SECTIONS: { id: Section; label: string; icon: typeof Building2; desc: string }[] = [
  { id: "empresa",     label: "Empresa",        icon: Building2,   desc: "Perfil, plano e dados cadastrais" },
  { id: "usuarios",    label: "Usuários",        icon: Users,       desc: "Convidar, papéis e acesso" },
  { id: "canais",      label: "Canais",          icon: Plug,        desc: "WhatsApp, Instagram e outros canais" },
  { id: "integracoes", label: "Integrações",     icon: Shuffle,     desc: "CRM, webhooks e apps externos" },
  { id: "ia",          label: "IA & Operação",   icon: BrainCircuit,desc: "Modelos de IA e configurações da operação" },
]

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Proprietário", ADMIN: "Admin", GESTOR: "Gestor", ATENDENTE: "Atendente",
}
const ROLE_STYLE: Record<string, string> = {
  OWNER:     "bg-violet-50 text-violet-700 border-violet-200",
  ADMIN:     "bg-blue-50 text-blue-700 border-blue-200",
  GESTOR:    "bg-amber-50 text-amber-700 border-amber-200",
  ATENDENTE: "bg-slate-50 text-slate-600 border-slate-200",
}

const STATUS_STYLE: Record<string, string> = {
  ATIVO:        "bg-emerald-50 text-emerald-700 border-emerald-200",
  BLOQUEADO:    "bg-red-50 text-red-700 border-red-200",
  TRIAL:        "bg-amber-50 text-amber-700 border-amber-200",
  CONECTADO:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  DESCONECTADO: "bg-slate-50 text-slate-500 border-slate-200",
  REVISAR:      "bg-amber-50 text-amber-700 border-amber-200",
  ERRO:         "bg-red-50 text-red-700 border-red-200",
}
const STATUS_ICON: Record<string, typeof CheckCircle2> = {
  ATIVO:        CheckCircle2,
  CONECTADO:    Wifi,
  BLOQUEADO:    XCircle,
  DESCONECTADO: WifiOff,
  REVISAR:      AlertCircle,
  ERRO:         XCircle,
  TRIAL:        Clock,
}

const CONNECTOR_TYPE_LABEL: Record<string, string> = {
  CANAL: "Canal", CRM: "CRM", ENTRADA: "Entrada", AGENDA: "Agenda", PAGAMENTO: "Pagamento", OUTRO: "Outro",
}

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
}
function fmtRelative(iso: string | null) {
  if (!iso) return "Nunca"
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 2)   return "Agora"
  if (mins < 60)  return `${mins}min atrás`
  if (hours < 24) return `${hours}h atrás`
  return `${days}d atrás`
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("")
}

// ─── ConfiguracoesPage ────────────────────────────────────────────────────────

export default function ConfiguracoesPage() {
  const auth      = useAuth()
  const companyId = auth?.companyId ?? ""
  const token     = localStorage.getItem("zv_token") ?? ""

  const [section, setSection] = useState<Section>("empresa")

  return (
    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
      <div className="grid h-full min-w-[900px] grid-cols-[240px_minmax(560px,1fr)] gap-2.5 p-2.5 md:p-3">

        {/* ── Left sidebar ─────────────────────────────────────────────────── */}
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white shadow-soft">
          <div className="shrink-0 border-b p-3">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Settings className="size-4 text-muted-foreground" />
              Configurações
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Gerencie sua operação</p>
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto space-y-1 p-2">
            {SECTIONS.map((s) => {
              const isActive = section === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  className={cn(
                    "w-full rounded-lg border px-2.5 py-2.5 text-left transition-colors",
                    isActive
                      ? "border-primary/30 bg-primary/5 ring-1 ring-primary/10"
                      : "border-transparent hover:border-muted hover:bg-muted/40",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <s.icon className={cn("size-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                    <div className="min-w-0">
                      <p className={cn("text-sm font-medium", isActive ? "text-primary" : "text-foreground")}>{s.label}</p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{s.desc}</p>
                    </div>
                    {isActive && <ChevronRight className="ml-auto size-3.5 shrink-0 text-primary/60" />}
                  </div>
                </button>
              )
            })}
          </nav>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <main className="min-h-0 overflow-hidden rounded-lg border bg-white shadow-soft">
          {section === "empresa"     && <EmpresaSection     companyId={companyId} token={token} />}
          {section === "usuarios"    && <UsuariosSection    companyId={companyId} token={token} />}
          {section === "canais"      && <ConectoresSection  companyId={companyId} token={token} type="CANAL" />}
          {section === "integracoes" && <ConectoresSection  companyId={companyId} token={token} type="OTHER" />}
          {section === "ia"          && <IASection          companyId={companyId} token={token} />}
        </main>

      </div>
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, subtitle, action }: {
  icon: typeof Building2
  title: string
  subtitle: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="size-4.5 text-primary" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {action}
    </div>
  )
}

// ─── Empresa Section ──────────────────────────────────────────────────────────

function EmpresaSection({ companyId, token }: { companyId: string; token: string }) {
  const [data,    setData]    = useState<CompanyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [form,    setForm]    = useState({
    name: "", ownerName: "", email: "", phone: "", cnpj: "", city: "",
  })

  useEffect(() => {
    if (!companyId) return
    fetch(`/api/settings/company?companyId=${companyId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d: CompanyData) => {
        setData(d)
        setForm({
          name:      d.name      ?? "",
          ownerName: d.ownerName ?? "",
          email:     d.email     ?? "",
          phone:     d.phone     ?? "",
          cnpj:      d.cnpj      ?? "",
          city:      d.city      ?? "",
        })
      })
      .finally(() => setLoading(false))
  }, [companyId, token])

  async function handleSave() {
    setSaving(true)
    await fetch("/api/settings/company", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ companyId, ...form }),
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return <Loader className="py-20" />

  const STATUS_MAP: Record<string, string> = {
    ATIVA: "Ativa", TRIAL: "Trial", INADIMPLENTE: "Inadimplente", SUSPENSA: "Suspensa",
  }

  return (
    <div className="flex min-h-0 flex-col overflow-hidden">
      <SectionHeader
        icon={Building2}
        title="Perfil da empresa"
        subtitle="Dados cadastrais e informações do plano"
        action={
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : saved ? <Check className="size-3.5" /> : <Save className="size-3.5" />}
            {saved ? "Salvo!" : "Salvar"}
          </Button>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-2xl space-y-6">

          {/* Plan strip */}
          {data && (
            <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-muted/30 px-4 py-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Plano</p>
                <p className="text-sm font-semibold">{data.plan.name}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Status</p>
                <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", STATUS_STYLE[data.status] ?? "bg-muted text-muted-foreground border-border")}>
                  {STATUS_MAP[data.status] ?? data.status}
                </span>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Usuários</p>
                <p className="text-sm font-semibold">{data.currentUsers} {data.plan.maxUsers ? `/ ${data.plan.maxUsers}` : ""}</p>
              </div>
              {data.trialEndsAt && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Trial até</p>
                  <p className="text-sm font-semibold">{fmtDate(data.trialEndsAt)}</p>
                </div>
              )}
              {data.nextBilling && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Próx. fatura</p>
                  <p className="text-sm font-semibold">{fmtDate(data.nextBilling)}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Slug</p>
                <p className="font-mono text-xs text-muted-foreground">{data.slug}</p>
              </div>
            </div>
          )}

          {/* Form */}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Nome da empresa" required>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Acme Corp" />
            </FormField>
            <FormField label="Responsável / proprietário">
              <Input value={form.ownerName} onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))} placeholder="João Silva" />
            </FormField>
            <FormField label="E-mail da empresa">
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="contato@empresa.com" />
            </FormField>
            <FormField label="Telefone">
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+55 11 99999-9999" />
            </FormField>
            <FormField label="CNPJ">
              <Input value={form.cnpj} onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0001-00" />
            </FormField>
            <FormField label="Cidade">
              <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="São Paulo" />
            </FormField>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Usuários Section ─────────────────────────────────────────────────────────

function UsuariosSection({ companyId, token }: { companyId: string; token: string }) {
  const [users,      setUsers]      = useState<UserData[]>([])
  const [loading,    setLoading]    = useState(true)
  const [inviting,   setInviting]   = useState(false)
  const [showForm,   setShowForm]   = useState(false)
  const [tempPass,   setTempPass]   = useState<{ user: string; pass: string } | null>(null)
  const [copied,     setCopied]     = useState(false)
  const [form,       setForm]       = useState({ name: "", email: "", role: "ATENDENTE" })
  const [formError,  setFormError]  = useState("")

  const fetchUsers = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    const r = await fetch(`/api/settings/users?companyId=${companyId}`, { headers: { Authorization: `Bearer ${token}` } })
    setUsers(await r.json())
    setLoading(false)
  }, [companyId, token])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  async function handleInvite() {
    if (!form.name || !form.email) { setFormError("Nome e e-mail são obrigatórios"); return }
    setInviting(true); setFormError("")
    const r = await fetch("/api/settings/users", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ companyId, ...form }),
    })
    const d = await r.json()
    setInviting(false)
    if (!r.ok) { setFormError(d.error ?? "Erro ao criar usuário"); return }
    setTempPass({ user: d.name, pass: d.tempPassword })
    setShowForm(false)
    setForm({ name: "", email: "", role: "ATENDENTE" })
    fetchUsers()
  }

  async function patchUser(id: string, patch: Partial<Pick<UserData, "role" | "status">>) {
    await fetch(`/api/settings/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(patch),
    })
    fetchUsers()
  }

  async function deleteUser(id: string, name: string) {
    if (!confirm(`Remover ${name}? Esta ação não pode ser desfeita.`)) return
    await fetch(`/api/settings/users/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
    fetchUsers()
  }

  function copyPass() {
    if (tempPass) { navigator.clipboard.writeText(tempPass.pass); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  }

  return (
    <div className="flex min-h-0 flex-col overflow-hidden">
      <SectionHeader
        icon={Users}
        title="Usuários"
        subtitle="Gerencie os membros da equipe e seus papéis"
        action={
          <Button size="sm" className="gap-1.5" onClick={() => { setShowForm((v) => !v); setFormError(""); setTempPass(null) }}>
            <Plus className="size-3.5" />
            Convidar usuário
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">

        {/* Invite form */}
        {showForm && (
          <div className="border-b bg-muted/20 px-4 py-3">
            <p className="mb-3 text-sm font-medium">Novo usuário</p>
            <div className="flex flex-wrap gap-2">
              <Input
                className="h-8 flex-1 min-w-[160px] text-sm"
                placeholder="Nome completo"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <Input
                className="h-8 flex-1 min-w-[200px] text-sm"
                placeholder="E-mail"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
              <select
                className="h-8 rounded-md border bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              >
                <option value="ATENDENTE">Atendente</option>
                <option value="GESTOR">Gestor</option>
                <option value="ADMIN">Admin</option>
              </select>
              <Button size="sm" className="h-8" onClick={handleInvite} disabled={inviting}>
                {inviting ? <Loader2 className="size-3.5 animate-spin" /> : "Criar"}
              </Button>
            </div>
            {formError && <p className="mt-2 text-xs text-red-600">{formError}</p>}
          </div>
        )}

        {/* Temp password callout */}
        {tempPass && (
          <div className="border-b bg-amber-50 px-4 py-3">
            <p className="mb-1 text-sm font-medium text-amber-800">Senha temporária para <strong>{tempPass.user}</strong></p>
            <p className="mb-2 text-xs text-amber-700">Copie e compartilhe com o usuário — ela não será exibida novamente.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded border border-amber-200 bg-white px-3 py-1.5 font-mono text-sm text-amber-900">{tempPass.pass}</code>
              <Button size="sm" variant="outline" className="h-8 gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-100" onClick={copyPass}>
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "Copiado" : "Copiar"}
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-amber-600" onClick={() => setTempPass(null)}>
                <XCircle className="size-3.5" />
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <Loader className="py-20" />
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/60 backdrop-blur">
              <tr className="text-left">
                {["Usuário", "Papel", "Status", "Último acesso", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {initials(u.name)}
                      </div>
                      <div>
                        <p className="font-medium">{u.name}</p>
                        <p className="text-[11px] text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {u.role === "OWNER" ? (
                      <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium", ROLE_STYLE.OWNER)}>
                        {ROLE_LABEL.OWNER}
                      </span>
                    ) : (
                      <select
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[11px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/20",
                          ROLE_STYLE[u.role],
                        )}
                        value={u.role}
                        onChange={(e) => patchUser(u.id, { role: e.target.value as UserData["role"] })}
                      >
                        <option value="ATENDENTE">Atendente</option>
                        <option value="GESTOR">Gestor</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {u.role === "OWNER" ? (
                      <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium", STATUS_STYLE.ATIVO)}>
                        <CheckCircle2 className="size-3" /> Ativo
                      </span>
                    ) : (
                      <button
                        onClick={() => patchUser(u.id, { status: u.status === "ATIVO" ? "BLOQUEADO" : "ATIVO" })}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-opacity hover:opacity-80",
                          STATUS_STYLE[u.status],
                        )}
                      >
                        {u.status === "ATIVO" ? <CheckCircle2 className="size-3" /> : <XCircle className="size-3" />}
                        {u.status === "ATIVO" ? "Ativo" : "Bloqueado"}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-muted-foreground">{fmtRelative(u.lastSeen)}</td>
                  <td className="px-4 py-3 text-right">
                    {u.role !== "OWNER" && (
                      <button
                        onClick={() => deleteUser(u.id, u.name)}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ─── Conectores Section (Canais + Integrações) ────────────────────────────────

const CANAL_TYPES = ["CANAL"]
const CANAL_SUBTYPES = ["WhatsApp", "Instagram", "Telegram", "Facebook", "Chat no site", "E-mail"]
const INTEGRATION_SUBTYPES = ["Webhook", "CRM externo", "Calendário", "Pagamento", "API personalizada", "Outro"]

function ConectoresSection({ companyId, token, type }: { companyId: string; token: string; type: "CANAL" | "OTHER" }) {
  const isCanal = type === "CANAL"

  const [connectors, setConnectors] = useState<ConnectorData[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [editing,    setEditing]    = useState<ConnectorData | null>(null)
  const [form,       setForm]       = useState({ name: "", subtype: "", details: "", connType: isCanal ? "CANAL" : "CRM" })
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState("")

  const subtypes = isCanal ? CANAL_SUBTYPES : INTEGRATION_SUBTYPES
  const nonCanalTypes = ["CRM", "ENTRADA", "AGENDA", "PAGAMENTO", "OUTRO"]

  const fetchConnectors = useCallback(async () => {
    if (!companyId) return
    setLoading(true)
    const r = await fetch(`/api/settings/connectors?companyId=${companyId}`, { headers: { Authorization: `Bearer ${token}` } })
    const all: ConnectorData[] = await r.json()
    setConnectors(isCanal ? all.filter((c) => c.type === "CANAL") : all.filter((c) => c.type !== "CANAL"))
    setLoading(false)
  }, [companyId, token, isCanal])

  useEffect(() => { fetchConnectors() }, [fetchConnectors])

  function openNew() {
    setEditing(null)
    setForm({ name: "", subtype: subtypes[0], details: "", connType: isCanal ? "CANAL" : "CRM" })
    setShowForm(true); setError("")
  }
  function openEdit(c: ConnectorData) {
    setEditing(c)
    setForm({ name: c.name, subtype: "", details: c.details ?? "", connType: c.type })
    setShowForm(true); setError("")
  }

  async function handleSave() {
    if (!form.name) { setError("Nome é obrigatório"); return }
    setSaving(true); setError("")
    if (editing) {
      await fetch(`/api/settings/connectors/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: form.name, details: form.details }),
      })
    } else {
      const r = await fetch("/api/settings/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          companyId,
          name: form.name || `${form.subtype}`,
          type: isCanal ? "CANAL" : form.connType,
          details: form.details,
        }),
      })
      const d = await r.json()
      if (!r.ok) { setSaving(false); setError(d.error ?? "Erro ao criar conector"); return }
    }
    setSaving(false)
    setShowForm(false)
    fetchConnectors()
  }

  async function patchStatus(id: string, status: ConnectorData["status"]) {
    await fetch(`/api/settings/connectors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    })
    fetchConnectors()
  }

  async function deleteConnector(id: string, name: string) {
    if (!confirm(`Remover ${name}?`)) return
    await fetch(`/api/settings/connectors/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
    fetchConnectors()
  }

  const titleMap = { CANAL: "Canais", OTHER: "Integrações" }
  const subtitleMap = {
    CANAL: "Configure os canais de atendimento conectados à plataforma",
    OTHER: "Webhooks, CRMs e aplicações externas conectadas",
  }

  return (
    <div className="flex min-h-0 flex-col overflow-hidden">
      <SectionHeader
        icon={isCanal ? Plug : Shuffle}
        title={titleMap[type]}
        subtitle={subtitleMap[type]}
        action={
          <Button size="sm" className="gap-1.5" onClick={openNew}>
            <Plus className="size-3.5" />
            {isCanal ? "Adicionar canal" : "Nova integração"}
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Form */}
        {showForm && (
          <div className="border-b bg-muted/20 px-4 py-4">
            <p className="mb-3 text-sm font-medium">{editing ? "Editar" : isCanal ? "Novo canal" : "Nova integração"}</p>
            <div className="flex flex-wrap gap-2">
              {!editing && (
                <select
                  className="h-8 rounded-md border bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={form.subtype}
                  onChange={(e) => setForm((f) => ({ ...f, subtype: e.target.value, name: e.target.value }))}
                >
                  <option value="">Selecione o tipo</option>
                  {subtypes.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              {!isCanal && !editing && (
                <select
                  className="h-8 rounded-md border bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={form.connType}
                  onChange={(e) => setForm((f) => ({ ...f, connType: e.target.value }))}
                >
                  {nonCanalTypes.map((t) => <option key={t} value={t}>{CONNECTOR_TYPE_LABEL[t]}</option>)}
                </select>
              )}
              <Input
                className="h-8 flex-1 min-w-[180px] text-sm"
                placeholder="Nome do conector"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <Input
                className="h-8 flex-1 min-w-[220px] text-sm"
                placeholder={isCanal ? "Número / instância / detalhe" : "URL do webhook / endpoint"}
                value={form.details}
                onChange={(e) => setForm((f) => ({ ...f, details: e.target.value }))}
              />
              <Button size="sm" className="h-8" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : editing ? "Salvar" : "Criar"}
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          </div>
        )}

        {loading ? (
          <Loader className="py-20" />
        ) : connectors.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
            {isCanal ? <Plug className="size-8 opacity-20" /> : <Shuffle className="size-8 opacity-20" />}
            <p className="text-sm">Nenhum {isCanal ? "canal" : "integração"} configurado.</p>
            <Button size="sm" variant="outline" onClick={openNew}>
              {isCanal ? "Adicionar primeiro canal" : "Criar primeira integração"}
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {connectors.map((c) => {
              const StatusIcon = STATUS_ICON[c.status] ?? Activity
              const statusOptions: ConnectorData["status"][] = ["CONECTADO", "DESCONECTADO", "REVISAR", "ERRO"]
              return (
                <div key={c.id} className="flex flex-col gap-2 rounded-xl border bg-white p-3.5 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-sm">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground">{CONNECTOR_TYPE_LABEL[c.type]}</p>
                    </div>
                    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", STATUS_STYLE[c.status])}>
                      <StatusIcon className="size-2.5" />
                      {c.status}
                    </span>
                  </div>

                  {c.details && (
                    <p className="truncate rounded-md bg-muted/40 px-2 py-1 font-mono text-[11px] text-muted-foreground">
                      {c.details}
                    </p>
                  )}

                  {c.lastEventAt && (
                    <p className="text-[10px] text-muted-foreground">
                      Último evento: {fmtRelative(c.lastEventAt)}
                    </p>
                  )}

                  <div className="flex items-center gap-1.5 border-t pt-2">
                    <select
                      className="h-6 flex-1 rounded border bg-white px-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/30"
                      value={c.status}
                      onChange={(e) => patchStatus(c.id, e.target.value as ConnectorData["status"])}
                    >
                      {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button
                      onClick={() => openEdit(c)}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                    >
                      <Settings className="size-3.5" />
                    </button>
                    <button
                      onClick={() => deleteConnector(c.id, c.name)}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── IA & Operação Section ────────────────────────────────────────────────────

function IASection({ companyId, token }: { companyId: string; token: string }) {
  const [stats, setStats] = useState<{ total: number; avgScore: number | null } | null>(null)
  const [showEnv, setShowEnv] = useState(false)

  useEffect(() => {
    if (!companyId) return
    fetch(`/api/auditorias/stats?companyId=${companyId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setStats({ total: d.total ?? 0, avgScore: d.avgScore ?? null }))
      .catch(() => {})
  }, [companyId, token])

  const envVars = [
    { key: "OLLAMA_BASE_URL",  label: "URL do Ollama",    hint: "Padrão: http://localhost:11434" },
    { key: "OLLAMA_MODEL",     label: "Modelo de IA",     hint: "Padrão: gemma4:latest" },
    { key: "AUTH_SECRET",      label: "JWT Secret",       hint: "Variável de ambiente AUTH_SECRET", secret: true },
    { key: "DATABASE_URL",     label: "Database URL",     hint: "PostgreSQL connection string", secret: true },
  ]

  return (
    <div className="flex min-h-0 flex-col overflow-hidden">
      <SectionHeader
        icon={BrainCircuit}
        title="IA & Operação"
        subtitle="Modelos de linguagem, auditoria e variáveis de ambiente"
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-2xl space-y-5">

          {/* Stats */}
          {stats !== null && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: "Auditorias realizadas", value: stats.total,  icon: Shield, color: "text-primary" },
                { label: "Score médio geral",      value: stats.avgScore ? `${Math.round(stats.avgScore)}/100` : "—", icon: Activity, color: "text-emerald-600" },
                { label: "Modelo ativo",           value: "Ollama",   icon: BrainCircuit, color: "text-violet-600" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2.5 rounded-xl border p-3">
                  <s.icon className={cn("size-5 shrink-0", s.color)} />
                  <div>
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    <p className="text-base font-bold">{String(s.value)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* How audits work */}
          <div className="rounded-xl border p-4">
            <p className="mb-1 text-sm font-semibold">Como funciona a auditoria por IA</p>
            <p className="text-[13px] leading-6 text-muted-foreground">
              As auditorias são processadas localmente pelo modelo Ollama configurado. Nenhum dado de conversa é enviado para serviços externos. O modelo analisa transcrições completas e retorna JSON estruturado com score, sentimento, nível de risco, recomendação de coaching e plano de melhoria — tudo em uma única chamada ao LLM.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {[
                ["9 dimensões de análise", "4 técnicas + 5 soft skills"],
                ["Plano de melhoria integrado", "Gerado na mesma chamada da análise"],
                ["Sem dependência externa", "Processamento 100% local via Ollama"],
                ["Score de 0 a 100", "Com critérios ponderados por dimensão"],
              ].map(([title, desc]) => (
                <div key={title} className="flex items-start gap-2 rounded-lg bg-muted/30 px-3 py-2">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-xs font-medium">{title}</p>
                    <p className="text-[11px] text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Environment variables */}
          <div className="rounded-xl border p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">Variáveis de ambiente</p>
              <button
                onClick={() => setShowEnv((v) => !v)}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                {showEnv ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                {showEnv ? "Ocultar" : "Mostrar"}
              </button>
            </div>
            <p className="mb-3 text-[12px] text-muted-foreground">
              Configuradas no arquivo <code className="rounded bg-muted px-1 py-0.5 font-mono">.env</code> do servidor. Reinicie o servidor após alterar.
            </p>
            <div className="space-y-2">
              {envVars.map((v) => (
                <div key={v.key} className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2">
                  <code className="min-w-[160px] shrink-0 font-mono text-xs text-primary">{v.key}</code>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium">{v.label}</p>
                    {showEnv
                      ? <p className="font-mono text-[11px] text-muted-foreground">{v.hint}</p>
                      : <p className="text-[11px] text-muted-foreground">{v.secret ? "••••••••••••" : v.hint}</p>
                    }
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ollama test */}
          <OllamaStatusCard token={token} />

        </div>
      </div>
    </div>
  )
}

function OllamaStatusCard({ token }: { token: string }) {
  const [status, setStatus] = useState<"idle" | "checking" | "ok" | "error">("idle")
  const [detail, setDetail] = useState("")

  async function checkOllama() {
    setStatus("checking"); setDetail("")
    try {
      const r = await fetch("/api/health", { headers: { Authorization: `Bearer ${token}` } })
      if (r.ok) { setStatus("ok"); setDetail("Servidor respondendo normalmente") }
      else       { setStatus("error"); setDetail(`HTTP ${r.status}`) }
    } catch (e) {
      setStatus("error"); setDetail(String(e))
    }
  }

  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Status do servidor</p>
        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={checkOllama} disabled={status === "checking"}>
          {status === "checking"
            ? <Loader2 className="size-3 animate-spin" />
            : <RefreshCw className="size-3" />
          }
          Verificar
        </Button>
      </div>
      {status !== "idle" && (
        <div className={cn("mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
          status === "ok"       ? "bg-emerald-50 text-emerald-700" :
          status === "error"    ? "bg-red-50 text-red-700" :
          "bg-muted/40 text-muted-foreground"
        )}>
          {status === "checking" && <Loader2 className="size-3.5 animate-spin" />}
          {status === "ok"       && <CheckCircle2 className="size-3.5" />}
          {status === "error"    && <XCircle className="size-3.5" />}
          {detail || "Verificando…"}
        </div>
      )}
    </div>
  )
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-muted-foreground">
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}

function Loader({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-2 text-muted-foreground", className)}>
      <Loader2 className="size-4 animate-spin" />
      <span className="text-sm">Carregando…</span>
    </div>
  )
}
