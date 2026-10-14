ALTER TABLE "PayrollConfiguration" ADD COLUMN IF NOT EXISTS "customAdditions" JSONB NOT NULL DEFAULT '[]'::jsonb;
UPDATE "PayrollConfiguration"
SET "customAdditions" = "benefits", "benefits" = '[]'::jsonb
WHERE "customAdditions" = '[]'::jsonb AND "benefits" <> '[]'::jsonb;

ALTER TABLE "PayrollPayslip" ADD COLUMN IF NOT EXISTS "recipientEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "PayrollPayslip"
SET "recipientEmails" = ARRAY["recipientEmail"]
WHERE cardinality("recipientEmails") = 0 AND "recipientEmail" <> '';
