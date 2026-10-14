import { Router } from "express";
import {
  create,
  getAll,
  getAllForManagement,
  getOne,
  getOneForManagement,
  update,
  remove,
  uploadAttachment,
  downloadAttachment,
  publishOwn,
  removeAttachment,
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
router.delete("/:id/attachments/:attachmentId", requirePermission("handbook:update"), removeAttachment);
router.post("/:id/attachments", express.raw({ type: () => true, limit: "20mb" }), uploadAttachment);
router.post("/:id/publish", requirePermission("handbook:create"), publishOwn);
router.get("/:id", requirePermission("handbook:read"), getOne);
router.post("/", requirePermission("handbook:create"), validate(createHandbookArticleSchema), create);
router.patch("/:id", requirePermission("handbook:update"), validate(updateHandbookArticleSchema), update);
router.delete("/:id", requirePermission("handbook:delete"), remove);

export default router;
