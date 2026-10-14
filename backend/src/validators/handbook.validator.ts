import { z } from "zod";

export const createHandbookArticleSchema = z.object({
  title: z.string().trim().min(3).max(180),
  slug: z.string().trim().min(2).max(180).optional(),
  summary: z.string().trim().max(500).nullable().optional(),
  category: z.string().trim().min(2).max(80),
  content: z.string().trim().max(500000).default(""),
  isPublished: z.boolean().default(false),
});

export const updateHandbookArticleSchema = z
  .object({
    title: z.string().trim().min(3).max(180).optional(),
    slug: z.string().trim().min(2).max(180).optional(),
    summary: z.string().trim().max(500).nullable().optional(),
    category: z.string().trim().min(2).max(80).optional(),
    content: z.string().trim().max(500000).optional(),
    isPublished: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const handbookQuerySchema = z.object({
  q: z.string().trim().max(180).optional(),
  category: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateHandbookArticleInput = z.infer<typeof createHandbookArticleSchema>;
export type UpdateHandbookArticleInput = z.infer<typeof updateHandbookArticleSchema>;
export type HandbookQueryInput = z.infer<typeof handbookQuerySchema>;
