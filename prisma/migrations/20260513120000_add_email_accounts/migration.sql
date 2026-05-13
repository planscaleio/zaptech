-- CreateEnum
CREATE TYPE "EmailAccountStatus" AS ENUM ('CONECTADO', 'DESCONECTADO', 'REVISAR', 'ERRO');

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "emailAccountId" TEXT;

-- CreateTable
CREATE TABLE "EmailAccount" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "fromName" TEXT,
  "username" TEXT NOT NULL,
  "passwordEnc" TEXT NOT NULL,
  "imapHost" TEXT NOT NULL,
  "imapPort" INTEGER NOT NULL,
  "imapSecure" BOOLEAN NOT NULL DEFAULT true,
  "smtpHost" TEXT NOT NULL,
  "smtpPort" INTEGER NOT NULL,
  "smtpSecure" BOOLEAN NOT NULL DEFAULT true,
  "mailbox" TEXT NOT NULL DEFAULT 'INBOX',
  "signature" TEXT,
  "status" "EmailAccountStatus" NOT NULL DEFAULT 'DESCONECTADO',
  "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
  "lastSyncAt" TIMESTAMP(3),
  "lastUid" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EmailAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailImportedMessage" (
  "id" TEXT NOT NULL,
  "emailAccountId" TEXT NOT NULL,
  "uid" INTEGER NOT NULL,
  "internetMessageId" TEXT,
  "conversationId" TEXT,
  "messageId" TEXT,
  "subject" TEXT,
  "fromAddress" TEXT,
  "receivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmailImportedMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailAccount_companyId_email_key" ON "EmailAccount"("companyId", "email");
CREATE INDEX "EmailAccount_companyId_idx" ON "EmailAccount"("companyId");
CREATE INDEX "EmailAccount_companyId_status_idx" ON "EmailAccount"("companyId", "status");
CREATE INDEX "EmailAccount_syncEnabled_status_idx" ON "EmailAccount"("syncEnabled", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EmailImportedMessage_emailAccountId_uid_key" ON "EmailImportedMessage"("emailAccountId", "uid");
CREATE UNIQUE INDEX "EmailImportedMessage_emailAccountId_internetMessageId_key" ON "EmailImportedMessage"("emailAccountId", "internetMessageId");
CREATE INDEX "EmailImportedMessage_emailAccountId_idx" ON "EmailImportedMessage"("emailAccountId");
CREATE INDEX "EmailImportedMessage_conversationId_idx" ON "EmailImportedMessage"("conversationId");
CREATE INDEX "Conversation_emailAccountId_idx" ON "Conversation"("emailAccountId");

-- AddForeignKey
ALTER TABLE "EmailAccount" ADD CONSTRAINT "EmailAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailImportedMessage" ADD CONSTRAINT "EmailImportedMessage_emailAccountId_fkey" FOREIGN KEY ("emailAccountId") REFERENCES "EmailAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_emailAccountId_fkey" FOREIGN KEY ("emailAccountId") REFERENCES "EmailAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
