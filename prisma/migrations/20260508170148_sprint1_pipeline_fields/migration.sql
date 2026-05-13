-- CreateEnum
CREATE TYPE "KanbanCloseType" AS ENUM ('GANHO', 'PERDIDO', 'CANCELADO');

-- AlterTable
ALTER TABLE "KanbanCard" ADD COLUMN     "assignedUserId" TEXT,
ADD COLUMN     "closeReason" TEXT,
ADD COLUMN     "closeType" "KanbanCloseType";

-- AlterTable
ALTER TABLE "KanbanColumn" ADD COLUMN     "probability" INTEGER,
ADD COLUMN     "slaHours" INTEGER;

-- CreateIndex
CREATE INDEX "KanbanCard_assignedUserId_idx" ON "KanbanCard"("assignedUserId");

-- AddForeignKey
ALTER TABLE "KanbanCard" ADD CONSTRAINT "KanbanCard_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
