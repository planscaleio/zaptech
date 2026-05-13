import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

const JOKE = {
  setup: "Por que o desenvolvedor foi ao psicólogo?",
  punchline: "Porque tinha muitos problemas não resolvidos na pilha de chamadas.",
}

export default function ErrorPage() {
  const navigate  = useNavigate()
  const [seconds, setSeconds] = useState(5)

  useEffect(() => {
    if (seconds <= 0) { navigate("/"); return }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [seconds, navigate])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-b from-slate-50 to-slate-100 px-6 text-center">
      {/* Big 404 */}
      <div className="relative select-none">
        <p className="text-[10rem] font-black leading-none tracking-tight text-slate-200">404</p>
        <p className="absolute inset-0 flex items-center justify-center text-5xl">🤔</p>
      </div>

      {/* Title */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-800">Página não encontrada</h1>
        <p className="text-slate-500">
          Parece que você foi mais longe que o nosso funil de vendas permite.
        </p>
      </div>

      {/* Joke card */}
      <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          Enquanto isso, uma piadinha
        </p>
        <p className="mt-3 font-medium text-slate-700">{JOKE.setup}</p>
        <p className="mt-2 text-sm text-slate-500 italic">{JOKE.punchline}</p>
        <p className="mt-4 text-2xl">😅</p>
      </div>

      {/* Countdown */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex size-14 items-center justify-center rounded-full border-4 border-primary/20 bg-primary/5 text-xl font-bold text-primary">
          {seconds}
        </div>
        <p className="text-sm text-slate-500">
          Voltando para o início em <span className="font-semibold text-slate-700">{seconds}s</span>…
        </p>
        <button
          onClick={() => navigate("/")}
          className="mt-1 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow transition-opacity hover:opacity-90"
        >
          Ir agora
        </button>
      </div>
    </div>
  )
}
