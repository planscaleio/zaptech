-- AlterTable
ALTER TABLE "AIAudit" ADD COLUMN     "attendantId" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "dimension" TEXT;

-- CreateIndex
CREATE INDEX "AIAudit_companyId_category_idx" ON "AIAudit"("companyId", "category");

-- CreateIndex
CREATE INDEX "AIAudit_companyId_dimension_idx" ON "AIAudit"("companyId", "dimension");

-- CreateIndex
CREATE INDEX "AIAudit_attendantId_idx" ON "AIAudit"("attendantId");

-- AddForeignKey
ALTER TABLE "AIAudit" ADD CONSTRAINT "AIAudit_attendantId_fkey" FOREIGN KEY ("attendantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
