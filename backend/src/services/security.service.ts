import { createHash } from "node:crypto";
import ipaddr from "ipaddr.js";
import { prisma } from "../config/database.js";

const hashSecret = (secret: string) => createHash("sha256").update(secret).digest("hex");

export function normalizeApprovedNetworks(values: unknown): string[] {
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string")) {
    throw new Error("Approved networks must be a list of IPv4 or IPv6 addresses/CIDR ranges");
  }
  const normalized = values.map((value: string) => {
    const input = value.trim();
    try {
      if (input.includes("/")) {
        const [address, prefix] = ipaddr.parseCIDR(input);
        return `${address.toString()}/${prefix}`;
      }
      return ipaddr.parse(input).toString();
    } catch {
      throw new Error(`Invalid IP address or CIDR range: ${input}`);
    }
  });
  return [...new Set(normalized)];
}

export function clientIpMatchesApprovedNetworks(clientIp: string, networks: string[]) {
  if (!ipaddr.isValid(clientIp)) return false;
  try {
    const address = ipaddr.process(clientIp);
    return networks.some((range) => {
      try {
        const [network, prefix] = range.includes("/") ? ipaddr.parseCIDR(range) : [ipaddr.parse(range), ipaddr.parse(range).kind() === "ipv4" ? 32 : 128] as const;
        if (address.kind() !== network.kind()) return false;
        if (address.kind() === "ipv4" && network.kind() === "ipv4") return (address as ipaddr.IPv4).match(network as ipaddr.IPv4, prefix);
        if (address.kind() === "ipv6" && network.kind() === "ipv6") return (address as ipaddr.IPv6).match(network as ipaddr.IPv6, prefix);
        return false;
      } catch { return false; }
    });
  } catch { return false; }
}

export async function recordSecurityEvent(data: {
  userId?: string | null; eventType: string; outcome: string; reason?: string;
  ipAddress?: string | null; details?: Record<string, unknown>;
}) {
  const actor = data.userId ? await prisma.user.findUnique({ where: { id: data.userId }, select: { email: true } }) : null;
  return prisma.securityEvent.create({ data: {
    userId: data.userId ?? null, userEmail: actor?.email ?? null, eventType: data.eventType, outcome: data.outcome,
    reason: data.reason ?? null, ipAddress: data.ipAddress ?? null,
    details: data.details as object | undefined,
  } });
}

export async function authorizeAttendanceNetwork(userId: string, clientIp?: string) {
  const [settings, user] = await Promise.all([
    prisma.securitySettings.findUnique({ where: { id: "global" } }),
    prisma.user.findUnique({ where: { id: userId }, include: { employee: { include: { office: true } } } }),
  ]);
  const enabled = settings?.attendanceOfficeEnforcement ?? false;
  const office = user?.employee?.office;
  if (!enabled) {
    await recordSecurityEvent({ userId, eventType: "ATTENDANCE_NETWORK_CHECK", outcome: "BYPASSED", reason: "ENFORCEMENT_DISABLED", ipAddress: clientIp, details: { officeCode: office?.code ?? null } });
    return;
  }

  let reason = "IP_NOT_APPROVED";
  let allowed = false;
  if (!clientIp || !ipaddr.isValid(clientIp)) reason = "CLIENT_IP_UNAVAILABLE_OR_INVALID";
  else if (!office) reason = user?.employee ? "EMPLOYEE_OFFICE_NOT_ASSIGNED" : "EMPLOYEE_PROFILE_MISSING";
  else if (!office.isActive) reason = "OFFICE_INACTIVE";
  else if (!office.approvedNetworks.length || !office.networkConfiguredAt) reason = "OFFICE_NETWORK_NOT_CONFIGURED";
  else {
    allowed = clientIpMatchesApprovedNetworks(clientIp, office.approvedNetworks);
  }
  if (allowed) reason = "APPROVED_OFFICE_NETWORK";
  await recordSecurityEvent({ userId, eventType: "ATTENDANCE_NETWORK_CHECK", outcome: allowed ? "ALLOWED" : "DENIED", reason, ipAddress: clientIp, details: { officeId: office?.id ?? null, officeCode: office?.code ?? null } });
  if (!allowed) throw new Error(`Attendance is only available from your assigned office network (${reason})`);
}

export async function listOffices() {
  return prisma.office.findMany({ orderBy: { code: "asc" }, include: { configuredBy: { select: { id: true, email: true } }, _count: { select: { employees: true } } } });
}

export async function listOfficeOptions() {
  return prisma.office.findMany({ where: { isActive: true }, orderBy: { code: "asc" }, select: { id: true, name: true, code: true, isActive: true } });
}

export async function updateOfficeNetworks(userId: string, officeId: string, values: unknown) {
  const approvedNetworks = normalizeApprovedNetworks(values);
  const office = await prisma.office.findUnique({ where: { id: officeId } });
  if (!office) throw new Error("Office not found");
  const actor = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return prisma.$transaction(async (tx) => {
    const updated = await tx.office.update({ where: { id: officeId }, data: {
      approvedNetworks, configuredById: userId, networkConfiguredAt: approvedNetworks.length ? new Date() : null,
    } });
    await tx.securityEvent.create({ data: { userId, userEmail: actor?.email ?? null, eventType: "OFFICE_NETWORK_CONFIGURATION", outcome: "UPDATED", details: { officeId, officeCode: office.code, approvedNetworks } } });
    return updated;
  });
}

export async function updateOfficeStatus(userId: string, officeId: string, isActive: boolean) {
  const office = await prisma.office.findUnique({ where: { id: officeId } });
  if (!office) throw new Error("Office not found");
  const actor = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return prisma.$transaction(async (tx) => {
    const updated = await tx.office.update({ where: { id: officeId }, data: { isActive } });
    await tx.securityEvent.create({ data: { userId, userEmail: actor?.email ?? null, eventType: "OFFICE_STATUS", outcome: isActive ? "ACTIVATED" : "DEACTIVATED", details: { officeId, officeCode: office.code } } });
    return updated;
  });
}

export async function getSecuritySettings() {
  const [settings, unassignedEmployeeCount] = await Promise.all([
    prisma.securitySettings.findUnique({ where: { id: "global" } }),
    prisma.employee.count({ where: { officeId: null } }),
  ]);
  const current = settings ?? await prisma.securitySettings.create({ data: { id: "global" } });
  return { ...current, unassignedEmployeeCount };
}

export async function updateAttendanceEnforcement(userId: string, enabled: boolean) {
  if (enabled) {
    const incomplete = await prisma.office.findMany({ where: { isActive: true, OR: [{ approvedNetworks: { isEmpty: true } }, { networkConfiguredAt: null }] }, select: { code: true } });
    const unassignedEmployeeCount = await prisma.employee.count({ where: { officeId: null } });
    if (incomplete.length || unassignedEmployeeCount) {
      const missing = incomplete.length ? `Configure approved networks for: ${incomplete.map((office) => office.code).join(", ")}.` : "";
      const assignments = unassignedEmployeeCount ? `Assign an office to ${unassignedEmployeeCount} employee(s).` : "";
      throw new Error(`${missing} ${assignments}`.trim());
    }
  }
  const actor = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return prisma.$transaction(async (tx) => {
    const settings = await tx.securitySettings.upsert({ where: { id: "global" }, create: { id: "global", attendanceOfficeEnforcement: enabled }, update: { attendanceOfficeEnforcement: enabled } });
    await tx.securityEvent.create({ data: { userId, userEmail: actor?.email ?? null, eventType: "ATTENDANCE_ENFORCEMENT", outcome: enabled ? "ENABLED" : "DISABLED" } });
    return settings;
  });
}

export async function listSecurityEvents() {
  return prisma.securityEvent.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
}

export async function listDevices() {
  return prisma.securityDevice.findMany({ where: { revokedAt: null }, orderBy: { lastUsedAt: "desc" }, include: { user: { select: { id: true, email: true, employee: { select: { firstName: true, lastName: true, employeeNumber: true } } } } } });
}

export async function listMyDevices(userId: string) {
  return prisma.securityDevice.findMany({ where: { userId, revokedAt: null }, orderBy: { lastUsedAt: "desc" }, select: { id: true, label: true, userAgent: true, lastUsedAt: true, createdAt: true } });
}

export async function revokeDevice(actorId: string, deviceId: string) {
  const device = await prisma.securityDevice.findUnique({ where: { id: deviceId } });
  if (!device || device.revokedAt) throw new Error("Active device not found");
  const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { email: true } });
  await prisma.$transaction(async (tx) => {
    await tx.securityDevice.update({ where: { id: deviceId }, data: { revokedAt: new Date() } });
    await tx.refreshToken.updateMany({ where: { deviceId, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.securityEvent.create({ data: { userId: actorId, userEmail: actor?.email ?? null, eventType: "DEVICE_REVOKED", outcome: "REVOKED", details: { deviceId, affectedUserId: device.userId } } });
  });
}

export async function requestDeviceReplacement(userId: string, deviceId: string, reason: string) {
  const device = await prisma.securityDevice.findFirst({ where: { id: deviceId, userId, revokedAt: null } });
  if (!device) throw new Error("Active device not found");
  const pending = await prisma.deviceReplacementRequest.findFirst({ where: { userId, status: "PENDING" } });
  if (pending) throw new Error("A device replacement request is already pending");
  const actor = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  return prisma.$transaction(async (tx) => {
    const result = await tx.deviceReplacementRequest.create({ data: { userId, deviceId, reason } });
    await tx.securityEvent.create({ data: { userId, userEmail: actor?.email ?? null, eventType: "DEVICE_REPLACEMENT_REQUEST", outcome: "PENDING", details: { requestId: result.id, deviceId } } });
    const admins = await tx.user.findMany({ where: { userRoles: { some: { role: { name: "SUPER_ADMIN" } } } }, select: { id: true } });
    if (admins.length) await tx.notification.createMany({ data: admins.filter((admin) => admin.id !== userId).map((admin) => ({
      userId: admin.id, title: "Device replacement needs review", message: `${actor?.email ?? "An employee"} requested a device replacement.`,
      type: "INFO" as const, metadata: { destination: "/security", requestType: "deviceReplacement", requestId: result.id },
    })) });
    return result;
  });
}

export async function listReplacementRequests() {
  return prisma.deviceReplacementRequest.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, include: { user: { select: { id: true, email: true } }, device: true } });
}

export async function approveReplacementRequest(actorId: string, requestId: string) {
  const request = await prisma.deviceReplacementRequest.findUnique({ where: { id: requestId } });
  if (!request || request.status !== "PENDING") throw new Error("Pending replacement request not found");
  const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { email: true } });
  await prisma.$transaction(async (tx) => {
    await tx.securityDevice.update({ where: { id: request.deviceId }, data: { revokedAt: new Date() } });
    await tx.refreshToken.updateMany({ where: { deviceId: request.deviceId, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.deviceReplacementRequest.update({ where: { id: requestId }, data: { status: "APPROVED", reviewedByUserId: actorId, reviewedAt: new Date() } });
    await tx.securityEvent.create({ data: { userId: actorId, userEmail: actor?.email ?? null, eventType: "DEVICE_REPLACEMENT_APPROVED", outcome: "APPROVED", details: { requestId, deviceId: request.deviceId, affectedUserId: request.userId } } });
  });
}

export async function rejectReplacementRequest(actorId: string, requestId: string) {
  const request = await prisma.deviceReplacementRequest.findUnique({ where: { id: requestId } });
  if (!request || request.status !== "PENDING") throw new Error("Pending replacement request not found");
  const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { email: true } });
  await prisma.$transaction(async (tx) => {
    await tx.deviceReplacementRequest.update({ where: { id: requestId }, data: { status: "REJECTED", reviewedByUserId: actorId, reviewedAt: new Date() } });
    await tx.securityEvent.create({ data: { userId: actorId, userEmail: actor?.email ?? null, eventType: "DEVICE_REPLACEMENT_REJECTED", outcome: "REJECTED", details: { requestId, deviceId: request.deviceId, affectedUserId: request.userId } } });
  });
}

