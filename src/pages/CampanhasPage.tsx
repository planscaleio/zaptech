import { useEffect, useMemo, useState } from "react"
import QRCode from "qrcode"
import {
  Archive, BarChart2, Calendar, CheckCircle2, Copy, Download, Link2, Loader2,
  Megaphone, MessageSquare, MousePointerClick, Pause, Plus, QrCode, RefreshCw,
  Save, Search, Smartphone, Users, X,
} from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

type CampaignType = "AQUISICAO" | "RETENCAO" | "ABM" | "REATIVACAO" | "UPSELL"
type CampaignStatus = "ATIVA" | "PLANEJADA" | "PAUSADA" | "CONCLUIDA" | "CANCELADA"
type DynamicQrStatus = "ATIVO" | "PAUSADO" | "ARQUIVADO"

interface Segment {
  id: string
  name: string
  customerCount: number
}

interface Campaign {
  id: string
  name: string
  type: CampaignType
  status: CampaignStatus
  budget: string | number | null
  leadCount: number
  segmentId: string | null
  createdAt: string
  segment?: { id: string; name: string; _count?: { customers: number } } | null
}

interface Routing {
  companyId: string
  activePhone: string | null
  backupPhones: string[]
  defaultMessage: string | null
  enabled: boolean
}

interface DynamicQrClick {
  id: string
  clickedAt: string
  destinationPhone: string
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmContent: string | null
}

interface DynamicQrLink {
  id: string
  campaignId: string | null
  slug: string
  name: string
  messageTemplate: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmContent: string | null
  status: DynamicQrStatus
  clickCount: number
  lastClickedAt: string | null
  publicUrl: string
  clicks: DynamicQrClick[]
}

const typeLabels: Record<CampaignType, string> = {
  AQUISICAO: "Aquisição",
  RETENCAO: "Retenção",
  ABM: "ABM",
  REATIVACAO: "Reativação",
  UPSELL: "Upsell",
}

const statusMap: Record<CampaignStatus, { label: string; cls: string }> = {
  ATIVA: { label: "Ativa", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  PLANEJADA: { label: "Planejada", cls: "border-blue-200 bg-blue-50 text-blue-700" },
  PAUSADA: { label: "Pausada", cls: "border-amber-200 bg-amber-50 text-amber-700" },
  CONCLUIDA: { label: "Concluída", cls: "border-slate-200 bg-slate-100 text-slate-700" },
  CANCELADA: { label: "Cancelada", cls: "border-red-200 bg-red-50 text-red-700" },
}

const qrStatusMap: Record<DynamicQrStatus, { label: string; variant: "success" | "warning" | "secondary" }> = {
  ATIVO: { label: "Ativo", variant: "success" },
  PAUSADO: { label: "Pausado", variant: "warning" },
  ARQUIVADO: { label: "Arquivado", variant: "secondary" },
}

function splitBackups(value: string) {
  return value.split(/[\n,;]+/g).map((item) => item.replace(/\D/g, "")).filter((item) => item.length >= 10)
}

function fmtDate(value: string | null) {
  if (!value) return "Sem cliques"
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value))
}

function money(value: string | number | null) {
  if (value == null || value === "") return "Sem orçamento"
  const n = Number(value)
  if (!Number.isFinite(n)) return String(value)
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)
}

function metricValue(value: number) {
  return value.toLocaleString("pt-BR")
}

export default function CampanhasPage() {
  const auth = useAuth()
  const companyId = auth?.companyId

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [links, setLinks] = useState<DynamicQrLink[]>([])
  const [segments, setSegments] = useState<Segment[]>([])
  const [routing, setRouting] = useState<Routing | null>(null)
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState("")

  const [campaignSheetOpen, setCampaignSheetOpen] = useState(false)
  const [campaignName, setCampaignName] = useState("")
  const [campaignType, setCampaignType] = useState<CampaignType>("AQUISICAO")
  const [campaignBudget, setCampaignBudget] = useState("")
  const [campaignSegmentId, setCampaignSegmentId] = useState("")

  const [activePhone, setActivePhone] = useState("")
  const [backupPhonesText, setBackupPhonesText] = useState("")
  const [defaultMessage, setDefaultMessage] = useState("")
  const [routingEnabled, setRoutingEnabled] = useState(true)

  const [qrSheetOpen, setQrSheetOpen] = useState(false)
  const [linkName, setLinkName] = useState("")
  const [linkMessage, setLinkMessage] = useState("")
  const [utmContent, setUtmContent] = useState("")
  const [creatingQr, setCreatingQr] = useState(false)

  const filteredCampaigns = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return campaigns
    return campaigns.filter((campaign) => {
      return [
        campaign.name,
        typeLabels[campaign.type],
        statusMap[campaign.status].label,
        campaign.segment?.name ?? "",
      ].some((value) => value.toLowerCase().includes(term))
    })
  }, [campaigns, query])

  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? filteredCampaigns[0] ?? campaigns[0] ?? null
  const campaignLinks = selectedCampaign ? links.filter((link) => link.campaignId === selectedCampaign.id) : []
  const selectedLink = campaignLinks.find((link) => link.id === selectedLinkId) ?? campaignLinks[0] ?? null
  const totalClicks = campaignLinks.reduce((sum, link) => sum + link.clickCount, 0)
  const allClicks = links.reduce((sum, link) => sum + link.clickCount, 0)
  const hasActivePhone = Boolean(routing?.enabled && routing.activePhone)
  const recentClicks = selectedLink?.clicks?.slice(0, 5) ?? []

  async function loadAll() {
    if (!companyId) return
    setLoading(true)
    try {
      const [campaignsRes, linksRes, routingRes, segmentsRes] = await Promise.all([
        fetch(`/api/campaigns?companyId=${companyId}`),
        fetch(`/api/dynamic-links?companyId=${companyId}`),
        fetch(`/api/dynamic-links/routing?companyId=${companyId}`),
        fetch(`/api/segments?companyId=${companyId}`),
      ])
      const campaignsData = await campaignsRes.json()
      const linksData = await linksRes.json()
      const routingData = await routingRes.json()
      const segmentsData = await segmentsRes.json()

      setCampaigns(Array.isArray(campaignsData) ? campaignsData : [])
      setLinks(Array.isArray(linksData) ? linksData : [])
      setSegments(Array.isArray(segmentsData) ? segmentsData : [])
      setRouting(routingData ?? null)
      setActivePhone(routingData?.activePhone ?? "")
      setBackupPhonesText((routingData?.backupPhones ?? []).join(", "))
      setDefaultMessage(routingData?.defaultMessage ?? "")
      setRoutingEnabled(routingData?.enabled !== false)
      setSelectedCampaignId((current) => current ?? campaignsData?.[0]?.id ?? null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [companyId])

  useEffect(() => {
    setSelectedLinkId(campaignLinks[0]?.id ?? null)
  }, [selectedCampaign?.id])

  useEffect(() => {
    let cancelled = false
    if (!selectedLink?.publicUrl) {
      setQrDataUrl("")
      return
    }
    QRCode.toDataURL(selectedLink.publicUrl, {
      margin: 2,
      width: 220,
      color: { dark: "#111827", light: "#ffffff" },
    }).then((dataUrl) => {
      if (!cancelled) setQrDataUrl(dataUrl)
    }).catch(() => {
      if (!cancelled) setQrDataUrl("")
    })
    return () => { cancelled = true }
  }, [selectedLink?.publicUrl])

  async function createCampaign() {
    if (!companyId || !campaignName.trim()) return
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        name: campaignName,
        type: campaignType,
        budget: campaignBudget,
        segmentId: campaignSegmentId,
      }),
    })
    if (!res.ok) {
      setNotice("Não foi possível criar a campanha.")
      return
    }
    const created = await res.json()
    setCampaigns((prev) => [created, ...prev])
    setSelectedCampaignId(created.id)
    setCampaignName("")
    setCampaignBudget("")
    setCampaignSegmentId("")
    setCampaignSheetOpen(false)
    setNotice("Campanha criada.")
  }

  async function updateCampaignStatus(status: CampaignStatus) {
    if (!selectedCampaign) return
    const res = await fetch(`/api/campaigns/${selectedCampaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) return
    const updated = await res.json()
    setCampaigns((prev) => prev.map((campaign) => campaign.id === updated.id ? updated : campaign))
  }

  async function saveRouting() {
    if (!companyId) return
    const res = await fetch("/api/dynamic-links/routing", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        activePhone,
        backupPhones: splitBackups(backupPhonesText),
        defaultMessage,
        enabled: routingEnabled,
      }),
    })
    if (!res.ok) {
      setNotice("Não foi possível salvar o WhatsApp ativo.")
      return
    }
    const data = await res.json()
    setRouting(data)
    setActivePhone(data.activePhone ?? "")
    setBackupPhonesText((data.backupPhones ?? []).join(", "))
    setDefaultMessage(data.defaultMessage ?? "")
    setRoutingEnabled(data.enabled !== false)
    setNotice("WhatsApp ativo atualizado.")
  }

  async function createLink() {
    if (!companyId || !selectedCampaign || !linkName.trim()) return
    setCreatingQr(true)
    const res = await fetch("/api/dynamic-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        campaignId: selectedCampaign.id,
        name: linkName,
        messageTemplate: linkMessage,
        utmSource: "qr",
        utmMedium: "offline",
        utmCampaign: selectedCampaign.name,
        utmContent,
      }),
    })
    setCreatingQr(false)
    if (!res.ok) {
      setNotice("Não foi possível criar o QR.")
      return
    }
    const created = await res.json()
    setLinks((prev) => [created, ...prev])
    setSelectedLinkId(created.id)
    setLinkName("")
    setLinkMessage("")
    setUtmContent("")
    setQrSheetOpen(false)
    setNotice("QR criado.")
  }

  async function updateLinkStatus(link: DynamicQrLink, status: DynamicQrStatus) {
    const res = await fetch(`/api/dynamic-links/${link.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) return
    const updated = await res.json()
    setLinks((prev) => prev.map((item) => item.id === link.id ? { ...item, ...updated } : item))
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text)
    setNotice("Copiado.")
  }

  function downloadQr() {
    if (!qrDataUrl || !selectedLink) return
    const a = document.createElement("a")
    a.href = qrDataUrl
    a.download = `${selectedLink.slug}.png`
    a.click()
  }

  if (!companyId) {
    return (
      <div className="p-4">
        <div className="rounded-lg border bg-white p-5 shadow-soft">
          <p className="text-sm font-semibold">Campanhas</p>
          <p className="mt-1 text-sm text-muted-foreground">Entre com um usuário vinculado a uma empresa.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
      <div className="grid h-full min-w-[1160px] grid-cols-[300px_minmax(560px,1fr)_300px] gap-2.5 p-2.5 md:p-3">
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white shadow-soft">
          <div className="shrink-0 space-y-2 border-b p-3">
            <div className="flex h-8 items-center gap-2 rounded-md border bg-white px-2">
              <Search className="size-3.5 text-muted-foreground" />
              <Input
                className="h-7 border-0 px-0 text-xs shadow-none focus-visible:ring-0"
                placeholder="Buscar campanha..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Button size="sm" className="w-full" onClick={() => setCampaignSheetOpen(true)}>
                <Plus className="size-3.5" /> Nova campanha
              </Button>
              <Button size="sm" variant="outline" onClick={loadAll} disabled={loading} title="Atualizar">
                {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
              </div>
            )}
            {!loading && filteredCampaigns.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
                <Megaphone className="size-7 opacity-30" />
                <p className="text-xs">{query ? "Nenhuma campanha encontrada" : "Nenhuma campanha criada"}</p>
              </div>
            )}
            {filteredCampaigns.map((campaign) => {
              const currentLinks = links.filter((link) => link.campaignId === campaign.id)
              const currentClicks = currentLinks.reduce((sum, link) => sum + link.clickCount, 0)
              const selected = selectedCampaign?.id === campaign.id

              return (
                <button
                  key={campaign.id}
                  onClick={() => setSelectedCampaignId(campaign.id)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5",
                    selected ? "border-primary/40 bg-primary/5 ring-1 ring-primary/15" : "border-transparent",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{campaign.name}</p>
                    <span className={cn("shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium", statusMap[campaign.status].cls)}>
                      {statusMap[campaign.status].label}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {typeLabels[campaign.type]} · {campaign.segment?.name ?? "Sem segmento"}
                  </p>
                  <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><QrCode className="size-2.5" />{currentLinks.length} QRs</span>
                    <span className="inline-flex items-center gap-1"><MousePointerClick className="size-2.5" />{metricValue(currentClicks)}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border bg-white shadow-soft">
          {selectedCampaign ? (
            <>
              <div className="flex shrink-0 flex-wrap items-center gap-3 border-b p-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Megaphone className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-semibold">{selectedCampaign.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {typeLabels[selectedCampaign.type]} · {money(selectedCampaign.budget)} · {selectedCampaign.segment?.name ?? "Sem segmento"}
                  </p>
                </div>
                <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", statusMap[selectedCampaign.status].cls)}>
                  {statusMap[selectedCampaign.status].label}
                </span>
                <Button size="sm" onClick={() => setQrSheetOpen(true)}>
                  <Plus className="size-3.5" /> Novo QR
                </Button>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { icon: QrCode, label: "QRs", value: metricValue(campaignLinks.length) },
                    { icon: MousePointerClick, label: "Cliques", value: metricValue(totalClicks) },
                    { icon: Users, label: "Público", value: selectedCampaign.segment?._count?.customers?.toLocaleString("pt-BR") ?? "Sem segmento" },
                    { icon: Calendar, label: "Criada em", value: fmtDate(selectedCampaign.createdAt) },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex min-w-0 flex-col items-center gap-1 rounded-xl border bg-muted/30 px-3 py-3 text-center">
                      <Icon className="size-3.5 text-primary" />
                      <p className="max-w-full truncate text-base font-bold">{value}</p>
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">QRs da campanha</p>
                    <p className="text-xs text-muted-foreground">{campaignLinks.length} link{campaignLinks.length === 1 ? "" : "s"}</p>
                  </div>

                  <div className="overflow-hidden rounded-xl border">
                    <div className="grid grid-cols-[minmax(0,1.4fr)_110px_100px_130px] border-b bg-muted/45 px-3 py-2 text-xs font-medium text-muted-foreground">
                      <span>QR</span>
                      <span>Status</span>
                      <span className="text-right">Cliques</span>
                      <span className="text-right">Último clique</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {campaignLinks.length === 0 && (
                        <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
                          <QrCode className="size-8 opacity-30" />
                          <p className="text-sm font-medium">Nenhum QR nesta campanha</p>
                          <Button size="sm" onClick={() => setQrSheetOpen(true)}>
                            <Plus className="size-3.5" /> Criar QR
                          </Button>
                        </div>
                      )}
                      {campaignLinks.map((link) => {
                        const selected = selectedLink?.id === link.id
                        return (
                          <button
                            key={link.id}
                            onClick={() => setSelectedLinkId(link.id)}
                            className={cn(
                              "grid w-full grid-cols-[minmax(0,1.4fr)_110px_100px_130px] items-center gap-3 border-b px-3 py-2.5 text-left transition-colors hover:bg-primary/5",
                              selected && "bg-primary/5",
                            )}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium">{link.name}</span>
                              <span className="block truncate text-[11px] text-muted-foreground">{link.utmContent || link.slug}</span>
                            </span>
                            <span><Badge variant={qrStatusMap[link.status].variant}>{qrStatusMap[link.status].label}</Badge></span>
                            <span className="text-right text-sm font-semibold">{metricValue(link.clickCount)}</span>
                            <span className="text-right text-xs text-muted-foreground">{fmtDate(link.lastClickedAt)}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {selectedLink ? (
                  <div className="grid grid-cols-[240px_minmax(0,1fr)] gap-3">
                    <div className="rounded-xl border bg-white p-3">
                      <div className="flex justify-center rounded-lg border bg-white p-3">
                        {qrDataUrl ? (
                          <img src={qrDataUrl} alt={`QR ${selectedLink.name}`} className="size-52" />
                        ) : (
                          <Loader2 className="my-20 size-5 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <Button size="sm" variant="outline" onClick={() => copy(selectedLink.publicUrl)}>
                          <Copy className="size-3.5" /> Copiar
                        </Button>
                        <Button size="sm" variant="outline" onClick={downloadQr}>
                          <Download className="size-3.5" /> Baixar
                        </Button>
                      </div>
                    </div>

                    <div className="min-w-0 space-y-3 rounded-xl border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{selectedLink.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{metricValue(selectedLink.clickCount)} cliques · {fmtDate(selectedLink.lastClickedAt)}</p>
                        </div>
                        <Badge variant={qrStatusMap[selectedLink.status].variant}>{qrStatusMap[selectedLink.status].label}</Badge>
                      </div>

                      <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-2.5 py-2 text-[11px]">
                        <Link2 className="size-3 shrink-0 text-primary" />
                        <span className="min-w-0 flex-1 truncate">{selectedLink.publicUrl}</span>
                      </div>

                      {selectedLink.messageTemplate && (
                        <div className="rounded-lg border bg-[#dcf8c6]/45 px-3 py-2">
                          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            <MessageSquare className="size-3" /> Mensagem
                          </div>
                          <p className="whitespace-pre-wrap text-xs leading-5">{selectedLink.messageTemplate}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-2">
                        <Button size="sm" variant="outline" onClick={() => updateLinkStatus(selectedLink, "ATIVO")}>Ativar</Button>
                        <Button size="sm" variant="outline" onClick={() => updateLinkStatus(selectedLink, "PAUSADO")}>Pausar</Button>
                        <Button size="sm" variant="outline" onClick={() => updateLinkStatus(selectedLink, "ARQUIVADO")}>Arquivar</Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="shrink-0 flex items-center gap-2 border-t bg-muted/20 p-3">
                <Button size="sm" onClick={() => updateCampaignStatus("ATIVA")}>
                  <CheckCircle2 className="size-3.5" /> Ativar
                </Button>
                <Button size="sm" variant="outline" onClick={() => updateCampaignStatus("PAUSADA")}>
                  <Pause className="size-3.5" /> Pausar
                </Button>
                <Button size="sm" variant="outline" onClick={() => updateCampaignStatus("CONCLUIDA")}>
                  <Archive className="size-3.5" /> Concluir
                </Button>
                {notice && <span className="ml-auto text-xs text-muted-foreground">{notice}</span>}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center text-muted-foreground">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/50">
                <Megaphone className="size-7 opacity-30" />
              </div>
              <div>
                <p className="text-sm font-medium">Selecione uma campanha</p>
                <p className="mt-0.5 text-xs opacity-70">ou crie uma nova para gerar QRs dinâmicos</p>
              </div>
              <Button size="sm" onClick={() => setCampaignSheetOpen(true)}>
                <Plus className="size-3.5" /> Nova campanha
              </Button>
            </div>
          )}
        </section>

        <aside className="min-h-0 space-y-3 overflow-y-auto pr-1">
          <div className="overflow-hidden rounded-lg border bg-white shadow-soft">
            <div className="flex items-center gap-2 border-b px-3 py-2.5">
              <Smartphone className="size-3.5 text-primary" />
              <p className="text-xs font-semibold">WhatsApp ativo</p>
              <Badge className="ml-auto" variant={hasActivePhone ? "success" : "warning"}>{hasActivePhone ? "Pronto" : "Pendente"}</Badge>
            </div>
            <div className="space-y-2 p-3">
              <Input value={activePhone} onChange={(e) => setActivePhone(e.target.value)} placeholder="5511999999999" />
              <Input value={backupPhonesText} onChange={(e) => setBackupPhonesText(e.target.value)} placeholder="Backups separados por vírgula" />
              <textarea
                className="min-h-20 w-full resize-none rounded-md border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={defaultMessage}
                onChange={(e) => setDefaultMessage(e.target.value)}
                placeholder="Mensagem padrão"
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={routingEnabled} onChange={(e) => setRoutingEnabled(e.target.checked)} />
                Roteamento ativo
              </label>
              <Button size="sm" className="w-full" onClick={saveRouting}>
                <Save className="size-3.5" /> Salvar WhatsApp
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border bg-white shadow-soft">
            <div className="flex items-center gap-2 border-b px-3 py-2.5">
              <BarChart2 className="size-3.5 text-primary" />
              <p className="text-xs font-semibold">Visão geral</p>
            </div>
            <div className="divide-y">
              {[
                ["Campanhas", metricValue(campaigns.length)],
                ["QRs dinâmicos", metricValue(links.length)],
                ["Cliques totais", metricValue(allClicks)],
                ["Segmentos disponíveis", metricValue(segments.length)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between px-3 py-2 text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-semibold">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border bg-white shadow-soft">
            <div className="flex items-center gap-2 border-b px-3 py-2.5">
              <MousePointerClick className="size-3.5 text-primary" />
              <p className="text-xs font-semibold">Últimos cliques</p>
            </div>
            <div className="divide-y">
              {recentClicks.length === 0 && (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">Nenhum clique no QR selecionado.</div>
              )}
              {recentClicks.map((click) => (
                <div key={click.id} className="px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium">{click.destinationPhone}</span>
                    <span className="text-muted-foreground">{fmtDate(click.clickedAt)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {[click.utmSource, click.utmMedium, click.utmContent].filter(Boolean).join(" · ") || "Sem UTMs"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <Sheet open={campaignSheetOpen} onClose={() => setCampaignSheetOpen(false)}>
        <SheetHeader>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Megaphone className="size-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Nova campanha</p>
            <p className="text-xs text-muted-foreground">Crie a campanha antes de gerar QRs dinâmicos.</p>
          </div>
          <button
            onClick={() => setCampaignSheetOpen(false)}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60"
          >
            <X className="size-4" />
          </button>
        </SheetHeader>
        <SheetContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nome da campanha</label>
              <Input autoFocus value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Ex: Black Friday loja física" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Objetivo</label>
              <select
                className="h-9 w-full rounded-md border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={campaignType}
                onChange={(e) => setCampaignType(e.target.value as CampaignType)}
              >
                {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Orçamento</label>
              <Input value={campaignBudget} onChange={(e) => setCampaignBudget(e.target.value)} placeholder="Ex: 1500" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Segmento</label>
              <select
                className="h-9 w-full rounded-md border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={campaignSegmentId}
                onChange={(e) => setCampaignSegmentId(e.target.value)}
              >
                <option value="">Sem segmento</option>
                {segments.map((segment) => <option key={segment.id} value={segment.id}>{segment.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex shrink-0 items-center justify-between gap-3 border-t bg-muted/20 px-4 py-3">
            <Button variant="outline" onClick={() => setCampaignSheetOpen(false)}>Cancelar</Button>
            <Button onClick={createCampaign} disabled={!campaignName.trim()}>
              <Save className="size-3.5" /> Criar campanha
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={qrSheetOpen} onClose={() => setQrSheetOpen(false)}>
        <SheetHeader>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <QrCode className="size-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Novo QR dinâmico</p>
            <p className="truncate text-xs text-muted-foreground">{selectedCampaign?.name ?? "Selecione uma campanha"}</p>
          </div>
          <button
            onClick={() => setQrSheetOpen(false)}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60"
          >
            <X className="size-4" />
          </button>
        </SheetHeader>
        <SheetContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nome do QR</label>
              <Input autoFocus value={linkName} onChange={(e) => setLinkName(e.target.value)} placeholder="Ex: Folder recepção" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">UTM content</label>
              <Input value={utmContent} onChange={(e) => setUtmContent(e.target.value)} placeholder="Ex: folder_a" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mensagem pré-preenchida</label>
              <textarea
                className="min-h-28 w-full resize-none rounded-md border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                value={linkMessage}
                onChange={(e) => setLinkMessage(e.target.value)}
                placeholder="Mensagem que abre no WhatsApp quando o QR for lido"
              />
            </div>
          </div>
          <div className="flex shrink-0 items-center justify-between gap-3 border-t bg-muted/20 px-4 py-3">
            <Button variant="outline" onClick={() => setQrSheetOpen(false)}>Cancelar</Button>
            <Button disabled={creatingQr || !selectedCampaign || !linkName.trim()} onClick={createLink}>
              {creatingQr ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              Criar QR
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
