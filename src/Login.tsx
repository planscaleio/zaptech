import { useState, useEffect, useRef } from "react"
import { consumeSessionExpiredNotice, storeAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"

// ─── Noise texture SVG (grain overlay) ───────────────────────────────────────

const NOISE_SVG = `data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E`

// ─── Illustration ─────────────────────────────────────────────────────────────

function DashboardIllustration() {
  return (
    <svg viewBox="0 0 420 320" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4ade80" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#4ade80" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="centerGlow" cx="50%" cy="45%" r="50%">
          <stop offset="0%" stopColor="#16c7cf" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#16c7cf" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="bottomGlow" cx="20%" cy="90%" r="40%">
          <stop offset="0%" stopColor="#4ade80" stopOpacity="0.09" />
          <stop offset="100%" stopColor="#4ade80" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="personL" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1cc8d0" />
          <stop offset="100%" stopColor="#0a8a92" />
        </linearGradient>
        <linearGradient id="personR" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#0d7680" />
        </linearGradient>
        <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#000" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* ── Glow halos ─────────────────────────────────────────────────── */}
      <ellipse cx="210" cy="148" rx="185" ry="135" fill="url(#centerGlow)" />
      <ellipse cx="80"  cy="310" rx="130" ry="90"  fill="url(#bottomGlow)" />

      {/* ── Dashboard card ─────────────────────────────────────────────── */}
      <rect x="78" y="14" width="264" height="195" rx="18" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.09)" strokeWidth="1" filter="url(#softShadow)" />

      {/* Card header */}
      <rect x="78"  y="14" width="264" height="36" rx="18" fill="rgba(255,255,255,0.05)" />
      <rect x="78"  y="32" width="264" height="18" fill="rgba(255,255,255,0.05)" />
      <circle cx="97"  cy="32" r="4.5" fill="#ef4444" fillOpacity="0.65" />
      <circle cx="112" cy="32" r="4.5" fill="#f59e0b" fillOpacity="0.65" />
      <circle cx="127" cy="32" r="4.5" fill="#22c55e" fillOpacity="0.65" />
      <text x="155" y="37" fontFamily="system-ui,sans-serif" fontSize="9.5" fill="rgba(255,255,255,0.35)" letterSpacing="0.3">Receita Mensal (MRR)</text>
      {/* Live dot */}
      <circle cx="321" cy="32" r="3.5" fill="#4ade80" />
      <circle cx="321" cy="32" r="6" fill="#4ade80" fillOpacity="0.25" />
      <text x="328" y="36" fontFamily="system-ui,sans-serif" fontSize="8" fill="rgba(255,255,255,0.3)">LIVE</text>

      {/* Grid lines inside chart */}
      <line x1="88" y1="162" x2="332" y2="162" stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="3,5" />
      <line x1="88" y1="140" x2="332" y2="140" stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="3,5" />
      <line x1="88" y1="118" x2="332" y2="118" stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="3,5" />
      <line x1="88" y1="96"  x2="332" y2="96"  stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="3,5" />

      {/* Y-axis labels */}
      <text x="88" y="164" fontFamily="system-ui,sans-serif" fontSize="7.5" fill="rgba(255,255,255,0.18)">0</text>
      <text x="82" y="141" fontFamily="system-ui,sans-serif" fontSize="7.5" fill="rgba(255,255,255,0.18)">30k</text>
      <text x="82" y="119" fontFamily="system-ui,sans-serif" fontSize="7.5" fill="rgba(255,255,255,0.18)">60k</text>
      <text x="82" y="97"  fontFamily="system-ui,sans-serif" fontSize="7.5" fill="rgba(255,255,255,0.18)">90k</text>

      {/* Chart area fill */}
      <path d="M100,162 L135,152 L168,156 L200,135 L232,110 L268,80 L332,50 L332,162 Z" fill="url(#areaGrad)" />

      {/* Chart line */}
      <polyline points="100,162 135,152 168,156 200,135 232,110 268,80 332,50"
        stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Chart dots */}
      <circle cx="135" cy="152" r="3"   fill="#4ade80" />
      <circle cx="200" cy="135" r="3"   fill="#4ade80" />
      <circle cx="268" cy="80"  r="3"   fill="#4ade80" />
      <circle cx="332" cy="50"  r="7"   fill="#4ade80" fillOpacity="0.2" />
      <circle cx="332" cy="50"  r="3.5" fill="#4ade80" />

      {/* Value callout at peak */}
      <rect x="296" y="32" width="50" height="16" rx="6" fill="rgba(74,222,128,0.18)" stroke="rgba(74,222,128,0.32)" strokeWidth="1" />
      <text x="321" y="43.5" fontFamily="system-ui,sans-serif" fontSize="9" fontWeight="700" fill="#4ade80" textAnchor="middle">R$94k</text>

      {/* Bottom stat row */}
      {/* Stat 1 */}
      <rect x="88"  y="171" width="74" height="30" rx="8" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
      <text x="125" y="183" fontFamily="system-ui,sans-serif" fontSize="8" fill="rgba(255,255,255,0.3)" textAnchor="middle">Conversão</text>
      <text x="125" y="195" fontFamily="system-ui,sans-serif" fontSize="10" fontWeight="700" fill="#4ade80" textAnchor="middle">+38%</text>
      {/* Stat 2 */}
      <rect x="173" y="171" width="74" height="30" rx="8" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
      <text x="210" y="183" fontFamily="system-ui,sans-serif" fontSize="8" fill="rgba(255,255,255,0.3)" textAnchor="middle">Resp. Média</text>
      <text x="210" y="195" fontFamily="system-ui,sans-serif" fontSize="10" fontWeight="700" fill="#1cc8d0" textAnchor="middle">{"< 8s"}</text>
      {/* Stat 3 */}
      <rect x="258" y="171" width="74" height="30" rx="8" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
      <text x="295" y="183" fontFamily="system-ui,sans-serif" fontSize="8" fill="rgba(255,255,255,0.3)" textAnchor="middle">Uptime</text>
      <text x="295" y="195" fontFamily="system-ui,sans-serif" fontSize="10" fontWeight="700" fill="#a78bfa" textAnchor="middle">99.9%</text>

      {/* ── Floating metric badge — left ────────────────────────────────── */}
      <rect x="2" y="70" width="72" height="40" rx="11" fill="rgba(74,222,128,0.10)" stroke="rgba(74,222,128,0.22)" strokeWidth="1" />
      <text x="15" y="87" fontFamily="system-ui,sans-serif" fontSize="8" fill="rgba(74,222,128,0.6)">▲ Receita</text>
      <text x="15" y="101" fontFamily="system-ui,sans-serif" fontSize="12" fontWeight="800" fill="#4ade80">+R$94k</text>

      {/* ── Floating metric badge — right ───────────────────────────────── */}
      <rect x="346" y="90" width="72" height="40" rx="11" fill="rgba(22,199,207,0.10)" stroke="rgba(22,199,207,0.22)" strokeWidth="1" />
      <text x="357" y="107" fontFamily="system-ui,sans-serif" fontSize="8" fill="rgba(22,199,207,0.6)">▲ Leads</text>
      <text x="357" y="121" fontFamily="system-ui,sans-serif" fontSize="12" fontWeight="800" fill="#1cc8d0">3.8×</text>

      {/* ── Left person (at laptop) ──────────────────────────────────────── */}
      {/* Laptop base */}
      <rect x="16" y="285" width="66" height="5"  rx="3" fill="rgba(255,255,255,0.08)" />
      <rect x="22" y="256" width="56" height="36" rx="8" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
      {/* Laptop screen content */}
      <rect x="26" y="260" width="48" height="26" rx="5" fill="rgba(22,199,207,0.14)" />
      <line x1="29" y1="270" x2="70" y2="270" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <line x1="29" y1="278" x2="60" y2="278" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
      {/* Body */}
      <rect x="34" y="233" width="32" height="28" rx="10" fill="url(#personL)" />
      {/* Head */}
      <circle cx="50" cy="222" r="16" fill="url(#personL)" />
      {/* Face */}
      <circle cx="44" cy="219" r="2"  fill="white" fillOpacity="0.9" />
      <circle cx="56" cy="219" r="2"  fill="white" fillOpacity="0.9" />
      <path d="M44,226 Q50,231 56,226" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none" />

      {/* Chat bubble from left person */}
      <rect x="68" y="204" width="100" height="28" rx="10" fill="rgba(22,199,207,0.14)" stroke="rgba(22,199,207,0.28)" strokeWidth="1" />
      {/* Bubble tail */}
      <path d="M74,232 L64,242 L84,232" fill="rgba(22,199,207,0.14)" stroke="rgba(22,199,207,0.28)" strokeWidth="1" />
      <text x="118" y="214" fontFamily="system-ui,sans-serif" fontSize="8" fill="rgba(255,255,255,0.55)" textAnchor="middle">Fechei o negócio!</text>
      <text x="118" y="226" fontFamily="system-ui,sans-serif" fontSize="10" fill="white" textAnchor="middle">🎉 +R$ 12.400</text>

      {/* Dashed connector to dashboard */}
      <line x1="84" y1="225" x2="88" y2="185" stroke="rgba(22,199,207,0.18)" strokeWidth="1" strokeDasharray="4,4" />

      {/* ── Right person (with phone) ────────────────────────────────────── */}
      {/* Body */}
      <rect x="356" y="233" width="32" height="28" rx="10" fill="url(#personR)" />
      {/* Head */}
      <circle cx="372" cy="222" r="16" fill="url(#personR)" />
      {/* Face */}
      <circle cx="366" cy="219" r="2"  fill="white" fillOpacity="0.9" />
      <circle cx="378" cy="219" r="2"  fill="white" fillOpacity="0.9" />
      <path d="M366,226 Q372,231 378,226" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      {/* Phone */}
      <rect x="382" y="235" width="18" height="30" rx="5" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
      <rect x="384" y="238" width="14" height="20" rx="3" fill="rgba(45,212,191,0.2)" />

      {/* Chat bubble from right person */}
      <rect x="252" y="216" width="100" height="28" rx="10" fill="rgba(74,222,128,0.12)" stroke="rgba(74,222,128,0.26)" strokeWidth="1" />
      <path d="M348,244 L360,254 L340,244" fill="rgba(74,222,128,0.12)" stroke="rgba(74,222,128,0.26)" strokeWidth="1" />
      <text x="302" y="226" fontFamily="system-ui,sans-serif" fontSize="8" fill="rgba(255,255,255,0.55)" textAnchor="middle">Atendimento top!</text>
      <text x="302" y="238" fontFamily="system-ui,sans-serif" fontSize="10" fill="white" textAnchor="middle">⭐ Nota 10 dada</text>

      {/* Dashed connector to dashboard */}
      <line x1="336" y1="225" x2="332" y2="195" stroke="rgba(74,222,128,0.18)" strokeWidth="1" strokeDasharray="4,4" />

      {/* ── Third person in background (center bottom) ───────────────────── */}
      <circle cx="210" cy="283" r="12" fill="rgba(167,139,250,0.5)" />
      <circle cx="205" cy="280" r="1.5" fill="white" fillOpacity="0.8" />
      <circle cx="215" cy="280" r="1.5" fill="white" fillOpacity="0.8" />
      <path d="M205,285 Q210,289 215,285" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <rect x="200" y="295" width="20" height="16" rx="5" fill="rgba(167,139,250,0.4)" />
      {/* Small chat from center person */}
      <rect x="220" y="272" width="72" height="20" rx="8" fill="rgba(167,139,250,0.15)" stroke="rgba(167,139,250,0.25)" strokeWidth="1" />
      <text x="256" y="280" fontFamily="system-ui,sans-serif" fontSize="7.5" fill="rgba(255,255,255,0.5)" textAnchor="middle">Quero comprar!</text>
      <text x="256" y="288" fontFamily="system-ui,sans-serif" fontSize="8" fill="rgba(255,255,255,0.65)" textAnchor="middle">🛒 Pedido #4821</text>

      {/* ── Upward arrows (growth feel) ──────────────────────────────────── */}
      {/* Arrow left floating */}
      <path d="M12,60 L12,40 M12,40 L8,48 M12,40 L16,48" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fillOpacity="0.7" />
      {/* Arrow right floating */}
      <path d="M408,80 L408,60 M408,60 L404,68 M408,60 L412,68" stroke="#1cc8d0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fillOpacity="0.7" />

      {/* ── Sparkles ─────────────────────────────────────────────────────── */}
      {/* Top right sparkle */}
      <path d="M354,12 L356,6 L358,12 L364,14 L358,16 L356,22 L354,16 L348,14 Z" fill="#1cc8d0" fillOpacity="0.55" />
      {/* Bottom left sparkle */}
      <path d="M28,228 L29.5,223 L31,228 L36,229.5 L31,231 L29.5,236 L28,231 L23,229.5 Z" fill="#4ade80" fillOpacity="0.45" />
      {/* Small sparkle center-top */}
      <path d="M210,6 L211,2 L212,6 L216,7 L212,8 L211,12 L210,8 L206,7 Z" fill="#a78bfa" fillOpacity="0.45" />

      {/* ── Scattered small dots ─────────────────────────────────────────── */}
      <circle cx="348" cy="175" r="2"   fill="#1cc8d0" fillOpacity="0.25" />
      <circle cx="70"  cy="150" r="2"   fill="#4ade80" fillOpacity="0.25" />
      <circle cx="158" cy="245" r="1.5" fill="#1cc8d0" fillOpacity="0.2" />
      <circle cx="265" cy="255" r="1.5" fill="#4ade80" fillOpacity="0.2" />
      <circle cx="390" cy="165" r="1.5" fill="white"   fillOpacity="0.1" />
      <circle cx="22"  cy="190" r="1.5" fill="white"   fillOpacity="0.1" />
      <circle cx="160" cy="10"  r="1.5" fill="#a78bfa"  fillOpacity="0.3" />
      <circle cx="380" cy="50"  r="1.5" fill="#4ade80"  fillOpacity="0.3" />
    </svg>
  )
}

// ─── Left panel ───────────────────────────────────────────────────────────────

function LeftPanel() {
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

      {/* Headline above illustration */}
      <div className="relative z-10 px-10 pt-7 pb-2">
        <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1" style={{ borderColor: "hsl(187 84% 40% / 0.25)", background: "hsl(187 84% 30% / 0.1)" }}>
          <span className="size-1.5 rounded-full" style={{ background: "hsl(187 84% 55%)", boxShadow: "0 0 5px hsl(187 84% 55%)" }} />
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/45" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Plataforma IA · Vendas
          </span>
        </div>
        <h1 className="text-[2rem] font-bold leading-[1.15] text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, letterSpacing: "-0.03em" }}>
          Venda mais.<br />
          <span style={{ color: "hsl(187 84% 52%)" }}>Automatize com IA.</span>
        </h1>
      </div>

      {/* Illustration */}
      <div className="relative z-10 flex-1 px-6">
        <DashboardIllustration />
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
  const [error, setError] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("expired") === "1" || consumeSessionExpiredNotice()) return "Sua sessão expirou. Entre novamente para continuar."
    if (params.get("invalid") === "1") return "Não foi possível validar sua sessão. Entre novamente."
    return ""
  })
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
      storeAuth(data.token, data.user)
      const next = new URLSearchParams(window.location.search).get("next")
      const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/atendimento"
      window.location.href = data.user.type === "admin" ? "/admin" : safeNext
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

        {/* Google SSO — disabled with fun badge */}
        <div className="relative">
          <button
            type="button"
            disabled
            className="flex h-[44px] w-full cursor-not-allowed items-center justify-center gap-2.5 rounded-xl border border-border bg-white text-[13px] font-medium text-foreground/30 opacity-60 select-none"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="opacity-40">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuar com Google
          </button>

          {/* Fun "coming soon" badge */}
          <div
            className="pointer-events-none absolute -top-3 -right-2 flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-bold shadow-md"
            style={{
              background: "linear-gradient(135deg, #f59e0b, #fbbf24)",
              color: "#78350f",
              transform: "rotate(6deg)",
              boxShadow: "0 2px 8px rgba(245,158,11,0.35)",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            🛠️ A gente tá nisso...
          </div>
        </div>

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
