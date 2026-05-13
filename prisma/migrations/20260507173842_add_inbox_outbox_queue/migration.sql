-- CreateEnum
CREATE TYPE "InboundStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "OutboundStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "InboundMessage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "waMessageId" TEXT NOT NULL,
    "senderPhone" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "InboundStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboundMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundMessage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'text',
    "body" TEXT,
    "payload" JSONB,
    "status" "OutboundStatus" NOT NULL DEFAULT 'QUEUED',
    "priority" INTEGER NOT NULL DEFAULT 5,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientRequestId" TEXT,
    "waMessageId" TEXT,
    "error" TEXT,
    "createdByUserId" TEXT,
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboundMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InboundMessage_status_nextAttemptAt_idx" ON "InboundMessage"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "InboundMessage_companyId_idx" ON "InboundMessage"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "InboundMessage_instanceId_waMessageId_key" ON "InboundMessage"("instanceId", "waMessageId");

-- CreateIndex
CREATE INDEX "OutboundMessage_status_nextAttemptAt_priority_idx" ON "OutboundMessage"("status", "nextAttemptAt", "priority");

-- CreateIndex
CREATE INDEX "OutboundMessage_conversationId_idx" ON "OutboundMessage"("conversationId");

-- CreateIndex
CREATE INDEX "OutboundMessage_companyId_idx" ON "OutboundMessage"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "OutboundMessage_clientRequestId_key" ON "OutboundMessage"("clientRequestId");

-- AddForeignKey
ALTER TABLE "OutboundMessage" ADD CONSTRAINT "OutboundMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
