import { prisma } from "../config/database.js";

export type OrgChartNode = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  position?: { id: string; title: string } | null;
  department?: { id: string; name: string } | null;
  employmentStatus: string;
  managerId?: string | null;
  directReports: OrgChartNode[];
};

export async function getOrganizationTree() {
  const employees = await prisma.employee.findMany({
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      email: true,
      employmentStatus: true,
      managerId: true,
      position: { select: { id: true, title: true } },
      department: { select: { id: true, name: true } },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  const map = new Map<string, OrgChartNode>();

  for (const employee of employees) {
    map.set(employee.id, {
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      position: employee.position,
      department: employee.department,
      employmentStatus: employee.employmentStatus,
      managerId: employee.managerId,
      directReports: [],
    });
  }

  const roots: OrgChartNode[] = [];

  for (const employee of employees) {
    const node = map.get(employee.id);
    if (!node) continue;

    if (employee.managerId) {
      const parent = map.get(employee.managerId);
      if (parent) {
        parent.directReports.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  }

  return {
    totalEmployees: employees.length,
    roots,
  };
}

export async function getManagementSummary() {
  const employees = await prisma.employee.findMany({
    select: {
      id: true,
      managerId: true,
      employmentStatus: true,
      department: { select: { id: true, name: true } },
    },
  });

  const managers = employees.filter((employee) => employee.managerId !== null).length;
  const topLevel = employees.filter((employee) => employee.managerId === null).length;

  return {
    totalEmployees: employees.length,
    managers,
    topLevel,
    byDepartment: employees.reduce<Record<string, number>>((acc, employee) => {
      const departmentName = employee.department?.name ?? "Unassigned";
      acc[departmentName] = (acc[departmentName] ?? 0) + 1;
      return acc;
    }, {}),
  };
}
