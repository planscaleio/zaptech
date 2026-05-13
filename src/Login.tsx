import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

// ─── Noise texture SVG (grain overlay) ───────────────────────────────────────

const NOISE_SVG = `data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E`

// ─── Left panel ───────────────────────────────────────────────────────────────

function LeftPanel() {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 3200)
    return () => clearInterval(id)
  }, [])

  const metrics = [
    { value: "94.2k", label: "chats processados/mês" },
    { value: "3.8×", label: "aumento na conversão" },
    { value: "< 8s", label: "tempo médio de resposta" },
    { value: "99.9%", label: "disponibilidade garantida" },
  ]

  const active = tick % metrics.length

  return (
    <div className="relative hidden overflow-hidden lg:flex lg:flex-col" style={{ width: "44%", minWidth: 400, flexShrink: 0, background: "hsl(215 42% 6%)" }}>

      {/* Noise grain */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-overlay"
        style={{ backgroundImage: `url("${NOISE_SVG}")`, backgroundSize: "256px" }}
      />

      {/* Mesh gradient */}
      <div className="pointer-events-none absolute inset-0" style={{
        background: `
          radial-gradient(ellipse 80% 60% at 20% 10%, hsl(187 84% 22% / 0.55) 0%, transparent 60%),
          radial-gradient(ellipse 60% 50% at 80% 80%, hsl(200 70% 18% / 0.4) 0%, transparent 55%),
          radial-gradient(ellipse 40% 40% at 50% 50%, hsl(215 42% 9% / 0.8) 0%, transparent 100%)
        `,
      }} />

      {/* Subtle grid */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.032]" style={{
        backgroundImage: "linear-gradient(hsl(187 84% 70%) 1px, transparent 1px), linear-gradient(90deg, hsl(187 84% 70%) 1px, transparent 1px)",
        backgroundSize: "64px 64px",
      }} />

      {/* Top edge accent line */}
      <div className="absolute left-0 right-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, hsl(187 84% 40% / 0.6), transparent)" }} />

      {/* Logo */}
      <div className="relative z-10 flex items-center gap-2.5 px-10 pt-10">
        <div className="flex size-8 items-center justify-center rounded-lg" style={{ background: "hsl(187 84% 30%)", boxShadow: "0 0 16px hsl(187 84% 30% / 0.5)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-white/90" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.01em" }}>
          Zap Tech
        </span>
      </div>

      {/* Main copy */}
      <div className="relative z-10 flex flex-1 flex-col justify-center px-10 pb-10">
        <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1" style={{ borderColor: "hsl(187 84% 40% / 0.25)", background: "hsl(187 84% 30% / 0.1)" }}>
          <span className="size-1.5 rounded-full" style={{ background: "hsl(187 84% 55%)", boxShadow: "0 0 5px hsl(187 84% 55%)" }} />
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/45" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Plataforma IA · Vendas
          </span>
        </div>

        <h1 className="text-[2.75rem] font-bold leading-[1.1] text-white" style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: 700,
          letterSpacing: "-0.03em",
        }}>
          Venda mais.
          <br />
          <span style={{ color: "hsl(187 84% 52%)" }}>Automatize</span>
          <br />
          <span style={{ color: "hsl(187 84% 52%)" }}>com IA.</span>
        </h1>

        <p className="mt-5 max-w-[260px] text-[13.5px] leading-[1.7] text-white/38" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Pipeline, atendimento e campanhas integrados — do primeiro contato ao fechamento.
        </p>

        {/* Rotating metric */}
        <div className="mt-10 overflow-hidden" style={{ height: 64 }}>
          {metrics.map((m, i) => (
            <div
              key={m.value}
              className="absolute transition-all duration-700 ease-in-out"
              style={{
                opacity: i === active ? 1 : 0,
                transform: i === active ? "translateY(0)" : i < active ? "translateY(-16px)" : "translateY(16px)",
              }}
            >
              <div className="text-[2.2rem] font-bold leading-none text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.04em" }}>
                {m.value}
              </div>
              <div className="mt-1 text-[12px] text-white/35" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {m.label}
              </div>
            </div>
          ))}
        </div>

        {/* Metric dots */}
        <div className="mt-6 flex items-center gap-1.5">
          {metrics.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-500"
              style={{
                width: i === active ? 20 : 5,
                height: 5,
                background: i === active ? "hsl(187 84% 50%)" : "hsl(187 84% 50% / 0.2)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Bottom card */}
      <div className="relative z-10 mx-8 mb-10 rounded-2xl border p-5" style={{ borderColor: "hsl(187 84% 40% / 0.12)", background: "hsl(215 42% 9% / 0.6)", backdropFilter: "blur(8px)" }}>
        <div className="flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "hsl(187 84% 30% / 0.2)", border: "1px solid hsl(187 84% 30% / 0.3)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="hsl(187 84% 65%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <div>
            <p className="text-[12px] font-semibold text-white/70" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Agentes IA em operação
            </p>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-white/35" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Triagem, qualificação e fechamento automatizados, com supervisão humana quando necessário.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Right panel ─────────────────────────────────────────────────────────────

function RightPanel() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [emailFocus, setEmailFocus] = useState(false)
  const [pwFocus, setPwFocus] = useState(false)
  const [mounted, setMounted] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setMounted(true)
      emailRef.current?.focus()
    }, 120)
    return () => clearTimeout(t)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Erro ao entrar. Tente novamente.")
        return
      }
      localStorage.setItem("zv_token", data.token)
      localStorage.setItem("zv_user", JSON.stringify(data.user))
      window.location.href = data.user.type === "admin" ? "/admin" : "/"
    } catch {
      setError("Não foi possível conectar ao servidor.")
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = email.length > 0 && password.length > 0

  return (
    <div
      className="flex flex-1 flex-col items-center justify-center px-8 py-16"
      style={{ background: "hsl(0 0% 99%)" }}
    >
      <div
        className="w-full max-w-[380px] transition-all duration-500"
        style={{ opacity: mounted ? 1 : 0, transform: mounted ? "none" : "translateY(10px)" }}
      >
        {/* Mobile logo */}
        <div className="mb-9 flex items-center gap-2 lg:hidden">
          <div className="flex size-7 items-center justify-center rounded-lg" style={{ background: "hsl(187 84% 30%)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <span className="text-sm font-semibold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Zap Tech</span>
        </div>

        {/* Heading */}
        <div className="mb-8">
          <h2 className="text-[1.6rem] font-bold leading-tight text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.025em" }}>
            Acesse sua conta
          </h2>
          <p className="mt-1.5 text-[13.5px] text-muted-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Entre com seu e-mail e senha para continuar
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Email */}
          <div className="space-y-1.5">
            <label className="block text-[13px] font-medium text-foreground/75" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              E-mail
            </label>
            <div
              className="flex items-center gap-2.5 rounded-xl border px-3.5 transition-all duration-150"
              style={{
                height: 46,
                borderColor: emailFocus ? "hsl(187 84% 30%)" : "hsl(var(--border))",
                boxShadow: emailFocus ? "0 0 0 3px hsl(187 84% 30% / 0.1)" : "none",
                background: "white",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <input
                ref={emailRef}
                type="email"
                placeholder="seu@email.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setEmailFocus(true)}
                onBlur={() => setEmailFocus(false)}
                autoComplete="email"
                className="flex-1 bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-muted-foreground/40"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-[13px] font-medium text-foreground/75" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Senha
              </label>
              <button
                type="button"
                className="text-[12px] font-medium transition-colors hover:text-foreground"
                style={{ color: "hsl(187 84% 30%)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Esqueci a senha
              </button>
            </div>
            <div
              className="flex items-center gap-2.5 rounded-xl border px-3.5 transition-all duration-150"
              style={{
                height: 46,
                borderColor: pwFocus ? "hsl(187 84% 30%)" : "hsl(var(--border))",
                boxShadow: pwFocus ? "0 0 0 3px hsl(187 84% 30% / 0.1)" : "none",
                background: "white",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                type={showPw ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPwFocus(true)}
                onBlur={() => setPwFocus(false)}
                autoComplete="current-password"
                className="flex-1 bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-muted-foreground/40"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="text-muted-foreground/50 transition-colors hover:text-muted-foreground"
              >
                {showPw ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Remember me */}
          <label className="flex cursor-pointer items-center gap-2.5 pt-0.5">
            <div className="relative">
              <input type="checkbox" className="peer sr-only" />
              <div className="flex size-4 items-center justify-center rounded border border-border bg-white transition-all peer-checked:border-primary peer-checked:bg-primary">
                <svg className="hidden peer-checked:block" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </div>
            <span className="text-[12.5px] text-muted-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Manter conectado por 7 dias
            </span>
          </label>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-600" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit || loading}
            className={cn(
              "relative mt-1 flex h-[46px] w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl text-[13.5px] font-semibold text-white transition-all duration-200",
              canSubmit && !loading ? "hover:brightness-105 active:scale-[0.985]" : "cursor-not-allowed opacity-50",
            )}
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              background: canSubmit
                ? "linear-gradient(135deg, hsl(187 84% 26%) 0%, hsl(194 78% 32%) 100%)"
                : "hsl(187 84% 30%)",
              boxShadow: canSubmit && !loading ? "0 2px 20px hsl(187 84% 30% / 0.4), inset 0 1px 0 hsl(187 84% 50% / 0.2)" : "none",
            }}
          >
            {loading ? (
              <>
                <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Entrando…
              </>
            ) : (
              <>
                Entrar na plataforma
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="my-7 flex items-center gap-3">
          <div className="flex-1 border-t border-border" />
          <span className="text-[11px] text-muted-foreground/50" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            ou continue com
          </span>
          <div className="flex-1 border-t border-border" />
        </div>

        {/* SSO */}
        <button
          type="button"
          className="flex h-[44px] w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-white text-[13px] font-medium text-foreground/80 transition-all hover:bg-muted/40 hover:text-foreground active:scale-[0.985]"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continuar com Google
        </button>

        {/* Footer */}
        <p className="mt-8 text-center text-[11.5px] text-muted-foreground/45" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Ao entrar, você concorda com os{" "}
          <button className="underline underline-offset-2 transition-colors hover:text-muted-foreground">Termos de Uso</button>
          {" "}e a{" "}
          <button className="underline underline-offset-2 transition-colors hover:text-muted-foreground">Política de Privacidade</button>.
        </p>
      </div>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function Login() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <main className="flex min-h-screen overflow-hidden" style={{ background: "hsl(0 0% 99%)" }}>
        <LeftPanel />
        <RightPanel />
      </main>
    </>
  )
}
