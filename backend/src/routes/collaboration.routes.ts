import { Router, type Response } from "express";
import { z } from "zod";
import { authenticate, type AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { getChannels, getMessages, sendMessage, getTasks, createTask, updateTaskStatus, getDepartmentEmployees } from "../services/collaboration.service.js";

const router = Router();
const messageSchema = z.object({ message: z.string().trim().min(1).max(2000) });
const taskSchema = z.object({ title: z.string().trim().min(2).max(160), description: z.string().max(2000).optional(), assigneeId: z.string().uuid(), dueDate: z.string().datetime().optional() });
const statusSchema = z.object({ status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED"]) });

function handleError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : "Collaboration request failed";
  const status = message.includes("not found") ? 404 : message.includes("permission") || message.includes("Only") || message.includes("access") || message.includes("cannot") ? 403 : 400;
  res.status(status).json({ success: false, message, error: "COLLABORATION_REQUEST_FAILED" });
}

router.use(authenticate);
router.get("/departments", async (req: AuthenticatedRequest, res: Response) => {
  try { res.json({ success: true, message: "Channels retrieved", data: await getChannels(req.user!.id) }); } catch (error) { handleError(res, error); }
});
router.get("/departments/:departmentId/messages", async (req: AuthenticatedRequest, res: Response) => {
  try { res.json({ success: true, message: "Messages retrieved", data: await getMessages(req.user!.id, req.params.departmentId as string) }); } catch (error) { handleError(res, error); }
});
router.post("/departments/:departmentId/messages", async (req: AuthenticatedRequest, res: Response) => {
  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, message: "Enter a message up to 2000 characters", error: "INVALID_MESSAGE" }); return; }
  try { res.status(201).json({ success: true, message: "Message sent", data: await sendMessage(req.user!.id, req.params.departmentId as string, parsed.data.message) }); } catch (error) { handleError(res, error); }
});
router.get("/departments/:departmentId/tasks", async (req: AuthenticatedRequest, res: Response) => {
  try { res.json({ success: true, message: "Tasks retrieved", data: await getTasks(req.user!.id, req.params.departmentId as string) }); } catch (error) { handleError(res, error); }
});
router.get("/departments/:departmentId/employees", async (req: AuthenticatedRequest, res: Response) => {
  try { res.json({ success: true, message: "Employees retrieved", data: await getDepartmentEmployees(req.user!.id, req.params.departmentId as string) }); } catch (error) { handleError(res, error); }
});
router.post("/departments/:departmentId/tasks", async (req: AuthenticatedRequest, res: Response) => {
  const parsed = taskSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, message: "Enter a title and choose an employee", error: "INVALID_TASK" }); return; }
  try { res.status(201).json({ success: true, message: "Task assigned", data: await createTask(req.user!.id, req.params.departmentId as string, parsed.data) }); } catch (error) { handleError(res, error); }
});
router.patch("/tasks/:taskId", async (req: AuthenticatedRequest, res: Response) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ success: false, message: "Choose a valid task status", error: "INVALID_TASK_STATUS" }); return; }
  try { res.json({ success: true, message: "Task updated", data: await updateTaskStatus(req.user!.id, req.params.taskId as string, parsed.data.status) }); } catch (error) { handleError(res, error); }
});

export default router;
