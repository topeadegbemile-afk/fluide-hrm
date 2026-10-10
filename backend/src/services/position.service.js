import { prisma } from "../config/database.js";
export async function createPosition(data) {
    const existingPosition = await prisma.position.findUnique({
        where: {
            title: data.title,
        },
    });
    if (existingPosition) {
        throw new Error("A position with this title already exists");
    }
    return prisma.position.create({
        data: {
            title: data.title,
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
export async function getPositions() {
    return prisma.position.findMany({
        orderBy: {
            title: "asc",
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
export async function getPositionById(id) {
    const position = await prisma.position.findUnique({
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
    if (!position) {
        throw new Error("Position not found");
    }
    return position;
}
export async function updatePosition(id, data) {
    const position = await prisma.position.findUnique({
        where: {
            id,
        },
    });
    if (!position) {
        throw new Error("Position not found");
    }
    if (data.title && data.title !== position.title) {
        const existingPosition = await prisma.position.findUnique({
            where: {
                title: data.title,
            },
        });
        if (existingPosition) {
            throw new Error("A position with this title already exists");
        }
    }
    return prisma.position.update({
        where: {
            id,
        },
        data: {
            ...(data.title !== undefined && {
                title: data.title,
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
export async function deletePosition(id) {
    const position = await prisma.position.findUnique({
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
    if (!position) {
        throw new Error("Position not found");
    }
    if (position._count.employees > 0) {
        throw new Error("Cannot delete a position that has employees assigned to it");
    }
    await prisma.position.delete({
        where: {
            id,
        },
    });
    return {
        id,
        deleted: true,
    };
}
