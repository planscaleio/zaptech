import { useDroppable } from "@dnd-kit/core"
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { GripVertical, Calendar, DollarSign } from "lucide-react"

type KCard = {
  id: string
  name: string
  description: string | null
  initials: string | null
  priority: string
  dots: number
  score: number | null
  value: string | null
  expectedCloseAt: string | null
  createdAt: string
  assignedUser?: { id: string; name: string; avatarUrl: string | null } | null
  closeType?: "GANHO" | "PERDIDO" | "CANCELADO" | null
  customer?: ({ isVip?: boolean } & Record<string, unknown>) | null
}

const PRIORITY_DOT: Record<string, string> = {
  ALTA:  "bg-rose-500",
  MEDIA: "bg-amber-400",
  BAIXA: "bg-sky-400",
}

const PRIORITY_LABEL: Record<string, string> = {
  ALTA: "Alta", MEDIA: "Média", BAIXA: "Baixa",
}

function formatCurrency(val: string | null): string | null {
  if (!val) return null
  const n = Number(val)
  if (isNaN(n)) return null
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n)
}

function formatDate(val: string | null): string | null {
  if (!val) return null
  const d = new Date(val)
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yy = String(d.getFullYear()).slice(2)
  return `${dd}/${mm}/${yy}`
}

// ── Sortable card (draggable) ────────────────────────────────────────────────

interface SortableCardProps {
  card: KCard
  isSelected: boolean
  onClick: () => void
}

export function SortableCard({ card, isSelected, onClick }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { card },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  }

  const currency = formatCurrency(card.value)
  const closeDate = formatDate(card.expectedCloseAt)
  const isVip = card.customer?.isVip ?? false
  const scoreCls = card.score != null
    ? card.score >= 70 ? "bg-rose-500 text-white"
    : card.score >= 40 ? "bg-amber-400 text-white"
    : "bg-sky-400 text-white"
    : ""

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative w-full rounded-lg border bg-white shadow-sm transition-colors",
        isVip
          ? isSelected
            ? "border-amber-400 ring-2 ring-amber-200 bg-amber-50/40"
            : "border-amber-300 bg-amber-50/30 hover:border-amber-400"
          : isSelected
            ? "border-primary/40 ring-2 ring-primary/10"
            : "hover:border-primary/30",
        isDragging && "shadow-none",
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="absolute left-1 top-1/2 -translate-y-1/2 cursor-grab touch-none rounded p-0.5 text-muted-foreground/30 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
        tabIndex={-1}
        aria-label="Arrastar card"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="size-3" />
      </button>

      {/* Clickable area */}
      <button className="block w-full pl-4 pr-2.5 py-2.5 text-left" onClick={onClick}>
        {/* Row 1: name + VIP badge + score */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {isVip && (
              <span className="shrink-0 rounded-sm bg-amber-400 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-white">
                VIP
              </span>
            )}
            <p className="truncate text-sm font-semibold leading-snug">{card.name}</p>
          </div>
          {card.score != null && (
            <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold", scoreCls)}>
              {card.score}
            </span>
          )}
        </div>

        {/* Row 2: value + close date — only if at least one is set */}
        {(currency || closeDate) && (
          <div className="mt-1.5 flex items-center gap-3">
            {currency && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-primary">
                <DollarSign className="size-2.5 shrink-0" />
                {currency}
              </span>
            )}
            {closeDate && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Calendar className="size-2.5 shrink-0" />
                {closeDate}
              </span>
            )}
          </div>
        )}

        {/* Row 3: priority dot + assignee + close badge */}
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className={cn("size-1.5 shrink-0 rounded-full", PRIORITY_DOT[card.priority] ?? "bg-muted")} />
          <span className="text-[10px] text-muted-foreground">{PRIORITY_LABEL[card.priority] ?? card.priority}</span>
          {card.closeType && (
            <span className={cn(
              "ml-1 shrink-0 rounded-full px-1.5 py-px text-[9px] font-bold uppercase",
              card.closeType === "GANHO"    && "bg-emerald-100 text-emerald-700",
              card.closeType === "PERDIDO"  && "bg-red-100 text-red-700",
              card.closeType === "CANCELADO" && "bg-slate-100 text-slate-600",
            )}>
              {card.closeType === "GANHO" ? "Ganho" : card.closeType === "PERDIDO" ? "Perdido" : "Cancelado"}
            </span>
          )}
          {card.assignedUser && (
            <span
              className="ml-auto flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[8px] font-bold text-primary"
              title={card.assignedUser.name}
            >
              {card.assignedUser.name.slice(0, 2).toUpperCase()}
            </span>
          )}
          {!card.assignedUser && !currency && !closeDate && (
            <span className="ml-auto text-[10px] text-muted-foreground">
              {formatDate(card.createdAt)}
            </span>
          )}
        </div>
      </button>
    </div>
  )
}

// ── Card ghost for DragOverlay ────────────────────────────────────────────────

export function CardGhost({ card }: { card: KCard }) {
  const currency = formatCurrency(card.value)
  const closeDate = formatDate(card.expectedCloseAt)
  const isVip = card.customer?.isVip ?? false

  return (
    <div className={cn(
      "w-60 rotate-1 rounded-lg border-2 px-3 py-2.5 shadow-2xl ring-2",
      isVip
        ? "border-amber-400/60 bg-amber-50/40 ring-amber-200"
        : "border-primary/30 bg-white ring-primary/10"
    )}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {isVip && (
            <span className="shrink-0 rounded-sm bg-amber-400 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-white">VIP</span>
          )}
          <p className="truncate text-sm font-semibold">{card.name}</p>
        </div>
        {card.score != null && (
          <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
            {card.score}
          </span>
        )}
      </div>
      {(currency || closeDate) && (
        <div className="mt-1.5 flex items-center gap-3">
          {currency && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-primary">
              <DollarSign className="size-2.5" />{currency}
            </span>
          )}
          {closeDate && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Calendar className="size-2.5" />{closeDate}
            </span>
          )}
        </div>
      )}
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className={cn("size-1.5 rounded-full", PRIORITY_DOT[card.priority] ?? "bg-muted")} />
        <span className="text-[10px] text-muted-foreground">{PRIORITY_LABEL[card.priority] ?? card.priority}</span>
      </div>
    </div>
  )
}

// ── Droppable column ──────────────────────────────────────────────────────────

interface DroppableColumnProps {
  columnId: string
  name: string
  color: string | null
  cards: KCard[]
  selectedCardId: string | null
  sheetOpen: boolean
  onCardClick: (card: KCard) => void
  isOver?: boolean
}

export function DroppableColumn({
  columnId, name, color, cards, selectedCardId, sheetOpen, onCardClick,
}: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId })

  return (
    <div className={cn(
      "flex min-h-0 w-60 shrink-0 flex-col rounded-xl transition-colors duration-150",
      isOver ? "bg-primary/5 ring-2 ring-primary/20" : "bg-white/75",
    )}>
      {/* Column header */}
      <div className="flex shrink-0 items-center justify-between rounded-t-xl border-b px-3 py-2.5">
        <div className="flex items-center gap-2">
          {color && <span className="size-2 rounded-full" style={{ background: color }} />}
          <h3 className="text-sm font-semibold">{name}</h3>
          <Badge variant="secondary">{cards.length}</Badge>
        </div>
      </div>

      {/* Cards list */}
      <div
        ref={setNodeRef}
        className={cn(
          "min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2 transition-colors",
          isOver && "rounded-b-xl bg-primary/5",
        )}
      >
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <SortableCard
              key={card.id}
              card={card}
              isSelected={selectedCardId === card.id && sheetOpen}
              onClick={() => onCardClick(card as any)}
            />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <div className={cn(
            "flex items-center justify-center rounded-lg border-2 border-dashed py-8 text-xs text-muted-foreground transition-colors",
            isOver ? "border-primary/40 text-primary" : "border-muted/60"
          )}>
            {isOver ? "Soltar aqui" : "Sem cards"}
          </div>
        )}
      </div>
    </div>
  )
}
