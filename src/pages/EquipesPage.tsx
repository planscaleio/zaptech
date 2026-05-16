import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/useAuth"
import {
  Users, Plus, X, Trash2,
  UserRound, Target, TrendingUp, Loader2, Zap, LifeBuoy, Pencil, Save,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetHeader, SheetContent } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeamUser {
  id: string
  name: string
  email: string
  role: string
  avatarUrl?: string | null
}

interface TeamMember {
  id: string
  role: string | null
  leadCount: number
  revenueValue: string | null
  user: TeamUser
}

interface Team {
  id: string
  name: string
  targetValue: string | null
  pipelineValue: string | null
  conversionRate: string | null
  manager: { id: string; name: string } | null
  channels: { channel: string }[]
  members: TeamMember[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CHANNELS = ["WHATSAPP", "INSTAGRAM", "SITE", "EMAIL", "TELEFONE", "WEBHOOK"] as const
const CHANNEL_LABEL: Record<string, string> = {
  WHATSAPP: "WhatsApp", INSTAGRAM: "Instagram", SITE: "Site",
  EMAIL: "E-mail", TELEFONE: "Telefone", WEBHOOK: "Webhook",
}

// ─── Add Member Sheet ─────────────────────────────────────────────────────────

interface AddMemberSheetProps {
  open: boolean
  teamId: string
  users: TeamUser[]
  existingIds: string[]
  onClose: () => void
  onAdded: (member: TeamMember) => void
}

function AddMemberSheet({ open, teamId, users, existingIds, onClose, onAdded }: AddMemberSheetProps) {
  const [userId, setUserId] = useState("")
  const [role, setRole] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const available = users.filter((u) => !existingIds.includes(u.id))

  useEffect(() => { if (open) { setUserId(""); setRole(""); setError(null) } }, [open])

  async function add() {
    if (!userId) return
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: role.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onAdded(data); onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <UserRound className="size-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Adicionar membro</p>
          <p className="text-xs text-muted-foreground">Escolha o atendente e seu papel</p>
        </div>
        <button onClick={onClose} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 transition-colors">
          <X className="size-4" />
        </button>
      </SheetHeader>
      <SheetContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Atendente</label>
            {available.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Todos os atendentes já fazem parte desta equipe.</p>
            ) : (
              <div className="space-y-1">
                {available.map((u) => (
                  <button key={u.id} onClick={() => setUserId(u.id)}
                    className={cn("flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                      userId === u.id ? "border-primary/40 bg-primary/5 ring-1 ring-primary/15" : "border-transparent hover:bg-muted/40"
                    )}
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold uppercase">
                      {u.name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Papel na equipe (opcional)</label>
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder='Ex: "SDR", "Closer", "Enterprise"' className="text-sm" />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="shrink-0 flex items-center justify-between gap-3 border-t bg-muted/20 px-4 py-3">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!userId || saving} onClick={add}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Adicionar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Create Team Sheet ────────────────────────────────────────────────────────

interface CreateTeamSheetProps {
  open: boolean
  companyId: string
  users: TeamUser[]
  onClose: () => void
  onCreate: (team: Team) => void
}

function CreateTeamSheet({ open, companyId, users, onClose, onCreate }: CreateTeamSheetProps) {
  const [name, setName] = useState("")
  const [managerId, setManagerId] = useState("")
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) { setName(""); setManagerId(""); setSelectedChannels([]); setError(null) }
  }, [open])

  function toggleChannel(ch: string) {
    setSelectedChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    )
  }

  async function save() {
    if (!name.trim()) return
    setSaving(true); setError(null)
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          name: name.trim(),
          managerId: managerId || null,
          channels: selectedChannels,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar equipe")
      // Normalize to Team shape (members array empty on creation)
      onCreate({ ...data, members: data.members ?? [], pipelineValue: null, conversionRate: null })
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Users className="size-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Nova equipe de vendas</p>
          <p className="text-xs text-muted-foreground">Configure nome, gestor e canais atendidos</p>
        </div>
        <button onClick={onClose} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 transition-colors">
          <X className="size-4" />
        </button>
      </SheetHeader>

      <SheetContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nome da equipe</label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='Ex: "Inside Sales", "Enterprise", "Suporte"'
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gestor responsável (opcional)</label>
            <select
              className="w-full rounded-lg border bg-white px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
            >
              <option value="">Sem gestor definido</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name} — {u.role}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Canais atendidos</label>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => toggleChannel(ch)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    selectedChannels.includes(ch)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-muted text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {CHANNEL_LABEL[ch]}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-muted/20 p-3">
            <p className="text-[11px] text-muted-foreground leading-4">
              Após criar a equipe você poderá adicionar membros, definir metas e criar regras de distribuição de leads.
            </p>
          </div>

          {error && <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs text-red-700">{error}</div>}
        </div>

        <div className="shrink-0 flex items-center justify-between gap-3 border-t bg-muted/20 px-4 py-3">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!name.trim() || saving} onClick={save}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Criar equipe
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Edit Team Sheet ──────────────────────────────────────────────────────────

interface EditTeamSheetProps {
  open: boolean
  team: Team
  users: TeamUser[]
  supportEnabled: boolean
  onClose: () => void
  onUpdate: (team: Partial<Team>, supportEnabled: boolean) => void
}

function EditTeamSheet({ open, team, users, supportEnabled, onClose, onUpdate }: EditTeamSheetProps) {
  const [name, setName] = useState(team.name)
  const [managerId, setManagerId] = useState(team.manager?.id ?? "")
  const [targetValue, setTargetValue] = useState(team.targetValue ?? "")
  const [selectedChannels, setSelectedChannels] = useState<string[]>(team.channels.map((c) => c.channel))
  const [attendsSupport, setAttendsSupport] = useState(supportEnabled)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(team.name)
    setManagerId(team.manager?.id ?? "")
    setTargetValue(team.targetValue ?? "")
    setSelectedChannels(team.channels.map((c) => c.channel))
    setAttendsSupport(supportEnabled)
    setError(null)
  }, [open, team, supportEnabled])

  function toggleChannel(ch: string) {
    setSelectedChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    )
  }

  async function save() {
    if (!name.trim()) return
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/teams/${team.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          managerId: managerId || null,
          targetValue: targetValue.trim().replace(",", ".") || null,
          channels: selectedChannels,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Erro ao editar equipe")
      onUpdate(data, attendsSupport)
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetHeader>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Pencil className="size-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Editar equipe</p>
          <p className="text-xs text-muted-foreground">Atualize dados, gestor, canais e suporte</p>
        </div>
        <button onClick={onClose} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 transition-colors">
          <X className="size-4" />
        </button>
      </SheetHeader>

      <SheetContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nome da equipe</label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='Ex: "Inside Sales", "Enterprise", "Suporte"'
              className="text-sm"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gestor responsável</label>
              <select
                className="w-full rounded-lg border bg-white px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
              >
                <option value="">Sem gestor definido</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} — {u.role}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Meta mensal</label>
              <Input
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value.replace(/[^\d.,]/g, ""))}
                placeholder="Ex: 50000"
                className="text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Canais atendidos</label>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => toggleChannel(ch)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    selectedChannels.includes(ch)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-muted text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {CHANNEL_LABEL[ch]}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-xl border bg-muted/20 p-3">
            <span>
              <span className="flex items-center gap-2 text-sm font-semibold">
                <LifeBuoy className="size-4 text-cyan-700" />
                Atende chamados
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Define se a equipe aparece como destino preferencial de tickets de suporte.
              </span>
            </span>
            <input
              type="checkbox"
              checked={attendsSupport}
              onChange={(e) => setAttendsSupport(e.target.checked)}
              className="size-4 accent-primary"
            />
          </label>

          {error && <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs text-red-700">{error}</div>}
        </div>

        <div className="shrink-0 flex items-center justify-between gap-3 border-t bg-muted/20 px-4 py-3">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!name.trim() || saving} onClick={save}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Salvar equipe
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EquipesPage() {
  const auth = useAuth()
  const companyId = auth?.companyId ?? ""

  const [teams, setTeams] = useState<Team[]>([])
  const [users, setUsers] = useState<TeamUser[]>([])
  const [selected, setSelected] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)

  const [memberSheet, setMemberSheet] = useState(false)
  const [teamSheet, setTeamSheet] = useState(false)
  const [editTeamSheet, setEditTeamSheet] = useState(false)
  const [supportEnabled, setSupportEnabled] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!companyId) return
    setLoading(true)
    const now = new Date()
    Promise.all([
      fetch(`/api/teams?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/teams/users?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/teams/goals-report?companyId=${companyId}&month=${now.getMonth() + 1}&year=${now.getFullYear()}`).then((r) => r.json()).catch(() => []),
    ])
      .then(([t, u, goals]: [Team[], TeamUser[], any[]]) => {
        const goalsMap = new Map(goals.map((g: any) => [g.id, g]))
        const enriched = t.map((team) => {
          const g = goalsMap.get(team.id)
          if (!g) return team
          return {
            ...team,
            pipelineValue: String(g.pipelineAtivo + g.receitaFechada),
            conversionRate: String(g.taxaConversao),
          }
        })
        setTeams(enriched); setUsers(u)
        setSupportEnabled((current) => {
          const next = { ...current }
          enriched.forEach((team) => {
            if (next[team.id] === undefined) {
              const supportLike = /suporte|implant|financeiro|cs/i.test(team.name) || team.channels.some((channel) => ["EMAIL", "WHATSAPP", "WEBHOOK"].includes(channel.channel))
              next[team.id] = supportLike
            }
          })
          return next
        })
        if (enriched.length > 0) setSelected(enriched[0])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [companyId])

  useEffect(() => {
    if (selected) {
      const updated = teams.find((t) => t.id === selected.id)
      if (updated) setSelected(updated)
    }
  }, [teams])

  async function removeMember(userId: string) {
    if (!selected) return
    await fetch(`/api/teams/${selected.id}/members/${userId}`, { method: "DELETE" })
    setTeams((prev) => prev.map((t) =>
      t.id === selected.id ? { ...t, members: t.members.filter((m) => m.user.id !== userId) } : t
    ))
  }

  function handleMemberAdded(member: TeamMember) {
    setTeams((prev) => prev.map((t) =>
      t.id === selected?.id ? { ...t, members: [...t.members, member] } : t
    ))
  }

  function handleTeamCreated(team: Team) {
    setTeams((prev) => [...prev, team])
    setSelected(team)
  }

  function handleTeamUpdated(updated: Partial<Team>, nextSupportEnabled: boolean) {
    setTeams((prev) => prev.map((team) => (
      team.id === selected?.id ? { ...team, ...updated, members: team.members, pipelineValue: team.pipelineValue, conversionRate: team.conversionRate } : team
    )))
    if (selected) {
      setSupportEnabled((current) => ({ ...current, [selected.id]: nextSupportEnabled }))
    }
  }

  async function deleteTeam(id: string) {
    if (!confirm("Excluir esta equipe? Todos os membros serão removidos.")) return
    await fetch(`/api/teams/${id}`, { method: "DELETE" })
    setTeams((prev) => prev.filter((t) => t.id !== id))
    setSelected((prev) => prev?.id === id ? null : prev)
  }

  return (
    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
      <div className="grid h-full min-w-[800px] grid-cols-[280px_minmax(500px,1fr)] gap-2.5 p-2.5 md:p-3">

        {/* ── Left: team list ── */}
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white shadow-soft">
          <div className="shrink-0 border-b p-3">
            <Button size="sm" className="w-full" onClick={() => setTeamSheet(true)}>
              <Plus className="size-3.5" /> Nova equipe
            </Button>
          </div>

          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : teams.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
              <Users className="size-7 opacity-30" />
              <p className="text-xs">Nenhuma equipe criada</p>
              <p className="text-[11px] opacity-60">Clique em "Nova equipe" para começar</p>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto p-2 space-y-1">
              {teams.map((team) => (
                <button key={team.id} onClick={() => setSelected(team)}
                  className={cn("w-full rounded-lg border px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5",
                    selected?.id === team.id ? "border-primary/40 bg-primary/5 ring-1 ring-primary/15" : "border-transparent"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{team.name}</p>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{team.members.length} membros</span>
                  </div>
                  {team.manager && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">Gestor: {team.manager.name}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {team.channels.slice(0, 3).map((c) => (
                      <span key={c.channel} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {CHANNEL_LABEL[c.channel] ?? c.channel}
                      </span>
                    ))}
                    {supportEnabled[team.id] && (
                      <span className="inline-flex items-center gap-1 rounded bg-cyan-50 px-1.5 py-0.5 text-[10px] font-medium text-cyan-700">
                        <LifeBuoy className="size-2.5" /> Suporte
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* ── Center: team detail ── */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white shadow-soft">
          {selected ? (
            <>
              <div className="flex shrink-0 items-center gap-3 border-b p-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
                  <Users className="size-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-semibold">{selected.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {selected.manager ? `Gestor: ${selected.manager.name}` : "Sem gestor"} · {selected.members.length} membro(s)
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {selected.channels.map((c) => (
                    <span key={c.channel} className="rounded-full border bg-muted/50 px-2 py-0.5 text-[10px] font-medium">
                      {CHANNEL_LABEL[c.channel] ?? c.channel}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => setSupportEnabled((current) => ({ ...current, [selected.id]: !current[selected.id] }))}
                  className={cn(
                    "flex h-8 items-center gap-2 rounded-md border px-3 text-xs font-medium transition-colors",
                    supportEnabled[selected.id]
                      ? "border-cyan-200 bg-cyan-50 text-cyan-700"
                      : "border-slate-200 bg-white text-muted-foreground hover:bg-muted",
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", supportEnabled[selected.id] ? "bg-cyan-600" : "bg-slate-400")} />
                  Atende chamados
                </button>
                <Button size="sm" variant="outline" onClick={() => setEditTeamSheet(true)}>
                  <Pencil className="size-3.5" /> Editar
                </Button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
                {/* Metrics */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { icon: Target,     label: "Meta mensal",  value: selected.targetValue    ? `R$ ${Number(selected.targetValue).toLocaleString("pt-BR")}`    : "—" },
                    { icon: TrendingUp, label: "Pipeline",     value: selected.pipelineValue  ? `R$ ${Number(selected.pipelineValue).toLocaleString("pt-BR")}`  : "—" },
                    { icon: Zap,        label: "Conversão",    value: selected.conversionRate ? `${Number(selected.conversionRate).toFixed(1)}%`                : "—" },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex flex-col items-center gap-1 rounded-xl border bg-muted/30 px-3 py-3">
                      <Icon className="size-3.5 text-primary" />
                      <p className="text-base font-bold">{value}</p>
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Members table */}
                <div className="overflow-hidden rounded-xl border">
                  <div className="flex items-center justify-between bg-muted/40 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Membros da equipe</p>
                    <Button size="sm" variant="outline" className="h-6 gap-1 text-[10px]" onClick={() => setMemberSheet(true)}>
                      <Plus className="size-3" /> Adicionar
                    </Button>
                  </div>
                  {selected.members.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">Nenhum membro ainda</div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-t text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          <th className="px-3 py-2">Nome</th>
                          <th className="px-3 py-2">Papel</th>
                          <th className="px-3 py-2 text-right">Leads</th>
                          <th className="px-3 py-2 text-right">Pipeline</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selected.members.map((m) => {
                          const load = m.leadCount > 40 ? "alta" : m.leadCount > 20 ? "média" : "baixa"
                          return (
                            <tr key={m.id} className="hover:bg-muted/20">
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold uppercase">
                                    {m.user.name[0]}
                                  </div>
                                  <span className="font-medium">{m.user.name}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">{m.role ?? "—"}</td>
                              <td className="px-3 py-2 text-right font-medium">{m.leadCount}</td>
                              <td className="px-3 py-2 text-right text-muted-foreground">
                                {m.revenueValue ? `R$ ${Number(m.revenueValue).toLocaleString("pt-BR")}` : "—"}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-medium",
                                    load === "alta" ? "bg-red-100 text-red-700" : load === "média" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                                  )}>
                                    {load}
                                  </span>
                                  <button onClick={() => removeMember(m.user.id)} className="text-muted-foreground hover:text-red-500 transition-colors">
                                    <X className="size-3" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Territories placeholder */}
                <div className="overflow-hidden rounded-xl border">
                  <div className="bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Territórios e segmentos</div>
                  <div className="divide-y">
                    {["São Paulo — Capital", "Interior SP", "Minas Gerais"].map((t) => (
                      <div key={t} className="flex items-center justify-between px-3 py-2.5 text-xs">
                        <span>{t}</span><span className="text-muted-foreground">Ativo</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="shrink-0 flex items-center justify-end gap-2 border-t bg-muted/20 p-3">
                <Button size="sm" variant="outline" onClick={() => setEditTeamSheet(true)}>
                  <Pencil className="size-3.5" /> Editar equipe
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                  onClick={() => deleteTeam(selected.id)}
                >
                  <Trash2 className="size-3.5" /> Excluir equipe
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center text-muted-foreground p-8">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/50">
                <Users className="size-7 opacity-30" />
              </div>
              <div>
                <p className="text-sm font-medium">Selecione uma equipe</p>
                <p className="mt-0.5 text-xs opacity-70">ou crie uma nova para começar</p>
              </div>
            </div>
          )}
        </section>

      </div>

      {selected && (
        <AddMemberSheet
          open={memberSheet}
          teamId={selected.id}
          users={users}
          existingIds={selected.members.map((m) => m.user.id)}
          onClose={() => setMemberSheet(false)}
          onAdded={handleMemberAdded}
        />
      )}

      <CreateTeamSheet
        open={teamSheet}
        companyId={companyId}
        users={users}
        onClose={() => setTeamSheet(false)}
        onCreate={handleTeamCreated}
      />

      {selected && (
        <EditTeamSheet
          open={editTeamSheet}
          team={selected}
          users={users}
          supportEnabled={!!supportEnabled[selected.id]}
          onClose={() => setEditTeamSheet(false)}
          onUpdate={handleTeamUpdated}
        />
      )}
    </div>
  )
}
