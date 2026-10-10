import { prisma } from "../config/database.js";
import type {
  CreateDepartmentInput,
  UpdateDepartmentInput,
} from "../validators/department.validator.js";

export async function createDepartment(
  data: CreateDepartmentInput
) {
  if (data.headEmployeeId) await assertDepartmentHead(data.headEmployeeId);
  const existingDepartment = await prisma.department.findUnique({
    where: {
      name: data.name,
    },
  });

  if (existingDepartment) {
    throw new Error("A department with this name already exists");
  }

  return prisma.department.create({
    data: {
      name: data.name,
      description: data.description,
      isActive: data.isActive,
      ...(data.headEmployeeId !== undefined && { headEmployeeId: data.headEmployeeId }),
    },
    include: {
      _count: {
        select: {
          employees: true,
        },
      },
      headEmployee: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function getDepartments() {
  return prisma.department.findMany({
    orderBy: {
      name: "asc",
    },
    include: {
      headEmployee: { select: { id: true, firstName: true, lastName: true } },
      _count: {
        select: {
          employees: true,
        },
      },
    },
  });
}

export async function getDepartmentById(id: string) {
  const department = await prisma.department.findUnique({
    where: {
      id,
    },
    include: {
      employees: {
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          email: true,
          employmentStatus: true,
        },
        orderBy: {
          firstName: "asc",
        },
      },
      _count: {
        select: {
          employees: true,
        },
      },
    },
  });

  if (!department) {
    throw new Error("Department not found");
  }

  return department;
}

export async function updateDepartment(
  id: string,
  data: UpdateDepartmentInput
) {
  const department = await prisma.department.findUnique({
    where: {
      id,
    },
  });

  if (!department) {
    throw new Error("Department not found");
  }
  if (data.headEmployeeId) await assertDepartmentHead(data.headEmployeeId, id);

  if (data.name && data.name !== department.name) {
    const existingDepartment = await prisma.department.findUnique({
      where: {
        name: data.name,
      },
    });

    if (existingDepartment) {
      throw new Error("A department with this name already exists");
    }
  }

  return prisma.department.update({
    where: {
      id,
    },
    data: {
      ...(data.name !== undefined && {
        name: data.name,
      }),

      ...(data.description !== undefined && {
        description: data.description,
      }),

      ...(data.isActive !== undefined && {
        isActive: data.isActive,
      }),
      ...(data.headEmployeeId !== undefined && { headEmployeeId: data.headEmployeeId }),
    },
    include: {
      headEmployee: { select: { id: true, firstName: true, lastName: true } },
      _count: {
        select: {
          employees: true,
        },
      },
    },
  });
}

async function assertDepartmentHead(employeeId: string, departmentId?: string) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { departmentId: true } });
  if (!employee || (departmentId ? employee.departmentId !== departmentId : !employee.departmentId)) {
    throw new Error("Department head must be an employee assigned to this department");
  }
}

export async function deleteDepartment(id: string) {
  const department = await prisma.department.findUnique({
    where: {
      id,
    },
    include: {
      _count: {
        select: {
          employees: true,
        },
      },
    },
  });

  if (!department) {
    throw new Error("Department not found");
  }

  if (department._count.employees > 0) {
    throw new Error(
      "Cannot delete a department that has employees assigned to it"
    );
  }

  await prisma.department.delete({
    where: {
      id,
    },
  });

  return {
    id,
    deleted: true,
  };
}
