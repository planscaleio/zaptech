import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  CheckCircle2,
  ClipboardList,
  DollarSign,
  Package,
  Plus,
  Search,
  Tag,
  X,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

type Status = "ATIVO" | "INATIVO"
type QuoteStatus = "RASCUNHO" | "ENVIADO" | "ACEITO" | "RECUSADO" | "EXPIRADO" | "CANCELADO"
type DiscountType = "VALOR" | "PERCENTUAL"

interface Category {
  id: string
  name: string
  description: string | null
  status: Status
  productCount: number
}

interface Product {
  id: string
  name: string
  sku: string | null
  description: string | null
  unit: string
  price: string
  status: Status
  category: { id: string; name: string; status: Status } | null
}

interface Customer {
  id: string
  name: string
  phone: string | null
  email: string | null
  companyName: string | null
}

interface QuoteItem {
  id: string
  productName: string
  categoryName: string | null
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
    const rawDiscount = item.discountType === "PERCENTUAL"
      ? subtotal * Math.min(Number(item.discountValue || 0), 100) / 100
      : Number(item.discountValue || 0)
    return sum + Math.max(0, subtotal - Math.min(subtotal, Math.max(0, rawDiscount)))
  }, Math.max(0, Number(freight || 0)))
}

export default function ProdutosOrcamentosPage() {
  const auth = useAuth()
  const companyId = auth?.companyId ?? ""

  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [quoteSearch, setQuoteSearch] = useState("")
  const [quoteStatusFilter, setQuoteStatusFilter] = useState<QuoteStatus | "TODOS">("TODOS")
  const [productSearch, setProductSearch] = useState("")

  const [categoryForm, setCategoryForm] = useState({ name: "", description: "" })
  const [productForm, setProductForm] = useState({ name: "", sku: "", categoryId: "", unit: "un", price: "", description: "" })
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
      fetch(`/api/product-categories?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/products?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/quotes?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/customers?companyId=${companyId}`).then((r) => r.json()),
    ])
      .then(([nextCategories, nextProducts, nextQuotes, nextCustomers]) => {
        setCategories(Array.isArray(nextCategories) ? nextCategories : [])
        setProducts(Array.isArray(nextProducts) ? nextProducts : [])
        setQuotes(Array.isArray(nextQuotes) ? nextQuotes : [])
        setCustomers(Array.isArray(nextCustomers) ? nextCustomers : [])
      })
      .catch(() => setError("Não foi possível carregar produtos e orçamentos."))
      .finally(() => setLoading(false))
  }

  useEffect(() => { refresh() }, [companyId])

  const activeProducts = useMemo(() => products.filter((p) => p.status === "ATIVO"), [products])
  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase()
    if (!term) return products
    return products.filter((product) =>
      [product.name, product.sku ?? "", product.category?.name ?? ""].some((value) => value.toLowerCase().includes(term))
    )
  }, [productSearch, products])
  const filteredQuotes = useMemo(() => {
    const term = quoteSearch.trim().toLowerCase()
    return quotes
      .filter((quote) => quoteStatusFilter === "TODOS" || quote.status === quoteStatusFilter)
      .filter((quote) => {
        if (!term) return true
        return [
          String(quote.number),
          quote.customer.name,
          quote.customer.phone ?? "",
          quote.customer.email ?? "",
          quote.generatedBy?.name ?? "",
          quote.items.map((item) => item.productName).join(" "),
        ].some((value) => value.toLowerCase().includes(term))
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
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
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

  async function createCategory() {
    if (!categoryForm.name.trim()) return
    setError("")
    const res = await fetch("/api/product-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, ...categoryForm }),
    })
    if (!res.ok) { setError((await res.json()).error ?? "Erro ao criar categoria"); return }
    setCategoryForm({ name: "", description: "" })
    refresh()
  }

  async function createProduct() {
    if (!productForm.name.trim()) return
    setError("")
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        ...productForm,
        categoryId: productForm.categoryId || null,
      }),
    })
    if (!res.ok) { setError((await res.json()).error ?? "Erro ao criar produto"); return }
    setProductForm({ name: "", sku: "", categoryId: "", unit: "un", price: "", description: "" })
    refresh()
  }

  async function createQuote(sendAfterCreate = false) {
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
    if (sendAfterCreate) setError("Orçamento criado. Para enviar pelo WhatsApp, crie-o a partir de uma conversa vinculada.")
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
      <Tabs defaultValue="quotes" className="space-y-3">
        <TabsList className="h-9">
          <TabsTrigger value="quotes" className="gap-1.5 text-xs"><ClipboardList className="size-3.5" />Orçamentos</TabsTrigger>
          <TabsTrigger value="products" className="gap-1.5 text-xs"><Package className="size-3.5" />Produtos</TabsTrigger>
          <TabsTrigger value="categories" className="gap-1.5 text-xs"><Tag className="size-3.5" />Categorias</TabsTrigger>
        </TabsList>

        {error && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</div>
        )}

        <TabsContent value="quotes" className="mt-0">
          <div className="grid h-[calc(100vh-190px)] min-h-[640px] gap-3 xl:grid-cols-[380px_minmax(0,1fr)]">
            <Card className="min-h-0 overflow-hidden">
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-sm">Novo orçamento</CardTitle>
                <CardDescription className="text-[11px]">Criação rápida para alto volume</CardDescription>
              </CardHeader>
              <CardContent className="min-h-0 space-y-2 overflow-y-auto p-3 pt-0">
                <Select value={quoteForm.customerId || "_none"} onValueChange={(value) => setQuoteForm((f) => ({ ...f, customerId: value === "_none" ? "" : value }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Cliente" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Selecione um cliente</SelectItem>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-2">
                  <Input className="h-8 text-xs" type="date" value={quoteForm.validUntil} onChange={(e) => setQuoteForm((f) => ({ ...f, validUntil: e.target.value }))} />
                  <Input className="h-8 text-xs" type="number" min="0" placeholder="Frete" value={quoteForm.freight} onChange={(e) => setQuoteForm((f) => ({ ...f, freight: e.target.value }))} />
                </div>
                <Select value="_none" onValueChange={(value) => value !== "_none" && addQuoteItem(value)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Adicionar produto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Adicionar produto</SelectItem>
                    {activeProducts.map((product) => (
                      <SelectItem key={product.id} value={product.id}>{product.name} · {money(product.price)}</SelectItem>
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
                          <Select value={item.discountType} onValueChange={(value) => updateQuoteItem(index, { discountType: value as DiscountType })}>
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
                  {quoteForm.items.length === 0 && <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">Nenhum produto no orçamento.</p>}
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
                <Button className="h-8 w-full text-xs" onClick={() => createQuote(false)}>
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
                  <Select value={quoteStatusFilter} onValueChange={(value) => setQuoteStatusFilter(value as QuoteStatus | "TODOS")}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODOS">Todos status</SelectItem>
                      {(Object.keys(statusLabel) as QuoteStatus[]).map((status) => (
                        <SelectItem key={status} value={status}>{statusLabel[status]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-auto p-0">
                {loading && <p className="py-6 text-center text-xs text-muted-foreground">Carregando…</p>}
                {!loading && filteredQuotes.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">Nenhum orçamento encontrado.</p>}
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
                        const expired = quote.status !== "ACEITO" && quote.status !== "CANCELADO" && new Date(quote.validUntil).getTime() < Date.now()
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
                              <p className="truncate">{quote.items.map((item) => item.productName).join(", ")}</p>
                              <p className="text-[11px] text-muted-foreground">{quote.items.length} item(ns) · frete {money(quote.freight)}</p>
                            </td>
                            <td className="max-w-[150px] truncate px-3 py-2">{quote.generatedBy?.name ?? "—"}</td>
                            <td className="whitespace-nowrap px-3 py-2 text-right font-bold text-primary">{money(quote.total)}</td>
                            <td className="px-3 py-2">
                              <div className="flex justify-end gap-1">
                                {quote.status !== "ACEITO" && (
                                  <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={() => updateQuoteStatus(quote, "ACEITO")}>
                                    <CheckCircle2 className="size-3" /> Aceitar
                                  </Button>
                                )}
                                {quote.status !== "RECUSADO" && (
                                  <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => updateQuoteStatus(quote, "RECUSADO")}>
                                    Recusar
                                  </Button>
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
        </TabsContent>

        <TabsContent value="products" className="mt-0">
          <div className="grid h-[calc(100vh-190px)] min-h-[640px] gap-3 xl:grid-cols-[340px_minmax(0,1fr)]">
            <Card className="min-h-0 overflow-hidden">
              <CardHeader className="p-3 pb-2"><CardTitle className="text-sm">Novo produto</CardTitle></CardHeader>
              <CardContent className="space-y-2 overflow-y-auto p-3 pt-0">
                <Input placeholder="Nome do produto ou serviço" value={productForm.name} onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="SKU" value={productForm.sku} onChange={(e) => setProductForm((f) => ({ ...f, sku: e.target.value }))} />
                  <Input placeholder="Unidade" value={productForm.unit} onChange={(e) => setProductForm((f) => ({ ...f, unit: e.target.value }))} />
                </div>
                <Input type="number" min="0" placeholder="Preço padrão" value={productForm.price} onChange={(e) => setProductForm((f) => ({ ...f, price: e.target.value }))} />
                <Select value={productForm.categoryId || "_none"} onValueChange={(value) => setProductForm((f) => ({ ...f, categoryId: value === "_none" ? "" : value }))}>
                  <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Sem categoria</SelectItem>
                    {categories.filter((c) => c.status === "ATIVO").map((category) => (
                      <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <textarea
                  className="min-h-20 w-full resize-none rounded-md border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Descrição"
                  value={productForm.description}
                  onChange={(e) => setProductForm((f) => ({ ...f, description: e.target.value }))}
                />
                <Button className="h-8 w-full text-xs" onClick={createProduct}><Plus className="size-4" />Salvar produto</Button>
              </CardContent>
            </Card>
            <Card className="flex min-h-0 flex-col overflow-hidden">
              <CardHeader className="shrink-0 p-3 pb-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm">Catálogo</CardTitle>
                    <CardDescription className="text-[11px]">Produtos ativos e inativos da empresa</CardDescription>
                  </div>
                  <div className="flex h-8 w-64 items-center gap-2 rounded-md border px-2">
                    <Search className="size-3.5 text-muted-foreground" />
                    <input className="min-w-0 flex-1 bg-transparent text-xs outline-none" placeholder="Buscar produto" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-auto p-0">
                <table className="w-full min-w-[760px] border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-muted/80 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr className="border-y">
                      <th className="px-3 py-2 text-left font-semibold">Produto</th>
                      <th className="px-3 py-2 text-left font-semibold">Categoria</th>
                      <th className="px-3 py-2 text-left font-semibold">SKU</th>
                      <th className="px-3 py-2 text-left font-semibold">Un.</th>
                      <th className="px-3 py-2 text-left font-semibold">Status</th>
                      <th className="px-3 py-2 text-right font-semibold">Preço</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => (
                      <tr key={product.id} className={cn("border-b bg-white hover:bg-muted/35", product.status === "INATIVO" && "bg-muted/35 opacity-70")}>
                        <td className="max-w-[280px] px-3 py-2">
                          <p className="truncate font-medium">{product.name}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{product.description ?? "Sem descrição"}</p>
                        </td>
                        <td className="max-w-[180px] truncate px-3 py-2">{product.category?.name ?? "Sem categoria"}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{product.sku ?? "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2">{product.unit}</td>
                        <td className="px-3 py-2"><Badge variant={product.status === "ATIVO" ? "success" : "secondary"} className="px-1.5 py-0 text-[10px]">{product.status}</Badge></td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-bold text-primary">{money(product.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="categories" className="mt-0">
          <div className="grid gap-3 xl:grid-cols-[340px_minmax(0,1fr)]">
            <Card>
              <CardHeader className="p-3 pb-2"><CardTitle className="text-sm">Nova categoria</CardTitle></CardHeader>
              <CardContent className="space-y-2 p-3 pt-0">
                <Input placeholder="Nome da categoria" value={categoryForm.name} onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))} />
                <textarea
                  className="min-h-20 w-full resize-none rounded-md border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Descrição"
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm((f) => ({ ...f, description: e.target.value }))}
                />
                <Button className="h-8 w-full text-xs" onClick={createCategory}><Plus className="size-4" />Salvar categoria</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-sm">Categorias</CardTitle>
                <CardDescription className="text-[11px]">Organização do catálogo comercial</CardDescription>
              </CardHeader>
              <CardContent className="overflow-auto p-0">
                <table className="w-full min-w-[620px] border-collapse text-xs">
                  <thead className="bg-muted/80 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr className="border-y">
                      <th className="px-3 py-2 text-left font-semibold">Categoria</th>
                      <th className="px-3 py-2 text-left font-semibold">Descrição</th>
                      <th className="px-3 py-2 text-left font-semibold">Status</th>
                      <th className="px-3 py-2 text-right font-semibold">Produtos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((category) => (
                      <tr key={category.id} className="border-b bg-white hover:bg-muted/35">
                        <td className="max-w-[220px] truncate px-3 py-2 font-medium">{category.name}</td>
                        <td className="max-w-[360px] truncate px-3 py-2 text-muted-foreground">{category.description ?? "Sem descrição"}</td>
                        <td className="px-3 py-2"><Badge variant={category.status === "ATIVO" ? "success" : "secondary"} className="px-1.5 py-0 text-[10px]">{category.status}</Badge></td>
                        <td className="px-3 py-2 text-right font-semibold text-primary">{category.productCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-3 grid gap-2 md:grid-cols-4">
        {([
          ["Produtos ativos", activeProducts.length, Package],
          ["Categorias", categories.length, Tag],
          ["Orçamentos", quotes.length, ClipboardList],
          ["Pipeline cotado", money(quotes.filter((q) => q.status !== "CANCELADO" && q.status !== "RECUSADO").reduce((sum, q) => sum + Number(q.total), 0)), DollarSign],
        ] as Array<[string, string | number, LucideIcon]>).map(([label, value, Icon]) => (
          <div key={String(label)} className="flex items-center gap-3 rounded-lg border bg-white p-3">
            <span className="flex size-9 items-center justify-center rounded-md bg-muted"><Icon className="size-4 text-muted-foreground" /></span>
            <span>
              <span className="block text-xs text-muted-foreground">{String(label)}</span>
              <span className="block text-sm font-bold">{String(value)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
