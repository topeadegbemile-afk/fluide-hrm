CREATE TABLE "EmployeePersonalInformation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeePersonalInformation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmployeePersonalInformation_employeeId_key"
ON "EmployeePersonalInformation"("employeeId");

ALTER TABLE "EmployeePersonalInformation"
ADD CONSTRAINT "EmployeePersonalInformation_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
