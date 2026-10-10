import { Router } from "express";
import {
  create,
  getAll,
  getAllForManagement,
  getOne,
  getOneForManagement,
  update,
  uploadAttachment,
  downloadAttachment,
} from "../controllers/handbook.controller.js";
import express from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { requirePermission } from "../middleware/rbac.middleware.js";
import { validate } from "../middleware/validation.middleware.js";
import {
  createHandbookArticleSchema,
  updateHandbookArticleSchema,
} from "../validators/handbook.validator.js";

const router = Router();

router.use(authenticate);
router.get("/", requirePermission("handbook:read"), getAll);
router.get("/manage", requirePermission("handbook:update"), getAllForManagement);
router.get("/manage/:id", requirePermission("handbook:update"), getOneForManagement);
router.get("/attachments/:attachmentId", requirePermission("handbook:read"), downloadAttachment);
router.post("/:id/attachments", requirePermission("handbook:update"), express.raw({ type: () => true, limit: "20mb" }), uploadAttachment);
router.get("/:id", requirePermission("handbook:read"), getOne);
router.post("/", requirePermission("handbook:create"), validate(createHandbookArticleSchema), create);
router.patch("/:id", requirePermission("handbook:update"), validate(updateHandbookArticleSchema), update);

export default router;
