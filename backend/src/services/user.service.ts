import { prisma } from "../config/database.js";
import { hashPassword } from "../utils/password.js";
import { createHash, randomBytes } from "node:crypto";
import { sendAccountSetupEmail } from "./email.service.js";
import type {
  CreateUserInput,
  UpdateUserInput,
} from "../validators/user.validator.js";

const userSelection = {
  id: true,
  email: true,
  status: true,
  createdAt: true,
  updatedAt: true,

  employee: true,

  userRoles: {
    include: {
      role: true,
    },
  },
} as const;

/**
 * Get all users.
 */
export async function getUsers() {
  return prisma.user.findMany({
    orderBy: {
      createdAt: "desc",
    },
    select: userSelection,
  });
}

/**
 * Get one user.
 */
export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: {
      id,
    },
    select: userSelection,
  });

  if (!user) {
    throw new Error("User not found");
  }

  return user;
}

/**
 * Get employees that do not yet have a login account.
 *
 * This is what the Users page will use for:
 *
 * Employee / Staff ID
 * FH-0007 — Remilekun Ajayi
 */
export async function getAvailableEmployees() {
  return prisma.employee.findMany({
    where: {
      userId: null,
    },

    orderBy: [
      {
        firstName: "asc",
      },
      {
        lastName: "asc",
      },
    ],

    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      middleName: true,
      lastName: true,
      email: true,
      phone: true,
      employmentStatus: true,
      employmentType: true,

      department: {
        select: {
          id: true,
          name: true,
        },
      },

      position: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });
}

/**
 * Create a user account.
 *
 * If employeeId is supplied:
 *
 * User
 *   ↓
 * Employee.userId
 *
 * are created/linked in the same transaction.
 */
export async function createUser(data: CreateUserInput) {
  const email = data.email.toLowerCase().trim();
  const setupToken = randomBytes(32).toString("base64url");
  const setupTokenHash = createHash("sha256").update(setupToken).digest("hex");
  const setupTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const initialPasswordHash = await hashPassword(randomBytes(32).toString("hex"));

  const user = await prisma.$transaction(async (tx) => {
    // -----------------------------------------
    // 1. Check duplicate email
    // -----------------------------------------

    const userExists = await tx.user.findUnique({
      where: {
        email,
      },
    });

    if (userExists) {
      throw new Error(
        "A user with this email already exists",
      );
    }

    // -----------------------------------------
    // 2. Validate employee
    // -----------------------------------------

    if (data.employeeId) {
      const employee = await tx.employee.findUnique({
        where: {
          id: data.employeeId,
        },
      });

      if (!employee) {
        throw new Error("Employee not found");
      }

      // Prevent one employee from having
      // multiple login accounts.
      if (employee.userId) {
        throw new Error(
          `Employee ${employee.employeeNumber} already has a user account`,
        );
      }
    }

    // -----------------------------------------
    // 3. Validate roles
    // -----------------------------------------

    if (data.roleIds.length > 0) {
      const roles = await tx.role.findMany({
        where: {
          id: {
            in: data.roleIds,
          },
        },
        select: {
          id: true,
        },
      });

      if (roles.length !== data.roleIds.length) {
        throw new Error(
          "One or more selected roles do not exist",
        );
      }
    }

    // -----------------------------------------
    // 4. Create the account with a random, undisclosed initial password.
    // -----------------------------------------

    const user = await tx.user.create({
      data: {
        email,
        passwordHash: initialPasswordHash,
        setupTokenHash,
        setupTokenExpiresAt,
        status: data.status,

        userRoles:
          data.roleIds.length > 0
            ? {
                create: data.roleIds.map((roleId) => ({
                  role: {
                    connect: {
                      id: roleId,
                    },
                  },
                })),
              }
            : undefined,
      },

      select: userSelection,
    });

    // -----------------------------------------
    // 5. Link employee to user
    // -----------------------------------------

    if (data.employeeId) {
      await tx.employee.update({
        where: {
          id: data.employeeId,
        },

        data: {
          userId: user.id,
        },
      });
    }

    // -----------------------------------------
    // 6. Return the created user
    // -----------------------------------------

    return tx.user.findUniqueOrThrow({
      where: {
        id: user.id,
      },
      select: userSelection,
    });
  });

  try {
    await sendAccountSetupEmail(email, setupToken);
  } catch {
    throw new Error(`The account was created, but the setup email could not be sent to ${email}. Check SMTP settings and try again.`);
  }

  return user;
}

export async function setInitialPassword(token: string, password: string) {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const pendingUser = await prisma.user.findFirst({
    where: {
      setupTokenHash: tokenHash,
      setupTokenExpiresAt: { gt: new Date() },
    },
    select: { id: true },
  });

  if (!pendingUser) {
    throw new Error("This password setup link is invalid or has expired. Ask your administrator to create a new invitation.");
  }

  const passwordHash = await hashPassword(password);
  const result = await prisma.user.updateMany({
    where: {
      id: pendingUser.id,
      setupTokenHash: tokenHash,
      setupTokenExpiresAt: { gt: new Date() },
    },
    data: {
      passwordHash,
      setupTokenHash: null,
      setupTokenExpiresAt: null,
    },
  });

  if (result.count !== 1) {
    throw new Error("This password setup link is invalid or has expired. Ask your administrator to create a new invitation.");
  }
}


/**
 * Resend the initial password setup invitation.
 * Only accounts that have not completed setup can receive a new invitation.
 */
export async function resendSetupInvitation(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      setupTokenHash: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (!user.setupTokenHash) {
    throw new Error(
      "This user has already completed password setup",
    );
  }

  const setupToken = randomBytes(32).toString("base64url");
  const setupTokenHash = createHash("sha256")
    .update(setupToken)
    .digest("hex");
  const setupTokenExpiresAt = new Date(
    Date.now() + 24 * 60 * 60 * 1000,
  );

  await prisma.user.updateMany({
    where: {
      id: user.id,
      setupTokenHash: user.setupTokenHash,
    },
    data: {
      setupTokenHash,
      setupTokenExpiresAt,
    },
  });

  await sendAccountSetupEmail(user.email, setupToken);

  return {
    message: "Account setup invitation sent successfully",
  };
}


/**
 * Update user.
 */
export async function updateUser(
  id: string,
  data: UpdateUserInput,
) {
  return prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        email: true,
        employee: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!existingUser) {
      throw new Error("User not found");
    }

    // -----------------------------------------
    // Email
    // -----------------------------------------

    const normalizedEmail =
      data.email?.toLowerCase().trim();

    if (
      normalizedEmail &&
      normalizedEmail !== existingUser.email
    ) {
      const duplicate = await tx.user.findUnique({
        where: {
          email: normalizedEmail,
        },
      });

      if (duplicate && duplicate.id !== id) {
        throw new Error(
          "A user with this email already exists",
        );
      }
    }

    // -----------------------------------------
    // Employee linking
    // -----------------------------------------

    if (data.employeeId !== undefined) {
      const employee = await tx.employee.findUnique({
        where: {
          id: data.employeeId,
        },
      });

      if (!employee) {
        throw new Error("Employee not found");
      }

      if (
        employee.userId &&
        employee.userId !== id
      ) {
        throw new Error(
          `Employee ${employee.employeeNumber} already has another user account`,
        );
      }
    }

    // -----------------------------------------
    // Password
    // -----------------------------------------

    let passwordHash: string | undefined;

    if (data.password) {
      passwordHash = await hashPassword(
        data.password,
      );
    }

    // -----------------------------------------
    // Update user
    // -----------------------------------------

    await tx.user.update({
      where: {
        id,
      },

      data: {
        ...(normalizedEmail !== undefined && {
          email: normalizedEmail,
        }),

        ...(data.status !== undefined && {
          status: data.status,
        }),

        ...(passwordHash !== undefined && {
          passwordHash,
        }),
      },
    });

    // -----------------------------------------
    // Link employee
    // -----------------------------------------

    if (data.employeeId !== undefined) {
      await tx.employee.update({
        where: {
          id: data.employeeId,
        },

        data: {
          userId: id,
        },
      });
    }

    // -----------------------------------------
    // Update roles
    // -----------------------------------------

    if (data.roleIds !== undefined) {
      const roles = await tx.role.findMany({
        where: {
          id: {
            in: data.roleIds,
          },
        },
        select: {
          id: true,
        },
      });

      if (roles.length !== data.roleIds.length) {
        throw new Error(
          "One or more selected roles do not exist",
        );
      }

      await tx.userRole.deleteMany({
        where: {
          userId: id,
        },
      });

      if (data.roleIds.length > 0) {
        await tx.userRole.createMany({
          data: data.roleIds.map((roleId) => ({
            userId: id,
            roleId,
          })),
          skipDuplicates: true,
        });
      }
    }

    return tx.user.findUniqueOrThrow({
      where: {
        id,
      },
      select: userSelection,
    });
  });
}

/**
 * Delete user.
 */
export async function deleteUser(id: string) {
  const user = await prisma.user.findUnique({
    where: {
      id,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  await prisma.user.delete({
    where: {
      id,
    },
  });

  return {
    id,
    deleted: true,
  };
}

/**
 * Assign role to user.
 */
export async function assignRoleToUser(
  userId: string,
  roleId: string,
) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const role = await prisma.role.findUnique({
    where: {
      id: roleId,
    },
  });

  if (!role) {
    throw new Error("Role not found");
  }

  return prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId,
        roleId,
      },
    },

    update: {},

    create: {
      userId,
      roleId,
    },

    include: {
      role: true,
    },
  });
}

/**
 * Deactivate user.
 */
export async function deactivateUser(id: string) {
  const user = await prisma.user.findUnique({
    where: {
      id,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return prisma.user.update({
    where: {
      id,
    },

    data: {
      status: "INACTIVE",
    },

    select: userSelection,
  });
}

/**
 * Reactivate user.
 */
export async function reactivateUser(id: string) {
  const user = await prisma.user.findUnique({
    where: {
      id,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return prisma.user.update({
    where: {
      id,
    },

    data: {
      status: "ACTIVE",
    },

    select: userSelection,
  });
}
