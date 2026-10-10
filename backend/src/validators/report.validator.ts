import { z } from "zod";

export const reportQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  departmentId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
});

export type ReportQueryInput = z.infer<typeof reportQuerySchema>;
