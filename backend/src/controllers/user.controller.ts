import { Request, Response } from "express";

import {
  assignRoleToUser,
  createUser,
  deactivateUser,
  deleteUser,
  getAvailableEmployees,
  getUserById,
  getUsers,
  reactivateUser,
  resendSetupInvitation,
  updateUser,
} from "../services/user.service.js";

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const user = await createUser(req.body);
    res.status(201).json({ success: true, message: "User created and setup email sent", data: user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create user";
    const emailFailure = message.includes("setup email could not be sent");
    res.status(emailFailure ? 502 : 400).json({ success: false, message, error: emailFailure ? "INVITATION_EMAIL_FAILED" : "USER_CREATE_FAILED" });
  }
}

export async function getAll(_req: Request, res: Response): Promise<void> {
  try {
    const users = await getUsers();
    res.status(200).json({ success: true, message: "Users retrieved successfully", data: users });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to retrieve users";
    res.status(500).json({ success: false, message, error: "USER_FETCH_FAILED" });
  }
}

export async function getAvailableEmployeesController(
  _req: Request,
  res: Response,
): Promise<void> {
  try {
    const employees = await getAvailableEmployees();

    res.status(200).json({
      success: true,
      message: "Available employees retrieved successfully",
      data: employees,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to retrieve available employees";

    res.status(500).json({
      success: false,
      message,
      error: "AVAILABLE_EMPLOYEES_FETCH_FAILED",
    });
  }
}

export async function getOne(req: Request, res: Response): Promise<void> {
  try {
    const user = await getUserById(req.params.id as string);
    res.status(200).json({ success: true, message: "User retrieved successfully", data: user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to retrieve user";
    const statusCode = message === "User not found" ? 404 : 500;
    res.status(statusCode).json({ success: false, message, error: "USER_FETCH_FAILED" });
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const user = await updateUser(req.params.id as string, req.body);
    res.status(200).json({ success: true, message: "User updated successfully", data: user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update user";
    const statusCode = message === "User not found" ? 404 : 400;
    res.status(statusCode).json({ success: false, message, error: "USER_UPDATE_FAILED" });
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  try {
    const result = await deleteUser(req.params.id as string);
    res.status(200).json({ success: true, message: "User deleted successfully", data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete user";
    const statusCode = message === "User not found" ? 404 : 400;
    res.status(statusCode).json({ success: false, message, error: "USER_DELETE_FAILED" });
  }
}

export async function assignRole(req: Request, res: Response): Promise<void> {
  try {
    const assignment = await assignRoleToUser(req.params.id as string, req.body.roleId as string);
    res.status(200).json({ success: true, message: "User role assigned successfully", data: assignment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to assign role";
    const statusCode = message === "User not found" || message === "Role not found" ? 404 : 400;
    res.status(statusCode).json({ success: false, message, error: "USER_ROLE_ASSIGN_FAILED" });
  }
}

export async function deactivate(req: Request, res: Response): Promise<void> {
  try {
    const user = await deactivateUser(req.params.id as string);
    res.status(200).json({ success: true, message: "User deactivated successfully", data: user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to deactivate user";
    const statusCode = message === "User not found" ? 404 : 400;
    res.status(statusCode).json({ success: false, message, error: "USER_DEACTIVATE_FAILED" });
  }
}

export async function reactivate(req: Request, res: Response): Promise<void> {
  try {
    const user = await reactivateUser(req.params.id as string);
    res.status(200).json({ success: true, message: "User reactivated successfully", data: user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reactivate user";
    const statusCode = message === "User not found" ? 404 : 400;
    res.status(statusCode).json({ success: false, message, error: "USER_REACTIVATE_FAILED" });
  }
}


export async function resendSetupInvitationController(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const result = await resendSetupInvitation(
      req.params.id as string,
    );

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to resend setup invitation";

    const statusCode =
      message === "User not found"
        ? 404
        : message === "This user has already completed password setup"
          ? 400
          : 502;

    res.status(statusCode).json({
      success: false,
      message,
      error: "SETUP_INVITATION_FAILED",
    });
  }
}



