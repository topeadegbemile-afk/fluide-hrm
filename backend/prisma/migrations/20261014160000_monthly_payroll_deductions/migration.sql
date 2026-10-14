CREATE TABLE "MonthlyPayrollDeduction" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "deductions" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MonthlyPayrollDeduction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MonthlyPayrollDeduction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MonthlyPayrollDeduction_employeeId_period_key" ON "MonthlyPayrollDeduction"("employeeId", "period");
CREATE INDEX "MonthlyPayrollDeduction_period_idx" ON "MonthlyPayrollDeduction"("period");
