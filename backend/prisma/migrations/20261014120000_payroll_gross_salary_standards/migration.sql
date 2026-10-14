CREATE TABLE "PayrollStandardComponent" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "percentage" DECIMAL(5,2) NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollStandardComponent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PayrollStandardComponent_name_key" ON "PayrollStandardComponent"("name");
ALTER TABLE "PayrollConfiguration" ADD COLUMN "customAdditions" JSONB NOT NULL DEFAULT '[]'::jsonb;
UPDATE "PayrollConfiguration" SET "customAdditions" = "benefits", "benefits" = '[]'::jsonb;
ALTER TABLE "PayrollPayslip" ADD COLUMN "recipientEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "PayrollPayslip" SET "recipientEmails" = ARRAY["recipientEmail"];
