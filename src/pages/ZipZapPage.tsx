import { useRef, useState, type ReactNode } from "react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  AtSign,
  Bell,
  Bookmark,
  Columns3,
  ChevronDown,
  Circle,
  FileText,
  Hash,
  Headphones,
  Link2,
  Lock,
  Paperclip,
  PanelRightClose,
  PanelRightOpen,
  Pin,
  Plus,
  Search,
  Send,
  Settings,
  Smile,
  UserPlus,
  Users,
} from "lucide-react"

const channels = [
  { id: "geral", name: "geral", unread: 0, active: false, private: false },
  { id: "operacao", name: "operacao", unread: 5, active: true, private: false },
  { id: "implantacao", name: "implantacao", unread: 0, active: false, private: false },
  { id: "gestores", name: "gestores", unread: 2, active: false, private: true },
]

const directMessages = [
  { id: "marina", name: "Marina Costa", status: "online", unread: 1 },
  { id: "rafa", name: "Rafa Lima", status: "online", unread: 0 },
  { id: "bia", name: "Bia Nunes", status: "away", unread: 0 },
  { id: "lucas", name: "Lucas Prado", status: "offline", unread: 0 },
]

const groupChats = [
  { id: "plantao", name: "Plantao comercial", people: 6, unread: 3 },
  { id: "churn", name: "Clientes em risco", people: 4, unread: 0 },
]

const messages = [
  {
    id: "1",
    author: "Marina Costa",
    role: "Gestora",
    time: "09:42",
    body: "Bom dia, time. Vou deixar neste canal os pontos de atencao do plantao: fila de WhatsApp, retornos de proposta e chamados que precisam de escalacao.",
    reactions: ["olhos 4", "ok 2"],
  },
  {
    id: "2",
    author: "Allan Torres",
    role: "Owner",
    time: "09:45",
    body: "Perfeito. A ideia do ZipZap e que cada area consiga criar seus proprios chats, canais e DMs sem tirar o contexto da plataforma.",
    reactions: ["foguete 3"],
  },
  {
    id: "3",
    author: "Rafa Lima",
    role: "Atendente",
    time: "09:51",
    body: "Ja criei um grupo rapido para alinharmos os clientes em risco antes das 11h. Vou marcar o pessoal de CS e suporte.",
    reactions: [],
  },
]

const pinnedMessage = messages[1]

const sharedFiles = [
  { name: "roteiro-plantao.pdf", meta: "PDF · 2.4 MB · Marina" },
  { name: "clientes-risco.xlsx", meta: "Planilha · 840 KB · Rafa" },
  { name: "print-fila-whatsapp.png", meta: "Imagem · 512 KB · Bia" },
]

const sharedLinks = [
  { name: "Painel de SLA", url: "dashboards/sla-operacao" },
  { name: "Checklist de implantacao", url: "base-conhecimento/implantacao" },
  { name: "Campanha enterprise", url: "campanhas/growth-maio" },
]

const savedItems = [
  "Alinhamento do plantao comercial atualizado.",
  "Clientes em risco devem ser revisados antes das 11h.",
  "Transferencias criticas entram no canal #gestores.",
]

const participants = [
  { name: "Marina Costa", role: "Gestora", status: "online" },
  { name: "Allan Torres", role: "Owner", status: "online" },
  { name: "Rafa Lima", role: "Atendente", status: "online" },
  { name: "Bia Nunes", role: "CS", status: "away" },
  { name: "Lucas Prado", role: "Suporte", status: "offline" },
]

const inviteSuggestions = [
  { name: "Camila Rocha", role: "Comercial", status: "online" },
  { name: "Thiago Mendes", role: "Suporte", status: "away" },
  { name: "Nina Alves", role: "CS", status: "online" },
]

const kanbanColumns = [
  {
    name: "A fazer",
    cards: ["Revisar clientes em risco", "Atualizar roteiro de plantao"],
  },
  {
    name: "Em andamento",
    cards: ["Alinhar handoff suporte"],
  },
  {
    name: "Concluido",
    cards: ["Publicar aviso do dia"],
  },
]

type MainView = "chat" | "kanban" | "settings"

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

function StatusDot({ status }: { status: string }) {
  const color = status === "online" ? "bg-green-400" : status === "away" ? "bg-amber-500" : "bg-green-200/50"
  return <span className={`size-2 rounded-full ${color}`} />
}

function SidebarSection({
  title,
  actionLabel,
  children,
}: {
  title: string
  actionLabel: string
  children: ReactNode
}) {
  return (
    <section className="mt-4">
      <div className="mb-1 flex items-center justify-between px-2">
        <button className="flex min-w-0 items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 hover:text-slate-900">
          <ChevronDown className="size-3" />
          <span className="truncate">{title}</span>
        </button>
        <button
          className="flex size-5 items-center justify-center rounded text-slate-500 hover:bg-green-50 hover:text-green-700"
          title={actionLabel}
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      <div className="space-y-0.5">{children}</div>
    </section>
  )
}

export default function ZipZapPage() {
  const [resourcesOpen, setResourcesOpen] = useState(false)
  const [mainView, setMainView] = useState<MainView>("chat")
  const [inviteOpen, setInviteOpen] = useState(false)
  const messageRefs = useRef<Record<string, HTMLElement | null>>({})

  function scrollToMessage(messageId: string) {
    messageRefs.current[messageId]?.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  return (
    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden bg-white">
      <div
        className="grid h-full min-h-0 min-w-[940px] overflow-hidden"
        style={{ gridTemplateColumns: `244px minmax(520px, 1fr) ${resourcesOpen ? "300px" : "48px"}` }}
      >
        <aside className="flex min-h-0 flex-col border-r bg-white text-slate-900">
          <header className="border-b px-2 py-2">
            <div className="flex h-7 items-center gap-2 rounded-md border bg-slate-50 px-2">
              <Search className="size-3.5 text-slate-500" />
              <input
                className="min-w-0 flex-1 bg-transparent text-[11px] text-slate-900 outline-none placeholder:text-slate-400"
                placeholder="Buscar"
              />
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
            <button className="mt-2 flex h-7 w-full items-center gap-2 rounded-md px-2 text-xs text-slate-700 hover:bg-green-50 hover:text-green-800">
              <Bell className="size-3.5 text-slate-500" />
              Atividades
            </button>
            <button className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-xs text-slate-700 hover:bg-green-50 hover:text-green-800">
              <Bookmark className="size-3.5 text-slate-500" />
              Salvos
            </button>

            <SidebarSection title="Canais" actionLabel="Criar canal">
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  className={`flex h-7 w-full items-center gap-2 rounded-md px-2 text-xs ${
                    channel.active ? "bg-green-600 font-semibold text-white" : "text-slate-700 hover:bg-green-50 hover:text-green-800"
                  }`}
                >
                  {channel.private ? <Lock className="size-3.5" /> : <Hash className="size-3.5" />}
                  <span className="min-w-0 flex-1 truncate text-left">{channel.name}</span>
                  {channel.unread > 0 && (
                    <span className="rounded-full bg-white px-1.5 text-[10px] font-bold text-green-900">{channel.unread}</span>
                  )}
                </button>
              ))}
            </SidebarSection>

            <SidebarSection title="DMs" actionLabel="Nova DM">
              {directMessages.map((dm) => (
                <button key={dm.id} className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-xs text-slate-700 hover:bg-green-50 hover:text-green-800">
                  <span className="relative flex size-4 shrink-0 items-center justify-center rounded bg-green-100 text-[9px] font-semibold text-green-800">
                    {initials(dm.name)}
                    <span className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-white">
                      <StatusDot status={dm.status} />
                    </span>
                  </span>
                  <span className="min-w-0 flex-1 truncate text-left">{dm.name}</span>
                  {dm.unread > 0 && <Circle className="size-2 fill-green-300 text-green-300" />}
                </button>
              ))}
            </SidebarSection>

            <SidebarSection title="Chats criados" actionLabel="Criar chat">
              {groupChats.map((chat) => (
                <button key={chat.id} className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-xs text-slate-700 hover:bg-green-50 hover:text-green-800">
                  <Users className="size-3.5 text-slate-500" />
                  <span className="min-w-0 flex-1 truncate text-left">{chat.name}</span>
                  <span className="text-[10px] text-slate-400">{chat.people}</span>
                </button>
              ))}
            </SidebarSection>
          </div>
        </aside>

        <section className="flex min-h-0 flex-col bg-white">
          <header className="grid h-14 shrink-0 grid-cols-[minmax(180px,1fr)_auto_minmax(360px,1fr)] items-center gap-3 border-b px-4">
            <div className="flex min-w-0 items-center gap-2">
              <Hash className="size-4 text-green-700" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">operacao</p>
                <p className="truncate text-xs text-muted-foreground">Canal para avisos, plantao, filas e alinhamentos internos</p>
              </div>
            </div>

            <div className="flex items-center justify-center">
              <div className="flex -space-x-2">
                {participants.slice(0, 4).map((participant) => (
                  <span
                    key={participant.name}
                    className="relative flex size-7 items-center justify-center rounded-full border-2 border-white bg-green-700 text-[10px] font-bold text-white"
                    title={participant.name}
                  >
                    {initials(participant.name)}
                    <span className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-white">
                      <StatusDot status={participant.status} />
                    </span>
                  </span>
                ))}
                <button
                  className="relative flex size-7 items-center justify-center rounded-full border-2 border-white bg-green-50 text-green-700 hover:bg-green-100"
                  onClick={() => setInviteOpen(true)}
                  title="Adicionar participante"
                >
                  <UserPlus className="size-3.5" />
                </button>
              </div>
            </div>

            <div className="flex min-w-0 items-center justify-end gap-1">
              <button
                className={`flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs font-bold ${
                  mainView === "chat" ? "border-green-200 bg-green-50 text-green-800" : "hover:bg-muted"
                }`}
                onClick={() => setMainView("chat")}
              >
                <Hash className="size-3.5" />
                Chat
              </button>
              <button
                className={`flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs font-medium ${
                  mainView === "kanban" ? "border-green-200 bg-green-50 text-green-800" : "hover:bg-muted"
                }`}
                onClick={() => setMainView("kanban")}
              >
                <Columns3 className="size-3.5" />
                Kanban
              </button>
              <button
                className="flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs font-medium hover:bg-muted"
                onClick={() => setResourcesOpen((open) => !open)}
                title={resourcesOpen ? "Ocultar recursos" : "Abrir recursos"}
              >
                {resourcesOpen ? <PanelRightClose className="size-3.5" /> : <PanelRightOpen className="size-3.5" />}
                Recursos
              </button>
              <button
                className={`flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs font-medium ${
                  mainView === "settings" ? "border-green-200 bg-green-50 text-green-800" : "hover:bg-muted"
                }`}
                onClick={() => setMainView("settings")}
              >
                <Settings className="size-3.5" />
                Configuracoes
              </button>
            </div>
          </header>

          {mainView === "chat" && (
            <>
              <button
                className="flex shrink-0 items-center gap-2 border-b bg-green-50 px-4 py-2 text-left text-xs hover:bg-green-100"
                onClick={() => scrollToMessage(pinnedMessage.id)}
                title="Ir para mensagem fixada"
              >
                <Pin className="size-3.5 shrink-0 text-green-700" />
                <span className="font-semibold text-green-900">Fixado</span>
                <span className="min-w-0 flex-1 truncate text-green-950/80">{pinnedMessage.body}</span>
                <span className="shrink-0 text-[11px] text-green-800">{pinnedMessage.author}</span>
              </button>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <div className="mb-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="rounded-full border bg-white px-3 py-1 text-[11px] font-medium text-muted-foreground">Hoje</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <div className="space-y-5">
                  {messages.map((message) => (
                    <article
                      key={message.id}
                      ref={(element) => { messageRefs.current[message.id] = element }}
                      className={`group flex gap-3 scroll-mt-16 rounded-lg px-2 py-1 transition-colors ${
                        message.id === pinnedMessage.id ? "ring-1 ring-green-100" : ""
                      }`}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-green-700 text-xs font-bold text-white">
                        {initials(message.author)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-semibold">{message.author}</span>
                          <span className="text-[11px] text-muted-foreground">{message.role}</span>
                          <span className="text-[11px] text-muted-foreground">{message.time}</span>
                        </div>
                        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-800">{message.body}</p>
                        {message.reactions.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {message.reactions.map((reaction) => (
                              <button key={reaction} className="rounded-full border border-green-100 bg-green-50 px-2 py-0.5 text-[11px] hover:bg-green-100">
                                {reaction}
                              </button>
                            ))}
                            {message.id === pinnedMessage.id && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-green-100 bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-800">
                                <Pin className="size-3" />
                                fixado
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              <footer className="shrink-0 border-t bg-white p-4">
                <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
                  <textarea
                    rows={3}
                    className="min-h-20 w-full resize-none px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
                    placeholder="Enviar mensagem para #operacao"
                  />
                  <div className="flex items-center justify-between border-t bg-green-50 px-2 py-1.5">
                    <div className="flex items-center gap-1">
                      <button className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-white hover:text-foreground">
                        <Paperclip className="size-4" />
                      </button>
                      <button className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-white hover:text-foreground">
                        <Smile className="size-4" />
                      </button>
                      <button className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-white hover:text-foreground">
                        <AtSign className="size-4" />
                      </button>
                    </div>
                    <button className="flex h-8 items-center gap-1.5 rounded-md bg-green-600 px-3 text-xs font-semibold text-white hover:bg-green-700">
                      <Send className="size-3.5" />
                      Enviar
                    </button>
                  </div>
                </div>
              </footer>
            </>
          )}

          {mainView === "kanban" && (
            <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden bg-slate-50 p-4">
              <div className="flex h-full min-w-[820px] gap-3">
                {kanbanColumns.map((column) => (
                  <section key={column.name} className="flex min-h-0 w-72 shrink-0 flex-col rounded-lg border bg-white">
                    <div className="flex h-11 shrink-0 items-center justify-between border-b px-3">
                      <p className="text-sm font-semibold">{column.name}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{column.cards.length}</span>
                    </div>
                    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                      {column.cards.map((card) => (
                        <button key={card} className="w-full rounded-md border bg-white px-3 py-2 text-left text-sm leading-5 shadow-sm hover:border-green-200 hover:bg-green-50">
                          {card}
                        </button>
                      ))}
                      <button className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-dashed text-xs font-medium text-green-700 hover:bg-green-50">
                        <Plus className="size-3.5" />
                        Nova tarefa
                      </button>
                    </div>
                  </section>
                ))}
              </div>
            </div>
          )}

          {mainView === "settings" && (
            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4">
              <div className="mx-auto grid max-w-5xl gap-3 xl:grid-cols-[1.1fr_0.9fr]">
                <section className="rounded-lg border bg-white p-4 xl:col-span-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Recursos do canal</p>
                      <p className="text-xs text-muted-foreground">Configure o que o time usa dentro do ZipZap</p>
                    </div>
                    <Settings className="size-4 text-green-700" />
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-4">
                    {[
                      [FileText, "Arquivos", `${sharedFiles.length} publicados`],
                      [Link2, "Links", `${sharedLinks.length} atalhos`],
                      [Columns3, "Kanban", `${kanbanColumns.length} colunas`],
                      [Pin, "Fixados", "1 aviso ativo"],
                    ].map(([Icon, title, desc]) => (
                      <button key={String(title)} className="rounded-lg border bg-white p-3 text-left hover:border-green-200 hover:bg-green-50">
                        <Icon className="mb-2 size-4 text-green-700" />
                        <span className="block text-xs font-semibold">{title as string}</span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">{desc as string}</span>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="rounded-lg border bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Arquivos e links</p>
                      <p className="text-xs text-muted-foreground">Envie e organize materiais do canal</p>
                    </div>
                    <Paperclip className="size-4 text-green-700" />
                  </div>
                  <div className="mt-3 grid gap-2">
                    <button className="flex h-10 items-center justify-center gap-2 rounded-md border border-dashed text-xs font-medium text-green-700 hover:bg-green-50">
                      <Paperclip className="size-3.5" />
                      Enviar arquivo
                    </button>
                    <label className="grid gap-1 text-xs font-medium">
                      Novo link
                      <input className="h-9 rounded-md border px-2 text-sm font-normal outline-none focus:ring-1 focus:ring-green-600" placeholder="https://..." />
                    </label>
                    <label className="grid gap-1 text-xs font-medium">
                      Nome do link
                      <input className="h-9 rounded-md border px-2 text-sm font-normal outline-none focus:ring-1 focus:ring-green-600" placeholder="Ex: Painel de SLA" />
                    </label>
                    <button className="h-9 rounded-md bg-green-600 text-xs font-semibold text-white hover:bg-green-700">
                      Salvar recurso
                    </button>
                  </div>
                </section>

                <section className="rounded-lg border bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Kanban do time</p>
                      <p className="text-xs text-muted-foreground">Configure colunas e regras do board</p>
                    </div>
                    <Columns3 className="size-4 text-green-700" />
                  </div>
                  <div className="mt-3 space-y-2">
                    {kanbanColumns.map((column) => (
                      <div key={column.name} className="flex items-center justify-between rounded-md border px-3 py-2">
                        <span className="text-sm font-medium">{column.name}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-muted-foreground">{column.cards.length}</span>
                      </div>
                    ))}
                    <button className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-dashed text-xs font-medium text-green-700 hover:bg-green-50">
                      <Plus className="size-3.5" />
                      Nova coluna
                    </button>
                  </div>
                </section>

                <section className="rounded-lg border bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Avisos e fixados</p>
                      <p className="text-xs text-muted-foreground">Mensagens destacadas no topo</p>
                    </div>
                    <Pin className="size-4 text-green-700" />
                  </div>
                  <div className="mt-3 space-y-2">
                    <textarea className="min-h-20 w-full resize-none rounded-md border px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-green-600" defaultValue={pinnedMessage.body} />
                    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                      <span>Mostrar aviso fixado</span>
                      <input type="checkbox" defaultChecked className="accent-green-600" />
                    </div>
                    <button className="h-9 w-full rounded-md bg-green-600 text-xs font-semibold text-white hover:bg-green-700">
                      Atualizar aviso
                    </button>
                  </div>
                </section>

                <section className="rounded-lg border bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Permissoes</p>
                      <p className="text-xs text-muted-foreground">Quem pode criar e editar recursos</p>
                    </div>
                    <Lock className="size-4 text-green-700" />
                  </div>
                  <div className="mt-3 divide-y rounded-md border text-sm">
                    {[
                      ["Gestores configuram recursos", true],
                      ["Atendentes enviam arquivos", true],
                      ["Atendentes criam cards no Kanban", true],
                      ["Apenas admin fixa mensagens", false],
                    ].map(([label, checked]) => (
                      <label key={String(label)} className="flex items-center justify-between gap-3 px-3 py-2">
                        <span>{label}</span>
                        <input type="checkbox" defaultChecked={Boolean(checked)} className="accent-green-600" />
                      </label>
                    ))}
                  </div>
                </section>

                <section className="rounded-lg border bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Automacoes</p>
                      <p className="text-xs text-muted-foreground">Acoes acionadas por eventos do chat</p>
                    </div>
                    <Bell className="size-4 text-green-700" />
                  </div>
                  <div className="mt-3 space-y-2 text-sm">
                    {[
                      "Criar tarefa quando mensagem for fixada",
                      "Avisar gestores em arquivos enviados",
                      "Notificar suporte em cards atrasados",
                    ].map((item) => (
                      <label key={item} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                        <span>{item}</span>
                        <input type="checkbox" className="accent-green-600" />
                      </label>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          )}
        </section>

        <aside className="flex min-h-0 flex-col border-l bg-white">
          {!resourcesOpen ? (
            <div className="flex h-full flex-col items-center gap-2 py-3">
              <button
                className="flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-green-50 hover:text-green-700"
                onClick={() => setResourcesOpen(true)}
                title="Abrir painel"
              >
                <PanelRightOpen className="size-4" />
              </button>
              <button className="flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-green-50 hover:text-green-700" onClick={() => setResourcesOpen(true)} title="Arquivos">
                <FileText className="size-4" />
              </button>
              <button className="flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-green-50 hover:text-green-700" onClick={() => setResourcesOpen(true)} title="Links">
                <Link2 className="size-4" />
              </button>
              <button className="flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-green-50 hover:text-green-700" onClick={() => setResourcesOpen(true)} title="Salvos">
                <Bookmark className="size-4" />
              </button>
            </div>
          ) : (
            <>
              <header className="flex h-14 shrink-0 items-center justify-between border-b px-3">
                <div>
                  <p className="text-sm font-semibold">Recursos</p>
                  <p className="text-xs text-muted-foreground">Arquivos, links e salvos</p>
                </div>
                <button
                  className="flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-muted hover:text-slate-900"
                  onClick={() => setResourcesOpen(false)}
                  title="Recolher recursos"
                >
                  <PanelRightClose className="size-4" />
                </button>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <section className="rounded-lg border bg-white p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold">Arquivos</p>
                    <span className="text-[11px] text-muted-foreground">{sharedFiles.length}</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {sharedFiles.map((file) => (
                      <button key={file.name} className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-green-50">
                        <FileText className="mt-0.5 size-3.5 shrink-0 text-green-700" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium">{file.name}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">{file.meta}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="mt-3 rounded-lg border bg-white p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold">Links</p>
                    <span className="text-[11px] text-muted-foreground">{sharedLinks.length}</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {sharedLinks.map((link) => (
                      <button key={link.url} className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-green-50">
                        <Link2 className="mt-0.5 size-3.5 shrink-0 text-green-700" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium">{link.name}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">{link.url}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="mt-3 rounded-lg border bg-white p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold">Salvos</p>
                    <span className="text-[11px] text-muted-foreground">{savedItems.length}</span>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {savedItems.map((item) => (
                      <button key={item} className="line-clamp-2 w-full rounded-md bg-slate-50 px-2 py-1.5 text-left text-[11px] leading-4 hover:bg-green-50">
                        {item}
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            </>
          )}
        </aside>
      </div>

      <Sheet open={inviteOpen} onOpenChange={setInviteOpen} className="w-full max-w-[420px]">
        <SheetHeader>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700">
            <UserPlus className="size-4" />
          </span>
          <div className="min-w-0">
            <SheetTitle className="text-base">Adicionar participante</SheetTitle>
            <SheetDescription>Convide pessoas para #operacao</SheetDescription>
          </div>
        </SheetHeader>
        <SheetContent className="space-y-4">
          <div className="flex h-9 items-center gap-2 rounded-md border bg-slate-50 px-2">
            <Search className="size-3.5 text-slate-500" />
            <input className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" placeholder="Buscar pessoa ou equipe" />
          </div>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Sugestoes</p>
              <span className="text-[11px] text-muted-foreground">{inviteSuggestions.length}</span>
            </div>
            <div className="space-y-1.5">
              {inviteSuggestions.map((person) => (
                <button key={person.name} className="flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left hover:border-green-200 hover:bg-green-50">
                  <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-green-700 text-[11px] font-bold text-white">
                    {initials(person.name)}
                    <span className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-white">
                      <StatusDot status={person.status} />
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{person.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{person.role}</span>
                  </span>
                  <Plus className="size-4 text-green-700" />
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">No canal</p>
            <div className="space-y-1.5">
              {participants.map((participant) => (
                <div key={participant.name} className="flex items-center gap-2 rounded-md bg-slate-50 px-2.5 py-2">
                  <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-green-700 text-[11px] font-bold text-white">
                    {initials(participant.name)}
                    <span className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-slate-50">
                      <StatusDot status={participant.status} />
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{participant.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{participant.role}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        </SheetContent>
      </Sheet>
    </div>
  )
}
