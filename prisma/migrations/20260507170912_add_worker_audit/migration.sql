-- CreateEnum
CREATE TYPE "WorkerRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL');

-- CreateTable
CREATE TABLE "WorkerRun" (
    "id" TEXT NOT NULL,
    "worker" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" "WorkerRunStatus" NOT NULL DEFAULT 'RUNNING',
    "companyId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "itemsTotal" INTEGER,
    "itemsProcessed" INTEGER,
    "itemsFailed" INTEGER,
    "meta" JSONB,
    "error" TEXT,

    CONSTRAINT "WorkerRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerLog" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "itemId" TEXT,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkerRun_worker_idx" ON "WorkerRun"("worker");

-- CreateIndex
CREATE INDEX "WorkerRun_worker_startedAt_idx" ON "WorkerRun"("worker", "startedAt");

-- CreateIndex
CREATE INDEX "WorkerRun_status_idx" ON "WorkerRun"("status");

-- CreateIndex
CREATE INDEX "WorkerRun_companyId_idx" ON "WorkerRun"("companyId");

-- CreateIndex
CREATE INDEX "WorkerLog_runId_idx" ON "WorkerLog"("runId");

-- CreateIndex
CREATE INDEX "WorkerLog_runId_level_idx" ON "WorkerLog"("runId", "level");

-- CreateIndex
CREATE INDEX "WorkerLog_itemId_idx" ON "WorkerLog"("itemId");

-- AddForeignKey
ALTER TABLE "WorkerLog" ADD CONSTRAINT "WorkerLog_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkerRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
