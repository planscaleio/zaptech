import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle2, X, Plus, Search, Eye } from "lucide-react"
import { Sheet, SheetHeader, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"

type Status = "ATIVO" | "INATIVO"
type QuoteStatus = "RASCUNHO" | "ENVIADO" | "ACEITO" | "RECUSADO" | "EXPIRADO" | "CANCELADO"
type DiscountType = "VALOR" | "PERCENTUAL"

interface Product {
  id: string
  name: string
  price: string
  status: Status
}

interface Customer {
  id: string
  name: string
  phone: string | null
  email: string | null
}

interface QuoteItem {
  id: string
  productName: string
  quantity: string
  unit: string
  unitPrice: string
  discountAmount: string
  total: string
}

interface Quote {
  id: string
  number: number
  status: QuoteStatus
  validUntil: string
  freight: string
  subtotal: string
  discountTotal: string
  total: string
  notes: string | null
  sentAt: string | null
  createdAt: string
  customer: { id: string; name: string; phone: string | null; email: string | null }
  conversation: { id: string; channel: string } | null
  generatedBy: { id: string; name: string } | null
  items: QuoteItem[]
}

interface DraftItem {
  productId: string
  quantity: string
  unitPrice: string
  discountType: DiscountType
  discountValue: string
}

const statusLabel: Record<QuoteStatus, string> = {
  RASCUNHO: "Rascunho",
  ENVIADO: "Enviado",
  ACEITO: "Aceito",
  RECUSADO: "Recusado",
  EXPIRADO: "Expirado",
  CANCELADO: "Cancelado",
}

function money(value: string | number | null | undefined) {
  const n = Number(value ?? 0)
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number.isFinite(n) ? n : 0)
}

function todayPlus(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function quoteVariant(status: QuoteStatus): "success" | "warning" | "secondary" | "outline" {
  if (status === "ACEITO") return "success"
  if (status === "ENVIADO") return "warning"
  if (status === "RASCUNHO") return "outline"
  return "secondary"
}

function calcDraftTotal(items: DraftItem[], products: Product[], freight: string) {
  return items.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.productId)
    const qty = Number(item.quantity || 0)
    const price = Number(item.unitPrice || product?.price || 0)
    const subtotal = Math.max(0, qty * price)
    const rawDiscount =
      item.discountType === "PERCENTUAL"
        ? (subtotal * Math.min(Number(item.discountValue || 0), 100)) / 100
        : Number(item.discountValue || 0)
    return sum + Math.max(0, subtotal - Math.min(subtotal, Math.max(0, rawDiscount)))
  }, Math.max(0, Number(freight || 0)))
}

export default function OrcamentosPage() {
  const auth = useAuth()
  const companyId = auth?.companyId ?? ""

  const [products, setProducts] = useState<Product[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [quoteSearch, setQuoteSearch] = useState("")
  const [quoteStatusFilter, setQuoteStatusFilter] = useState<QuoteStatus | "TODOS">("TODOS")
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null)

  const [quoteForm, setQuoteForm] = useState({
    customerId: "",
    validUntil: todayPlus(7),
    freight: "",
    notes: "",
    items: [] as DraftItem[],
  })

  function refresh() {
    if (!companyId) return
    setLoading(true)
    Promise.all([
      fetch(`/api/products?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/quotes?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/customers?companyId=${companyId}`).then((r) => r.json()),
    ])
      .then(([nextProducts, nextQuotes, nextCustomers]) => {
        setProducts(Array.isArray(nextProducts) ? nextProducts : [])
        setQuotes(Array.isArray(nextQuotes) ? nextQuotes : [])
        setCustomers(Array.isArray(nextCustomers) ? nextCustomers : [])
      })
      .catch(() => setError("Não foi possível carregar os orçamentos."))
      .finally(() => setLoading(false))
  }

  useEffect(() => { refresh() }, [companyId])

  const activeProducts = useMemo(() => products.filter((p) => p.status === "ATIVO"), [products])

  const filteredQuotes = useMemo(() => {
    const term = quoteSearch.trim().toLowerCase()
    return quotes
      .filter((q) => quoteStatusFilter === "TODOS" || q.status === quoteStatusFilter)
      .filter((q) => {
        if (!term) return true
        return [
          String(q.number),
          q.customer.name,
          q.customer.phone ?? "",
          q.customer.email ?? "",
          q.generatedBy?.name ?? "",
          q.items.map((i) => i.productName).join(" "),
        ].some((v) => v.toLowerCase().includes(term))
      })
  }, [quoteSearch, quoteStatusFilter, quotes])

  const quoteMetrics = useMemo(() => {
    const open = quotes.filter((q) => ["RASCUNHO", "ENVIADO"].includes(q.status))
    const accepted = quotes.filter((q) => q.status === "ACEITO")
    const expiring = open.filter((q) => {
      const diff = new Date(q.validUntil).getTime() - Date.now()
      return diff >= 0 && diff <= 3 * 24 * 60 * 60_000
    })
    return {
      openCount: open.length,
      acceptedCount: accepted.length,
      expiringCount: expiring.length,
      openValue: open.reduce((sum, q) => sum + Number(q.total), 0),
    }
  }, [quotes])

  const quoteTotalPreview = useMemo(
    () => calcDraftTotal(quoteForm.items, products, quoteForm.freight),
    [quoteForm.items, products, quoteForm.freight],
  )

  function shortDate(iso: string) {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
  }

  function updateQuoteItem(index: number, patch: Partial<DraftItem>) {
    setQuoteForm((current) => ({
      ...current,
      items: current.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }))
  }

  function addQuoteItem(productId: string) {
    const product = products.find((p) => p.id === productId)
    if (!product) return
    setQuoteForm((current) => ({
      ...current,
      items: [
        ...current.items,
        { productId, quantity: "1", unitPrice: product.price, discountType: "VALOR", discountValue: "" },
      ],
    }))
  }

  async function createQuote() {
    if (!quoteForm.customerId || !quoteForm.validUntil || quoteForm.items.length === 0) {
      setError("Cliente, validade e ao menos um produto são obrigatórios.")
      return
    }
    setError("")
    const res = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        customerId: quoteForm.customerId,
        generatedById: auth?.id,
        generatedByName: auth?.name,
        validUntil: quoteForm.validUntil,
        freight: quoteForm.freight || "0",
        notes: quoteForm.notes,
        items: quoteForm.items,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? "Erro ao criar orçamento"); return }
    setQuoteForm({ customerId: "", validUntil: todayPlus(7), freight: "", notes: "", items: [] })
    refresh()
  }

  async function updateQuoteStatus(quote: Quote, status: QuoteStatus) {
    const res = await fetch(`/api/quotes/${quote.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, authorId: auth?.id, authorName: auth?.name }),
    })
    if (!res.ok) { setError((await res.json()).error ?? "Erro ao alterar status"); return }
    refresh()
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      {error && (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</div>
      )}

      <div className="grid h-[calc(100vh-130px)] min-h-[640px] gap-3 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="min-h-0 overflow-hidden">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm">Novo orçamento</CardTitle>
            <CardDescription className="text-[11px]">Criação rápida para alto volume</CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 space-y-2 overflow-y-auto p-3 pt-0">
            <Select
              value={quoteForm.customerId || "_none"}
              onValueChange={(v) => setQuoteForm((f) => ({ ...f, customerId: v === "_none" ? "" : v }))}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Selecione um cliente</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <Input
                className="h-8 text-xs"
                type="date"
                value={quoteForm.validUntil}
                onChange={(e) => setQuoteForm((f) => ({ ...f, validUntil: e.target.value }))}
              />
              <Input
                className="h-8 text-xs"
                type="number"
                min="0"
                placeholder="Frete"
                value={quoteForm.freight}
                onChange={(e) => setQuoteForm((f) => ({ ...f, freight: e.target.value }))}
              />
            </div>
            <Select value="_none" onValueChange={(v) => v !== "_none" && addQuoteItem(v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Adicionar produto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Adicionar produto</SelectItem>
                {activeProducts.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} · {money(p.price)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="space-y-2">
              {quoteForm.items.map((item, index) => {
                const product = products.find((p) => p.id === item.productId)
                return (
                  <div key={`${item.productId}-${index}`} className="rounded-md border bg-muted/20 p-2">
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate text-xs font-semibold">{product?.name ?? "Produto"}</p>
                      <button
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setQuoteForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }))}
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-1.5">
                      <Input className="h-8 text-xs" type="number" min="0" value={item.quantity} onChange={(e) => updateQuoteItem(index, { quantity: e.target.value })} />
                      <Input className="h-8 text-xs" type="number" min="0" value={item.unitPrice} onChange={(e) => updateQuoteItem(index, { unitPrice: e.target.value })} />
                      <Select value={item.discountType} onValueChange={(v) => updateQuoteItem(index, { discountType: v as DiscountType })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="VALOR">R$</SelectItem>
                          <SelectItem value="PERCENTUAL">%</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input className="h-8 text-xs" type="number" min="0" placeholder="Desc." value={item.discountValue} onChange={(e) => updateQuoteItem(index, { discountValue: e.target.value })} />
                    </div>
                  </div>
                )
              })}
              {quoteForm.items.length === 0 && (
                <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">Nenhum produto no orçamento.</p>
              )}
            </div>
            <textarea
              className="min-h-16 w-full resize-none rounded-md border bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring"
              placeholder="Observações comerciais"
              value={quoteForm.notes}
              onChange={(e) => setQuoteForm((f) => ({ ...f, notes: e.target.value }))}
            />
            <div className="flex items-center justify-between rounded-md border bg-emerald-50 px-3 py-2">
              <span className="text-xs text-emerald-900">Total previsto</span>
              <span className="text-base font-bold text-emerald-700">{money(quoteTotalPreview)}</span>
            </div>
            <Button className="h-8 w-full text-xs" onClick={createQuote}>
              <Plus className="size-4" /> Criar orçamento
            </Button>
          </CardContent>
        </Card>

        <Card className="flex min-h-0 flex-col overflow-hidden">
          <CardHeader className="shrink-0 p-3 pb-2">
            <div className="grid gap-2 xl:grid-cols-[1fr_auto]">
              <div>
                <CardTitle className="text-sm">Esteira de orçamentos</CardTitle>
                <CardDescription className="text-[11px]">Operação compacta para muitos atendentes e clientes</CardDescription>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  ["Abertos", quoteMetrics.openCount],
                  ["Aceitos", quoteMetrics.acceptedCount],
                  ["Vencem 3d", quoteMetrics.expiringCount],
                  ["Valor aberto", money(quoteMetrics.openValue)],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-md border bg-muted/30 px-2 py-1">
                    <p className="text-[10px] text-muted-foreground">{String(label)}</p>
                    <p className="truncate text-xs font-bold">{String(value)}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_160px] gap-2">
              <div className="flex h-8 items-center gap-2 rounded-md border bg-white px-2">
                <Search className="size-3.5 text-muted-foreground" />
                <input
                  className="min-w-0 flex-1 bg-transparent text-xs outline-none"
                  placeholder="Buscar número, cliente, telefone, produto ou atendente"
                  value={quoteSearch}
                  onChange={(e) => setQuoteSearch(e.target.value)}
                />
              </div>
              <Select value={quoteStatusFilter} onValueChange={(v) => setQuoteStatusFilter(v as QuoteStatus | "TODOS")}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos status</SelectItem>
                  {(Object.keys(statusLabel) as QuoteStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-auto p-0">
            {loading && <p className="py-6 text-center text-xs text-muted-foreground">Carregando…</p>}
            {!loading && filteredQuotes.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">Nenhum orçamento encontrado.</p>
            )}
            {filteredQuotes.length > 0 && (
              <table className="w-full min-w-[920px] border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-muted/80 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr className="border-y">
                    <th className="px-3 py-2 text-left font-semibold">#</th>
                    <th className="px-3 py-2 text-left font-semibold">Cliente</th>
                    <th className="px-3 py-2 text-left font-semibold">Status</th>
                    <th className="px-3 py-2 text-left font-semibold">Validade</th>
                    <th className="px-3 py-2 text-left font-semibold">Itens</th>
                    <th className="px-3 py-2 text-left font-semibold">Atendente</th>
                    <th className="px-3 py-2 text-right font-semibold">Total</th>
                    <th className="px-3 py-2 text-right font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuotes.map((quote) => {
                    const expired =
                      quote.status !== "ACEITO" &&
                      quote.status !== "CANCELADO" &&
                      new Date(quote.validUntil).getTime() < Date.now()
                    return (
                      <tr key={quote.id} className={cn("border-b bg-white hover:bg-muted/35", expired && "bg-amber-50/60")}>
                        <td className="whitespace-nowrap px-3 py-2 font-semibold">#{quote.number}</td>
                        <td className="max-w-[220px] px-3 py-2">
                          <p className="truncate font-medium">{quote.customer.name}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{quote.customer.phone ?? quote.customer.email ?? "Sem contato"}</p>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={quoteVariant(quote.status)} className="px-1.5 py-0 text-[10px]">{statusLabel[quote.status]}</Badge>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          <span className={cn(expired && "font-semibold text-amber-700")}>{shortDate(quote.validUntil)}</span>
                        </td>
                        <td className="max-w-[220px] px-3 py-2">
                          <p className="truncate">{quote.items.map((i) => i.productName).join(", ")}</p>
                          <p className="text-[11px] text-muted-foreground">{quote.items.length} item(ns) · frete {money(quote.freight)}</p>
                        </td>
                        <td className="max-w-[150px] truncate px-3 py-2">{quote.generatedBy?.name ?? "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-bold text-primary">{money(quote.total)}</td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1">
                            <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => setSelectedQuote(quote)}>
                              <Eye className="size-3" /> Ver
                            </Button>
                            {["RASCUNHO", "ENVIADO", "EXPIRADO"].includes(quote.status) && (
                              <>
                                <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => updateQuoteStatus(quote, "ACEITO")}>
                                  <CheckCircle2 className="size-3" /> Aceitar
                                </Button>
                                <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => updateQuoteStatus(quote, "RECUSADO")}>
                                  Recusar
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <Sheet open={!!selectedQuote} onClose={() => setSelectedQuote(null)} className="w-[50vw] max-w-[700px]">
        <SheetHeader>
          <SheetTitle>Orçamento #{selectedQuote?.number}</SheetTitle>
          <SheetDescription>
            Cliente: {selectedQuote?.customer.name} · Status: {selectedQuote ? statusLabel[selectedQuote.status] : ""}
          </SheetDescription>
        </SheetHeader>
        <SheetContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 rounded-md border bg-muted/20 p-3">
              <div>
                <p className="text-xs text-muted-foreground">Validade</p>
                <p className="text-sm font-medium">{selectedQuote?.validUntil ? shortDate(selectedQuote.validUntil) : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Criado em</p>
                <p className="text-sm font-medium">{selectedQuote?.createdAt ? shortDate(selectedQuote.createdAt) : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Atendente</p>
                <p className="text-sm font-medium">{selectedQuote?.generatedBy?.name ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Enviado em</p>
                <p className="text-sm font-medium">{selectedQuote?.sentAt ? shortDate(selectedQuote.sentAt) : "—"}</p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">ITENS</p>
              <table className="w-full text-xs">
                <thead className="bg-muted/30 text-[10px] uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1 text-left">Produto</th>
                    <th className="px-2 py-1 text-right">Qtd</th>
                    <th className="px-2 py-1 text-right">Unit.</th>
                    <th className="px-2 py-1 text-right">Desc.</th>
                    <th className="px-2 py-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedQuote?.items.map((item) => (
                    <tr key={item.id} className="border-b">
                      <td className="px-2 py-2">{item.productName}</td>
                      <td className="px-2 py-2 text-right">{item.quantity} {item.unit}</td>
                      <td className="px-2 py-2 text-right">{money(item.unitPrice)}</td>
                      <td className="px-2 py-2 text-right">{money(item.discountAmount)}</td>
                      <td className="px-2 py-2 text-right font-medium">{money(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-md border bg-muted/20 p-3">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{money(selectedQuote?.subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Desconto total</span>
                <span className="text-red-600">-{money(selectedQuote?.discountTotal)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Frete</span>
                <span>{money(selectedQuote?.freight)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t pt-2 text-base font-bold">
                <span>Total</span>
                <span className="text-primary">{money(selectedQuote?.total)}</span>
              </div>
            </div>

            {selectedQuote?.notes && (
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">OBSERVAÇÕES</p>
                <p className="rounded-md border bg-muted/20 p-2 text-sm">{selectedQuote.notes}</p>
              </div>
            )}

            <div className="flex gap-2">
              {selectedQuote?.status === "RASCUNHO" && (
                <Button variant="outline" size="sm" className="flex-1" onClick={() => { updateQuoteStatus(selectedQuote, "ENVIADO"); setSelectedQuote(null) }}>
                  Marcar como Enviado
                </Button>
              )}
              {["RASCUNHO", "ENVIADO", "EXPIRADO"].includes(selectedQuote?.status ?? "") && (
                <>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => { updateQuoteStatus(selectedQuote, "ACEITO"); setSelectedQuote(null) }}>
                    <CheckCircle2 className="size-4" /> Aceitar
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => { updateQuoteStatus(selectedQuote, "RECUSADO"); setSelectedQuote(null) }}>
                    Recusar
                  </Button>
                </>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
