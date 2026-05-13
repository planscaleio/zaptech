import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Package, Plus, Pencil, Search, Tag, X } from "lucide-react"

type Status = "ATIVO" | "INATIVO"

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

function money(value: string | number | null | undefined) {
  const n = Number(value ?? 0)
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number.isFinite(n) ? n : 0)
}

const emptyProductForm = { name: "", sku: "", categoryId: "", unit: "un", price: "", description: "", status: "ATIVO" as Status }

export default function ProdutosPage() {
  const auth = useAuth()
  const companyId = auth?.companyId ?? ""

  const [categories, setCategories] = useState<Category[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [productSearch, setProductSearch] = useState("")

  const emptyCategoryForm = { name: "", description: "", status: "ATIVO" as Status }
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)

  const [productForm, setProductForm] = useState(emptyProductForm)
  const [editingProductId, setEditingProductId] = useState<string | null>(null)

  function refresh() {
    if (!companyId) return
    setLoading(true)
    Promise.all([
      fetch(`/api/product-categories?companyId=${companyId}`).then((r) => r.json()),
      fetch(`/api/products?companyId=${companyId}`).then((r) => r.json()),
    ])
      .then(([nextCategories, nextProducts]) => {
        setCategories(Array.isArray(nextCategories) ? nextCategories : [])
        setProducts(Array.isArray(nextProducts) ? nextProducts : [])
      })
      .catch(() => setError("Não foi possível carregar produtos e categorias."))
      .finally(() => setLoading(false))
  }

  useEffect(() => { refresh() }, [companyId])

  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase()
    if (!term) return products
    return products.filter((p) =>
      [p.name, p.sku ?? "", p.category?.name ?? ""].some((v) => v.toLowerCase().includes(term))
    )
  }, [productSearch, products])

  function startEdit(product: Product) {
    setEditingProductId(product.id)
    setProductForm({
      name: product.name,
      sku: product.sku ?? "",
      categoryId: product.category?.id ?? "",
      unit: product.unit,
      price: product.price,
      description: product.description ?? "",
      status: product.status,
    })
  }

  function cancelEdit() {
    setEditingProductId(null)
    setProductForm(emptyProductForm)
  }

  async function saveProduct() {
    if (!productForm.name.trim()) return
    setError("")

    if (editingProductId) {
      const res = await fetch(`/api/products/${editingProductId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...productForm,
          categoryId: productForm.categoryId || null,
        }),
      })
      if (!res.ok) { setError((await res.json()).error ?? "Erro ao editar produto"); return }
      setEditingProductId(null)
    } else {
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
    }
    setProductForm(emptyProductForm)
    refresh()
  }

  function startEditCategory(category: Category) {
    setEditingCategoryId(category.id)
    setCategoryForm({ name: category.name, description: category.description ?? "", status: category.status })
  }

  function cancelEditCategory() {
    setEditingCategoryId(null)
    setCategoryForm(emptyCategoryForm)
  }

  async function saveCategory() {
    if (!categoryForm.name.trim()) return
    setError("")
    if (editingCategoryId) {
      const res = await fetch(`/api/product-categories/${editingCategoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(categoryForm),
      })
      if (!res.ok) { setError((await res.json()).error ?? "Erro ao editar categoria"); return }
      setEditingCategoryId(null)
    } else {
      const res = await fetch("/api/product-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, ...categoryForm }),
      })
      if (!res.ok) { setError((await res.json()).error ?? "Erro ao criar categoria"); return }
    }
    setCategoryForm(emptyCategoryForm)
    refresh()
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      <Tabs defaultValue="products" className="space-y-3">
        <TabsList className="h-9">
          <TabsTrigger value="products" className="gap-1.5 text-xs"><Package className="size-3.5" />Produtos</TabsTrigger>
          <TabsTrigger value="categories" className="gap-1.5 text-xs"><Tag className="size-3.5" />Categorias</TabsTrigger>
        </TabsList>

        {error && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</div>
        )}

        <TabsContent value="products" className="mt-0">
          <div className="grid h-[calc(100vh-190px)] min-h-[640px] gap-3 xl:grid-cols-[340px_minmax(0,1fr)]">
            <Card className="min-h-0 overflow-hidden">
              <CardHeader className="p-3 pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    {editingProductId ? "Editar produto" : "Novo produto"}
                  </CardTitle>
                  {editingProductId && (
                    <button
                      className="text-muted-foreground hover:text-foreground"
                      onClick={cancelEdit}
                      title="Cancelar edição"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 overflow-y-auto p-3 pt-0">
                <Input
                  placeholder="Nome do produto ou serviço"
                  value={productForm.name}
                  onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="SKU"
                    value={productForm.sku}
                    onChange={(e) => setProductForm((f) => ({ ...f, sku: e.target.value }))}
                  />
                  <Input
                    placeholder="Unidade"
                    value={productForm.unit}
                    onChange={(e) => setProductForm((f) => ({ ...f, unit: e.target.value }))}
                  />
                </div>
                <Input
                  type="number"
                  min="0"
                  placeholder="Preço padrão"
                  value={productForm.price}
                  onChange={(e) => setProductForm((f) => ({ ...f, price: e.target.value }))}
                />
                <Select
                  value={productForm.categoryId || "_none"}
                  onValueChange={(v) => setProductForm((f) => ({ ...f, categoryId: v === "_none" ? "" : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Sem categoria</SelectItem>
                    {categories.filter((c) => c.status === "ATIVO").map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editingProductId && (
                  <Select
                    value={productForm.status}
                    onValueChange={(v) => setProductForm((f) => ({ ...f, status: v as Status }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ATIVO">Ativo</SelectItem>
                      <SelectItem value="INATIVO">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <textarea
                  className="min-h-20 w-full resize-none rounded-md border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Descrição"
                  value={productForm.description}
                  onChange={(e) => setProductForm((f) => ({ ...f, description: e.target.value }))}
                />
                <div className="flex gap-2">
                  {editingProductId && (
                    <Button variant="outline" className="h-8 flex-1 text-xs" onClick={cancelEdit}>
                      Cancelar
                    </Button>
                  )}
                  <Button className="h-8 flex-1 text-xs" onClick={saveProduct}>
                    <Plus className="size-4" />
                    {editingProductId ? "Salvar alterações" : "Salvar produto"}
                  </Button>
                </div>
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
                    <input
                      className="min-w-0 flex-1 bg-transparent text-xs outline-none"
                      placeholder="Buscar produto"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-auto p-0">
                {loading && <p className="py-6 text-center text-xs text-muted-foreground">Carregando…</p>}
                <table className="w-full min-w-[760px] border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-muted/80 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr className="border-y">
                      <th className="px-3 py-2 text-left font-semibold">Produto</th>
                      <th className="px-3 py-2 text-left font-semibold">Categoria</th>
                      <th className="px-3 py-2 text-left font-semibold">SKU</th>
                      <th className="px-3 py-2 text-left font-semibold">Un.</th>
                      <th className="px-3 py-2 text-left font-semibold">Status</th>
                      <th className="px-3 py-2 text-right font-semibold">Preço</th>
                      <th className="px-3 py-2 text-right font-semibold">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => (
                      <tr
                        key={product.id}
                        className={cn(
                          "border-b bg-white hover:bg-muted/35",
                          product.status === "INATIVO" && "bg-muted/35 opacity-70",
                          editingProductId === product.id && "ring-1 ring-inset ring-primary/40",
                        )}
                      >
                        <td className="max-w-[280px] px-3 py-2">
                          <p className="truncate font-medium">{product.name}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{product.description ?? "Sem descrição"}</p>
                        </td>
                        <td className="max-w-[180px] truncate px-3 py-2">{product.category?.name ?? "Sem categoria"}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{product.sku ?? "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2">{product.unit}</td>
                        <td className="px-3 py-2">
                          <Badge variant={product.status === "ATIVO" ? "success" : "secondary"} className="px-1.5 py-0 text-[10px]">
                            {product.status}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-bold text-primary">{money(product.price)}</td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => editingProductId === product.id ? cancelEdit() : startEdit(product)}
                          >
                            <Pencil className="size-3" />
                            {editingProductId === product.id ? "Cancelar" : "Editar"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="categories" className="mt-0">
          <div className="grid h-[calc(100vh-190px)] min-h-[640px] gap-3 xl:grid-cols-[340px_minmax(0,1fr)]">
            <Card className="min-h-0 overflow-hidden">
              <CardHeader className="p-3 pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    {editingCategoryId ? "Editar categoria" : "Nova categoria"}
                  </CardTitle>
                  {editingCategoryId && (
                    <button
                      className="text-muted-foreground hover:text-foreground"
                      onClick={cancelEditCategory}
                      title="Cancelar edição"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 overflow-y-auto p-3 pt-0">
                <Input
                  placeholder="Nome da categoria"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))}
                />
                <textarea
                  className="min-h-20 w-full resize-none rounded-md border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Descrição"
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm((f) => ({ ...f, description: e.target.value }))}
                />
                {editingCategoryId && (
                  <Select
                    value={categoryForm.status}
                    onValueChange={(v) => setCategoryForm((f) => ({ ...f, status: v as Status }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ATIVO">Ativo</SelectItem>
                      <SelectItem value="INATIVO">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                <div className="flex gap-2">
                  {editingCategoryId && (
                    <Button variant="outline" className="h-8 flex-1 text-xs" onClick={cancelEditCategory}>
                      Cancelar
                    </Button>
                  )}
                  <Button className="h-8 flex-1 text-xs" onClick={saveCategory}>
                    <Plus className="size-4" />
                    {editingCategoryId ? "Salvar alterações" : "Salvar categoria"}
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card className="flex min-h-0 flex-col overflow-hidden">
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-sm">Categorias</CardTitle>
                <CardDescription className="text-[11px]">Organização do catálogo comercial</CardDescription>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-auto p-0">
                {loading && <p className="py-6 text-center text-xs text-muted-foreground">Carregando…</p>}
                <table className="w-full min-w-[620px] border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-muted/80 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr className="border-y">
                      <th className="px-3 py-2 text-left font-semibold">Categoria</th>
                      <th className="px-3 py-2 text-left font-semibold">Descrição</th>
                      <th className="px-3 py-2 text-left font-semibold">Status</th>
                      <th className="px-3 py-2 text-right font-semibold">Produtos</th>
                      <th className="px-3 py-2 text-right font-semibold">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((category) => (
                      <tr
                        key={category.id}
                        className={cn(
                          "border-b bg-white hover:bg-muted/35",
                          editingCategoryId === category.id && "ring-1 ring-inset ring-primary/40",
                        )}
                      >
                        <td className="max-w-[220px] truncate px-3 py-2 font-medium">{category.name}</td>
                        <td className="max-w-[360px] truncate px-3 py-2 text-muted-foreground">{category.description ?? "Sem descrição"}</td>
                        <td className="px-3 py-2">
                          <Badge variant={category.status === "ATIVO" ? "success" : "secondary"} className="px-1.5 py-0 text-[10px]">
                            {category.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-primary">{category.productCount}</td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => editingCategoryId === category.id ? cancelEditCategory() : startEditCategory(category)}
                          >
                            <Pencil className="size-3" />
                            {editingCategoryId === category.id ? "Cancelar" : "Editar"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
