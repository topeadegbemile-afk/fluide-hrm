import { prisma } from "../config/database.js";
export async function createDepartment(data) {
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
        },
        include: {
            _count: {
                select: {
                    employees: true,
                },
            },
        },
    });
}
export async function getDepartments() {
    return prisma.department.findMany({
        orderBy: {
            name: "asc",
        },
        include: {
            _count: {
                select: {
                    employees: true,
                },
            },
        },
    });
}
export async function getDepartmentById(id) {
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
export async function updateDepartment(id, data) {
    const department = await prisma.department.findUnique({
        where: {
            id,
        },
    });
    if (!department) {
        throw new Error("Department not found");
    }
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
        },
        include: {
            _count: {
                select: {
                    employees: true,
                },
            },
        },
    });
}
export async function deleteDepartment(id) {
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
        throw new Error("Cannot delete a department that has employees assigned to it");
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
