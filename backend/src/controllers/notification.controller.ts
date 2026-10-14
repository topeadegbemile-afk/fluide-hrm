import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import {
  createNotification,
  createNotificationForAllEmployees,
  deleteNotification,
  getNotificationsForUser,
  updateNotificationForUser,
} from "../services/notification.service.js";

export async function getAll(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required", error: "AUTHENTICATION_REQUIRED" });
      return;
    }

    const notifications = await getNotificationsForUser(req.user.id);
    res.status(200).json({ success: true, message: "Notifications retrieved successfully", data: notifications });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve notifications";
    res.status(500).json({ success: false, message, error: "NOTIFICATION_FETCH_FAILED" });
  }
}

export async function create(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required", error: "AUTHENTICATION_REQUIRED" });
      return;
    }

    const notification = req.body.allEmployees
      ? await createNotificationForAllEmployees(req.body)
      : await createNotification({ ...req.body, userId: req.body.userId ?? req.user.id });

    res.status(201).json({ success: true, message: "Notification created successfully", data: notification });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create notification";
    res.status(400).json({ success: false, message, error: "NOTIFICATION_CREATE_FAILED" });
  }
}

export async function update(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required", error: "AUTHENTICATION_REQUIRED" });
      return;
    }

    const notification = await updateNotificationForUser(req.params.id as string, req.user.id, req.body);
    res.status(200).json({ success: true, message: "Notification updated successfully", data: notification });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update notification";
    const statusCode = message === "Notification not found" ? 404 : 400;
    res.status(statusCode).json({ success: false, message, error: "NOTIFICATION_UPDATE_FAILED" });
  }
}

export async function remove(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Authentication required", error: "AUTHENTICATION_REQUIRED" });
      return;
    }

    const result = await deleteNotification(req.params.id as string, req.user.id);
    res.status(200).json({ success: true, message: "Notification deleted successfully", data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete notification";
    const statusCode = message === "Notification not found" ? 404 : 400;
    res.status(statusCode).json({ success: false, message, error: "NOTIFICATION_DELETE_FAILED" });
  }
}
