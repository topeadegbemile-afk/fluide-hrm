import { prisma } from "../config/database.js";
import type {
  CreateEmployeeInput,
  UpdateEmployeeInput,
} from "../validators/employee.validator.js";

/**
 * CREATE EMPLOYEE
 */
export async function createEmployee(
  data: CreateEmployeeInput
) {
  const office = await prisma.office.findFirst({ where: { id: data.officeId, isActive: true } });
  if (!office) throw new Error("A valid active office assignment is required");
  const existingEmployeeNumber =
    await prisma.employee.findUnique({
      where: {
        employeeNumber: data.employeeNumber,
      },
    });

  if (existingEmployeeNumber) {
    throw new Error(
      "Employee number already exists"
    );
  }

  const existingEmail = data.email ? await prisma.employee.findUnique({
      where: {
        email: data.email,
      },
    }) : null;

  if (existingEmail) {
    throw new Error(
      "An employee with this email already exists"
    );
  }

  if (data.departmentId) {
    const department =
      await prisma.department.findUnique({
        where: {
          id: data.departmentId,
        },
      });

    if (!department) {
      throw new Error(
        "Department not found"
      );
    }

    if (!department.isActive) {
      throw new Error(
        "The selected department is inactive"
      );
    }
  }

  if (data.positionId) {
    const position =
      await prisma.position.findUnique({
        where: {
          id: data.positionId,
        },
      });

    if (!position) {
      throw new Error(
        "Position not found"
      );
    }

    if (!position.isActive) {
      throw new Error(
        "The selected position is inactive"
      );
    }
  }

  if (data.managerId) {
    const manager =
      await prisma.employee.findUnique({
        where: {
          id: data.managerId,
        },
      });

    if (!manager) {
      throw new Error(
        "Manager not found"
      );
    }

    if (
      manager.employmentStatus ===
        "TERMINATED" ||
      manager.employmentStatus ===
        "RESIGNED"
    ) {
      throw new Error(
        "The selected manager is not active"
      );
    }
  }

  const employee =
    await prisma.employee.create({
      data: {
        employeeNumber:
          data.employeeNumber,

        firstName: data.firstName,

        lastName: data.lastName,

        middleName:
          data.middleName,

        email: data.email || null,

        phone: data.phone,

        dateOfBirth: data.dateOfBirth
          ? new Date(data.dateOfBirth)
          : undefined,

        gender: data.gender,

        address: data.address,

        profilePhoto:
          data.profilePhoto,

        employmentType:
          data.employmentType,

        employmentStatus:
          data.employmentStatus,

        dateJoined:
          new Date(data.dateJoined),

        employmentMonthYear: data.employmentMonthYear,

        confirmationDate:
          data.confirmationDate
            ? new Date(data.confirmationDate)
            : undefined,

        grossSalary: data.grossSalary,
        lastSalary: data.lastSalary,
        reviewDate: data.reviewDate ? new Date(data.reviewDate) : undefined,

        departmentId:
          data.departmentId,

        positionId:
          data.positionId,

        managerId:
          data.managerId,
        officeId: data.officeId,
      },

      include: {
        department: true,
        position: true,
        office: true,
        manager: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

  return employee;
}

/**
 * GET ALL EMPLOYEES
 */
export async function getEmployees() {
  return prisma.employee.findMany({
    orderBy: [
      {
        firstName: "asc",
      },
      {
        lastName: "asc",
      },
    ],

    include: {
      department: true,
      position: true,
      office: true,
      personalInformation: true,

      manager: {
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });
}

/**
 * GET EMPLOYEE BY ID
 */
export async function getEmployeeById(
  id: string
) {
  const employee =
    await prisma.employee.findUnique({
      where: {
        id,
      },

      include: {
        department: true,
        position: true,
        office: true,
        manager: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },

        directReports: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            email: true,
            employmentStatus: true,
          },
        },

        user: {
          select: {
            id: true,
            email: true,
            status: true,
          },
        },
      },
    });

  if (!employee) {
    throw new Error(
      "Employee not found"
    );
  }

  return employee;
}

/**
 * UPDATE EMPLOYEE
 */
export async function updateEmployee(
  id: string,
  data: UpdateEmployeeInput
) {
  const existingEmployee =
    await prisma.employee.findUnique({
      where: {
        id,
      },
    });

  if (!existingEmployee) {
    throw new Error(
      "Employee not found"
    );
  }

  if (data.officeId) {
    const office = await prisma.office.findFirst({ where: { id: data.officeId, isActive: true } });
    if (!office) throw new Error("A valid active office assignment is required");
  }

  if (
    data.employeeNumber &&
    data.employeeNumber !==
      existingEmployee.employeeNumber
  ) {
    const duplicateNumber =
      await prisma.employee.findUnique({
        where: {
          employeeNumber:
            data.employeeNumber,
        },
      });

    if (duplicateNumber) {
      throw new Error(
        "Employee number already exists"
      );
    }
  }

  if (
    data.email &&
    data.email !== existingEmployee.email
  ) {
    const duplicateEmail =
      await prisma.employee.findUnique({
        where: {
          email: data.email,
        },
      });

    if (duplicateEmail) {
      throw new Error(
        "An employee with this email already exists"
      );
    }
  }

  if (data.departmentId) {
    const department =
      await prisma.department.findUnique({
        where: {
          id: data.departmentId,
        },
      });

    if (!department) {
      throw new Error(
        "Department not found"
      );
    }

    if (!department.isActive) {
      throw new Error(
        "The selected department is inactive"
      );
    }
  }

  if (data.positionId) {
    const position =
      await prisma.position.findUnique({
        where: {
          id: data.positionId,
        },
      });

    if (!position) {
      throw new Error(
        "Position not found"
      );
    }

    if (!position.isActive) {
      throw new Error(
        "The selected position is inactive"
      );
    }
  }

  if (data.managerId) {
    if (data.managerId === id) {
      throw new Error(
        "An employee cannot be their own manager"
      );
    }

    const manager =
      await prisma.employee.findUnique({
        where: {
          id: data.managerId,
        },
      });

    if (!manager) {
      throw new Error(
        "Manager not found"
      );
    }
  }

  const employee =
    await prisma.employee.update({
      where: {
        id,
      },

      data: {
        ...(data.employeeNumber !==
        undefined
          ? {
              employeeNumber:
                data.employeeNumber,
            }
          : {}),

        ...(data.firstName !== undefined
          ? {
              firstName: data.firstName,
            }
          : {}),

        ...(data.lastName !== undefined
          ? {
              lastName: data.lastName,
            }
          : {}),

        ...(data.middleName !== undefined
          ? {
              middleName:
                data.middleName,
            }
          : {}),

        ...(data.email !== undefined
          ? {
              email: data.email || null,
            }
          : {}),

        ...(data.phone !== undefined
          ? {
              phone: data.phone,
            }
          : {}),

        ...(data.dateOfBirth !==
        undefined
          ? {
              dateOfBirth:
                data.dateOfBirth
                  ? new Date(
                      data.dateOfBirth
                    )
                  : null,
            }
          : {}),

        ...(data.gender !== undefined
          ? {
              gender: data.gender,
            }
          : {}),

        ...(data.address !== undefined
          ? {
              address: data.address,
            }
          : {}),

        ...(data.profilePhoto !==
        undefined
          ? {
              profilePhoto:
                data.profilePhoto,
            }
          : {}),

        ...(data.employmentType !==
        undefined
          ? {
              employmentType:
                data.employmentType,
            }
          : {}),

        ...(data.employmentStatus !==
        undefined
          ? {
              employmentStatus:
                data.employmentStatus,
            }
          : {}),

        ...(data.dateJoined !==
        undefined
          ? {
              dateJoined:
                new Date(
                  data.dateJoined
                ),
            }
          : {}),

        ...(data.employmentMonthYear !== undefined ? { employmentMonthYear: data.employmentMonthYear } : {}),

        ...(data.confirmationDate !==
        undefined
          ? {
              confirmationDate:
                data.confirmationDate
                  ? new Date(
                      data.confirmationDate
                    )
                  : null,
            }
          : {}),

        ...(data.grossSalary !== undefined ? { grossSalary: data.grossSalary } : {}),
        ...(data.lastSalary !== undefined ? { lastSalary: data.lastSalary } : {}),
        ...(data.reviewDate !== undefined ? { reviewDate: data.reviewDate ? new Date(data.reviewDate) : null } : {}),

        ...(data.departmentId !==
        undefined
          ? {
              departmentId:
                data.departmentId,
            }
          : {}),

        ...(data.positionId !==
        undefined
          ? {
              positionId:
                data.positionId,
            }
          : {}),

        ...(data.managerId !== undefined
          ? {
              managerId:
                data.managerId,
            }
          : {}),

        ...(data.officeId !== undefined ? { officeId: data.officeId } : {}),
      },

      include: {
        department: true,
        position: true,
        office: true,

        manager: {
          select: {
            id: true,
            employeeNumber: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

  return employee;
}

/**
 * DELETE EMPLOYEE
 */
export async function deleteEmployee(
  id: string
) {
  const employee =
    await prisma.employee.findUnique({
      where: {
        id,
      },
    });

  if (!employee) {
    throw new Error(
      "Employee not found"
    );
  }

  await prisma.employee.delete({
    where: {
      id,
    },
  });

  return {
    id,
    deleted: true,
  };
}
