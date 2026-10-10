import { prisma } from "../config/database.js";

async function getUserRoles(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: {
        include: { role: true },
      },
    },
  });

  return user?.userRoles.map((userRole) => userRole.role.name) ?? [];
}

function hasRole(roles, ...names) {
  return names.some((name) => roles.includes(name));
}

async function getEmployeeForUser(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { employee: true },
  });
}

const reviewInclude = {
  employee: {
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  reviewer: {
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
  cycle: true,
};

export async function createAppraisalCycle(userId, data) {
  const roles = await getUserRoles(userId);

  if (!hasRole(roles, "SUPER_ADMIN", "HR", "MANAGER")) {
    throw new Error("You do not have permission to create appraisal cycles");
  }

  return prisma.appraisalCycle.create({
    data: {
      name: data.name,
      year: data.year,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      description: data.description ?? null,
      status: data.status ?? "DRAFT",
    },
  });
}

export async function getAppraisalCycles(userId) {
  const roles = await getUserRoles(userId);

  if (hasRole(roles, "SUPER_ADMIN", "HR", "MANAGER")) {
    return prisma.appraisalCycle.findMany({
      orderBy: { startDate: "desc" },
    });
  }

  return prisma.appraisalCycle.findMany({
    where: { status: "ACTIVE" },
    orderBy: { startDate: "desc" },
  });
}

export async function getAppraisalCycleById(userId, cycleId) {
  const cycle = await prisma.appraisalCycle.findUnique({
    where: { id: cycleId },
    include: {
      performanceReviews: {
        include: reviewInclude,
      },
    },
  });

  if (!cycle) {
    throw new Error("Appraisal cycle not found");
  }

  const roles = await getUserRoles(userId);
  if (hasRole(roles, "SUPER_ADMIN", "HR", "MANAGER") || cycle.status === "ACTIVE") {
    return cycle;
  }

  throw new Error("You do not have access to this appraisal cycle");
}

export async function createPerformanceReview(userId, data) {
  const roles = await getUserRoles(userId);
  const currentEmployee = await getEmployeeForUser(userId);

  const employeeId = data.employeeId ?? currentEmployee?.employee?.id;

  if (!employeeId) {
    throw new Error("Employee profile is required to manage performance reviews");
  }

  const hasAccess = hasRole(roles, "SUPER_ADMIN", "HR", "MANAGER") || employeeId === currentEmployee?.employee?.id;
  if (!hasAccess) {
    throw new Error("You do not have permission to create this performance review");
  }

  const cycle = await prisma.appraisalCycle.findUnique({ where: { id: data.cycleId } });
  if (!cycle) {
    throw new Error("Appraisal cycle not found");
  }

  if (cycle.status === "CLOSED") {
    throw new Error("Closed appraisal cycles cannot receive new performance reviews");
  }

  const existingReview = await prisma.performanceReview.findFirst({
    where: {
      cycleId: data.cycleId,
      employeeId,
    },
  });

  if (existingReview) {
    throw new Error("A performance review already exists for this employee in the selected cycle");
  }

  return prisma.performanceReview.create({
    data: {
      cycleId: data.cycleId,
      employeeId,
      reviewerId: data.reviewerId ?? currentEmployee?.employee?.id ?? null,
      title: data.title ?? null,
      selfAssessment: data.selfAssessment ?? null,
      managerAssessment: data.managerAssessment ?? null,
      strengths: data.strengths ?? null,
      improvementAreas: data.improvementAreas ?? null,
      goals: data.goals ?? null,
      overallRating: data.overallRating ?? null,
      status: data.status ?? "DRAFT",
      submittedAt: data.status === "SUBMITTED" ? new Date() : null,
      reviewedAt: ["APPROVED", "REJECTED", "IN_REVIEW"].includes(data.status ?? "DRAFT") ? new Date() : null,
    },
    include: reviewInclude,
  });
}

export async function getPerformanceReviews(userId, employeeId) {
  const roles = await getUserRoles(userId);
  const currentEmployee = await getEmployeeForUser(userId);

  const targetEmployeeId = employeeId ?? currentEmployee?.employee?.id;

  if (hasRole(roles, "SUPER_ADMIN", "HR", "MANAGER")) {
    return prisma.performanceReview.findMany({
      where: targetEmployeeId ? { employeeId: targetEmployeeId } : undefined,
      orderBy: { createdAt: "desc" },
      include: reviewInclude,
    });
  }

  if (!targetEmployeeId) {
    throw new Error("Employee profile is required to view performance reviews");
  }

  return prisma.performanceReview.findMany({
    where: { employeeId: targetEmployeeId },
    orderBy: { createdAt: "desc" },
    include: reviewInclude,
  });
}

export async function getPerformanceReviewById(userId, reviewId) {
  const roles = await getUserRoles(userId);
  const currentEmployee = await getEmployeeForUser(userId);
  const review = await prisma.performanceReview.findUnique({
    where: { id: reviewId },
    include: reviewInclude,
  });

  if (!review) {
    throw new Error("Performance review not found");
  }

  if (hasRole(roles, "SUPER_ADMIN", "HR", "MANAGER") || review.employeeId === currentEmployee?.employee?.id) {
    return review;
  }

  throw new Error("You do not have access to this performance review");
}

export async function updatePerformanceReview(userId, reviewId, data) {
  const roles = await getUserRoles(userId);
  const currentEmployee = await getEmployeeForUser(userId);
  const review = await prisma.performanceReview.findUnique({ where: { id: reviewId } });

  if (!review) {
    throw new Error("Performance review not found");
  }

  const isOwnReview = review.employeeId === currentEmployee?.employee?.id;
  if (!hasRole(roles, "SUPER_ADMIN", "HR", "MANAGER") && !isOwnReview) {
    throw new Error("You do not have permission to update this performance review");
  }

  if (!hasRole(roles, "SUPER_ADMIN", "HR", "MANAGER") && review.status !== "DRAFT") {
    throw new Error("Only draft reviews can be edited by the employee");
  }

  const update = {
    title: data.title ?? undefined,
    selfAssessment: data.selfAssessment ?? undefined,
    managerAssessment: data.managerAssessment ?? undefined,
    strengths: data.strengths ?? undefined,
    improvementAreas: data.improvementAreas ?? undefined,
    goals: data.goals ?? undefined,
    overallRating: data.overallRating ?? undefined,
  };

  if (data.status) {
    update.status = data.status;
    if (data.status === "SUBMITTED") update.submittedAt = new Date();
    if (["APPROVED", "REJECTED", "IN_REVIEW"].includes(data.status)) update.reviewedAt = new Date();
  }

  return prisma.performanceReview.update({
    where: { id: reviewId },
    data: update,
    include: reviewInclude,
  });
}

export async function updatePerformanceReviewStatus(userId, reviewId, data) {
  const roles = await getUserRoles(userId);
  const currentEmployee = await getEmployeeForUser(userId);
  const review = await prisma.performanceReview.findUnique({ where: { id: reviewId } });

  if (!review) {
    throw new Error("Performance review not found");
  }

  const isOwnReview = review.employeeId === currentEmployee?.employee?.id;
  if (!hasRole(roles, "SUPER_ADMIN", "HR", "MANAGER") && !isOwnReview) {
    throw new Error("You do not have permission to update this review status");
  }

  if (!hasRole(roles, "SUPER_ADMIN", "HR", "MANAGER") && review.status !== "DRAFT") {
    throw new Error("Only draft reviews can be submitted by the employee");
  }

  const update = {
    status: data.status,
    managerAssessment: data.managerAssessment ?? undefined,
    strengths: data.strengths ?? undefined,
    improvementAreas: data.improvementAreas ?? undefined,
    goals: data.goals ?? undefined,
    overallRating: data.overallRating ?? undefined,
  };

  if (data.status === "SUBMITTED") update.submittedAt = new Date();
  if (["APPROVED", "REJECTED", "IN_REVIEW"].includes(data.status)) update.reviewedAt = new Date();

  if (hasRole(roles, "SUPER_ADMIN", "HR", "MANAGER") && !isOwnReview) {
    update.reviewerId = currentEmployee?.employee?.id ?? review.reviewerId;
  }

  return prisma.performanceReview.update({
    where: { id: reviewId },
    data: update,
    include: reviewInclude,
  });
}
