ALTER TABLE "EmployeePersonalInformation"
  ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "reviewComment" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "EmployeePersonalInformation"
SET "reviewStatus" = 'APPROVED', "reviewedAt" = "updatedAt"
WHERE "createdAt" < CURRENT_TIMESTAMP;

CREATE INDEX "EmployeePersonalInformation_reviewStatus_submittedAt_idx"
  ON "EmployeePersonalInformation"("reviewStatus", "submittedAt");
