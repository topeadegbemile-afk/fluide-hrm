import { z } from "zod";

export const leaveTypeSchema = z.enum([
  "ANNUAL",
  "SICK",
  "EMERGENCY",
  "MATERNITY",
  "PATERNITY",
  "STUDY",
  "UNPAID",
  "OTHER",
]);

export const createLeaveSchema = z.object({
  leaveType: leaveTypeSchema,
  startDate: z.string().datetime("Start date must be a valid ISO date-time string"),
  endDate: z.string().datetime("End date must be a valid ISO date-time string"),
  reason: z.string().trim().min(5, "Reason must be at least 5 characters").max(1000),
}).refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
  message: "End date must be on or after start date",
  path: ["endDate"],
});

export const approveLeaveSchema = z.object({
  approvalComment: z.string().trim().max(500).optional(),
});

export const rejectLeaveSchema = z.object({
  rejectionReason: z.string().trim().min(5, "Rejection reason must be at least 5 characters").max(500),
});

export const leaveIdSchema = z.object({
  id: z.string().uuid("Invalid leave ID"),
});

export type CreateLeaveInput = z.infer<typeof createLeaveSchema>;
export type ApproveLeaveInput = z.infer<typeof approveLeaveSchema>;
export type RejectLeaveInput = z.infer<typeof rejectLeaveSchema>;
