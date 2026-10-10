CREATE TABLE "PolicyAttachment" (
  "id" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PolicyAttachment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PolicyAttachment_storageKey_key" ON "PolicyAttachment"("storageKey");
CREATE INDEX "PolicyAttachment_articleId_idx" ON "PolicyAttachment"("articleId");
ALTER TABLE "PolicyAttachment" ADD CONSTRAINT "PolicyAttachment_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "HandbookArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
