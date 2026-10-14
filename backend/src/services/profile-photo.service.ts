import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "../config/database.js";

const photoDirectory = resolve(process.env.PROFILE_PHOTO_DIR ?? "uploads/profile-photos");
const maxPhotoBytes = 500 * 1024;

function isValidImage(bytes: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === "image/webp") return bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  return false;
}

export async function saveProfilePhoto(employeeId: string, bytes: Buffer, mimeType: string) {
  if (!bytes.length || bytes.length > maxPhotoBytes) throw new Error("Profile photos must be 500 KB or smaller.");
  if (!isValidImage(bytes, mimeType)) throw new Error("Choose a valid PNG, JPG, or WebP image.");
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
  if (!employee) throw new Error("Employee not found");
  await mkdir(photoDirectory, { recursive: true });
  await writeFile(resolve(photoDirectory, `${employeeId}.photo`), bytes);
  const profilePhoto = `/employees/${employeeId}/profile-photo?mime=${encodeURIComponent(mimeType)}&v=${randomUUID()}`;
  return prisma.employee.update({
    where: { id: employeeId },
    data: { profilePhoto },
    include: {
      department: true,
      position: true,
      manager: { select: { id: true, employeeNumber: true, firstName: true, lastName: true, email: true } },
    },
  });
}

export async function readProfilePhoto(employeeId: string) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { profilePhoto: true } });
  if (!employee?.profilePhoto?.startsWith(`/employees/${employeeId}/profile-photo`)) throw new Error("Profile photo not found");
  const mimeType = new URL(employee.profilePhoto, "http://localhost").searchParams.get("mime") ?? "image/jpeg";
  if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(mimeType)) throw new Error("Profile photo not found");
  const bytes = await readFile(resolve(photoDirectory, `${employeeId}.photo`));
  return { bytes, mimeType };
}

export async function mayAccessEmployeePhoto(userId: string, employeeId: string) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { userId: true } });
  if (!employee) throw new Error("Employee not found");
  if (employee.userId === userId) return true;
  const permission = await prisma.userRole.findFirst({
    where: { userId, role: { rolePermissions: { some: { permission: { name: "employee:read" } } } } },
    select: { id: true },
  });
  if (!permission) throw new Error("You do not have permission to view this employee photo");
  return false;
}

export async function mayUploadEmployeePhoto(userId: string, employeeId: string) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { userId: true } });
  if (!employee) throw new Error("Employee not found");
  if (employee.userId === userId) return true;
  const permission = await prisma.userRole.findFirst({
    where: { userId, role: { rolePermissions: { some: { permission: { name: "employee:update" } } } } },
    select: { id: true },
  });
  if (!permission) throw new Error("You do not have permission to update this employee photo");
  return false;
}
