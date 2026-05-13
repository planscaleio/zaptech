import { Link } from "react-router-dom"
import { LandingNav, LandingFooter } from "./shared"

const GF = { fontFamily: "'Geist', ui-sans-serif, system-ui, sans-serif" } as const
const W  = "mx-auto w-full max-w-[1100px] px-5 md:px-8"

const FEATURES = [
  {
    n: "01",
    title: "Triagem Automática 24h",
    desc: "O Agente de Triagem recebe, responde e categoriza cada mensagem — mesmo fora do horário comercial. Nenhum cliente fica sem resposta, nunca.",
    tag: "Resposta imediata",
  },
  {
    n: "02",
    title: "Chamados com SLA",
    desc: "Organize solicitações em chamados rastreáveis com prazo de resolução automático. Saiba exatamente o que está pendente, em risco ou vencido.",
    tag: "SLA automático",
  },
  {
    n: "03",
    title: "Base de Conhecimento",
    desc: "Monte uma biblioteca de respostas e a IA usa automaticamente para resolver dúvidas frequentes — sem precisar de atendente para cada mensagem.",
    tag: "Respostas automáticas",
  },
  {
    n: "04",
    title: "Multi-canal Unificado",
    desc: "WhatsApp e e-mail em uma única caixa de entrada. Histórico por cliente, contexto sempre disponível, acesso pelo celular ou computador.",
    tag: "WhatsApp + E-mail",
  },
]

const STEPS = [
  {
    n: "01",
    title: "Conecte seu WhatsApp",
    desc: "Sincronize seu número em menos de 5 minutos. Sem desenvolvedor, sem código.",
  },
  {
    n: "02",
    title: "Configure os agentes",
    desc: "Ative a triagem automática e adicione respostas à base de conhecimento.",
  },
  {
    n: "03",
    title: "Atenda com profissionalismo",
    desc: "Clientes recebem respostas rápidas. Você tem controle total dos chamados.",
  },
]

export default function LandingPME() {
  return (
    <div style={GF} className="min-h-screen bg-[var(--lk-bg-0)] text-[var(--lk-ink-0)] antialiased">
      <LandingNav />

      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <section style={GF} className="relative overflow-hidden pt-10 pb-20 md:pt-16 md:pb-28">
        <div
          className="pointer-events-none absolute -left-40 -top-40 size-[500px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(79,188,245,0.08) 0%, transparent 70%)" }}
        />
        <div className={W}>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--lk-line-2)] bg-[var(--lk-bg-1)] px-4 py-1.5">
            <span className="size-1.5 rounded-full bg-[var(--aqua)]" />
            <span className="text-[12.5px] font-medium text-[var(--lk-ink-1)]">Para Pequenas Empresas</span>
          </div>

          <div className="grid items-center gap-14 md:grid-cols-2">
            <div>
              <h1
                className="mb-5 text-[30px] font-medium leading-[1.1] tracking-[-0.028em] text-[var(--lk-ink-0)] sm:text-[38px] md:text-[46px]"
                style={{ textWrap: "balance" } as React.CSSProperties}
              >
                Atendimento{" "}
                <span className="oval-wrap">profissional</span>{" "}
                sem equipe técnica
              </h1>
              <p
                className="mb-8 text-[15px] leading-[1.65] text-[var(--lk-ink-2)] md:text-[16.5px]"
                style={{ textWrap: "balance" } as React.CSSProperties}
              >
                Triagem automática, chamados organizados e base de conhecimento — tudo pronto em minutos. Sem TI, sem código, sem complicação.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-lg bg-[var(--cobalt)] px-6 py-3 text-[14px] font-medium text-white transition-all hover:bg-[var(--sapphire)]"
                >
                  Criar conta grátis
                </Link>
                <Link
                  to="/"
                  className="inline-flex items-center justify-center rounded-lg border border-[var(--lk-line-2)] px-6 py-3 text-[14px] font-medium text-[var(--lk-ink-1)] transition-all hover:bg-[var(--lk-bg-2)]"
                >
                  Ver todas as funcionalidades
                </Link>
              </div>
              <p className="mt-4 text-[12.5px] text-[var(--lk-ink-3)]">
                ✓ Sem cartão de crédito &nbsp;·&nbsp; ✓ Setup em minutos &nbsp;·&nbsp; ✓ Suporte incluso
              </p>
            </div>

            {/* Ticket list preview */}
            <div className="hidden flex-col gap-2.5 md:flex">
              {[
                { code: "SUP-0043", title: "Problema no acesso à conta",   status: "Em atendimento", sla: "No prazo",  dot: "#16a34a" },
                { code: "SUP-0042", title: "Dúvida sobre emissão de nota",  status: "Resolvido",     sla: "No prazo",  dot: "#16a34a" },
                { code: "SUP-0041", title: "Cancelamento de pedido #1182",  status: "Triagem",       sla: "Em risco",  dot: "#d97706" },
                { code: "SUP-0040", title: "Solicitação de reembolso",      status: "Novo",          sla: "No prazo",  dot: "#16a34a" },
              ].map((t) => (
                <div
                  key={t.code}
                  className="flex items-center gap-3 rounded-xl border border-[var(--lk-line)] bg-[var(--lk-bg-0)] p-3.5"
                >
                  <div
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white"
                    style={{ background: "var(--cobalt)" }}
                  >
                    SUP
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-[var(--lk-ink-3)]">{t.code}</span>
                      <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: t.dot }}>
                        <span className="size-1.5 rounded-full" style={{ background: t.dot }} /> {t.sla}
                      </span>
                    </div>
                    <p className="truncate text-[12px] font-medium text-[var(--lk-ink-0)]">{t.title}</p>
                    <p className="text-[11px] text-[var(--lk-ink-3)]">{t.status}</p>
                  </div>
                </div>
              ))}
              <div
                className="flex items-center gap-2 rounded-xl p-3.5"
                style={{ background: "rgba(79,188,245,0.06)", border: "1px solid rgba(79,188,245,0.2)" }}
              >
                <span className="size-1.5 rounded-full bg-[var(--aqua)]" />
                <p className="text-[11.5px] font-medium" style={{ color: "var(--aqua)" }}>
                  Agente de Triagem · 18 mensagens respondidas hoje
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── METRICS STRIP ─────────────────────────────────────────────── */}
      <div style={GF} className="border-y border-[var(--lk-line)] bg-[var(--lk-bg-1)] py-10">
        <div className={`${W} grid grid-cols-1 gap-8 sm:grid-cols-3 text-center`}>
          {[
            { value: "24h",  label: "atendimento automático ininterrupto" },
            { value: "−70%", label: "tickets repetitivos com base de conhecimento" },
            { value: "5 min", label: "para configurar e começar a atender" },
          ].map((m) => (
            <div key={m.label}>
              <p className="text-[38px] font-semibold leading-none tracking-[-0.04em] text-[var(--lk-ink-0)]">
                {m.value}
              </p>
              <p className="mt-2 text-[13.5px] text-[var(--lk-ink-2)]">{m.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── STEPS ─────────────────────────────────────────────────────── */}
      <section style={GF} className="py-16 md:py-24 bg-[var(--lk-bg-1)] border-b border-[var(--lk-line)]">
        <div className={W}>
          <div className="mb-12 text-center">
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--lk-ink-3)]">
              Como funciona
            </p>
            <h2
              className="text-[26px] font-medium leading-[1.1] tracking-[-0.026em] text-[var(--lk-ink-0)] md:text-[34px]"
              style={{ textWrap: "balance" } as React.CSSProperties}
            >
              Pronto em <span className="grad-text">minutos</span>
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="flex flex-col gap-4 rounded-2xl border border-[var(--lk-line)] bg-[var(--lk-bg-0)] p-6"
              >
                <span className="text-[13px] font-semibold" style={{ color: "var(--cobalt)" }}>{s.n}</span>
                <div>
                  <p className="text-[15.5px] font-semibold tracking-[-0.015em] text-[var(--lk-ink-0)]">{s.title}</p>
                  <p className="mt-2 text-[13px] leading-[1.7] text-[var(--lk-ink-2)]">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────── */}
      <section style={GF} className="py-16 md:py-24">
        <div className={W}>
          <div className="mb-12 text-center">
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--lk-ink-3)]">
              Funcionalidades
            </p>
            <h2
              className="text-[26px] font-medium leading-[1.1] tracking-[-0.026em] text-[var(--lk-ink-0)] md:text-[34px]"
              style={{ textWrap: "balance" } as React.CSSProperties}
            >
              Tudo para atender <span className="grad-text">muito bem</span>
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div
                key={f.n}
                className="group flex flex-col gap-4 rounded-2xl border border-[var(--lk-line)] bg-[var(--lk-bg-0)] p-6 transition-shadow hover:shadow-[0_8px_32px_-8px_rgba(11,11,15,0.10)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[11.5px] font-semibold text-[var(--lk-ink-3)]">{f.n}/04</span>
                  <span className="rounded-full border border-[var(--lk-line-2)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--lk-ink-2)]">
                    {f.tag}
                  </span>
                </div>
                <div>
                  <p className="text-[15.5px] font-semibold tracking-[-0.015em] text-[var(--lk-ink-0)]">{f.title}</p>
                  <p className="mt-2 text-[13px] leading-[1.7] text-[var(--lk-ink-2)]">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DIFFERENTIALS ─────────────────────────────────────────────── */}
      <section style={GF} className="border-y border-[var(--lk-line)] bg-[var(--lk-bg-1)] py-16 md:py-20">
        <div className={W}>
          <div className="mb-10 text-center">
            <h2
              className="text-[24px] font-medium leading-[1.1] tracking-[-0.026em] text-[var(--lk-ink-0)] md:text-[32px]"
              style={{ textWrap: "balance" } as React.CSSProperties}
            >
              Sem complicação. <span className="grad-text">Sem equipe técnica.</span>
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { n: "01", title: "Sem TI", desc: "Interface simples e intuitiva. Você configura tudo em minutos, sozinho." },
              { n: "02", title: "Dados protegidos", desc: "Conformidade com LGPD. Seus dados e os de seus clientes estão seguros." },
              { n: "03", title: "Suporte incluso", desc: "Time de suporte à disposição para ajudar na configuração e no uso diário." },
            ].map((d) => (
              <div
                key={d.n}
                className="flex flex-col gap-4 rounded-2xl border border-[var(--lk-line)] bg-[var(--lk-bg-0)] p-6"
              >
                <span className="text-[13px] font-semibold" style={{ color: "var(--cobalt)" }}>{d.n}</span>
                <div>
                  <p className="text-[15.5px] font-semibold tracking-[-0.015em] text-[var(--lk-ink-0)]">{d.title}</p>
                  <p className="mt-2 text-[13px] leading-[1.7] text-[var(--lk-ink-2)]">{d.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIAL ───────────────────────────────────────────────── */}
      <section style={GF} className="py-16 md:py-20">
        <div className={`${W} max-w-[660px]`}>
          <div className="rounded-2xl border border-[var(--lk-line)] bg-[var(--lk-bg-1)] p-8 text-center">
            <div className="mb-5 flex justify-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} width="16" height="16" viewBox="0 0 16 16" fill="#f59e0b">
                  <path d="M8 1l1.85 3.75 4.15.6-3 2.92.71 4.13L8 10.35l-3.71 1.95.71-4.13-3-2.92 4.15-.6z"/>
                </svg>
              ))}
            </div>
            <blockquote
              className="text-[16px] font-medium leading-[1.65] tracking-[-0.012em] text-[var(--lk-ink-0)]"
              style={{ textWrap: "balance" } as React.CSSProperties}
            >
              "Reduzi o tempo de resposta de horas para segundos. Meus clientes adoraram e eu deixei de perder oportunidades à noite e nos fins de semana."
            </blockquote>
            <p className="mt-4 text-[13px] text-[var(--lk-ink-3)]">
              Proprietário de PME · Setor de serviços
            </p>
          </div>
        </div>
      </section>

      {/* ── DARK CTA ──────────────────────────────────────────────────── */}
      <section style={GF} className="relative overflow-hidden bg-[var(--lk-black)] py-20 md:py-28">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 60% 50% at 50% 100%, rgba(79,188,245,0.14) 0%, transparent 70%)" }}
        />
        <div className={`${W} relative text-center`}>
          <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--lk-ink-3)]">
            Comece hoje
          </p>
          <h2
            className="mx-auto mb-5 max-w-[520px] text-[28px] font-medium leading-[1.1] tracking-[-0.028em] text-white md:text-[40px]"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            Configure em minutos,{" "}
            <span className="grad-text">atenda para sempre</span>
          </h2>
          <p className="mx-auto mb-8 max-w-[360px] text-[14.5px] leading-[1.65] text-[var(--lk-ink-2)]">
            Sem cartão de crédito, sem equipe técnica. Comece grátis e veja a diferença.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/login"
              className="rounded-lg bg-[var(--cobalt)] px-7 py-3 text-[14px] font-medium text-white transition-all hover:bg-[var(--sapphire)]"
            >
              Criar conta grátis
            </Link>
            <Link
              to="/"
              className="rounded-lg border border-[rgba(255,255,255,0.12)] px-7 py-3 text-[14px] font-medium text-[var(--lk-ink-2)] transition-all hover:border-[rgba(255,255,255,0.25)] hover:text-white"
            >
              Ver todas as soluções
            </Link>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  )
}
