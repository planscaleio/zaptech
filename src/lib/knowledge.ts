import { sharedServiceCategories } from "@/lib/categories"

export type KnowledgeStatus = "RASCUNHO" | "PUBLICADO" | "ARQUIVADO"
export type KnowledgeChannel = "WHATSAPP" | "INSTAGRAM" | "SITE" | "EMAIL" | "TELEFONE" | "WEBHOOK"

export type KnowledgeVersion = {
  id: string
  version: number
  status: KnowledgeStatus
  content?: string
  publishedAt?: string | null
  createdAt: string
  updatedAt: string
}

export type KnowledgeArticle = {
  id: string
  companyId: string
  parentId?: string | null
  title: string
  category: string
  content: string
  tags: string[]
  channels: KnowledgeChannel[]
  status: KnowledgeStatus
  createdById?: string | null
  createdBy?: { id: string; name: string } | null
  parent?: { id: string; title: string } | null
  publishedVersionId?: string | null
  draftVersionId?: string | null
  publishedVersion?: KnowledgeVersion | null
  draftVersion?: KnowledgeVersion | null
  versions: KnowledgeVersion[]
  createdAt: string
  updatedAt: string
}

export const knowledgeStatuses: Array<{ value: KnowledgeStatus; label: string }> = [
  { value: "PUBLICADO", label: "Publicado" },
  { value: "RASCUNHO", label: "Rascunho" },
  { value: "ARQUIVADO", label: "Arquivado" },
]

export const knowledgeChannels: Array<{ value: KnowledgeChannel; label: string }> = [
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "EMAIL", label: "E-mail" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "SITE", label: "Site" },
  { value: "TELEFONE", label: "Telefone" },
  { value: "WEBHOOK", label: "Webhook" },
]

export const knowledgeCategories = sharedServiceCategories

export function knowledgeStatusLabel(status: KnowledgeStatus) {
  return knowledgeStatuses.find((item) => item.value === status)?.label ?? status
}

export function knowledgeChannelLabel(channel: KnowledgeChannel) {
  return knowledgeChannels.find((item) => item.value === channel)?.label ?? channel
}

export function normalizeTagInput(value: string): string[] {
  return value.split(",").map((tag) => tag.trim()).filter(Boolean)
}

export function formatKnowledgeChannels(channels: KnowledgeChannel[]) {
  if (channels.length === 0) return "Todos os canais"
  return channels.map(knowledgeChannelLabel).join(", ")
}

export function htmlToPlainText(html: string) {
  if (typeof document === "undefined") return html.replace(/<[^>]+>/g, " ")
  const element = document.createElement("div")
  element.innerHTML = html
  return element.innerText.trim()
}

export function createBlankKnowledgeArticle(companyId: string, createdById?: string | null): KnowledgeArticle {
  const now = new Date().toISOString()
  return {
    id: "",
    companyId,
    parentId: null,
    title: "",
    category: "Geral",
    content: "",
    tags: [],
    channels: [],
    status: "RASCUNHO",
    createdById,
    createdBy: null,
    parent: null,
    publishedVersionId: null,
    draftVersionId: null,
    publishedVersion: null,
    draftVersion: null,
    versions: [],
    createdAt: now,
    updatedAt: now,
  }
}
