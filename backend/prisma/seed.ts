import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

const permissions = [
  // Users
  {
    name: "user:create",
    description: "Create users",
  },
  {
    name: "user:read",
    description: "View users",
  },
  {
    name: "user:update",
    description: "Update users",
  },
  {
    name: "user:delete",
    description: "Delete users",
  },

  // Roles
  {
    name: "role:create",
    description: "Create roles",
  },
  {
    name: "role:read",
    description: "View roles",
  },
  {
    name: "role:update",
    description: "Update roles",
  },
  {
    name: "role:delete",
    description: "Delete roles",
  },

  // Permissions
  {
    name: "permission:read",
    description: "View permissions",
  },
  {
    name: "permission:assign",
    description: "Assign permissions",
  },

  // Employees
  {
    name: "employee:create",
    description: "Create employees",
  },
  {
    name: "employee:read",
    description: "View employees",
  },
  {
    name: "employee:update",
    description: "Update employees",
  },
  {
    name: "employee:delete",
    description: "Delete employees",
  },

  // Departments
  {
    name: "department:create",
    description: "Create departments",
  },
  {
    name: "department:read",
    description: "View departments",
  },
  {
    name: "department:update",
    description: "Update departments",
  },
  {
    name: "department:delete",
    description: "Delete departments",
  },

  // Positions
  {
    name: "position:create",
    description: "Create positions",
  },
  {
    name: "position:read",
    description: "View positions",
  },
  {
    name: "position:update",
    description: "Update positions",
  },
  {
    name: "position:delete",
    description: "Delete positions",
  },

  // Attendance
  {
    name: "attendance:clock",
    description: "Clock in and clock out",
  },
  {
    name: "attendance:read",
    description: "View attendance",
  },
  {
    name: "attendance:update",
    description: "Update attendance",
  },

  // Leave
  {
    name: "leave:create",
    description: "Create leave requests",
  },
  {
    name: "leave:read",
    description: "View leave requests",
  },
  {
    name: "leave:approve",
    description: "Approve leave requests",
  },
  {
    name: "leave:reject",
    description: "Reject leave requests",
  },

  // Appraisal
  {
    name: "appraisal:create",
    description: "Create appraisals",
  },
  {
    name: "appraisal:read",
    description: "View appraisals",
  },
  {
    name: "appraisal:update",
    description: "Update appraisals",
  },
  {
    name: "appraisal:review",
    description: "Review appraisals",
  },

  // Handbook
  {
    name: "handbook:create",
    description: "Create handbook content",
  },
  {
    name: "handbook:read",
    description: "View handbook content",
  },
  {
    name: "handbook:update",
    description: "Update handbook content",
  },

  // Celebrations
  {
    name: "celebration:read",
    description: "View celebrations",
  },
  {
    name: "celebration:create",
    description: "Create celebrations",
  },

  // Notifications
  {
    name: "notification:read",
    description: "View notifications",
  },
  {
    name: "notification:create",
    description: "Create notifications",
  },

  // Reports
  {
    name: "report:read",
    description: "View reports",
  },
  {
    name: "report:export",
    description: "Export reports",
  },

  // Audit
  {
    name: "audit:read",
    description: "View audit logs",
  },

  // Dashboard
  {
    name: "dashboard:read",
    description: "View dashboard statistics",
  },
];

const rolePermissions: Record<string, string[]> = {
  SUPER_ADMIN: permissions.map((permission) => permission.name),

  HR: permissions
    .filter(
      (permission) =>
        !permission.name.startsWith("role:") &&
        !permission.name.startsWith("permission:")
    )
    .map((permission) => permission.name),

  MANAGER: [
    "employee:read",

    "department:read",
    "position:read",

    "attendance:read",
    "attendance:update",

    "leave:create",
    "leave:read",
    "leave:approve",
    "leave:reject",

    "appraisal:read",
    "appraisal:review",

    "celebration:read",
    "celebration:create",

    "notification:read",
    "notification:create",

    "handbook:read",

    "report:read",
    "dashboard:read",
  ],

  STAFF: [
    "attendance:clock",
    "attendance:read",

    "leave:create",
    "leave:read",

    "appraisal:read",
    "appraisal:update",

    "celebration:read",
    "celebration:create",

    "notification:read",

    "handbook:read",
  ],
};

async function main() {
  console.log("Starting Fluidé HRM database seed...");

  // Create permissions
  const permissionMap = new Map<string, string>();

  for (const permission of permissions) {
    const createdPermission = await prisma.permission.upsert({
      where: {
        name: permission.name,
      },
      update: {
        description: permission.description,
      },
      create: permission,
    });

    permissionMap.set(createdPermission.name, createdPermission.id);
  }

  // Create roles
  const roleDescriptions: Record<string, string> = {
    SUPER_ADMIN: "Full system access",
    HR: "Human Resources administrator",
    MANAGER: "Department or team manager",
    STAFF: "Standard employee access",
  };

  const roleMap = new Map<string, string>();

  for (const [roleName, description] of Object.entries(roleDescriptions)) {
    const role = await prisma.role.upsert({
      where: {
        name: roleName,
      },
      update: {
        description,
      },
      create: {
        name: roleName,
        description,
      },
    });

    roleMap.set(role.name, role.id);
  }

  // Assign permissions to roles
  for (const [roleName, permissionNames] of Object.entries(rolePermissions)) {
    const roleId = roleMap.get(roleName);

    if (!roleId) {
      throw new Error(`Role not found: ${roleName}`);
    }

    for (const permissionName of permissionNames) {
      const permissionId = permissionMap.get(permissionName);

      if (!permissionId) {
        throw new Error(`Permission not found: ${permissionName}`);
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId,
          },
        },
        update: {},
        create: {
          roleId,
          permissionId,
        },
      });
    }
  }

  console.log("Fluidé HRM database seed completed successfully.");
}

main()
  .catch((error) => {
    console.error("Database seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });