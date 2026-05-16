import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/hooks/useAuth"
import {
  Plus, X, Trash2, GripVertical,
  ToggleLeft, ToggleRight, ChevronDown,
  ChevronUp, Loader2, Filter, Save,
  Users, Zap, Activity, HelpCircle,
  ArrowRight, CheckCircle2, AlertCircle, Layers,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
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

interface Connector {
  id: string
  name: string
  type: string
  status: string
}

type RuleActionType = "TEAM" | "SPECIFIC_USER" | "EXISTING_OWNER" | "QUEUE"
type RuleStrategy   = "ROUND_ROBIN" | "LOWEST_LOAD" | "MANUAL"
type RuleFallback   = "QUEUE" | "NEXT_RULE"

interface RuleCondition {
  field: string
  operator: string
  value: string | number | boolean
}

interface RuleConditionGroup {
  operator: "AND" | "OR"
  conditions: RuleCondition[]
}

interface DistributionRule {
  id: string
  name: string
  priority: number
  active: boolean
  conditions: unknown // raw from API — may be flat or grouped
  conditionGroups: RuleConditionGroup[]
  actionType: RuleActionType
  strategy: RuleStrategy
  fallback: RuleFallback
  targetTeamId: string | null
  targetUserId: string | null
  targetTeam: { id: string; name: string } | null
  targetUser: { id: string; name: string } | null
  triggerCount: number
  lastTriggeredAt: string | null
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
  { id: "channel",           label: "Canal de entrada",       type: "enum",      values: CHANNELS, valueLabels: CHANNEL_LABEL },
  { id: "instance",          label: "Instância (número WA)",  type: "connector" },
  { id: "lead_value",        label: "Valor do lead (R$)",     type: "number" },
  { id: "lead_source",       label: "Origem do lead",         type: "enum",      values: ["WHATSAPP","INSTAGRAM","SITE","CAMPANHA_CRM","WEBHOOK","EMAIL","INDICACAO","ORGANICO","OUTRO"] as const, valueLabels: { WHATSAPP:"WhatsApp",INSTAGRAM:"Instagram",SITE:"Site",CAMPANHA_CRM:"Campanha CRM",WEBHOOK:"Webhook",EMAIL:"E-mail",INDICACAO:"Indicação",ORGANICO:"Orgânico",OUTRO:"Outro" } },
  { id: "customer_status",   label: "Status do cliente",      type: "enum",      values: ["QUENTE","NUTRICAO","EM_ANALISE","CLIENTE","INATIVO","PERDIDO"] as const, valueLabels: { QUENTE:"Quente",NUTRICAO:"Nutrição",EM_ANALISE:"Em análise",CLIENTE:"Cliente",INATIVO:"Inativo",PERDIDO:"Perdido" } },
  { id: "customer_stage",    label: "Etapa do funil",         type: "enum",      values: ["PROSPECCAO","QUALIFICACAO","DEMONSTRACAO","PROPOSTA","NEGOCIACAO","FECHADO","POS_VENDA"] as const, valueLabels: { PROSPECCAO:"Prospecção",QUALIFICACAO:"Qualificação",DEMONSTRACAO:"Demonstração",PROPOSTA:"Proposta",NEGOCIACAO:"Negociação",FECHADO:"Fechado",POS_VENDA:"Pós-venda" } },
  { id: "team",              label: "Time do atendente atual","type": "team" },
  { id: "tag",               label: "Tag da conversa",        type: "string" },
  { id: "customer_existing", label: "Cliente já atendido",    type: "boolean" },
  { id: "message_contains",  label: "Mensagem contém",        type: "string" },
] as const

const OPERATORS_BY_TYPE: Record<string, { id: string; label: string }[]> = {
  enum:      [{ id: "eq", label: "=" }, { id: "neq", label: "≠" }],
  number:    [{ id: "gt", label: ">" }, { id: "lt", label: "<" }, { id: "eq", label: "=" }],
  string:    [{ id: "contains", label: "contém" }, { id: "not_contains", label: "não contém" }],
  boolean:   [{ id: "is_true", label: "sim" }, { id: "is_false", label: "não" }],
  connector: [{ id: "eq", label: "=" }, { id: "neq", label: "≠" }],
  team:      [{ id: "eq", label: "pertence a" }, { id: "neq", label: "não pertence a" }],
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeConditionGroups(raw: unknown): RuleConditionGroup[] {
  if (!Array.isArray(raw) || raw.length === 0) return [{ operator: "AND", conditions: [] }]
  // New format: array of objects with operator + conditions
  if (raw[0] && typeof raw[0] === "object" && "operator" in (raw[0] as object) && "conditions" in (raw[0] as object)) {
    return raw as RuleConditionGroup[]
  }
  // Legacy flat array → single AND group
  return [{ operator: "AND", conditions: raw as RuleCondition[] }]
}

function ruleFromApi(raw: Omit<DistributionRule, "conditionGroups"> & { conditions: unknown }): DistributionRule {
  return { ...raw, conditionGroups: normalizeConditionGroups(raw.conditions) }
}

function formatRelativeDate(iso: string | null): string {
  if (!iso) return "nunca"
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2) return "agora mesmo"
  if (mins < 60) return `${mins}min atrás`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h atrás`
  const days = Math.floor(hrs / 24)
  return `${days}d atrás`
}

// ─── Draft state ──────────────────────────────────────────────────────────────

interface RuleDraft {
  id: string | null
  name: string
  conditionGroups: RuleConditionGroup[]
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
    conditionGroups: [{ operator: "AND", conditions: [] }],
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
    conditionGroups: rule.conditionGroups.length > 0
      ? rule.conditionGroups
      : [{ operator: "AND", conditions: [] }],
    actionType: rule.actionType,
    targetTeamId: rule.targetTeamId ?? "",
    targetUserId: rule.targetUserId ?? "",
    strategy: rule.strategy ?? "ROUND_ROBIN",
    fallback: rule.fallback,
  }
}

// ─── Condition row ────────────────────────────────────────────────────────────

function ConditionRow({
  cond,
  connectors,
  teams,
  onChange,
  onRemove,
}: {
  cond: RuleCondition
  connectors: Connector[]
  teams: Team[]
  onChange: (patch: Partial<RuleCondition>) => void
  onRemove: () => void
}) {
  const fieldDef = CONDITION_FIELDS.find((f) => f.id === cond.field)
  const fieldType = fieldDef?.type ?? "string"
  const ops = OPERATORS_BY_TYPE[fieldType] ?? OPERATORS_BY_TYPE.string

  function handleFieldChange(field: string) {
    const def = CONDITION_FIELDS.find((f) => f.id === field)
    const newType = def?.type ?? "string"
    const newOps = OPERATORS_BY_TYPE[newType] ?? OPERATORS_BY_TYPE.string
    const defaultValue =
      newType === "boolean" ? true
      : newType === "number" ? 0
      : newType === "connector" ? (connectors[0]?.name ?? "")
      : newType === "team" ? (teams[0]?.id ?? "")
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
        className="w-32 rounded-lg border bg-white px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
        value={cond.operator}
        onChange={(e) => onChange({ operator: e.target.value })}
      >
        {ops.map((op) => <option key={op.id} value={op.id}>{op.label}</option>)}
      </select>

      {/* Value input by type */}
      {(fieldType === "string") && (
        <input
          type="text"
          className="w-36 rounded-lg border bg-white px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
          placeholder="valor…"
          value={String(cond.value)}
          onChange={(e) => onChange({ value: e.target.value })}
        />
      )}
      {fieldType === "number" && (
        <input
          type="number"
          className="w-36 rounded-lg border bg-white px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
          value={Number(cond.value)}
          onChange={(e) => onChange({ value: Number(e.target.value) })}
        />
      )}
      {fieldType === "enum" && (
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
      {fieldType === "boolean" && (
        <select
          className="w-20 rounded-lg border bg-white px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
          value={String(cond.value)}
          onChange={(e) => onChange({ value: e.target.value === "true" })}
        >
          <option value="true">Sim</option>
          <option value="false">Não</option>
        </select>
      )}
      {fieldType === "connector" && (
        <select
          className="w-40 rounded-lg border bg-white px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
          value={String(cond.value)}
          onChange={(e) => onChange({ value: e.target.value })}
        >
          {connectors.length === 0
            ? <option value="">Nenhuma instância</option>
            : connectors.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)
          }
        </select>
      )}
      {fieldType === "team" && (
        <select
          className="w-40 rounded-lg border bg-white px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
          value={String(cond.value)}
          onChange={(e) => onChange({ value: e.target.value })}
        >
          {teams.length === 0
            ? <option value="">Nenhum time</option>
            : teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)
          }
        </select>
      )}

      <button onClick={onRemove} className="ml-auto text-muted-foreground hover:text-red-500 transition-colors">
        <X className="size-3.5" />
      </button>
    </div>
  )
}

// ─── Condition groups editor ──────────────────────────────────────────────────

function ConditionGroupsEditor({
  groups,
  connectors,
  teams,
  onChange,
}: {
  groups: RuleConditionGroup[]
  connectors: Connector[]
  teams: Team[]
  onChange: (groups: RuleConditionGroup[]) => void
}) {
  function addGroup() {
    onChange([...groups, { operator: "AND", conditions: [] }])
  }

  function removeGroup(gi: number) {
    onChange(groups.filter((_, i) => i !== gi))
  }

  function setGroupOperator(gi: number, op: "AND" | "OR") {
    const next = groups.map((g, i) => i === gi ? { ...g, operator: op } : g)
    onChange(next)
  }

  function addCondition(gi: number) {
    const next = groups.map((g, i) =>
      i === gi
        ? { ...g, conditions: [...g.conditions, { field: "channel", operator: "eq", value: "WHATSAPP" }] }
        : g
    )
    onChange(next)
  }

  function updateCondition(gi: number, ci: number, patch: Partial<RuleCondition>) {
    const next = groups.map((g, i) =>
      i === gi
        ? { ...g, conditions: g.conditions.map((c, j) => j === ci ? { ...c, ...patch } : c) }
        : g
    )
    onChange(next)
  }

  function removeCondition(gi: number, ci: number) {
    const next = groups.map((g, i) =>
      i === gi
        ? { ...g, conditions: g.conditions.filter((_, j) => j !== ci) }
        : g
    )
    onChange(next)
  }

  return (
    <div className="space-y-2">
      {groups.map((group, gi) => (
        <div key={gi}>
          {/* AND separator between groups */}
          {gi > 0 && (
            <div className="flex items-center gap-2 py-1.5">
              <div className="h-px flex-1 bg-border" />
              <span className="rounded border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">E também</span>
              <div className="h-px flex-1 bg-border" />
            </div>
          )}

          {/* Group card */}
          <div className="rounded-lg border bg-muted/10 p-2.5 space-y-2">
            {/* Group header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Grupo {gi + 1}</span>
                <span className="text-[10px] text-muted-foreground">—</span>
                <div className="flex rounded-md border bg-white overflow-hidden text-[10px]">
                  <button
                    className={cn("px-2 py-0.5 font-semibold transition-colors", group.operator === "AND" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted/50")}
                    onClick={() => setGroupOperator(gi, "AND")}
                  >
                    E (AND)
                  </button>
                  <button
                    className={cn("px-2 py-0.5 font-semibold transition-colors", group.operator === "OR" ? "bg-amber-500 text-white" : "text-muted-foreground hover:bg-muted/50")}
                    onClick={() => setGroupOperator(gi, "OR")}
                  >
                    OU (OR)
                  </button>
                </div>
                <span className="text-[10px] text-muted-foreground">entre condições</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => addCondition(gi)}
                  className="flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
                >
                  <Plus className="size-3" /> Condição
                </button>
                {groups.length > 1 && (
                  <button onClick={() => removeGroup(gi)} className="text-muted-foreground/50 hover:text-red-500 transition-colors">
                    <X className="size-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Conditions */}
            {group.conditions.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg border border-dashed bg-white px-3 py-2 text-xs text-muted-foreground">
                <Filter className="size-3.5 opacity-40" />
                {groups.length === 1 ? "Sem condições — aplica-se a todas as conversas" : "Sem condições — grupo sempre verdadeiro"}
              </div>
            ) : (
              <div className="space-y-1.5">
                {group.conditions.map((cond, ci) => (
                  <div key={ci} className="flex items-center gap-2">
                    {ci > 0 && (
                      <span className={cn(
                        "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
                        group.operator === "OR"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-primary/10 text-primary"
                      )}>
                        {group.operator === "OR" ? "OU" : "E"}
                      </span>
                    )}
                    <div className={cn("flex-1", ci > 0 && "")}>
                      <ConditionRow
                        cond={cond}
                        connectors={connectors}
                        teams={teams}
                        onChange={(patch) => updateCondition(gi, ci, patch)}
                        onRemove={() => removeCondition(gi, ci)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Add group */}
      <button
        onClick={addGroup}
        className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors"
      >
        <Plus className="size-3" /> Adicionar grupo de condições
      </button>
    </div>
  )
}

// ─── Rule editor (inline form) ────────────────────────────────────────────────

function RuleEditor({
  draft,
  teams,
  users,
  connectors,
  saving,
  error,
  onChange,
  onSave,
  onCancel,
}: {
  draft: RuleDraft
  teams: Team[]
  users: TeamUser[]
  connectors: Connector[]
  saving: boolean
  error: string | null
  onChange: (patch: Partial<RuleDraft>) => void
  onSave: () => void
  onCancel: () => void
}) {
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

      {/* Condições por grupos */}
      <div className="space-y-2">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Condições <span className="normal-case font-normal">(grupos são sempre combinados com E)</span>
        </label>
        <ConditionGroupsEditor
          groups={draft.conditionGroups}
          connectors={connectors}
          teams={teams}
          onChange={(groups) => onChange({ conditionGroups: groups })}
        />
      </div>

      {/* Ação + Fallback */}
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

// ─── Rule card preview helpers ────────────────────────────────────────────────

function getRuleConditionSummary(rule: DistributionRule): string {
  const groups = rule.conditionGroups
  if (groups.length === 0 || groups.every((g) => g.conditions.length === 0)) {
    return "Todas as conversas"
  }
  const allConds = groups.flatMap((g) => g.conditions)
  const first = allConds[0]
  const fieldDef = CONDITION_FIELDS.find((f) => f.id === first.field)
  const fl = fieldDef?.label ?? first.field
  const vl = (fieldDef as { valueLabels?: Record<string, string> } | undefined)?.valueLabels?.[String(first.value)] ?? String(first.value)
  const op = first.operator === "eq" ? "=" : first.operator === "neq" ? "≠" : first.operator === "gt" ? ">" : first.operator === "lt" ? "<" : first.operator
  const rest = allConds.length - 1
  return rest > 0 ? `${fl} ${op} ${vl} +${rest}` : `${fl} ${op} ${vl}`
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
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [loading, setLoading] = useState(true)

  const [expanded, setExpanded] = useState<string | "new" | null>(null)
  const [draft, setDraft] = useState<RuleDraft>(emptyDraft())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)

  const dragId = useRef<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  useEffect(() => {
    if (!companyId) return
    setLoading(true)
    Promise.all([
      fetch(`/api/teams/rules?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/teams?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/teams/users?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/teams/connectors?companyId=${companyId}`).then((r) => r.json()),
    ])
      .then(([r, t, u, c]) => {
        setRules((r as Parameters<typeof ruleFromApi>[0][]).map(ruleFromApi))
        setTeams(t)
        setUsers(u)
        setConnectors(c)
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
        conditions: draft.conditionGroups,
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
      const normalized = ruleFromApi(data)
      setRules((prev) => {
        const idx = prev.findIndex((r) => r.id === normalized.id)
        if (idx >= 0) { const next = [...prev]; next[idx] = normalized; return next }
        return [...prev, normalized]
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

  function handleDragStart(id: string) { dragId.current = id }
  function handleDragOver(e: React.DragEvent, overId: string) {
    e.preventDefault()
    if (dragId.current !== overId) setDragOverId(overId)
  }
  function handleDragEnd() { setDragOverId(null); dragId.current = null }

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

  const totalTriggers = rules.reduce((s, r) => s + (r.triggerCount ?? 0), 0)

  return (
    <>
    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
      <div className="grid h-full min-w-[960px] grid-cols-[260px_minmax(500px,1fr)] gap-2.5 p-2.5 md:p-3">

        {/* ── Left: info panel ── */}
        <aside className="flex min-h-0 flex-col gap-2.5 overflow-y-auto">

          <div className="overflow-hidden rounded-lg border bg-white shadow-soft">
            <div className="border-b bg-muted/20 px-3 py-2.5">
              <p className="text-xs font-semibold">Como funciona</p>
            </div>
            <div className="p-3 space-y-3">
              {[
                { n: "1", title: "Condições verificadas", desc: "Canal, instância, origem, valor, time e muito mais." },
                { n: "2", title: "Lógica AND / OR", desc: "Grupos de condições — misture E / OU dentro de cada grupo." },
                { n: "3", title: "Primeira regra que bater", desc: "Regras avaliadas em ordem de prioridade." },
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
                { icon: <Filter className="size-3 text-muted-foreground" />, label: "Total de regras",     value: String(rules.length) },
                { icon: <Zap className="size-3 text-emerald-500" />,         label: "Ativas",              value: String(rules.filter((r) => r.active).length), highlight: "text-emerald-600" },
                { icon: <Users className="size-3 text-muted-foreground" />,  label: "Equipes cadastradas", value: String(teams.length) },
                { icon: <Activity className="size-3 text-primary" />,        label: "Acionamentos totais", value: String(totalTriggers), highlight: "text-primary" },
              ].map(({ icon, label, value, highlight }) => (
                <div key={label} className="flex items-center justify-between px-3 py-2 text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">{icon}{label}</span>
                  <span className={cn("font-semibold", highlight)}>{value}</span>
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
              <p className="text-[10px] text-muted-foreground">Clique para editar · Arraste para reordenar · Suporta AND / OR</p>
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
                  <button
                    onClick={() => setHelpOpen(true)}
                    className="ml-auto flex items-center gap-1.5 rounded-md border border-primary/20 bg-white px-2 py-1 text-[11px] font-medium text-primary/80 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                    title="Como criar regras"
                  >
                    <HelpCircle className="size-3" />
                    Ajuda
                  </button>
                </div>
                <RuleEditor
                  draft={draft}
                  teams={teams}
                  users={users}
                  connectors={connectors}
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
                        "flex items-start gap-2.5 px-3 py-2.5",
                        !isEditing && "cursor-pointer hover:bg-muted/20 transition-colors"
                      )}
                      onClick={() => !isEditing ? openEdit(rule) : undefined}
                    >
                      {/* Drag handle + move buttons */}
                      {!isEditing && (
                        <div className="flex shrink-0 flex-col items-center gap-0.5 pt-0.5" onClick={(e) => e.stopPropagation()}>
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

                      <span className="flex size-5 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-bold text-muted-foreground mt-0.5">
                        {i + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        {/* Row 1: name + status */}
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
                          <>
                            {/* Row 2: conditions + action */}
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                              {getRuleConditionSummary(rule)}
                              {" "}
                              <span className="font-medium text-primary/70">{getRuleAction(rule)}</span>
                              {" · "}
                              <span className="text-muted-foreground/60">{FALLBACK_LABELS[rule.fallback]}</span>
                            </p>
                            {/* Row 3: stats */}
                            <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground/60">
                              <Activity className="size-2.5" />
                              <span>{rule.triggerCount ?? 0} acionamentos</span>
                              {rule.lastTriggeredAt && (
                                <>
                                  <span>·</span>
                                  <span>última: {formatRelativeDate(rule.lastTriggeredAt)}</span>
                                </>
                              )}
                            </p>
                          </>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-1 mt-0.5" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => toggleRule(rule.id)} title={rule.active ? "Desativar" : "Ativar"}>
                          {rule.active
                            ? <ToggleRight className="size-4 text-primary" />
                            : <ToggleLeft className="size-4 text-muted-foreground" />}
                        </button>
                        <button onClick={() => deleteRule(rule.id)} className="text-muted-foreground hover:text-red-500 transition-colors">
                          <Trash2 className="size-3.5" />
                        </button>
                        {!isEditing && (
                          <ChevronDown className="size-3.5 text-muted-foreground/40" />
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
                          connectors={connectors}
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

    {/* ── Help Sheet ── */}

    <Sheet open={helpOpen} onOpenChange={setHelpOpen} className="w-full max-w-[560px]">
      <SheetContent>
        <SheetHeader className="mb-6 flex-col items-stretch gap-2">
          <SheetTitle className="flex items-center gap-2 text-base">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
              <HelpCircle className="size-4" />
            </span>
            Como criar regras de distribuição
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            Entenda como funcionam as regras para direcionar leads automaticamente ao vendedor ou equipe certa.
          </p>
        </SheetHeader>

        <div className="space-y-6 pb-8">

          {/* Como funciona */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Layers className="size-4 text-primary" />
              Como as regras funcionam
            </h3>
            <div className="space-y-2 rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
              <p>As regras são avaliadas em <strong className="text-foreground">ordem de prioridade</strong> (de cima para baixo). A <strong className="text-foreground">primeira regra que corresponder</strong> à conversa é aplicada — as demais são ignoradas.</p>
              <div className="mt-3 flex flex-col gap-1.5 text-xs">
                {[
                  "Regra 1 — verifica condições → bate? Aplica e para.",
                  "Regra 2 — só avaliada se a regra 1 não bateu.",
                  "Regra 3 — avaliada se as anteriores não bateram.",
                  "Sem match → lead vai para a fila geral.",
                ].map((s, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">{i + 1}</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Condições */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Filter className="size-4 text-amber-500" />
              Condições — filtrando conversas
            </h3>
            <p className="text-sm text-muted-foreground">
              Condições determinam <strong className="text-foreground">quando</strong> a regra se aplica. Se não adicionar nenhuma condição, a regra se aplica a <em>todas</em> as conversas.
            </p>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lógica dentro de um grupo</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border bg-primary/5 p-3 text-xs">
                  <p className="font-semibold text-primary">E (AND)</p>
                  <p className="mt-1 text-muted-foreground">Todas as condições precisam ser verdadeiras ao mesmo tempo.</p>
                  <p className="mt-2 rounded bg-white px-2 py-1 font-mono text-[10px]">Canal = WhatsApp<br /><strong>E</strong> Valor &gt; 50.000</p>
                </div>
                <div className="rounded-lg border bg-amber-50 p-3 text-xs">
                  <p className="font-semibold text-amber-700">OU (OR)</p>
                  <p className="mt-1 text-muted-foreground">Basta uma das condições ser verdadeira.</p>
                  <p className="mt-2 rounded bg-white px-2 py-1 font-mono text-[10px]">Status = Quente<br /><strong>OU</strong> Etapa = Negociação</p>
                </div>
              </div>
              <div className="rounded-lg border border-dashed bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
                <strong className="text-foreground">Grupos</strong> são sempre combinados com <strong className="text-foreground">E</strong> entre si. Use múltiplos grupos para combinar AND e OR na mesma regra.
              </div>
            </div>
          </section>

          {/* Ações */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <ArrowRight className="size-4 text-emerald-600" />
              Ações — o que acontece quando a regra bate
            </h3>
            <div className="divide-y rounded-xl border overflow-hidden text-sm">
              {[
                { label: "Atribuir a equipe", desc: "Distribui o lead para um membro da equipe conforme a estratégia (rodízio ou menor carteira).", color: "bg-emerald-50 text-emerald-700" },
                { label: "Atendente específico", desc: "Direciona sempre para o mesmo vendedor, independente de carga de trabalho.", color: "bg-blue-50 text-blue-700" },
                { label: "Dono da conta", desc: "Se o cliente já tem um atendente responsável, a conversa vai direto para ele.", color: "bg-violet-50 text-violet-700" },
                { label: "Fila geral", desc: "Nenhuma atribuição automática — o gestor distribui manualmente.", color: "bg-muted text-muted-foreground" },
              ].map(({ label, desc, color }) => (
                <div key={label} className="flex items-start gap-3 bg-white px-3 py-2.5">
                  <span className={cn("mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold", color)}>{label}</span>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Fallback */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <AlertCircle className="size-4 text-orange-500" />
              Fallback — o que fazer se a ação falhar
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border bg-orange-50 p-3">
                <p className="font-semibold text-orange-700">Fila geral</p>
                <p className="mt-1 text-muted-foreground">Se nenhum atendente estiver disponível, o lead fica na fila aguardando atribuição manual.</p>
              </div>
              <div className="rounded-lg border bg-sky-50 p-3">
                <p className="font-semibold text-sky-700">Tentar próxima regra</p>
                <p className="mt-1 text-muted-foreground">Se a ação falhar, o sistema avalia a próxima regra na lista.</p>
              </div>
            </div>
          </section>

          {/* Exemplos */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 className="size-4 text-primary" />
              Exemplos práticos
            </h3>

            <div className="space-y-3">
              {[
                {
                  title: "Leads enterprise para especialista",
                  tag: "TEAM",
                  tagColor: "bg-emerald-100 text-emerald-700",
                  conditions: [
                    "Canal = WhatsApp",
                    "Valor do lead > R$ 25.000",
                  ],
                  logic: "E",
                  action: "→ Equipe Enterprise · Rodízio",
                  fallback: "Tentar próxima regra",
                },
                {
                  title: "Clientes quentes ou em negociação",
                  tag: "SPECIFIC_USER",
                  tagColor: "bg-blue-100 text-blue-700",
                  conditions: [
                    "Status do cliente = Quente",
                    "Etapa do funil = Negociação",
                  ],
                  logic: "OU",
                  action: "→ Maria Silva (atendente específica)",
                  fallback: "Fila geral",
                },
                {
                  title: "Mensagens do Instagram para SDR",
                  tag: "TEAM",
                  tagColor: "bg-emerald-100 text-emerald-700",
                  conditions: [
                    "Canal = Instagram",
                  ],
                  logic: "—",
                  action: "→ Equipe SDR · Menor carteira",
                  fallback: "Fila geral",
                },
                {
                  title: "Instância VIP → vendedor sênior",
                  tag: "SPECIFIC_USER",
                  tagColor: "bg-blue-100 text-blue-700",
                  conditions: [
                    "Instância = numero-vip",
                    "Status do cliente ≠ Em análise",
                  ],
                  logic: "E",
                  action: "→ Carlos Souza (atendente específico)",
                  fallback: "Tentar próxima regra",
                },
              ].map((ex) => (
                <div key={ex.title} className="rounded-xl border bg-white overflow-hidden text-xs">
                  <div className="flex items-center gap-2 border-b bg-muted/20 px-3 py-2">
                    <p className="font-semibold">{ex.title}</p>
                    <span className={cn("ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold", ex.tagColor)}>
                      {ex.tag === "TEAM" ? "Equipe" : "Atendente"}
                    </span>
                  </div>
                  <div className="px-3 py-2.5 space-y-2">
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Condições ({ex.logic})</p>
                      {ex.conditions.map((c) => (
                        <div key={c} className="flex items-center gap-1.5">
                          <span className="size-1 shrink-0 rounded-full bg-primary/40" />
                          <span className="text-muted-foreground">{c}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 border-t pt-2">
                      <span className="font-medium text-emerald-700">{ex.action}</span>
                      <span className="ml-auto text-muted-foreground/60">Fallback: {ex.fallback}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Dicas */}
          <section className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
            <p className="text-xs font-semibold text-primary">Boas práticas</p>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {[
                "Coloque regras mais específicas no topo — elas têm prioridade sobre as genéricas.",
                "Use 'Tentar próxima regra' no fallback para criar cascatas de distribuição.",
                "Uma regra sem condições captura tudo — ideal como regra padrão no final da lista.",
                "Use o campo 'Instância' para separar leads por número de WhatsApp (ex: número VIP vs. número geral).",
                "Combine grupos: Grupo 1 com AND filtra o perfil, Grupo 2 com OR flexibiliza o status.",
              ].map((tip) => (
                <li key={tip} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-primary/60" />
                  {tip}
                </li>
              ))}
            </ul>
          </section>

        </div>
      </SheetContent>
    </Sheet>
    </>
  )
}
