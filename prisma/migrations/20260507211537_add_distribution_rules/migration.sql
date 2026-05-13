-- CreateEnum
CREATE TYPE "RuleActionType" AS ENUM ('TEAM', 'SPECIFIC_USER', 'EXISTING_OWNER', 'QUEUE');

-- CreateEnum
CREATE TYPE "RuleStrategy" AS ENUM ('ROUND_ROBIN', 'LOWEST_LOAD', 'EXISTING_OWNER', 'MANUAL');

-- CreateEnum
CREATE TYPE "RuleFallback" AS ENUM ('QUEUE', 'NEXT_RULE');

-- CreateTable
CREATE TABLE "DistributionRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "conditions" JSONB NOT NULL,
    "actionType" "RuleActionType" NOT NULL,
    "targetTeamId" TEXT,
    "targetUserId" TEXT,
    "strategy" "RuleStrategy" NOT NULL DEFAULT 'ROUND_ROBIN',
    "fallback" "RuleFallback" NOT NULL DEFAULT 'QUEUE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DistributionRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DistributionRule_companyId_active_priority_idx" ON "DistributionRule"("companyId", "active", "priority");

-- AddForeignKey
ALTER TABLE "DistributionRule" ADD CONSTRAINT "DistributionRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributionRule" ADD CONSTRAINT "DistributionRule_targetTeamId_fkey" FOREIGN KEY ("targetTeamId") REFERENCES "SalesTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DistributionRule" ADD CONSTRAINT "DistributionRule_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
