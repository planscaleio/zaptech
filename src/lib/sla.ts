export type SlaStatus = "overdue" | "warning" | "ok" | "none"

export interface SlaInfo {
  status: SlaStatus
  minutesSinceLastMessage: number | null
  minutesUntilOverdue: number | null
  label: string
}

export function computeSla(
  lastMessageAt: string | null | undefined,
  maxWaitMinutes: number | null | undefined,
  now: Date = new Date(),
): SlaInfo {
  if (!lastMessageAt || !maxWaitMinutes || maxWaitMinutes <= 0) {
    return { status: "none", minutesSinceLastMessage: null, minutesUntilOverdue: null, label: "—" }
  }
  const last = new Date(lastMessageAt).getTime()
  if (Number.isNaN(last)) {
    return { status: "none", minutesSinceLastMessage: null, minutesUntilOverdue: null, label: "—" }
  }
  const diffMin = Math.floor((now.getTime() - last) / 60000)
  const remaining = maxWaitMinutes - diffMin

  let status: SlaStatus
  if (diffMin >= maxWaitMinutes) status = "overdue"
  else if (diffMin >= maxWaitMinutes * 0.5) status = "warning"
  else status = "ok"

  const label =
    status === "overdue"
      ? `Atrasada ${formatMinutes(diffMin - maxWaitMinutes)}`
      : status === "warning"
      ? `Vence em ${formatMinutes(remaining)}`
      : `No prazo (${formatMinutes(remaining)})`

  return { status, minutesSinceLastMessage: diffMin, minutesUntilOverdue: remaining, label }
}

export function formatMinutes(min: number): string {
  const abs = Math.abs(min)
  if (abs < 60) return `${abs}m`
  const h = Math.floor(abs / 60)
  const m = abs % 60
  if (h < 24) return m === 0 ? `${h}h` : `${h}h${m}m`
  const d = Math.floor(h / 24)
  const remH = h % 24
  return remH === 0 ? `${d}d` : `${d}d${remH}h`
}

export const SLA_GROUP_ORDER: SlaStatus[] = ["overdue", "warning", "ok", "none"]

export const SLA_GROUP_LABELS: Record<SlaStatus, string> = {
  overdue: "Atrasadas",
  warning: "Atenção",
  ok: "No prazo",
  none: "Sem SLA",
}

export const SLA_GROUP_COLORS: Record<SlaStatus, { bar: string; dot: string; text: string; bg: string; ring: string }> = {
  overdue: {
    bar: "bg-rose-500",
    dot: "bg-rose-500",
    text: "text-rose-700",
    bg: "bg-rose-50",
    ring: "ring-rose-200",
  },
  warning: {
    bar: "bg-amber-500",
    dot: "bg-amber-500",
    text: "text-amber-700",
    bg: "bg-amber-50",
    ring: "ring-amber-200",
  },
  ok: {
    bar: "bg-emerald-500",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    bg: "bg-emerald-50",
    ring: "ring-emerald-200",
  },
  none: {
    bar: "bg-slate-300",
    dot: "bg-slate-300",
    text: "text-slate-600",
    bg: "bg-slate-50",
    ring: "ring-slate-200",
  },
}
