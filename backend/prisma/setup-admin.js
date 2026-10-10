import "dotenv/config";
import readline from "readline";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { hashPassword } from "../src/utils/password.js";
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error("DATABASE_URL is not defined");
}
const adapter = new PrismaPg({
    connectionString,
});
const prisma = new PrismaClient({
    adapter,
});
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});
function ask(question) {
    return new Promise((resolve) => {
        rl.question(question, resolve);
    });
}
async function main() {
    console.log("\n=================================");
    console.log("   Fluidé Homes HRM");
    console.log("   Super Admin Setup");
    console.log("=================================\n");
    const email = (await ask("Admin email: ")).trim().toLowerCase();
    const password = await ask("Admin password: ");
    if (!email || !email.includes("@")) {
        throw new Error("Please provide a valid email address.");
    }
    if (password.length < 8) {
        throw new Error("Password must be at least 8 characters.");
    }
    const role = await prisma.role.findUnique({
        where: {
            name: "SUPER_ADMIN",
        },
    });
    if (!role) {
        throw new Error("SUPER_ADMIN role not found. Run the database seed first.");
    }
    const existingUser = await prisma.user.findUnique({
        where: {
            email,
        },
    });
    if (existingUser) {
        throw new Error(`A user with ${email} already exists.`);
    }
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
        data: {
            email,
            passwordHash,
            status: "ACTIVE",
            userRoles: {
                create: {
                    roleId: role.id,
                },
            },
        },
        include: {
            userRoles: {
                include: {
                    role: true,
                },
            },
        },
    });
    console.log("\nSuper Admin created successfully.\n");
    console.log({
        id: user.id,
        email: user.email,
        status: user.status,
        roles: user.userRoles.map((userRole) => userRole.role.name),
    });
}
main()
    .catch((error) => {
    console.error("\nSetup failed:", error instanceof Error
        ? error.message
        : error);
    process.exit(1);
})
    .finally(async () => {
    rl.close();
    await prisma.$disconnect();
});
