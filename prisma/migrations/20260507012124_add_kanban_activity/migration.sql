-- CreateEnum
CREATE TYPE "KanbanActivityType" AS ENUM ('NOTA', 'LIGACAO', 'EMAIL', 'REUNIAO', 'TAREFA', 'WHATSAPP');

-- AlterTable
ALTER TABLE "KanbanCard" ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "expectedCloseAt" TIMESTAMP(3),
ADD COLUMN     "value" DECIMAL(14,2);

-- CreateTable
CREATE TABLE "KanbanActivity" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "type" "KanbanActivityType" NOT NULL DEFAULT 'NOTA',
    "title" TEXT,
    "content" TEXT NOT NULL,
    "doneAt" TIMESTAMP(3),
    "authorName" TEXT NOT NULL DEFAULT 'Sistema',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KanbanActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KanbanActivity_cardId_idx" ON "KanbanActivity"("cardId");

-- AddForeignKey
ALTER TABLE "KanbanActivity" ADD CONSTRAINT "KanbanActivity_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "KanbanCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
