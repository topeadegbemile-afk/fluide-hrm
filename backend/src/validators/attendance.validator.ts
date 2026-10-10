import { z } from "zod";

export const clockInSchema = z.object({
  notes: z
    .string()
    .trim()
    .max(500, "Notes must be 500 characters or fewer")
    .optional(),
});

export const clockOutSchema = z.object({
  notes: z
    .string()
    .trim()
    .max(500, "Notes must be 500 characters or fewer")
    .optional(),
});

export const updateAttendanceSchema = z
  .object({
    clockIn: z.string().datetime("Clock-in must be a valid ISO date-time string").optional(),
    clockOut: z.string().datetime("Clock-out must be a valid ISO date-time string").optional(),
    status: z
      .enum(["PRESENT", "LATE", "ABSENT", "HALF_DAY", "ON_LEAVE"])
      .optional(),
    notes: z
      .string()
      .trim()
      .max(500, "Notes must be 500 characters or fewer")
      .optional(),
  })
  .refine(
    (data) => {
      if (data.clockIn && data.clockOut) {
        return new Date(data.clockOut) >= new Date(data.clockIn);
      }
      return true;
    },
    {
      message: "Clock-out must be after clock-in",
      path: ["clockOut"],
    }
  );

export type ClockInInput = z.infer<typeof clockInSchema>;
export type ClockOutInput = z.infer<typeof clockOutSchema>;
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;
