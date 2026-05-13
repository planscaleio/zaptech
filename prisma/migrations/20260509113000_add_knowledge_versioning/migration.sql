-- AlterTable
ALTER TABLE "KnowledgeArticle"
ADD COLUMN "parentId" TEXT,
ADD COLUMN "publishedVersionId" TEXT,
ADD COLUMN "draftVersionId" TEXT;

-- CreateTable
CREATE TABLE "KnowledgeArticleVersion" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "createdById" TEXT,
    "version" INTEGER NOT NULL,
    "status" "KnowledgeArticleStatus" NOT NULL DEFAULT 'RASCUNHO',
    "content" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeArticleVersion_pkey" PRIMARY KEY ("id")
);

-- Backfill one version per existing article so current content is preserved.
INSERT INTO "KnowledgeArticleVersion" (
    "id",
    "articleId",
    "createdById",
    "version",
    "status",
    "content",
    "publishedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    'kav_' || md5(random()::text || "id"),
    "id",
    "createdById",
    1,
    CASE WHEN "status" = 'PUBLICADO' THEN 'PUBLICADO'::"KnowledgeArticleStatus" ELSE 'RASCUNHO'::"KnowledgeArticleStatus" END,
    "content",
    CASE WHEN "status" = 'PUBLICADO' THEN "updatedAt" ELSE NULL END,
    "createdAt",
    "updatedAt"
FROM "KnowledgeArticle";

-- Link articles to their current published or draft version.
UPDATE "KnowledgeArticle" a
SET "publishedVersionId" = v."id"
FROM "KnowledgeArticleVersion" v
WHERE v."articleId" = a."id"
  AND v."status" = 'PUBLICADO';

UPDATE "KnowledgeArticle" a
SET "draftVersionId" = v."id"
FROM "KnowledgeArticleVersion" v
WHERE v."articleId" = a."id"
  AND v."status" = 'RASCUNHO';

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeArticleVersion_articleId_version_key" ON "KnowledgeArticleVersion"("articleId", "version");

-- CreateIndex
CREATE INDEX "KnowledgeArticleVersion_articleId_idx" ON "KnowledgeArticleVersion"("articleId");

-- CreateIndex
CREATE INDEX "KnowledgeArticleVersion_createdById_idx" ON "KnowledgeArticleVersion"("createdById");

-- CreateIndex
CREATE INDEX "KnowledgeArticleVersion_status_idx" ON "KnowledgeArticleVersion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeArticle_publishedVersionId_key" ON "KnowledgeArticle"("publishedVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeArticle_draftVersionId_key" ON "KnowledgeArticle"("draftVersionId");

-- CreateIndex
CREATE INDEX "KnowledgeArticle_parentId_idx" ON "KnowledgeArticle"("parentId");

-- AddForeignKey
ALTER TABLE "KnowledgeArticle" ADD CONSTRAINT "KnowledgeArticle_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "KnowledgeArticle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeArticle" ADD CONSTRAINT "KnowledgeArticle_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "KnowledgeArticleVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeArticle" ADD CONSTRAINT "KnowledgeArticle_draftVersionId_fkey" FOREIGN KEY ("draftVersionId") REFERENCES "KnowledgeArticleVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeArticleVersion" ADD CONSTRAINT "KnowledgeArticleVersion_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "KnowledgeArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeArticleVersion" ADD CONSTRAINT "KnowledgeArticleVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
