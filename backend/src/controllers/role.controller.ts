import { Request, Response } from "express";
import { assignPermissionToRole, createRole, deleteRole, getPermissions, getRoleById, getRoles, updateRole } from "../services/role.service.js";

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const role = await createRole(req.body);
    res.status(201).json({ success: true, message: "Role created successfully", data: role });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create role";
    res.status(400).json({ success: false, message, error: "ROLE_CREATE_FAILED" });
  }
}

export async function getAll(_req: Request, res: Response): Promise<void> {
  try {
    const roles = await getRoles();
    res.status(200).json({ success: true, message: "Roles retrieved successfully", data: roles });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to retrieve roles";
    res.status(500).json({ success: false, message, error: "ROLE_FETCH_FAILED" });
  }
}

export async function getAllPermissions(_req: Request, res: Response): Promise<void> {
  try {
    const permissions = await getPermissions();
    res.status(200).json({ success: true, message: "Permissions retrieved successfully", data: permissions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to retrieve permissions";
    res.status(500).json({ success: false, message, error: "PERMISSION_FETCH_FAILED" });
  }
}

export async function getOne(req: Request, res: Response): Promise<void> {
  try {
    const role = await getRoleById(req.params.id as string);
    res.status(200).json({ success: true, message: "Role retrieved successfully", data: role });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to retrieve role";
    const statusCode = message === "Role not found" ? 404 : 500;
    res.status(statusCode).json({ success: false, message, error: "ROLE_FETCH_FAILED" });
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const role = await updateRole(req.params.id as string, req.body);
    res.status(200).json({ success: true, message: "Role updated successfully", data: role });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update role";
    const statusCode = message === "Role not found" ? 404 : 400;
    res.status(statusCode).json({ success: false, message, error: "ROLE_UPDATE_FAILED" });
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  try {
    const result = await deleteRole(req.params.id as string);
    res.status(200).json({ success: true, message: "Role deleted successfully", data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete role";
    const statusCode = message === "Role not found" ? 404 : 400;
    res.status(statusCode).json({ success: false, message, error: "ROLE_DELETE_FAILED" });
  }
}

export async function assignPermission(req: Request, res: Response): Promise<void> {
  try {
    const result = await assignPermissionToRole(req.params.id as string, req.body.permissionId as string);
    res.status(200).json({ success: true, message: "Permission assigned successfully", data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to assign permission";
    const statusCode = message === "Role not found" || message === "Permission not found" ? 404 : 400;
    res.status(statusCode).json({ success: false, message, error: "ROLE_PERMISSION_ASSIGN_FAILED" });
  }
}
