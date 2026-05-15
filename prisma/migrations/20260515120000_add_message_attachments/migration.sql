CREATE TYPE "MessageAttachmentType" AS ENUM ('IMAGE', 'AUDIO', 'DOCUMENT', 'VIDEO');

CREATE TABLE "MessageAttachment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT,
    "type" "MessageAttachmentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER,
    "url" TEXT NOT NULL,
    "storagePath" TEXT,
    "source" TEXT NOT NULL DEFAULT 'LOCAL',
    "externalUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MessageAttachment_companyId_idx" ON "MessageAttachment"("companyId");
CREATE INDEX "MessageAttachment_conversationId_idx" ON "MessageAttachment"("conversationId");
CREATE INDEX "MessageAttachment_messageId_idx" ON "MessageAttachment"("messageId");
CREATE INDEX "MessageAttachment_type_idx" ON "MessageAttachment"("type");

ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
