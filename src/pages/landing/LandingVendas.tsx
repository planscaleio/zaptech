import { Link } from "react-router-dom"
import { LandingNav, LandingFooter } from "./shared"

const GF = { fontFamily: "'Geist', ui-sans-serif, system-ui, sans-serif" } as const
const W  = "mx-auto w-full max-w-[1100px] px-5 md:px-8"

const FEATURES = [
  {
    n: "01",
    title: "CRM & Pipeline Kanban",
    desc: "Board drag-and-drop com etapas personalizadas, score de lead por IA e alertas de inatividade. Visualize e gerencie todo o funil em tempo real, sem planilha.",
    tag: "Pipeline visual",
  },
  {
    n: "02",
    title: "Qualificação por IA",
    desc: "O Agente Qualificador analisa cada conversa, atribui score de 0–100, detecta sentimento e sugere a próxima ação. Seu time prioriza quem realmente vai fechar.",
    tag: "Score automático",
  },
  {
    n: "03",
    title: "Orçamentos Automatizados",
    desc: "Monte e envie propostas diretamente pelo WhatsApp. O Agente de Vendas seleciona produtos do catálogo e gera o PDF em segundos — aceite ou recusa com 1 clique.",
    tag: "PDF automático",
  },
  {
    n: "04",
    title: "Agentes de Vendas 24h",
    desc: "Triagem, Qualificador e Vendas trabalhando enquanto sua equipe descansa — respondendo, avançando cards no pipeline e escalando para humanos só quando necessário.",
    tag: "Operação 24h",
  },
]

const STEPS = [
  {
    n: "01",
    title: "Lead entra pelo WhatsApp",
    desc: "O Agente de Triagem recebe, responde e coleta informações básicas em segundos.",
  },
  {
    n: "02",
    title: "Agente qualifica e pontua",
    desc: "Análise automática da conversa, score de 0–100 e abertura do card no pipeline.",
  },
  {
    n: "03",
    title: "Atendente fecha o negócio",
    desc: "Contexto completo em mãos — o time envia o orçamento e fecha com confiança.",
  },
]

export default function LandingVendas() {
  return (
    <div style={GF} className="min-h-screen bg-[var(--lk-bg-0)] text-[var(--lk-ink-0)] antialiased">
      <LandingNav />

      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <section style={GF} className="relative overflow-hidden pt-10 pb-20 md:pt-16 md:pb-28">
        {/* Subtle blue glow top-right */}
        <div
          className="pointer-events-none absolute -right-40 -top-40 size-[600px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(22,163,74,0.07) 0%, transparent 70%)" }}
        />
        <div className={W}>
          {/* Eyebrow */}
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--lk-line-2)] bg-[var(--lk-bg-1)] px-4 py-1.5">
            <span className="size-1.5 rounded-full bg-[var(--cobalt)]" />
            <span className="text-[12.5px] font-medium text-[var(--lk-ink-1)]">Para Times de Vendas</span>
          </div>

          <div className="grid items-center gap-14 md:grid-cols-2">
            <div>
              <h1
                className="mb-5 text-[30px] font-medium leading-[1.1] tracking-[-0.028em] text-[var(--lk-ink-0)] sm:text-[38px] md:text-[46px]"
                style={{ textWrap: "balance" } as React.CSSProperties}
              >
                Seu time de vendas com{" "}
                <span className="oval-wrap">IA</span> ao lado de cada atendente
              </h1>
              <p className="mb-8 text-[15px] leading-[1.65] text-[var(--lk-ink-2)] md:text-[16.5px]"
                style={{ textWrap: "balance" } as React.CSSProperties}
              >
                Qualifique leads automaticamente, envie propostas e acompanhe o pipeline — sem sair do WhatsApp, sem trocar de ferramenta.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-lg bg-[var(--cobalt)] px-6 py-3 text-[14px] font-medium text-white transition-all hover:bg-[var(--sapphire)]"
                >
                  Começar trial grátis
                </Link>
                <Link
                  to="/"
                  className="inline-flex items-center justify-center rounded-lg border border-[var(--lk-line-2)] px-6 py-3 text-[14px] font-medium text-[var(--lk-ink-1)] transition-all hover:bg-[var(--lk-bg-2)]"
                >
                  Ver todas as funcionalidades
                </Link>
              </div>
            </div>

            {/* Pipeline preview */}
            <div className="hidden flex-col gap-3 rounded-2xl border border-[var(--lk-line)] bg-[var(--lk-bg-1)] p-5 md:flex">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-semibold text-[var(--lk-ink-2)]">Pipeline — Vendas</p>
                <span className="flex items-center gap-1 rounded-full border border-[rgba(22,163,74,0.2)] bg-[rgba(22,163,74,0.06)] px-2.5 py-1 text-[11px] font-medium text-[var(--cobalt)]">
                  <span className="size-1.5 rounded-full bg-[var(--cobalt)]" /> Ao vivo
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { col: "Novos", count: 8, items: ["Lucas F.", "Ana S."] },
                  { col: "Qualificados", count: 5, items: ["Marcos O."] },
                  { col: "Proposta", count: 3, items: ["Carla R."] },
                ].map((col) => (
                  <div
                    key={col.col}
                    className="rounded-xl border border-[var(--lk-line)] bg-[var(--lk-bg-0)] p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[10.5px] font-semibold text-[var(--lk-ink-2)]">{col.col}</p>
                      <span className="rounded-full bg-[var(--lk-bg-2)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--lk-ink-3)]">
                        {col.count}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {col.items.map((item) => (
                        <div
                          key={item}
                          className="h-8 rounded-lg border border-[var(--lk-line)] bg-[var(--lk-bg-1)] px-2.5 flex items-center"
                        >
                          <span className="text-[10.5px] font-medium text-[var(--lk-ink-1)]">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div
                className="flex items-center gap-2 rounded-xl p-3"
                style={{ background: "rgba(22,163,74,0.05)", border: "1px solid rgba(22,163,74,0.15)" }}
              >
                <span className="size-1.5 rounded-full bg-[var(--cobalt)]" />
                <p className="text-[11.5px] font-medium text-[var(--cobalt)]">
                  Agente Qualificador · 3 leads analisados agora
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── METRICS STRIP ─────────────────────────────────────────────── */}
      <div
        style={GF}
        className="border-y border-[var(--lk-line)] bg-[var(--lk-bg-1)] py-10"
      >
        <div className={`${W} grid grid-cols-1 gap-8 sm:grid-cols-3 text-center`}>
          {[
            { value: "3×",   label: "mais conversões de lead para cliente" },
            { value: "−60%", label: "no tempo de resposta inicial" },
            { value: "100%", label: "do pipeline visível em tempo real" },
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

      {/* ── HOW IT WORKS ──────────────────────────────────────────────── */}
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
              Do primeiro contato ao{" "}
              <span className="grad-text">fechamento</span>
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
              Tudo para <span className="grad-text">vender mais</span>
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

      {/* ── AGENTS SHOWCASE ───────────────────────────────────────────── */}
      <section style={GF} className="border-y border-[var(--lk-line)] bg-[var(--lk-bg-1)] py-16 md:py-24">
        <div className={W}>
          <div className="mb-10 text-center">
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--lk-ink-3)]">
              Agentes ativos
            </p>
            <h2
              className="text-[26px] font-medium leading-[1.1] tracking-[-0.026em] text-[var(--lk-ink-0)] md:text-[34px]"
              style={{ textWrap: "balance" } as React.CSSProperties}
            >
              Os agentes que trabalham <span className="grad-text">por você</span>
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { name: "Triagem",      role: "Recepciona e registra leads" },
              { name: "Qualificador", role: "Score e análise de fit" },
              { name: "Vendas",       role: "Proposta e fechamento" },
              { name: "Suporte",      role: "Pós-venda e retenção" },
            ].map((a, i) => (
              <div
                key={a.name}
                className="flex flex-col items-center gap-4 rounded-2xl border border-[var(--lk-line)] bg-[var(--lk-bg-0)] p-6 text-center"
              >
                <div
                  className="flex size-12 items-center justify-center rounded-2xl text-lg font-bold text-white"
                  style={{ background: ["#2962ff","#144b99","#4fbcf5","#0b0b0f"][i] }}
                >
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-[var(--lk-ink-0)]">{a.name}</p>
                  <p className="mt-1 text-[12.5px] text-[var(--lk-ink-2)]">{a.role}</p>
                </div>
                <span className="flex items-center gap-1.5 text-[11.5px] font-medium" style={{ color: "#16a34a" }}>
                  <span className="size-1.5 rounded-full bg-[#16a34a]" /> Ativo
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DARK CTA ──────────────────────────────────────────────────── */}
      <section style={GF} className="relative overflow-hidden bg-[var(--lk-black)] py-20 md:py-28">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 60% 50% at 50% 100%, rgba(22,163,74,0.18) 0%, transparent 70%)" }}
        />
        <div className={`${W} relative text-center`}>
          <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--lk-ink-3)]">
            Comece hoje
          </p>
          <h2
            className="mx-auto mb-5 max-w-[520px] text-[28px] font-medium leading-[1.1] tracking-[-0.028em] text-white md:text-[40px]"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            Pronto para turbinar suas <span className="grad-text">vendas</span>?
          </h2>
          <p className="mx-auto mb-8 max-w-[380px] text-[14.5px] leading-[1.65] text-[var(--lk-ink-2)]">
            Comece grátis. Seus agentes entram em operação hoje.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/login"
              className="rounded-lg bg-[var(--cobalt)] px-7 py-3 text-[14px] font-medium text-white transition-all hover:bg-[var(--sapphire)]"
            >
              Começar trial grátis
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
