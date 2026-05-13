import { useEffect, type ReactNode } from "react"
import { cn } from "@/lib/utils"

interface SheetProps {
  open: boolean
  onClose?: () => void
  onOpenChange?: (open: boolean) => void
  children: ReactNode
  className?: string
}

export function Sheet({ open, onClose, onOpenChange, children, className }: SheetProps) {
  const close = () => { onClose?.(); onOpenChange?.(false) }

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    if (open) document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open])

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
          onClick={close}
          aria-hidden="true"
        />
      )}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-[60vw] max-w-full flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "translate-x-full",
          className,
        )}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </>
  )
}

export function SheetHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex shrink-0 items-start gap-3 border-b p-4", className)}>
      {children}
    </div>
  )
}

export function SheetContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-h-0 flex-1 overflow-y-auto p-4", className)}>
      {children}
    </div>
  )
}

export function SheetTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={cn("text-lg font-semibold leading-none tracking-tight", className)}>
      {children}
    </h2>
  )
}

export function SheetDescription({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)}>
      {children}
    </p>
  )
}
