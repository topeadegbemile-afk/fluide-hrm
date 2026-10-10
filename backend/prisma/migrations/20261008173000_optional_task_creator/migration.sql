ALTER TABLE "DepartmentTask" DROP CONSTRAINT "DepartmentTask_assignedById_fkey";
ALTER TABLE "DepartmentTask" ALTER COLUMN "assignedById" DROP NOT NULL;
ALTER TABLE "DepartmentTask" ADD CONSTRAINT "DepartmentTask_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
