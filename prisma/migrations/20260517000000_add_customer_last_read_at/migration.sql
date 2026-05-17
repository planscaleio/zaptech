-- AlterTable: add customerLastReadAt for WhatsApp read receipts
ALTER TABLE "Conversation" ADD COLUMN "customerLastReadAt" TIMESTAMP(3);
