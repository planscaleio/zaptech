import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/hooks/useAuth"
import {
  Plus, X, Trash2, GripVertical,
  ToggleLeft, ToggleRight, ChevronDown,
  ChevronUp, Users, Loader2, Filter, Save,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeamUser {
  id: string
  name: string
  email: string
  role: string
}

interface Team {
  id: string
  name: string
}

type RuleActionType = "TEAM" | "SPECIFIC_USER" | "EXISTING_OWNER" | "QUEUE"
type RuleStrategy   = "ROUND_ROBIN" | "LOWEST_LOAD" | "MANUAL"
type RuleFallback   = "QUEUE" | "NEXT_RULE"

interface RuleCondition {
  field: string
  operator: string
  value: string | number | boolean
}

interface DistributionRule {
  id: string
  name: string
  priority: number
  active: boolean
  conditions: RuleCondition[]
  actionType: RuleActionType
  strategy: RuleStrategy
  fallback: RuleFallback
  targetTeamId: string | null
  targetUserId: string | null
  targetTeam: { id: string; name: string } | null
  targetUser: { id: string; name: string } | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CHANNELS = ["WHATSAPP", "INSTAGRAM", "SITE", "EMAIL", "TELEFONE", "WEBHOOK"] as const
const CHANNEL_LABEL: Record<string, string> = {
  WHATSAPP: "WhatsApp", INSTAGRAM: "Instagram", SITE: "Site",
  EMAIL: "E-mail", TELEFONE: "Telefone", WEBHOOK: "Webhook",
}

const ACTION_LABELS: Record<RuleActionType, string> = {
  TEAM: "Atribuir a equipe",
  SPECIFIC_USER: "Atendente específico",
  EXISTING_OWNER: "Dono da conta",
  QUEUE: "Fila geral",
}

const STRATEGY_LABELS: Record<RuleStrategy, string> = {
  ROUND_ROBIN: "Rodízio (round-robin)",
  LOWEST_LOAD: "Menor carteira de leads",
  MANUAL: "Gestor decide",
}

const FALLBACK_LABELS: Record<RuleFallback, string> = {
  QUEUE: "Fila geral",
  NEXT_RULE: "Tentar próxima regra",
}

const CONDITION_FIELDS = [
  { id: "channel",           label: "Canal de entrada",    type: "enum",    values: CHANNELS, valueLabels: CHANNEL_LABEL },
  { id: "lead_value",        label: "Valor do lead (R$)",  type: "number" },
  { id: "lead_source",       label: "Origem do lead",      type: "enum",    values: ["WHATSAPP","INSTAGRAM","SITE","CAMPANHA_CRM","WEBHOOK","EMAIL","INDICACAO","ORGANICO","OUTRO"] as const, valueLabels: { WHATSAPP:"WhatsApp",INSTAGRAM:"Instagram",SITE:"Site",CAMPANHA_CRM:"Campanha CRM",WEBHOOK:"Webhook",EMAIL:"E-mail",INDICACAO:"Indicação",ORGANICO:"Orgânico",OUTRO:"Outro" } },
  { id: "customer_status",   label: "Status do cliente",   type: "enum",    values: ["QUENTE","NUTRICAO","EM_ANALISE","CLIENTE","INATIVO","PERDIDO"] as const, valueLabels: { QUENTE:"Quente",NUTRICAO:"Nutrição",EM_ANALISE:"Em análise",CLIENTE:"Cliente",INATIVO:"Inativo",PERDIDO:"Perdido" } },
  { id: "customer_stage",    label: "Etapa do funil",      type: "enum",    values: ["PROSPECCAO","QUALIFICACAO","DEMONSTRACAO","PROPOSTA","NEGOCIACAO","FECHADO","POS_VENDA"] as const, valueLabels: { PROSPECCAO:"Prospecção",QUALIFICACAO:"Qualificação",DEMONSTRACAO:"Demonstração",PROPOSTA:"Proposta",NEGOCIACAO:"Negociação",FECHADO:"Fechado",POS_VENDA:"Pós-venda" } },
  { id: "tag",               label: "Tag da conversa",     type: "string" },
  { id: "customer_existing", label: "Cliente já atendido", type: "boolean" },
  { id: "message_contains",  label: "Mensagem contém",     type: "string" },
] as const

const OPERATORS_BY_TYPE: Record<string, { id: string; label: string }[]> = {
  enum:    [{ id: "eq", label: "=" }, { id: "neq", label: "≠" }],
  number:  [{ id: "gt", label: ">" }, { id: "lt", label: "<" }, { id: "eq", label: "=" }],
  string:  [{ id: "contains", label: "contém" }, { id: "not_contains", label: "não contém" }],
  boolean: [{ id: "is_true", label: "sim" }, { id: "is_false", label: "não" }],
}

// ─── Draft state for an unsaved/editing rule ──────────────────────────────────

interface RuleDraft {
  id: string | null // null = new rule
  name: string
  conditions: RuleCondition[]
  actionType: RuleActionType
  targetTeamId: string
  targetUserId: string
  strategy: RuleStrategy
  fallback: RuleFallback
}

function emptyDraft(): RuleDraft {
  return {
    id: null,
    name: "",
    conditions: [],
    actionType: "TEAM",
    targetTeamId: "",
    targetUserId: "",
    strategy: "ROUND_ROBIN",
    fallback: "QUEUE",
  }
}

function draftFromRule(rule: DistributionRule): RuleDraft {
  return {
    id: rule.id,
    name: rule.name,
    conditions: rule.conditions,
    actionType: rule.actionType,
    targetTeamId: rule.targetTeamId ?? "",
    targetUserId: rule.targetUserId ?? "",
    strategy: (rule.strategy as RuleStrategy) ?? "ROUND_ROBIN",
    fallback: rule.fallback,
  }
}

// ─── Condition row ────────────────────────────────────────────────────────────

function ConditionRow({
  cond,
  onChange,
  onRemove,
}: {
  cond: RuleCondition
  onChange: (patch: Partial<RuleCondition>) => void
  onRemove: () => void
}) {
  const fieldDef = CONDITION_FIELDS.find((f) => f.id === cond.field)
  const ops = OPERATORS_BY_TYPE[fieldDef?.type ?? "string"]

  function handleFieldChange(field: string) {
    const def = CONDITION_FIELDS.find((f) => f.id === field)
    const newOps = OPERATORS_BY_TYPE[def?.type ?? "string"]
    const defaultValue =
      def?.type === "boolean" ? true
      : def?.type === "number" ? 0
      : (def as { values?: readonly string[] } | undefined)?.values?.[0] ?? ""
    onChange({ field, operator: newOps[0].id, value: defaultValue })
  }

  return (
    <div className="flex items-center gap-2">
      <select
        className="w-44 rounded-lg border bg-white px-2.5 py-1.5 text-xs font-medium outline-none focus:ring-2 focus:ring-ring"
        value={cond.field}
        onChange={(e) => handleFieldChange(e.target.value)}
      >
        {CONDITION_FIELDS.map((f) => (
          <option key={f.id} value={f.id}>{f.label}</option>
        ))}
      </select>

      <select
        className="w-28 rounded-lg border bg-white px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
        value={cond.operator}
        onChange={(e) => onChange({ operator: e.target.value })}
      >
        {ops.map((op) => <option key={op.id} value={op.id}>{op.label}</option>)}
      </select>

      {(!fieldDef || fieldDef.type === "string") && (
        <input
          type="text"
          className="w-36 rounded-lg border bg-white px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
          placeholder="valor…"
          value={String(cond.value)}
          onChange={(e) => onChange({ value: e.target.value })}
        />
      )}
      {fieldDef?.type === "number" && (
        <input
          type="number"
          className="w-36 rounded-lg border bg-white px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
          value={Number(cond.value)}
          onChange={(e) => onChange({ value: Number(e.target.value) })}
        />
      )}
      {fieldDef?.type === "enum" && (
        <select
          className="w-36 rounded-lg border bg-white px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
          value={String(cond.value)}
          onChange={(e) => onChange({ value: e.target.value })}
        >
          {(fieldDef as { values: readonly string[]; valueLabels?: Record<string, string> }).values.map((v) => (
            <option key={v} value={v}>
              {(fieldDef as { valueLabels?: Record<string, string> }).valueLabels?.[v] ?? v}
            </option>
          ))}
        </select>
      )}
      {fieldDef?.type === "boolean" && (
        <select
          className="w-20 rounded-lg border bg-white px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
          value={String(cond.value)}
          onChange={(e) => onChange({ value: e.target.value === "true" })}
        >
          <option value="true">Sim</option>
          <option value="false">Não</option>
        </select>
      )}

      <button onClick={onRemove} className="ml-auto text-muted-foreground hover:text-red-500 transition-colors">
        <X className="size-3.5" />
      </button>
    </div>
  )
}

// ─── Rule editor (inline form) ────────────────────────────────────────────────

function RuleEditor({
  draft,
  teams,
  users,
  saving,
  error,
  onChange,
  onSave,
  onCancel,
}: {
  draft: RuleDraft
  teams: Team[]
  users: TeamUser[]
  saving: boolean
  error: string | null
  onChange: (patch: Partial<RuleDraft>) => void
  onSave: () => void
  onCancel: () => void
}) {
  function addCondition() {
    onChange({ conditions: [...draft.conditions, { field: "channel", operator: "eq", value: "WHATSAPP" }] })
  }

  function updateCondition(i: number, patch: Partial<RuleCondition>) {
    const next = draft.conditions.map((c, idx) => idx === i ? { ...c, ...patch } : c)
    onChange({ conditions: next })
  }

  function removeCondition(i: number) {
    onChange({ conditions: draft.conditions.filter((_, idx) => idx !== i) })
  }

  return (
    <div className="space-y-5 p-4">

      {/* Nome */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Nome da regra</label>
        <Input
          autoFocus
          value={draft.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder='Ex: "Enterprise acima de R$ 50.000"'
          className="text-sm"
        />
      </div>

      {/* Condições */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Condições <span className="normal-case font-normal">(todas precisam ser verdadeiras)</span>
          </label>
          <button
            onClick={addCondition}
            className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
          >
            <Plus className="size-3" /> Adicionar
          </button>
        </div>

        {draft.conditions.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
            <Filter className="size-3.5 opacity-40" />
            Sem condições — esta regra se aplica a todas as conversas
          </div>
        ) : (
          <div className="space-y-2">
            {draft.conditions.map((cond, i) => (
              <ConditionRow
                key={i}
                cond={cond}
                onChange={(patch) => updateCondition(i, patch)}
                onRemove={() => removeCondition(i)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Ação + configuração */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ação</label>
          <select
            className="w-full rounded-lg border bg-white px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            value={draft.actionType}
            onChange={(e) => onChange({ actionType: e.target.value as RuleActionType })}
          >
            {(Object.entries(ACTION_LABELS) as [RuleActionType, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Fallback</label>
          <select
            className="w-full rounded-lg border bg-white px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            value={draft.fallback}
            onChange={(e) => onChange({ fallback: e.target.value as RuleFallback })}
          >
            {(Object.entries(FALLBACK_LABELS) as [RuleFallback, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Equipe / usuário / estratégia */}
      {draft.actionType === "TEAM" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Equipe destino</label>
            <select
              className="w-full rounded-lg border bg-white px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={draft.targetTeamId}
              onChange={(e) => onChange({ targetTeamId: e.target.value })}
            >
              <option value="">Selecionar equipe…</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Estratégia</label>
            <select
              className="w-full rounded-lg border bg-white px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={draft.strategy}
              onChange={(e) => onChange({ strategy: e.target.value as RuleStrategy })}
            >
              {(Object.entries(STRATEGY_LABELS) as [RuleStrategy, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {draft.actionType === "SPECIFIC_USER" && (
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Atendente</label>
          <select
            className="w-full rounded-lg border bg-white px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            value={draft.targetUserId}
            onChange={(e) => onChange({ targetUserId: e.target.value })}
          >
            <option value="">Selecionar atendente…</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}

      <div className="flex items-center justify-end gap-2 border-t pt-3">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" disabled={!draft.name.trim() || saving} onClick={onSave}>
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          {draft.id ? "Salvar" : "Criar regra"}
        </Button>
      </div>
    </div>
  )
}

// ─── Rule card (collapsed view) ───────────────────────────────────────────────

function getRulePreview(rule: DistributionRule): string {
  if (rule.conditions.length === 0) return "Aplica-se a todas as conversas"
  return rule.conditions.map((c) => {
    const field = CONDITION_FIELDS.find((f) => f.id === c.field)
    const fl = field?.label ?? c.field
    const vl = (field as { valueLabels?: Record<string, string> } | undefined)?.valueLabels?.[String(c.value)] ?? String(c.value)
    const op = c.operator === "eq" ? "=" : c.operator === "neq" ? "≠" : c.operator === "gt" ? ">" : c.operator === "lt" ? "<" : c.operator
    return `${fl} ${op} ${vl}`
  }).join(" · ")
}

function getRuleAction(rule: DistributionRule): string {
  if (rule.actionType === "TEAM" && rule.targetTeam) return `→ ${rule.targetTeam.name}`
  if (rule.actionType === "SPECIFIC_USER" && rule.targetUser) return `→ ${rule.targetUser.name}`
  return ACTION_LABELS[rule.actionType]
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DistribuicaoPage() {
  const auth = useAuth()
  const companyId = auth?.companyId ?? ""

  const [rules, setRules] = useState<DistributionRule[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [users, setUsers] = useState<TeamUser[]>([])
  const [loading, setLoading] = useState(true)

  // which rule id is expanded (null = none, "new" = new rule form at top)
  const [expanded, setExpanded] = useState<string | "new" | null>(null)
  const [draft, setDraft] = useState<RuleDraft>(emptyDraft())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const dragId = useRef<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  useEffect(() => {
    if (!companyId) return
    setLoading(true)
    Promise.all([
      fetch(`/api/teams/rules?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/teams?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/teams/users?companyId=${companyId}`).then((r) => r.json()),
    ])
      .then(([r, t, u]: [DistributionRule[], Team[], TeamUser[]]) => {
        setRules(r); setTeams(t); setUsers(u)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [companyId])

  function openNew() {
    setDraft(emptyDraft())
    setSaveError(null)
    setExpanded("new")
  }

  function openEdit(rule: DistributionRule) {
    setDraft(draftFromRule(rule))
    setSaveError(null)
    setExpanded(rule.id)
  }

  function closeEditor() {
    setExpanded(null)
    setSaveError(null)
  }

  async function saveRule() {
    if (!draft.name.trim()) return
    setSaving(true); setSaveError(null)
    try {
      const body = {
        companyId,
        name: draft.name.trim(),
        conditions: draft.conditions,
        actionType: draft.actionType,
        targetTeamId: draft.actionType === "TEAM" ? draft.targetTeamId || null : null,
        targetUserId: draft.actionType === "SPECIFIC_USER" ? draft.targetUserId || null : null,
        strategy: draft.strategy,
        fallback: draft.fallback,
      }
      const url = draft.id ? `/api/teams/rules/${draft.id}` : "/api/teams/rules"
      const method = draft.id ? "PUT" : "POST"
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar")
      setRules((prev) => {
        const idx = prev.findIndex((r) => r.id === data.id)
        if (idx >= 0) { const next = [...prev]; next[idx] = data; return next }
        return [...prev, data]
      })
      closeEditor()
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Erro")
    } finally {
      setSaving(false)
    }
  }

  async function toggleRule(id: string) {
    const res = await fetch(`/api/teams/rules/${id}/toggle`, { method: "PATCH" })
    const data = await res.json()
    setRules((prev) => prev.map((r) => r.id === id ? { ...r, active: data.active } : r))
  }

  async function deleteRule(id: string) {
    if (!confirm("Excluir esta regra de distribuição?")) return
    await fetch(`/api/teams/rules/${id}`, { method: "DELETE" })
    setRules((prev) => prev.filter((r) => r.id !== id))
    if (expanded === id) closeEditor()
  }

  async function persistReorder(reordered: DistributionRule[]) {
    setRules(reordered)
    await fetch("/api/teams/rules/reorder", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: reordered.map((r) => r.id) }),
    })
  }

  function handleDragStart(id: string) {
    dragId.current = id
  }

  function handleDragOver(e: React.DragEvent, overId: string) {
    e.preventDefault()
    if (dragId.current !== overId) setDragOverId(overId)
  }

  function handleDragEnd() {
    setDragOverId(null)
    dragId.current = null
  }

  async function handleDrop(toId: string) {
    setDragOverId(null)
    if (!dragId.current || dragId.current === toId) { dragId.current = null; return }
    const fromIdx = rules.findIndex((r) => r.id === dragId.current)
    const toIdx   = rules.findIndex((r) => r.id === toId)
    dragId.current = null
    if (fromIdx < 0 || toIdx < 0) return
    const reordered = [...rules]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    await persistReorder(reordered)
  }

  async function moveRule(id: string, dir: -1 | 1) {
    const idx = rules.findIndex((r) => r.id === id)
    const next = idx + dir
    if (next < 0 || next >= rules.length) return
    const reordered = [...rules]
    const [moved] = reordered.splice(idx, 1)
    reordered.splice(next, 0, moved)
    await persistReorder(reordered)
  }

  return (
    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
      <div className="grid h-full min-w-[900px] grid-cols-[260px_minmax(500px,1fr)] gap-2.5 p-2.5 md:p-3">

        {/* ── Left: info panel ── */}
        <aside className="flex min-h-0 flex-col gap-2.5 overflow-y-auto">

          <div className="overflow-hidden rounded-lg border bg-white shadow-soft">
            <div className="border-b bg-muted/20 px-3 py-2.5">
              <p className="text-xs font-semibold">Como funciona</p>
            </div>
            <div className="p-3 space-y-3">
              {[
                { n: "1", title: "Condições verificadas", desc: "Canal, origem, valor, status do cliente e muito mais." },
                { n: "2", title: "Primeira regra que bater", desc: "Regras avaliadas em ordem de prioridade." },
                { n: "3", title: "Atribuição automática", desc: "Lead vai para equipe ou atendente definido." },
                { n: "4", title: "Fallback configurável", desc: "Se ninguém disponível: fila ou próxima regra." },
              ].map(({ n, title, desc }) => (
                <div key={n} className="flex gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{n}</span>
                  <div>
                    <p className="text-xs font-semibold">{title}</p>
                    <p className="text-[11px] text-muted-foreground leading-4">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border bg-white shadow-soft">
            <div className="border-b bg-muted/20 px-3 py-2.5">
              <p className="text-xs font-semibold">Gatilhos</p>
            </div>
            <div className="divide-y">
              {[
                { label: "Nova conversa", desc: "Ao criar a conversa via webhook" },
                { label: "Atribuição manual", desc: "Gestor aciona pela central" },
                { label: "Inatividade", desc: "Worker a cada 10 min, +2h sem resposta" },
              ].map(({ label, desc }) => (
                <div key={label} className="px-3 py-2.5">
                  <p className="text-xs font-semibold">{label}</p>
                  <p className="text-[11px] text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border bg-white shadow-soft">
            <div className="border-b bg-muted/20 px-3 py-2.5">
              <p className="text-xs font-semibold">Resumo</p>
            </div>
            <div className="divide-y">
              {[
                { label: "Total de regras",    value: String(rules.length) },
                { label: "Ativas",             value: String(rules.filter((r) => r.active).length), highlight: true },
                { label: "Equipes cadastradas", value: String(teams.length) },
              ].map(({ label, value, highlight }) => (
                <div key={label} className="flex items-center justify-between px-3 py-2 text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={cn("font-semibold", highlight && "text-emerald-600")}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ── Right: rules list ── */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white shadow-soft">
          <div className="flex shrink-0 items-center justify-between border-b bg-muted/20 px-3 py-2.5">
            <div>
              <p className="text-xs font-semibold">Regras de distribuição</p>
              <p className="text-[10px] text-muted-foreground">Clique em uma regra para editar · Arraste para reordenar</p>
            </div>
            <Button size="sm" className="h-7 gap-1 text-xs" onClick={openNew} disabled={expanded === "new"}>
              <Plus className="size-3" /> Nova regra
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2.5 space-y-2">

            {/* New rule form */}
            {expanded === "new" && (
              <div className="overflow-hidden rounded-xl border border-primary/30 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b bg-primary/5 px-3 py-2">
                  <div className="size-2 rounded-full bg-primary" />
                  <p className="text-xs font-semibold text-primary">Nova regra</p>
                </div>
                <RuleEditor
                  draft={draft}
                  teams={teams}
                  users={users}
                  saving={saving}
                  error={saveError}
                  onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
                  onSave={saveRule}
                  onCancel={closeEditor}
                />
              </div>
            )}

            {/* Rules list */}
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : rules.length === 0 && expanded !== "new" ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center text-muted-foreground">
                <Filter className="size-7 opacity-20" />
                <div>
                  <p className="text-sm font-medium">Nenhuma regra criada</p>
                  <p className="text-xs opacity-70 mt-0.5">Leads vão para a fila geral</p>
                </div>
              </div>
            ) : (
              rules.map((rule, i) => {
                const isEditing = expanded === rule.id
                const isDragOver = dragOverId === rule.id
                return (
                  <div
                    key={rule.id}
                    draggable={!isEditing}
                    onDragStart={() => { if (!isEditing) handleDragStart(rule.id) }}
                    onDragOver={(e) => { if (!isEditing) handleDragOver(e, rule.id) }}
                    onDragEnd={handleDragEnd}
                    onDrop={() => handleDrop(rule.id)}
                    className={cn(
                      "overflow-hidden rounded-xl border bg-white transition-all",
                      isEditing && "border-primary/30 shadow-md",
                      !isEditing && isDragOver && "border-primary border-dashed bg-primary/5 scale-[1.01]",
                      !isEditing && !isDragOver && "hover:shadow-sm",
                    )}
                  >
                    {/* Card header */}
                    <div
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2.5",
                        !isEditing && "cursor-pointer hover:bg-muted/20 transition-colors"
                      )}
                      onClick={() => !isEditing ? openEdit(rule) : undefined}
                    >
                      {/* Drag handle + move buttons */}
                      {!isEditing && (
                        <div className="flex shrink-0 flex-col items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            disabled={i === 0}
                            onClick={() => moveRule(rule.id, -1)}
                            className="text-muted-foreground/40 hover:text-muted-foreground disabled:opacity-20 transition-colors"
                            title="Mover para cima"
                          >
                            <ChevronUp className="size-3" />
                          </button>
                          <GripVertical className="size-3.5 text-muted-foreground/30 hover:text-muted-foreground cursor-grab transition-colors" />
                          <button
                            disabled={i === rules.length - 1}
                            onClick={() => moveRule(rule.id, 1)}
                            className="text-muted-foreground/40 hover:text-muted-foreground disabled:opacity-20 transition-colors"
                            title="Mover para baixo"
                          >
                            <ChevronDown className="size-3" />
                          </button>
                        </div>
                      )}

                      <span className="flex size-5 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-bold text-muted-foreground">
                        {i + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-xs font-semibold">{rule.name}</p>
                          <span className={cn(
                            "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium",
                            rule.active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
                          )}>
                            {rule.active ? "ativa" : "inativa"}
                          </span>
                        </div>
                        {!isEditing && (
                          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                            {getRulePreview(rule)}{" "}
                            <span className="font-medium text-primary/70">{getRuleAction(rule)}</span>
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => toggleRule(rule.id)} title={rule.active ? "Desativar" : "Ativar"}>
                          {rule.active
                            ? <ToggleRight className="size-4 text-primary" />
                            : <ToggleLeft className="size-4 text-muted-foreground" />}
                        </button>
                        <button onClick={() => deleteRule(rule.id)} className="text-muted-foreground hover:text-red-500 transition-colors">
                          <Trash2 className="size-3.5" />
                        </button>
                        {!isEditing && (
                          <ChevronDown className="size-3.5 text-muted-foreground/40 rotate-0" />
                        )}
                      </div>
                    </div>

                    {/* Inline editor */}
                    {isEditing && (
                      <>
                        <div className="border-t" />
                        <RuleEditor
                          draft={draft}
                          teams={teams}
                          users={users}
                          saving={saving}
                          error={saveError}
                          onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
                          onSave={saveRule}
                          onCancel={closeEditor}
                        />
                      </>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
