/*
  Warnings:

  - The `score` column on the `KanbanCard` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "KanbanCard" ADD COLUMN     "scoreBreakdown" JSONB,
DROP COLUMN "score",
ADD COLUMN     "score" INTEGER;
