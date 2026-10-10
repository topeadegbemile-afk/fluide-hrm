import { prisma } from "../config/database.js";

export async function getCollaborationContext(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      employee: true,
      userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } },
    },
  });
  if (!user) throw new Error("User not found");
  const permissions = user.userRoles.flatMap((item) => item.role.rolePermissions.map((rp) => rp.permission.name));
  return { employee: user.employee, canViewAll: permissions.includes("employee:update"), canManageAll: permissions.includes("employee:update") };
}

export async function getChannels(userId: string) {
  const context = await getCollaborationContext(userId);
  if (context.canViewAll) {
    return prisma.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, include: { _count: { select: { employees: true, chatMessages: true, tasks: true } }, headEmployee: { select: { id: true, firstName: true, lastName: true } } } });
  }
  if (!context.employee?.departmentId) return [];
  return prisma.department.findMany({ where: { id: context.employee.departmentId, isActive: true }, include: { _count: { select: { employees: true, chatMessages: true, tasks: true } }, headEmployee: { select: { id: true, firstName: true, lastName: true } } } });
}

async function assertDepartmentAccess(userId: string, departmentId: string) {
  const context = await getCollaborationContext(userId);
  const department = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!department || !department.isActive) throw new Error("Department not found");
  if (!context.canViewAll && context.employee?.departmentId !== departmentId) throw new Error("You do not have access to this department channel");
  return { context, department };
}

export async function getMessages(userId: string, departmentId: string) {
  await assertDepartmentAccess(userId, departmentId);
  return prisma.departmentMessage.findMany({ where: { departmentId }, orderBy: { createdAt: "asc" }, take: 250, include: { sender: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } } } });
}

export async function sendMessage(userId: string, departmentId: string, message: string) {
  const { context } = await assertDepartmentAccess(userId, departmentId);
  if (!context.employee || context.employee.departmentId !== departmentId) throw new Error("Only department members can post messages");
  const content = message.trim();
  if (!content || content.length > 2000) throw new Error("Message must be between 1 and 2000 characters");
  return prisma.departmentMessage.create({ data: { departmentId, senderId: context.employee.id, message: content }, include: { sender: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } } } });
}

export async function getTasks(userId: string, departmentId: string) {
  await assertDepartmentAccess(userId, departmentId);
  return prisma.departmentTask.findMany({ where: { departmentId }, orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }], include: { assignee: { select: { id: true, firstName: true, lastName: true } }, assignedBy: { select: { id: true, firstName: true, lastName: true } } } });
}

export async function createTask(userId: string, departmentId: string, input: { title: string; description?: string; assigneeId: string; dueDate?: string }) {
  const { context } = await assertDepartmentAccess(userId, departmentId);
  const department = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!context.canManageAll && (!context.employee || department?.headEmployeeId !== context.employee.id)) throw new Error("Only the department head or an administrator can assign tasks");
  const assignee = await prisma.employee.findFirst({ where: { id: input.assigneeId, departmentId } });
  if (!assignee) throw new Error("Choose an employee from this department");
  const task = await prisma.departmentTask.create({ data: { departmentId, title: input.title.trim(), description: input.description?.trim() || null, assigneeId: assignee.id, assignedById: context.employee?.id ?? null, dueDate: input.dueDate ? new Date(input.dueDate) : null }, include: { assignee: { select: { id: true, firstName: true, lastName: true } }, assignedBy: { select: { id: true, firstName: true, lastName: true } } } });
  if (assignee.userId) await prisma.notification.create({ data: { userId: assignee.userId, title: "A task was assigned to you", message: task.title, type: "INFO", metadata: { taskId: task.id, departmentId } } });
  return task;
}

export async function updateTaskStatus(userId: string, taskId: string, status: "OPEN" | "IN_PROGRESS" | "COMPLETED") {
  const context = await getCollaborationContext(userId);
  if (!context.employee) throw new Error("Your account is not linked to an employee profile");
  const task = await prisma.departmentTask.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("Task not found");
  const department = await prisma.department.findUnique({ where: { id: task.departmentId }, select: { headEmployeeId: true } });
  if (task.assigneeId !== context.employee.id && task.assignedById !== context.employee.id && department?.headEmployeeId !== context.employee.id && !context.canManageAll) throw new Error("You cannot update this task");
  return prisma.departmentTask.update({ where: { id: taskId }, data: { status } });
}

export async function getDepartmentEmployees(userId: string, departmentId: string) {
  await assertDepartmentAccess(userId, departmentId);
  return prisma.employee.findMany({ where: { departmentId, employmentStatus: { notIn: ["RESIGNED", "TERMINATED"] } }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }], select: { id: true, firstName: true, lastName: true } });
}
