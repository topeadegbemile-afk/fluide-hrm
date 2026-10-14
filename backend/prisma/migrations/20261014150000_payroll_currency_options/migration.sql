ALTER TABLE "PayrollConfiguration"
ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'NGN';

CREATE TABLE "PayrollCurrencyOption" (
  "code" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollCurrencyOption_pkey" PRIMARY KEY ("code")
);

INSERT INTO "PayrollCurrencyOption" ("code") VALUES ('NGN'), ('USD'), ('GBP'), ('SEK')
ON CONFLICT ("code") DO NOTHING;
