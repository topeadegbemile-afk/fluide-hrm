import { prisma } from "../config/database.js";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  CreateHandbookArticleInput,
  HandbookQueryInput,
  UpdateHandbookArticleInput,
} from "../validators/handbook.validator.js";

const authorSelection = {
  id: true,
  employeeNumber: true,
  firstName: true,
  lastName: true,
} as const;

const attachmentSelection = { id: true, fileName: true, mimeType: true, size: true, createdAt: true } as const;
const uploadDirectory = resolve(process.env.POLICY_UPLOAD_DIR ?? "uploads/policies");
const allowedAttachmentTypes: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "text/plain": ".txt",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
};

function toSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function ensureSlugAvailable(slug: string, exceptId?: string) {
  const existing = await prisma.handbookArticle.findUnique({ where: { slug } });
  if (existing && existing.id !== exceptId) {
    throw new Error("An article with this slug already exists");
  }
}

async function getAuthorId(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { employee: { select: { id: true } } },
  });
  if (!user) {
    throw new Error("User not found");
  }
  return user.employee?.id ?? null;
}

export async function getHandbookArticles(query: HandbookQueryInput, includeDrafts = false) {
  const where = {
    ...(includeDrafts ? {} : { isPublished: true }),
    ...(query.category ? { category: { equals: query.category, mode: "insensitive" as const } } : {}),
    ...(query.q
      ? {
          OR: [
            { title: { contains: query.q, mode: "insensitive" as const } },
            { summary: { contains: query.q, mode: "insensitive" as const } },
            { content: { contains: query.q, mode: "insensitive" as const } },
            { category: { contains: query.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const skip = (query.page - 1) * query.pageSize;

  const [articles, total] = await Promise.all([
    prisma.handbookArticle.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
      skip,
      take: query.pageSize,
      include: { createdBy: { select: authorSelection }, attachments: { select: attachmentSelection, orderBy: { createdAt: "asc" } } },
    }),
    prisma.handbookArticle.count({ where }),
  ]);

  return {
    items: articles,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  };
}

export async function getHandbookArticleById(id: string, includeDrafts = false) {
  const article = await prisma.handbookArticle.findFirst({
    where: { id, ...(includeDrafts ? {} : { isPublished: true }) },
    include: { createdBy: { select: authorSelection }, attachments: { select: attachmentSelection, orderBy: { createdAt: "asc" } } },
  });
  if (!article) {
    throw new Error("Handbook article not found");
  }
  return article;
}

export async function createHandbookArticle(userId: string, data: CreateHandbookArticleInput) {
  const slug = toSlug(data.slug ?? data.title);
  if (!slug) {
    throw new Error("Article title or slug must contain letters or numbers");
  }
  await ensureSlugAvailable(slug);
  const createdById = await getAuthorId(userId);

  return prisma.handbookArticle.create({
    data: {
      title: data.title,
      slug,
      summary: data.summary ?? null,
      category: data.category,
      content: data.content,
      isPublished: data.isPublished,
      publishedAt: data.isPublished ? new Date() : null,
      createdById,
    },
    include: { createdBy: { select: authorSelection }, attachments: { select: attachmentSelection, orderBy: { createdAt: "asc" } } },
  });
}

export async function updateHandbookArticle(id: string, data: UpdateHandbookArticleInput) {
  const existing = await prisma.handbookArticle.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("Handbook article not found");
  }

  const slug = data.slug !== undefined
    ? toSlug(data.slug)
    : data.title !== undefined
      ? toSlug(data.title)
      : undefined;
  if (slug !== undefined) {
    if (!slug) {
      throw new Error("Article title or slug must contain letters or numbers");
    }
    await ensureSlugAvailable(slug, id);
  }

  return prisma.handbookArticle.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(slug !== undefined && { slug }),
      ...(data.summary !== undefined && { summary: data.summary }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.content !== undefined && { content: data.content }),
      ...(data.isPublished !== undefined && {
        isPublished: data.isPublished,
        publishedAt: data.isPublished ? existing.publishedAt ?? new Date() : null,
      }),
    },
    include: { createdBy: { select: authorSelection }, attachments: { select: attachmentSelection, orderBy: { createdAt: "asc" } } },
  });
}

export async function addPolicyAttachment(articleId: string, fileName: string, mimeType: string, bytes: Buffer) {
  const extension = allowedAttachmentTypes[mimeType];
  if (!extension) throw new Error("Unsupported attachment type. Use PDF, PNG, JPG, TXT, DOCX, or XLSX.");
  if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw new Error("Attachment must be smaller than 20 MB.");
  if (mimeType === "application/pdf" && !bytes.subarray(0, 1024).includes(Buffer.from("%PDF-"))) throw new Error("This file does not appear to be a valid PDF.");
  const article = await prisma.handbookArticle.findUnique({ where: { id: articleId }, select: { id: true } });
  if (!article) throw new Error("Policy not found");
  const storageKey = `${randomUUID()}${extension}`;
  await mkdir(uploadDirectory, { recursive: true });
  const filePath = resolve(uploadDirectory, storageKey);
  await writeFile(filePath, bytes, { flag: "wx" });
  try {
    return await prisma.policyAttachment.create({
      data: { articleId, fileName: fileName.replace(/[\\/\0]/g, "").slice(0, 180) || `policy-file${extension}`, storageKey, mimeType, size: bytes.length },
      select: attachmentSelection,
    });
  } catch (error) {
    await unlink(filePath).catch(() => undefined);
    throw error;
  }
}

export async function getPolicyAttachment(attachmentId: string, includeDrafts = false) {
  const attachment = await prisma.policyAttachment.findUnique({
    where: { id: attachmentId },
    include: { article: { select: { isPublished: true } } },
  });
  if (!attachment || (!includeDrafts && !attachment.article.isPublished)) throw new Error("Policy attachment not found");
  const filePath = resolve(uploadDirectory, attachment.storageKey);
  const relativePath = relative(uploadDirectory, filePath);
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) throw new Error("Policy attachment not found");
  const bytes = await readFile(filePath);
  return { attachment, bytes };
}
