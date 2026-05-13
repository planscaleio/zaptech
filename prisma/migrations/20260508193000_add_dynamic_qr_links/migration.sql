-- CreateEnum
CREATE TYPE "DynamicQrStatus" AS ENUM ('ATIVO', 'PAUSADO', 'ARQUIVADO');

-- CreateTable
CREATE TABLE "CompanyWhatsAppRouting" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "activePhone" TEXT,
    "backupPhones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "defaultMessage" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyWhatsAppRouting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DynamicQrLink" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "campaignId" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "messageTemplate" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "status" "DynamicQrStatus" NOT NULL DEFAULT 'ATIVO',
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "lastClickedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DynamicQrLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DynamicQrClick" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "destinationPhone" TEXT NOT NULL,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "referrer" TEXT,

    CONSTRAINT "DynamicQrClick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyWhatsAppRouting_companyId_key" ON "CompanyWhatsAppRouting"("companyId");
CREATE INDEX "CompanyWhatsAppRouting_companyId_idx" ON "CompanyWhatsAppRouting"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "DynamicQrLink_slug_key" ON "DynamicQrLink"("slug");
CREATE INDEX "DynamicQrLink_companyId_idx" ON "DynamicQrLink"("companyId");
CREATE INDEX "DynamicQrLink_companyId_status_idx" ON "DynamicQrLink"("companyId", "status");
CREATE INDEX "DynamicQrLink_campaignId_idx" ON "DynamicQrLink"("campaignId");

-- CreateIndex
CREATE INDEX "DynamicQrClick_linkId_clickedAt_idx" ON "DynamicQrClick"("linkId", "clickedAt");
CREATE INDEX "DynamicQrClick_companyId_clickedAt_idx" ON "DynamicQrClick"("companyId", "clickedAt");

-- AddForeignKey
ALTER TABLE "CompanyWhatsAppRouting" ADD CONSTRAINT "CompanyWhatsAppRouting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DynamicQrLink" ADD CONSTRAINT "DynamicQrLink_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DynamicQrLink" ADD CONSTRAINT "DynamicQrLink_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DynamicQrClick" ADD CONSTRAINT "DynamicQrClick_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "DynamicQrLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DynamicQrClick" ADD CONSTRAINT "DynamicQrClick_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
