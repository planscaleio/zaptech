-- AlterTable: add transferredAt and transferredBy to Conversation
ALTER TABLE "Conversation" ADD COLUMN "transferredAt" TIMESTAMP(3),
                             ADD COLUMN "transferredBy" TEXT;

-- AlterTable: add maxWaitMinutes to Company
ALTER TABLE "Company" ADD COLUMN "maxWaitMinutes" INTEGER DEFAULT 30;

-- CreateIndex
CREATE INDEX "Conversation_transferredAt_idx" ON "Conversation"("transferredAt");