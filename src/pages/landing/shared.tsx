import { Link, useLocation } from "react-router-dom"
import { useState } from "react"
import { cn } from "@/lib/utils"

/* ── Zap Tech original logo — chat bubble com raio interno ── */
export function ZapLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      {/* Chat bubble */}
      <rect x="4" y="6" width="56" height="42" rx="12" fill="#16a34a" />
      {/* Bubble tail */}
      <path d="M14 48 L8 58 L26 50 Z" fill="#16a34a" />
      {/* Lightning bolt (raio = "zap") */}
      <path
        d="M36 14 L24 33 L31 33 L28 50 L40 31 L33 31 Z"
        fill="white"
      />
    </svg>
  )
}

const NAV_LINKS = [
  { href: "/para-vendas", label: "Para Times de Vendas" },
  { href: "/pme",         label: "Para PMEs" },
]

export function LandingNav() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  return (
    <nav
      style={{ fontFamily: "'Geist', ui-sans-serif, system-ui, sans-serif" }}
      className="sticky top-0 z-50 border-b border-[var(--lk-line)] bg-[var(--lk-bg-0)]"
    >
      <div className="mx-auto flex h-[60px] max-w-[1200px] items-center gap-6 px-5 md:px-8">
        {/* Logo */}
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <ZapLogo size={28} />
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--lk-ink-0)]">
            Zap Tech
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden flex-1 items-center gap-0.5 md:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              to={l.href}
              className={cn(
                "rounded-lg px-3.5 py-2 text-[13.5px] font-medium transition-colors",
                pathname === l.href
                  ? "text-[var(--lk-ink-0)]"
                  : "text-[var(--lk-ink-2)] hover:bg-[var(--lk-bg-2)] hover:text-[var(--lk-ink-0)]",
              )}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="ml-auto hidden items-center gap-3 md:flex">
          <Link
            to="/login"
            className="text-[13.5px] font-medium text-[var(--lk-ink-2)] transition-colors hover:text-[var(--lk-ink-0)]"
          >
            Entrar
          </Link>
          <Link
            to="/login"
            className="rounded-lg bg-[var(--cobalt)] px-4 py-2 text-[13.5px] font-medium text-white transition-all hover:bg-[var(--sapphire)]"
          >
            Começar grátis
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--lk-line)] text-[var(--lk-ink-2)] md:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sr-only">Menu</span>
          {open ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M0 1h16M0 6h16M0 11h16"/>
            </svg>
          )}
        </button>
      </div>

      {open && (
        <div className="border-t border-[var(--lk-line)] bg-[var(--lk-bg-0)] px-5 pb-5 md:hidden">
          <div className="flex flex-col gap-0.5 pt-2">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                to={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--lk-ink-1)] hover:bg-[var(--lk-bg-2)]"
              >
                {l.label}
              </Link>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2.5">
            <Link to="/login" className="rounded-lg border border-[var(--lk-line)] px-4 py-2.5 text-center text-sm font-medium text-[var(--lk-ink-0)]">
              Entrar
            </Link>
            <Link to="/login" className="rounded-lg bg-[var(--cobalt)] px-4 py-2.5 text-center text-sm font-medium text-white">
              Começar grátis
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}

export function LandingFooter() {
  return (
    <footer
      style={{ fontFamily: "'Geist', ui-sans-serif, system-ui, sans-serif" }}
      className="border-t border-[var(--lk-line)] bg-[var(--lk-bg-1)]"
    >
      <div className="mx-auto max-w-[1200px] px-5 py-14 md:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2.5">
              <ZapLogo size={26} />
              <span className="text-[15px] font-semibold tracking-[-0.02em] text-[var(--lk-ink-0)]">Zap Tech</span>
            </Link>
            <p className="mt-3 max-w-[240px] text-[13.5px] leading-relaxed text-[var(--lk-ink-2)]">
              Operação Omnichannel de vendas com IA para times que querem crescer.
            </p>
          </div>

          {[
            { title: "Produto", links: [
              { label: "Para Times de Vendas", href: "/para-vendas" },
              { label: "Para PMEs",            href: "/pme" },
              { label: "Entrar na plataforma", href: "/login" },
            ]},
            { title: "Funcionalidades", links: [
              { label: "Agentes de IA",        href: "/para-vendas" },
              { label: "CRM & Pipeline",       href: "/para-vendas" },
              { label: "Suporte Inteligente",  href: "/pme" },
              { label: "Automações",           href: "/para-vendas" },
            ]},
            { title: "Empresa", links: [
              { label: "Sobre nós",   href: "/" },
              { label: "Contato",     href: "/" },
              { label: "LGPD",        href: "/" },
            ]},
          ].map((col) => (
            <div key={col.title}>
              <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-[var(--lk-ink-3)]">
                {col.title}
              </p>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      to={l.href}
                      className="text-[13.5px] text-[var(--lk-ink-2)] transition-colors hover:text-[var(--lk-ink-0)]"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-[var(--lk-line)] pt-6 text-[12.5px] text-[var(--lk-ink-3)] md:flex-row md:items-center">
          <p>© 2026 Zap Tech · Operação Omnichannel com IA · Brasil</p>
          <p>v1.0.0 · LGPD</p>
        </div>
      </div>
    </footer>
  )
}
