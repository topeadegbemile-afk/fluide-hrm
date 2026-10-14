CREATE TABLE "PayrollConfiguration" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "basicSalary" DECIMAL(14,2) NOT NULL,
  "benefits" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "deductions" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollConfiguration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PayrollConfiguration_employeeId_key" ON "PayrollConfiguration"("employeeId");
CREATE INDEX "PayrollConfiguration_isEnabled_idx" ON "PayrollConfiguration"("isEnabled");
ALTER TABLE "PayrollConfiguration" ADD CONSTRAINT "PayrollConfiguration_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PayrollPayslip" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT,
  "employeeName" TEXT NOT NULL,
  "employeeNumber" TEXT NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "basicSalary" DECIMAL(14,2) NOT NULL,
  "benefits" JSONB NOT NULL,
  "grossPay" DECIMAL(14,2) NOT NULL,
  "deductions" JSONB NOT NULL,
  "totalDeductions" DECIMAL(14,2) NOT NULL,
  "netPay" DECIMAL(14,2) NOT NULL,
  "emailedAt" TIMESTAMP(3),
  "emailSendingAt" TIMESTAMP(3),
  "emailError" TEXT,
  "emailAttempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollPayslip_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PayrollPayslip_employeeId_period_key" ON "PayrollPayslip"("employeeId", "period");
CREATE INDEX "PayrollPayslip_period_idx" ON "PayrollPayslip"("period");
CREATE INDEX "PayrollPayslip_recipientEmail_idx" ON "PayrollPayslip"("recipientEmail");
ALTER TABLE "PayrollPayslip" ADD CONSTRAINT "PayrollPayslip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
