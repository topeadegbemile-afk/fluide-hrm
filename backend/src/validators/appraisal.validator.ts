import { z } from "zod";

export const createAppraisalCycleSchema = z
  .object({
    name: z.string().trim().min(2, "Cycle name is required").max(150, "Cycle name is too long"),
    year: z.number().int().min(2020, "Year must be a valid four-digit year"),
    startDate: z.string().datetime("Start date must be a valid ISO date-time string"),
    endDate: z.string().datetime("End date must be a valid ISO date-time string"),
    description: z.string().trim().max(2000, "Description is too long").optional(),
    status: z.enum(["DRAFT", "ACTIVE", "CLOSED"]).optional(),
  })
  .refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  });

export const createPerformanceReviewSchema = z.object({
  cycleId: z.string().min(1, "Cycle ID is required"),
  employeeId: z.string().min(1, "Employee ID is required").optional(),
  reviewerId: z.string().min(1, "Reviewer ID is required").optional(),
  title: z.string().trim().max(150, "Title is too long").optional(),
  selfAssessment: z.string().trim().max(4000, "Self assessment is too long").optional(),
  managerAssessment: z.string().trim().max(4000, "Manager assessment is too long").optional(),
  strengths: z.string().trim().max(2000, "Strengths are too long").optional(),
  improvementAreas: z.string().trim().max(2000, "Improvement areas are too long").optional(),
  goals: z.string().trim().max(2000, "Goals are too long").optional(),
  overallRating: z.number().min(1, "Rating must be at least 1").max(5, "Rating must be no more than 5").optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "IN_REVIEW", "APPROVED", "REJECTED"]).optional(),
});

export const updatePerformanceReviewSchema = z.object({
  title: z.string().trim().max(150, "Title is too long").optional(),
  selfAssessment: z.string().trim().max(4000, "Self assessment is too long").optional(),
  managerAssessment: z.string().trim().max(4000, "Manager assessment is too long").optional(),
  strengths: z.string().trim().max(2000, "Strengths are too long").optional(),
  improvementAreas: z.string().trim().max(2000, "Improvement areas are too long").optional(),
  goals: z.string().trim().max(2000, "Goals are too long").optional(),
  overallRating: z.number().min(1, "Rating must be at least 1").max(5, "Rating must be no more than 5").optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "IN_REVIEW", "APPROVED", "REJECTED"]).optional(),
});

export const updatePerformanceReviewStatusSchema = z.object({
  status: z.enum(["DRAFT", "SUBMITTED", "IN_REVIEW", "APPROVED", "REJECTED"]),
  managerAssessment: z.string().trim().max(4000, "Manager assessment is too long").optional(),
  strengths: z.string().trim().max(2000, "Strengths are too long").optional(),
  improvementAreas: z.string().trim().max(2000, "Improvement areas are too long").optional(),
  goals: z.string().trim().max(2000, "Goals are too long").optional(),
  overallRating: z.number().min(1, "Rating must be at least 1").max(5, "Rating must be no more than 5").optional(),
});

export type CreateAppraisalCycleInput = z.infer<typeof createAppraisalCycleSchema>;
export type CreatePerformanceReviewInput = z.infer<typeof createPerformanceReviewSchema>;
export type UpdatePerformanceReviewInput = z.infer<typeof updatePerformanceReviewSchema>;
export type UpdatePerformanceReviewStatusInput = z.infer<typeof updatePerformanceReviewStatusSchema>;
