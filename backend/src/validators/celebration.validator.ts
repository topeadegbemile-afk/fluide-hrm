import { z } from "zod";

export const createCelebrationSchema = z.object({
  title: z.string().trim().min(2, "Title is required").max(150, "Title is too long"),
  type: z.enum(["BIRTHDAY", "WORK_ANNIVERSARY", "TEAM_ACHIEVEMENT", "COMPANY_EVENT", "HOLIDAY", "RECOGNITION", "OTHER"]).optional(),
  description: z.string().trim().max(2000, "Description is too long").optional(),
  eventDate: z.string().datetime("Event date must be a valid ISO date-time string").optional(),
  location: z.string().trim().max(200, "Location is too long").optional(),
  imageUrl: z.string().trim().url("Image URL must be a valid URL").max(500, "Image URL is too long").optional(),
  isPublished: z.boolean().optional(),
});

export const updateCelebrationSchema = z.object({
  title: z.string().trim().min(2, "Title is required").max(150, "Title is too long").optional(),
  type: z.enum(["BIRTHDAY", "WORK_ANNIVERSARY", "TEAM_ACHIEVEMENT", "COMPANY_EVENT", "HOLIDAY", "RECOGNITION", "OTHER"]).optional(),
  description: z.string().trim().max(2000, "Description is too long").optional(),
  eventDate: z.string().datetime("Event date must be a valid ISO date-time string").optional(),
  location: z.string().trim().max(200, "Location is too long").optional(),
  imageUrl: z.string().trim().url("Image URL must be a valid URL").max(500, "Image URL is too long").optional(),
  isPublished: z.boolean().optional(),
});

export type CreateCelebrationInput = z.infer<typeof createCelebrationSchema>;
export type UpdateCelebrationInput = z.infer<typeof updateCelebrationSchema>;
