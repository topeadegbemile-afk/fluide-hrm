CREATE TABLE "Office" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "approvedNetworks" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "networkConfiguredAt" TIMESTAMP(3),
  "configuredById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Office_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Office_code_key" ON "Office"("code");
CREATE INDEX "Office_isActive_idx" ON "Office"("isActive");
ALTER TABLE "Office" ADD CONSTRAINT "Office_configuredById_fkey" FOREIGN KEY ("configuredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
INSERT INTO "Office" ("id", "name", "code", "address", "updatedAt") VALUES
  ('office-abuja', 'Fluide Homes Abuja', 'ABJ', '8 Tarkwa Cres, Wuse, Abuja 904101, Federal Capital Territory, Nigeria', CURRENT_TIMESTAMP),
  ('office-lagos', 'Fluide Homes Lagos', 'LOS', '27A Admiralty Way, Lekki Phase I, Lagos, Nigeria', CURRENT_TIMESTAMP);

ALTER TABLE "Employee" ADD COLUMN "officeId" TEXT;
CREATE INDEX "Employee_officeId_idx" ON "Employee"("officeId");
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SecuritySettings" (
  "id" TEXT NOT NULL DEFAULT 'global',
  "attendanceOfficeEnforcement" BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SecuritySettings_pkey" PRIMARY KEY ("id")
);
INSERT INTO "SecuritySettings" ("id", "updatedAt") VALUES ('global', CURRENT_TIMESTAMP);

CREATE TABLE "SecurityDevice" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "credentialHash" TEXT NOT NULL,
  "label" TEXT,
  "userAgent" TEXT,
  "lastIpAddress" TEXT,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecurityDevice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SecurityDevice_credentialHash_key" ON "SecurityDevice"("credentialHash");
CREATE INDEX "SecurityDevice_userId_revokedAt_idx" ON "SecurityDevice"("userId", "revokedAt");
ALTER TABLE "SecurityDevice" ADD CONSTRAINT "SecurityDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DeviceReplacementRequest" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeviceReplacementRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DeviceReplacementRequest_status_createdAt_idx" ON "DeviceReplacementRequest"("status", "createdAt");
CREATE INDEX "DeviceReplacementRequest_userId_idx" ON "DeviceReplacementRequest"("userId");
CREATE UNIQUE INDEX "DeviceReplacementRequest_one_pending_user_idx" ON "DeviceReplacementRequest"("userId") WHERE "status" = 'PENDING';
ALTER TABLE "DeviceReplacementRequest" ADD CONSTRAINT "DeviceReplacementRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceReplacementRequest" ADD CONSTRAINT "DeviceReplacementRequest_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "SecurityDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SecurityEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "userEmail" TEXT,
  "eventType" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "reason" TEXT,
  "ipAddress" TEXT,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SecurityEvent_eventType_createdAt_idx" ON "SecurityEvent"("eventType", "createdAt");
CREATE INDEX "SecurityEvent_userId_createdAt_idx" ON "SecurityEvent"("userId", "createdAt");
CREATE FUNCTION "prevent_security_event_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Security events are immutable';
END;
$$;
CREATE TRIGGER "SecurityEvent_immutable_update" BEFORE UPDATE ON "SecurityEvent" FOR EACH ROW EXECUTE FUNCTION "prevent_security_event_mutation"();
CREATE TRIGGER "SecurityEvent_immutable_delete" BEFORE DELETE ON "SecurityEvent" FOR EACH ROW EXECUTE FUNCTION "prevent_security_event_mutation"();

ALTER TABLE "RefreshToken" ADD COLUMN "deviceId" TEXT;
CREATE INDEX "RefreshToken_deviceId_idx" ON "RefreshToken"("deviceId");
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "SecurityDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
