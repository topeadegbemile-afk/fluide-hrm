ALTER TABLE "Employee" ADD COLUMN "birthdayNotificationYear" INTEGER;

CREATE TABLE "BirthdayWish" (
  "id" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BirthdayWish_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BirthdayWish_recipientId_createdAt_idx" ON "BirthdayWish"("recipientId", "createdAt");
CREATE INDEX "BirthdayWish_senderId_idx" ON "BirthdayWish"("senderId");
ALTER TABLE "BirthdayWish" ADD CONSTRAINT "BirthdayWish_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BirthdayWish" ADD CONSTRAINT "BirthdayWish_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
