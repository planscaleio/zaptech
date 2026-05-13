import { Link, Navigate } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { LandingNav, LandingFooter } from "./shared"

/* ── Tiny helpers ─────────────────────────────────────────── */
const GF = { fontFamily: "'Geist', ui-sans-serif, system-ui, sans-serif" } as const

function Section({ children, className = "", dark = false }: {
  children: React.ReactNode
  className?: string
  dark?: boolean
}) {
  return (
    <section
      style={GF}
      className={`py-16 md:py-24 ${dark ? "bg-[var(--lk-black)] text-white" : ""} ${className}`}
    >
      {children}
    </section>
  )
}

const W = "mx-auto w-full max-w-[1100px] px-5 md:px-8"

/* ── Ticker logos ─────────────────────────────────────────── */
const LOGOS = [
  "Alpha Vendas", "Beta Soluções", "Gamma Tech", "Delta Corp",
  "Epsilon Group", "Zeta Commerce", "Eta Digital", "Theta PME",
]

function LogoTicker() {
  const items = [...LOGOS, ...LOGOS]
  return (
    <div className="overflow-hidden border-y border-[var(--lk-line)]">
      <div className="lk-ticker-track flex w-max">
        {items.map((name, i) => (
          <span
            key={i}
            className="mx-8 flex shrink-0 items-center py-5 text-[13px] font-medium text-[var(--lk-ink-3)]"
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ── Feature cards ────────────────────────────────────────── */
const FEATURES = [
  {
    n: "01",
    title: "Agentes de IA",
    desc: "Quatro agentes especializados — Triagem, Qualificador, Vendas e Suporte — operam 24h respondendo, qualificando e avançando seu pipeline sem intervenção humana.",
    tag: "4 agentes ativos",
  },
  {
    n: "02",
    title: "CRM & Pipeline Visual",
    desc: "Board Kanban drag-and-drop com etapas personalizadas, score de lead por IA, histórico de conversas e alertas de inatividade para nenhuma oportunidade escapar.",
    tag: "Pipeline drag & drop",
  },
  {
    n: "03",
    title: "Suporte Inteligente",
    desc: "Chamados com SLA automático, base de conhecimento que a IA usa para responder dúvidas frequentes e histórico completo de atendimento e transferências.",
    tag: "SLA + base de conhecimento",
  },
  {
    n: "04",
    title: "Omnichannel Unificado",
    desc: "WhatsApp, E-mail e Chat em uma única caixa de entrada. Histórico unificado por cliente, sem alternar entre ferramentas ou perder contexto.",
    tag: "WhatsApp · E-mail · Chat",
  },
  {
    n: "05",
    title: "Automações & Workflows",
    desc: "Regras de distribuição, ROPs visuais e campanhas de disparo — tudo configurável sem escrever código. Gatilhos por evento, horário ou condição de lead.",
    tag: "Sem código",
  },
  {
    n: "06",
    title: "Relatórios & IA",
    desc: "Score de lead, análise de sentimento, auditoria de conversas e dashboards em tempo real. Identifique oportunidades perdidas antes que o concorrente chegue.",
    tag: "Insights em tempo real",
  },
]

/* ── Main page ────────────────────────────────────────────── */
export default function LandingPage() {
  const auth = useAuth()
  if (auth) return <Navigate to="/atendimento" replace />

  return (
    <div style={GF} className="min-h-screen bg-[var(--lk-bg-0)] text-[var(--lk-ink-0)] antialiased">
      <LandingNav />

      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <section style={GF} className="relative overflow-hidden pt-10 pb-20 md:pt-16 md:pb-28 lg:pt-20 lg:pb-32">
        <div className={W}>
          <div className="flex flex-col items-center text-center">
            {/* Badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--lk-line-2)] bg-[var(--lk-bg-1)] px-4 py-1.5">
              <span className="size-1.5 rounded-full bg-[var(--cobalt)]" />
              <span className="text-[12.5px] font-medium text-[var(--lk-ink-1)]">
                Omnichannel · IA · WhatsApp · E-mail
              </span>
            </div>

            {/* Headline */}
            <h1
              className="m-0 mb-5 max-w-[700px] text-[32px] font-medium leading-[1.1] tracking-[-0.028em] text-[var(--lk-ink-0)] sm:text-[42px] md:text-[50px] lg:text-[58px]"
              style={{ textWrap: "balance" } as React.CSSProperties}
            >
              O sistema operacional de IA para as suas{" "}
              <span className="oval-wrap">vendas</span>
            </h1>

            {/* Subtitle */}
            <p
              className="mb-8 max-w-[520px] text-[15px] leading-[1.65] text-[var(--lk-ink-2)] md:text-[17px]"
              style={{ textWrap: "balance" } as React.CSSProperties}
            >
              Agentes de IA que triagem, qualificam e fecham negócios no WhatsApp, e-mail e chat — enquanto seu time foca no que importa.
            </p>

            {/* CTAs */}
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <Link
                to="/login"
                className="rounded-lg bg-[var(--cobalt)] px-6 py-3 text-[14px] font-medium text-white transition-all hover:bg-[var(--sapphire)]"
              >
                Começar grátis
              </Link>
              <Link
                to="/para-vendas"
                className="rounded-lg border border-[var(--lk-line-2)] bg-[var(--lk-bg-0)] px-6 py-3 text-[14px] font-medium text-[var(--lk-ink-1)] transition-all hover:border-[var(--lk-line-2)] hover:bg-[var(--lk-bg-2)]"
              >
                Ver planos por perfil →
              </Link>
            </div>

            {/* Hero interface mock */}
            <div className="relative mt-14 w-full max-w-[860px]">
              {/* Window chrome */}
              <div className="overflow-hidden rounded-2xl border border-[var(--lk-line)] shadow-[0_32px_80px_-20px_rgba(11,11,15,0.18)]">
                {/* Title bar */}
                <div className="flex items-center gap-2 border-b border-[var(--lk-line)] bg-[var(--lk-bg-1)] px-4 py-3">
                  <span className="size-3 rounded-full bg-[#ff605c]" />
                  <span className="size-3 rounded-full bg-[#ffbd44]" />
                  <span className="size-3 rounded-full bg-[#00ca4e]" />
                  <div className="mx-auto h-5 w-48 rounded-full bg-[var(--lk-bg-2)]" />
                </div>

                {/* App layout mock */}
                <div className="flex bg-[var(--lk-bg-0)]" style={{ height: "300px" }}>
                  {/* Sidebar */}
                  <div className="hidden w-44 shrink-0 flex-col gap-0.5 border-r border-[var(--lk-line)] bg-[var(--lk-bg-1)] p-2 md:flex">
                    {["Atendimento", "CRM & Pipeline", "Suporte", "Agentes", "Automações"].map((item, i) => (
                      <div
                        key={item}
                        className="flex items-center gap-2 rounded-md px-2.5 py-2 text-[11px] font-medium"
                        style={{
                          background: i === 0 ? "var(--cobalt)" : "transparent",
                          color: i === 0 ? "#fff" : "var(--lk-ink-3)",
                        }}
                      >
                        <span className="size-1.5 rounded-full" style={{ background: i === 0 ? "#fff" : "var(--lk-ink-3)", opacity: 0.7 }} />
                        {item}
                      </div>
                    ))}
                  </div>

                  {/* Main area */}
                  <div className="flex flex-1 flex-col gap-2.5 overflow-hidden p-3">
                    {/* Header bar */}
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-32 rounded-md bg-[var(--lk-bg-2)]" />
                      <div className="ml-auto h-6 w-20 rounded-md bg-[var(--cobalt)] opacity-20" />
                    </div>
                    {/* Conversation cards */}
                    {[
                      { name: "Lucas Ferreira",  msg: "Agente: Lead qualificado · Score 87",  badge: "QUENTE",   bc: "#fef2f2", tc: "#dc2626" },
                      { name: "Ana Souza",        msg: "Orçamento enviado · Aguardando aceite", badge: "PROPOSTA", bc: "#f0fdf4", tc: "#16a34a" },
                      { name: "Marcos Oliveira",  msg: "Triagem concluída · Encaminhado",       badge: "TRIAGEM",  bc: "#eff6ff", tc: "#2563eb" },
                      { name: "Carla Santos",     msg: "SLA: No prazo · Chamado SUP-0043",       badge: "SUPORTE",  bc: "#fafafa", tc: "#71717a" },
                    ].map((c) => (
                      <div
                        key={c.name}
                        className="flex items-center gap-2.5 rounded-lg border border-[var(--lk-line)] bg-[var(--lk-bg-0)] px-3 py-2.5"
                      >
                        <div
                          className="flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                          style={{ background: "var(--cobalt)" }}
                        >
                          {c.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold text-[var(--lk-ink-0)]">{c.name}</p>
                          <p className="truncate text-[10px] text-[var(--lk-ink-3)]">{c.msg}</p>
                        </div>
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                          style={{ background: c.bc, color: c.tc }}
                        >
                          {c.badge}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Right metric panel */}
                  <div className="hidden w-40 shrink-0 flex-col gap-2 border-l border-[var(--lk-line)] p-3 lg:flex">
                    {[
                      { label: "Leads hoje",   value: "+47", color: "#16a34a" },
                      { label: "SLA OK",       value: "94%", color: "var(--cobalt)" },
                      { label: "Em aberto",    value: "12",  color: "var(--lk-ink-1)" },
                    ].map((m) => (
                      <div key={m.label} className="rounded-lg border border-[var(--lk-line)] bg-[var(--lk-bg-1)] p-2.5">
                        <p className="text-[10px] text-[var(--lk-ink-3)]">{m.label}</p>
                        <p className="mt-0.5 text-[18px] font-bold" style={{ color: m.color }}>{m.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TICKER ────────────────────────────────────────────────────── */}
      <div style={GF}>
        <p className={`${W} mb-4 text-center text-[11.5px] font-medium uppercase tracking-[0.12em] text-[var(--lk-ink-3)]`}>
          Operação ativa em dezenas de empresas
        </p>
        <LogoTicker />
      </div>

      {/* ── AUDIENCE CARDS ────────────────────────────────────────────── */}
      <Section className="bg-[var(--lk-bg-1)] border-b border-[var(--lk-line)]">
        <div className={W}>
          <div className="mb-12 text-center">
            <h2
              className="text-[26px] font-medium leading-[1.1] tracking-[-0.026em] text-[var(--lk-ink-0)] md:text-[34px]"
              style={{ textWrap: "balance" } as React.CSSProperties}
            >
              Feito para o seu <span className="grad-text">momento</span>
            </h2>
            <p className="mt-3 text-[14.5px] text-[var(--lk-ink-2)]">
              Escolha a solução que melhor se encaixa na sua operação.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {[
              {
                href: "/para-vendas",
                label: "Para Times de Vendas",
                desc: "CRM, pipeline visual, qualificação de leads por IA, orçamentos automáticos e agentes de vendas ativos 24h.",
                tags: ["CRM", "Pipeline", "Lead Scoring", "Orçamentos"],
                accent: "#2962ff",
                accentBg: "rgba(22,163,74,0.06)",
                accentBorder: "rgba(22,163,74,0.18)",
              },
              {
                href: "/pme",
                label: "Para Pequenas Empresas",
                desc: "Triagem automática, chamados organizados com SLA e base de conhecimento — pronto em minutos, sem equipe técnica.",
                tags: ["Triagem IA", "Suporte", "WhatsApp", "Fácil setup"],
                accent: "#4fbcf5",
                accentBg: "rgba(79,188,245,0.06)",
                accentBorder: "rgba(79,188,245,0.22)",
              },
            ].map((card) => (
              <Link
                key={card.href}
                to={card.href}
                className="group flex flex-col gap-5 rounded-2xl border p-7 transition-all hover:shadow-[0_8px_32px_-8px_rgba(22,163,74,0.14)]"
                style={{
                  background: card.accentBg,
                  borderColor: card.accentBorder,
                }}
              >
                <div>
                  <p className="text-[17px] font-semibold tracking-[-0.018em] text-[var(--lk-ink-0)]">
                    {card.label}
                  </p>
                  <p className="mt-2 text-[13.5px] leading-[1.65] text-[var(--lk-ink-2)]">
                    {card.desc}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {card.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border px-2.5 py-1 text-[11.5px] font-medium"
                      style={{ borderColor: card.accentBorder, color: card.accent }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <span
                  className="text-[13.5px] font-medium transition-all group-hover:translate-x-0.5"
                  style={{ color: card.accent }}
                >
                  Ver solução →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </Section>

      {/* ── FEATURES ──────────────────────────────────────────────────── */}
      <Section>
        <div className={W}>
          <div className="mb-12 text-center">
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--lk-ink-3)]">
              Funcionalidades
            </p>
            <h2
              className="text-[26px] font-medium leading-[1.1] tracking-[-0.026em] text-[var(--lk-ink-0)] md:text-[34px]"
              style={{ textWrap: "balance" } as React.CSSProperties}
            >
              Tudo que sua operação <span className="grad-text">precisa</span>
            </h2>
            <p className="mt-3 text-[14.5px] text-[var(--lk-ink-2)]">
              Seis módulos integrados em uma plataforma — sem integrações complexas.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.n}
                className="group flex flex-col gap-4 rounded-2xl border border-[var(--lk-line)] bg-[var(--lk-bg-0)] p-6 transition-shadow hover:shadow-[0_8px_32px_-8px_rgba(11,11,15,0.10)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[11.5px] font-semibold text-[var(--lk-ink-3)]">{f.n}/06</span>
                  <span className="rounded-full border border-[var(--lk-line-2)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--lk-ink-2)]">
                    {f.tag}
                  </span>
                </div>
                <div>
                  <p className="text-[15.5px] font-semibold tracking-[-0.015em] text-[var(--lk-ink-0)]">{f.title}</p>
                  <p className="mt-2 text-[13px] leading-[1.7] text-[var(--lk-ink-2)]">{f.desc}</p>
                </div>
                <div className="mt-auto">
                  <Link
                    to="/para-vendas"
                    className="text-[13px] font-medium text-[var(--cobalt)] transition-all group-hover:underline"
                  >
                    Saiba mais →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── METRICS BAR ───────────────────────────────────────────────── */}
      <div style={GF} className="border-y border-[var(--lk-line)] bg-[var(--lk-bg-1)] py-12">
        <div className={`${W} grid grid-cols-1 gap-8 sm:grid-cols-3`}>
          {[
            { value: "4",    label: "Agentes de IA especializados" },
            { value: "3+",   label: "Canais: WhatsApp, E-mail, Chat" },
            { value: "24h",  label: "Operação automática ininterrupta" },
          ].map((m) => (
            <div key={m.label} className="text-center">
              <p className="text-[40px] font-semibold leading-none tracking-[-0.04em] text-[var(--lk-ink-0)]">
                {m.value}
              </p>
              <p className="mt-2 text-[13.5px] text-[var(--lk-ink-2)]">{m.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────── */}
      <Section className="bg-[var(--lk-bg-1)] border-b border-[var(--lk-line)]">
        <div className={W}>
          <div className="mb-12 text-center">
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--lk-ink-3)]">
              Como funciona
            </p>
            <h2
              className="text-[26px] font-medium leading-[1.1] tracking-[-0.026em] text-[var(--lk-ink-0)] md:text-[34px]"
              style={{ textWrap: "balance" } as React.CSSProperties}
            >
              Três passos para operar <span className="grad-text">com IA</span>
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                n: "01",
                title: "Conecte seus canais",
                desc: "WhatsApp, e-mail e chat sincronizados em minutos. Sem configurações técnicas.",
              },
              {
                n: "02",
                title: "Agentes entram em ação",
                desc: "A IA triagem, qualifica leads e abre oportunidades no pipeline automaticamente.",
              },
              {
                n: "03",
                title: "Sua equipe fecha negócios",
                desc: "Atendentes recebem o contexto completo e focam em relacionamento e fechamento.",
              },
            ].map((s) => (
              <div key={s.n} className="flex flex-col gap-4 rounded-2xl border border-[var(--lk-line)] bg-[var(--lk-bg-0)] p-6">
                <span className="text-[13px] font-semibold" style={{ color: "var(--cobalt)" }}>{s.n}</span>
                <div>
                  <p className="text-[15.5px] font-semibold tracking-[-0.015em] text-[var(--lk-ink-0)]">{s.title}</p>
                  <p className="mt-2 text-[13px] leading-[1.7] text-[var(--lk-ink-2)]">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── DARK CTA ──────────────────────────────────────────────────── */}
      <section
        style={GF}
        className="relative overflow-hidden bg-[var(--lk-black)] py-20 md:py-28"
      >
        {/* Gradient glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 60% 50% at 50% 100%, rgba(22,163,74,0.18) 0%, transparent 70%)",
          }}
        />
        <div className={`${W} relative text-center`}>
          <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--lk-ink-3)]">
            Comece hoje
          </p>
          <h2
            className="mx-auto mb-5 max-w-[560px] text-[28px] font-medium leading-[1.1] tracking-[-0.028em] text-white md:text-[40px]"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            Pronto para operar com <span className="grad-text">IA</span>?
          </h2>
          <p className="mx-auto mb-8 max-w-[380px] text-[14.5px] leading-[1.65] text-[var(--lk-ink-2)]">
            Configure em minutos. Seus agentes entram em operação imediatamente — sem equipe técnica.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/login"
              className="rounded-lg bg-[var(--cobalt)] px-7 py-3 text-[14px] font-medium text-white transition-all hover:bg-[var(--sapphire)]"
            >
              Criar conta grátis
            </Link>
            <Link
              to="/para-vendas"
              className="rounded-lg border border-[rgba(255,255,255,0.12)] px-7 py-3 text-[14px] font-medium text-[var(--lk-ink-2)] transition-all hover:border-[rgba(255,255,255,0.25)] hover:text-white"
            >
              Ver planos por perfil
            </Link>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  )
}
