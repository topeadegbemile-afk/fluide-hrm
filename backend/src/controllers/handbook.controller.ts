import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { prisma } from "../config/database.js";
import {
  createHandbookArticle,
  getHandbookArticleById,
  getHandbookArticles,
  addPolicyAttachment,
  getPolicyAttachment,
  updateHandbookArticle,
} from "../services/handbook.service.js";
import { handbookQuerySchema } from "../validators/handbook.validator.js";

function parseHandbookQuery(req: AuthenticatedRequest, res: Response) {
  const parsed = handbookQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      message: "Invalid handbook filters",
      error: "VALIDATION_ERROR",
      details: parsed.error.flatten(),
    });
    return undefined;
  }
  return parsed.data;
}

export async function getAll(req: AuthenticatedRequest, res: Response): Promise<void> {
  const query = parseHandbookQuery(req, res);
  if (!query) return;

  try {
    const result = await getHandbookArticles(query);
    res.status(200).json({ success: true, message: "Handbook articles retrieved successfully", data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve handbook articles";
    res.status(500).json({ success: false, message, error: "HANDBOOK_FETCH_FAILED" });
  }
}

export async function getAllForManagement(req: AuthenticatedRequest, res: Response): Promise<void> {
  const query = parseHandbookQuery(req, res);
  if (!query) return;

  try {
    const result = await getHandbookArticles(query, true);
    res.status(200).json({ success: true, message: "Handbook articles retrieved successfully", data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve handbook articles";
    res.status(500).json({ success: false, message, error: "HANDBOOK_FETCH_FAILED" });
  }
}

export async function getOne(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const article = await getHandbookArticleById(req.params.id as string);
    res.status(200).json({ success: true, message: "Handbook article retrieved successfully", data: article });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve handbook article";
    const statusCode = message === "Handbook article not found" ? 404 : 500;
    res.status(statusCode).json({ success: false, message, error: "HANDBOOK_FETCH_FAILED" });
  }
}

export async function getOneForManagement(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const article = await getHandbookArticleById(req.params.id as string, true);
    res.status(200).json({ success: true, message: "Handbook article retrieved successfully", data: article });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve handbook article";
    const statusCode = message === "Handbook article not found" ? 404 : 500;
    res.status(statusCode).json({ success: false, message, error: "HANDBOOK_FETCH_FAILED" });
  }
}

export async function create(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, message: "Authentication required", error: "AUTHENTICATION_REQUIRED" });
    return;
  }

  try {
    const article = await createHandbookArticle(req.user.id, req.body);
    res.status(201).json({ success: true, message: "Handbook article created successfully", data: article });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create handbook article";
    const statusCode = message.includes("already exists") ? 409 : message === "User not found" ? 404 : 400;
    res.status(statusCode).json({ success: false, message, error: "HANDBOOK_CREATE_FAILED" });
  }
}

export async function update(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const article = await updateHandbookArticle(req.params.id as string, req.body);
    res.status(200).json({ success: true, message: "Handbook article updated successfully", data: article });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update handbook article";
    const statusCode = message === "Handbook article not found" ? 404 : message.includes("already exists") ? 409 : 400;
    res.status(statusCode).json({ success: false, message, error: "HANDBOOK_UPDATE_FAILED" });
  }
}

export async function uploadAttachment(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!Buffer.isBuffer(req.body)) {
    res.status(400).json({ success: false, message: "Upload a file to attach to this policy", error: "FILE_REQUIRED" });
    return;
  }
  try {
    let fileName = "policy-attachment";
    try { fileName = decodeURIComponent(String(req.headers["x-file-name"] ?? fileName)); } catch { /* use a safe fallback */ }
    const attachment = await addPolicyAttachment(req.params.id as string, fileName, String(req.headers["content-type"] ?? ""), req.body);
    res.status(201).json({ success: true, message: "Policy attachment uploaded", data: attachment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload policy attachment";
    const status = message === "Policy not found" ? 404 : 400;
    res.status(status).json({ success: false, message, error: "POLICY_ATTACHMENT_UPLOAD_FAILED" });
  }
}

export async function downloadAttachment(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const canManage = req.user ? await prisma.userRole.findFirst({
      where: { userId: req.user!.id, role: { rolePermissions: { some: { permission: { name: "handbook:update" } } } } },
      select: { id: true },
    }) : null;
    const { attachment, bytes } = await getPolicyAttachment(req.params.attachmentId as string, Boolean(canManage));
    res.setHeader("Content-Type", attachment.mimeType);
    res.setHeader("Content-Length", String(bytes.length));
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", ["application/pdf", "image/png", "image/jpeg", "text/plain"].includes(attachment.mimeType) ? "inline" : "attachment");
    res.status(200).send(bytes);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve policy attachment";
    const status = message.includes("not found") || message.includes("ENOENT") ? 404 : 500;
    res.status(status).json({ success: false, message, error: "POLICY_ATTACHMENT_FETCH_FAILED" });
  }
}
