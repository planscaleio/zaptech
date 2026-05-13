CREATE TYPE "CatalogItemStatus" AS ENUM ('ATIVO', 'INATIVO');

CREATE TYPE "QuoteStatus" AS ENUM ('RASCUNHO', 'ENVIADO', 'ACEITO', 'RECUSADO', 'EXPIRADO', 'CANCELADO');

CREATE TYPE "QuoteDiscountType" AS ENUM ('VALOR', 'PERCENTUAL');

CREATE TYPE "QuoteEventType" AS ENUM ('CRIADO', 'ATUALIZADO', 'ENVIADO', 'ACEITO', 'RECUSADO', 'EXPIRADO', 'CANCELADO');

CREATE TABLE "ProductCategory" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "CatalogItemStatus" NOT NULL DEFAULT 'ATIVO',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogProduct" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "categoryId" TEXT,
  "name" TEXT NOT NULL,
  "sku" TEXT,
  "description" TEXT,
  "unit" TEXT NOT NULL DEFAULT 'un',
  "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "status" "CatalogItemStatus" NOT NULL DEFAULT 'ATIVO',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CatalogProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Quote" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "conversationId" TEXT,
  "generatedById" TEXT,
  "number" INTEGER NOT NULL,
  "status" "QuoteStatus" NOT NULL DEFAULT 'RASCUNHO',
  "validUntil" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "freight" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "discountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuoteItem" (
  "id" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "productId" TEXT,
  "productName" TEXT NOT NULL,
  "categoryName" TEXT,
  "sku" TEXT,
  "unit" TEXT NOT NULL DEFAULT 'un',
  "quantity" DECIMAL(12,2) NOT NULL,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "discountType" "QuoteDiscountType",
  "discountValue" DECIMAL(12,2),
  "subtotal" DECIMAL(12,2) NOT NULL,
  "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(12,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QuoteEvent" (
  "id" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "type" "QuoteEventType" NOT NULL,
  "authorId" TEXT,
  "authorName" TEXT NOT NULL DEFAULT 'Sistema',
  "message" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuoteEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductCategory_companyId_name_key" ON "ProductCategory"("companyId", "name");
CREATE INDEX "ProductCategory_companyId_idx" ON "ProductCategory"("companyId");
CREATE INDEX "ProductCategory_companyId_status_idx" ON "ProductCategory"("companyId", "status");

CREATE UNIQUE INDEX "CatalogProduct_companyId_sku_key" ON "CatalogProduct"("companyId", "sku");
CREATE INDEX "CatalogProduct_companyId_idx" ON "CatalogProduct"("companyId");
CREATE INDEX "CatalogProduct_categoryId_idx" ON "CatalogProduct"("categoryId");
CREATE INDEX "CatalogProduct_companyId_status_idx" ON "CatalogProduct"("companyId", "status");

CREATE UNIQUE INDEX "Quote_companyId_number_key" ON "Quote"("companyId", "number");
CREATE INDEX "Quote_companyId_idx" ON "Quote"("companyId");
CREATE INDEX "Quote_customerId_idx" ON "Quote"("customerId");
CREATE INDEX "Quote_conversationId_idx" ON "Quote"("conversationId");
CREATE INDEX "Quote_generatedById_idx" ON "Quote"("generatedById");
CREATE INDEX "Quote_companyId_status_idx" ON "Quote"("companyId", "status");

CREATE INDEX "QuoteItem_quoteId_idx" ON "QuoteItem"("quoteId");
CREATE INDEX "QuoteItem_productId_idx" ON "QuoteItem"("productId");

CREATE INDEX "QuoteEvent_quoteId_idx" ON "QuoteEvent"("quoteId");
CREATE INDEX "QuoteEvent_authorId_idx" ON "QuoteEvent"("authorId");
CREATE INDEX "QuoteEvent_type_idx" ON "QuoteEvent"("type");

ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CatalogProduct" ADD CONSTRAINT "CatalogProduct_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CatalogProduct" ADD CONSTRAINT "CatalogProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CatalogProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuoteEvent" ADD CONSTRAINT "QuoteEvent_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuoteEvent" ADD CONSTRAINT "QuoteEvent_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
