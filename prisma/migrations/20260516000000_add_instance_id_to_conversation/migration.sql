-- AlterTable: add instanceId to Conversation (nome da instância Evolution que recebeu a mensagem)
ALTER TABLE "Conversation" ADD COLUMN "instanceId" TEXT;
