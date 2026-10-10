-- CreateEnum
CREATE TYPE "CelebrationType" AS ENUM ('BIRTHDAY', 'WORK_ANNIVERSARY', 'TEAM_ACHIEVEMENT', 'COMPANY_EVENT', 'HOLIDAY', 'RECOGNITION', 'OTHER');

-- CreateTable
CREATE TABLE "Celebration" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "CelebrationType" NOT NULL DEFAULT 'OTHER',
    "description" TEXT,
    "eventDate" TIMESTAMP(3),
    "location" TEXT,
    "imageUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Celebration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Celebration_type_idx" ON "Celebration"("type");

-- CreateIndex
CREATE INDEX "Celebration_isPublished_idx" ON "Celebration"("isPublished");

-- CreateIndex
CREATE INDEX "Celebration_eventDate_idx" ON "Celebration"("eventDate");

-- AddForeignKey
ALTER TABLE "Celebration" ADD CONSTRAINT "Celebration_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
