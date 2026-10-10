-- CreateTable
CREATE TABLE "HandbookArticle" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HandbookArticle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HandbookArticle_slug_key" ON "HandbookArticle"("slug");

-- CreateIndex
CREATE INDEX "HandbookArticle_category_idx" ON "HandbookArticle"("category");

-- CreateIndex
CREATE INDEX "HandbookArticle_isPublished_publishedAt_idx" ON "HandbookArticle"("isPublished", "publishedAt");

-- CreateIndex
CREATE INDEX "HandbookArticle_createdById_idx" ON "HandbookArticle"("createdById");

-- AddForeignKey
ALTER TABLE "HandbookArticle" ADD CONSTRAINT "HandbookArticle_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
