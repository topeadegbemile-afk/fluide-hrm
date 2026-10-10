import type { Request, Response } from "express";
import { createAuditLog, getAuditLogs } from "../services/audit.service.js";

export async function getAll(_req: Request, res: Response): Promise<void> {
  try {
    const logs = await getAuditLogs();
    res.status(200).json({ success: true, message: "Audit logs retrieved successfully", data: logs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve audit logs";
    res.status(500).json({ success: false, message, error: "AUDIT_FETCH_FAILED" });
  }
}

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const log = await createAuditLog(req.body);
    res.status(201).json({ success: true, message: "Audit log created successfully", data: log });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create audit log";
    res.status(400).json({ success: false, message, error: "AUDIT_CREATE_FAILED" });
  }
}
