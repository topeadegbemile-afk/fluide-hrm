ALTER TABLE "Employee" ADD COLUMN "workAnniversaryNotificationYear" INTEGER;
ALTER TABLE "BirthdayWish" ADD COLUMN "celebrationType" "CelebrationType" NOT NULL DEFAULT 'BIRTHDAY';
