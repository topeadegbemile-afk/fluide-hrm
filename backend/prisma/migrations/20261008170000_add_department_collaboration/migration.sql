CREATE TYPE "DepartmentTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED');

ALTER TABLE "Department"
  ADD COLUMN "headEmployeeId" TEXT;

CREATE UNIQUE INDEX "Department_headEmployeeId_key" ON "Department"("headEmployeeId");
ALTER TABLE "Department"
  ADD CONSTRAINT "Department_headEmployeeId_fkey"
  FOREIGN KEY ("headEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "DepartmentMessage" (
  "id" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DepartmentMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DepartmentMessage_departmentId_createdAt_idx" ON "DepartmentMessage"("departmentId", "createdAt");
ALTER TABLE "DepartmentMessage" ADD CONSTRAINT "DepartmentMessage_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DepartmentMessage" ADD CONSTRAINT "DepartmentMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DepartmentTask" (
  "id" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "assignedById" TEXT NOT NULL,
  "assigneeId" TEXT NOT NULL,
  "dueDate" TIMESTAMP(3),
  "status" "DepartmentTaskStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DepartmentTask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DepartmentTask_departmentId_status_idx" ON "DepartmentTask"("departmentId", "status");
CREATE INDEX "DepartmentTask_assigneeId_status_idx" ON "DepartmentTask"("assigneeId", "status");
ALTER TABLE "DepartmentTask" ADD CONSTRAINT "DepartmentTask_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DepartmentTask" ADD CONSTRAINT "DepartmentTask_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DepartmentTask" ADD CONSTRAINT "DepartmentTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
