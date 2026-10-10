import { createDepartment, getDepartments, getDepartmentById, updateDepartment, deleteDepartment, } from "../services/department.service.js";
export async function create(req, res) {
    try {
        const department = await createDepartment(req.body);
        res.status(201).json({
            success: true,
            message: "Department created successfully",
            data: department,
        });
    }
    catch (error) {
        const message = error instanceof Error
            ? error.message
            : "Failed to create department";
        res.status(400).json({
            success: false,
            message,
            error: "DEPARTMENT_CREATE_FAILED",
        });
    }
}
export async function getAll(_req, res) {
    try {
        const departments = await getDepartments();
        res.status(200).json({
            success: true,
            message: "Departments retrieved successfully",
            data: departments,
        });
    }
    catch (error) {
        const message = error instanceof Error
            ? error.message
            : "Failed to retrieve departments";
        res.status(500).json({
            success: false,
            message,
            error: "DEPARTMENT_FETCH_FAILED",
        });
    }
}
export async function getOne(req, res) {
    try {
        const department = await getDepartmentById(req.params.id);
        res.status(200).json({
            success: true,
            message: "Department retrieved successfully",
            data: department,
        });
    }
    catch (error) {
        const message = error instanceof Error
            ? error.message
            : "Failed to retrieve department";
        const statusCode = message === "Department not found" ? 404 : 500;
        res.status(statusCode).json({
            success: false,
            message,
            error: "DEPARTMENT_FETCH_FAILED",
        });
    }
}
export async function update(req, res) {
    try {
        const department = await updateDepartment(req.params.id, req.body);
        res.status(200).json({
            success: true,
            message: "Department updated successfully",
            data: department,
        });
    }
    catch (error) {
        const message = error instanceof Error
            ? error.message
            : "Failed to update department";
        const statusCode = message === "Department not found" ? 404 : 400;
        res.status(statusCode).json({
            success: false,
            message,
            error: "DEPARTMENT_UPDATE_FAILED",
        });
    }
}
export async function remove(req, res) {
    try {
        const result = await deleteDepartment(req.params.id);
        res.status(200).json({
            success: true,
            message: "Department deleted successfully",
            data: result,
        });
    }
    catch (error) {
        const message = error instanceof Error
            ? error.message
            : "Failed to delete department";
        let statusCode = 400;
        if (message === "Department not found") {
            statusCode = 404;
        }
        res.status(statusCode).json({
            success: false,
            message,
            error: "DEPARTMENT_DELETE_FAILED",
        });
    }
}
