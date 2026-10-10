import "dotenv/config";

import { prisma } from "../src/config/database.js";

const USER_EMAIL = "topeadegbemile@gmail.com";
const EMPLOYEE_NUMBER = "FH-0009";

async function main() {
  console.log("Looking for user...");

  const user = await prisma.user.findUnique({
    where: {
      email: USER_EMAIL.toLowerCase(),
    },
  });

  if (!user) {
    throw new Error(
      `No user account found for ${USER_EMAIL}`,
    );
  }

  console.log(`User found: ${user.email}`);
  console.log(`User ID: ${user.id}`);

  console.log("Looking for employee...");

  const employee = await prisma.employee.findUnique({
    where: {
      employeeNumber: EMPLOYEE_NUMBER,
    },
  });

  if (!employee) {
    throw new Error(
      `No employee found with employee number ${EMPLOYEE_NUMBER}`,
    );
  }

  console.log(
    `Employee found: ${employee.firstName} ${employee.lastName}`,
  );
  console.log(`Employee ID: ${employee.id}`);

  if (
    employee.userId &&
    employee.userId !== user.id
  ) {
    throw new Error(
      `Employee ${EMPLOYEE_NUMBER} is already linked to another user account.`,
    );
  }

  if (
    user.id !== employee.userId
  ) {
    await prisma.employee.update({
      where: {
        id: employee.id,
      },
      data: {
        userId: user.id,
      },
    });
  }

  console.log("");
  console.log("======================================");
  console.log("EMPLOYEE ACCOUNT LINKED SUCCESSFULLY");
  console.log("======================================");
  console.log(`User:     ${user.email}`);
  console.log(`Employee: ${employee.firstName} ${employee.lastName}`);
  console.log(`Number:   ${employee.employeeNumber}`);
  console.log(`User ID:  ${user.id}`);
  console.log(`Employee ID: ${employee.id}`);
  console.log("");
  console.log(
    "The STAFF account can now be used for attendance.",
  );
}

main()
  .catch((error) => {
    console.error("");
    console.error("Failed to link employee account.");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });