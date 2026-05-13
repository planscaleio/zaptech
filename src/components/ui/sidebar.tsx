import * as React from "react"
import { PanelLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type SidebarContextValue = {
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  mobileOpen: boolean
  setMobileOpen: React.Dispatch<React.SetStateAction<boolean>>
  state: "expanded" | "collapsed"
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null)

export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }
  return context
}

type SidebarProviderProps = React.HTMLAttributes<HTMLDivElement> & {
  defaultOpen?: boolean
  storageKey?: string
}

export function SidebarProvider({
  defaultOpen = true,
  storageKey = "zapvendas:sidebar:open",
  className,
  children,
  ...props
}: SidebarProviderProps) {
  const [open, setOpen] = React.useState(() => {
    if (typeof window === "undefined") return defaultOpen
    const stored = window.localStorage.getItem(storageKey)
    if (stored === "true") return true
    if (stored === "false") return false
    return defaultOpen
  })
  const [mobileOpen, setMobileOpen] = React.useState(false)

  React.useEffect(() => {
    window.localStorage.setItem(storageKey, String(open))
  }, [open, storageKey])

  const value = React.useMemo<SidebarContextValue>(
    () => ({
      open,
      setOpen,
      mobileOpen,
      setMobileOpen,
      state: open ? "expanded" : "collapsed",
      toggleSidebar: () => {
        if (window.matchMedia("(min-width: 1024px)").matches) {
          setOpen((current) => !current)
          return
        }
        setMobileOpen((current) => !current)
      },
    }),
    [open, mobileOpen],
  )

  return (
    <SidebarContext.Provider value={value}>
      <div
        className={cn("group/sidebar-wrapper h-full min-h-0 w-full", className)}
        data-sidebar-state={value.state}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

export function Sidebar({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  const { open, mobileOpen, setMobileOpen, state } = useSidebar()

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[1px] transition-opacity lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setMobileOpen(false)}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r bg-white/92 px-2.5 py-3 shadow-soft backdrop-blur transition-[transform,width] duration-200 lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          open ? "lg:w-56" : "lg:w-[4.5rem]",
          className,
        )}
        data-state={state}
        {...props}
      >
        {children}
      </aside>
    </>
  )
}

export function SidebarHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("shrink-0", className)} {...props} />
}

export function SidebarContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto py-3", className)} {...props} />
}

export function SidebarFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("shrink-0 pt-2", className)} {...props} />
}

export function SidebarGroup({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-1.5", className)} {...props} />
}

export function SidebarGroupLabel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80",
        className,
      )}
      {...props}
    />
  )
}

export function SidebarMenu({
  className,
  ...props
}: React.HTMLAttributes<HTMLUListElement>) {
  return <ul className={cn("space-y-0.5", className)} {...props} />
}

export function SidebarMenuItem({
  className,
  ...props
}: React.HTMLAttributes<HTMLLIElement>) {
  return <li className={cn("list-none", className)} {...props} />
}

type SidebarMenuButtonProps = React.HTMLAttributes<HTMLElement> & {
  asChild?: boolean
  isActive?: boolean
}

export function SidebarMenuButton({
  asChild,
  isActive,
  className,
  children,
  ...props
}: SidebarMenuButtonProps) {
  const classes = cn(
    "relative flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    isActive && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
    className,
  )

  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ className?: string }>
    return React.cloneElement(child, {
      className: cn(classes, child.props.className),
      ...props,
    })
  }

  return (
    <button className={classes} type="button" {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  )
}

export function SidebarInset({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return <section className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)} {...props} />
}

export function SidebarTrigger({
  className,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      aria-label="Alternar menu"
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <PanelLeft />
    </Button>
  )
}
