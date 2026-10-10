ALTER TABLE "User"
ADD COLUMN "setupTokenHash" TEXT,
ADD COLUMN "setupTokenExpiresAt" TIMESTAMP(3);
