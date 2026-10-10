import { createEmployee, getEmployees, getEmployeeById, updateEmployee, deleteEmployee, } from "../services/employee.service.js";
function getRouteParamId(id) {
    if (Array.isArray(id)) {
        return id[0] ?? "";
    }
    return id ?? "";
}
/**
 * POST /api/v1/employees
 */
export async function create(req, res) {
    try {
        const employee = await createEmployee(req.body);
        res.status(201).json({
            success: true,
            message: "Employee created successfully",
            data: employee,
        });
    }
    catch (error) {
        const message = error instanceof Error
            ? error.message
            : "Unable to create employee";
        const statusCode = message.includes("already exists")
            ? 409
            : message.includes("not found")
                ? 404
                : message.includes("inactive")
                    ? 400
                    : 500;
        res.status(statusCode).json({
            success: false,
            message,
            error: statusCode === 500
                ? "INTERNAL_SERVER_ERROR"
                : "EMPLOYEE_CREATION_ERROR",
        });
    }
}
/**
 * GET /api/v1/employees
 */
export async function getAll(_req, res) {
    try {
        const employees = await getEmployees();
        res.status(200).json({
            success: true,
            message: "Employees retrieved successfully",
            data: employees,
        });
    }
    catch {
        res.status(500).json({
            success: false,
            message: "Unable to retrieve employees",
            error: "INTERNAL_SERVER_ERROR",
        });
    }
}
/**
 * GET /api/v1/employees/:id
 */
export async function getOne(req, res) {
    try {
        const employeeId = getRouteParamId(req.params.id);
        const employee = await getEmployeeById(employeeId);
        res.status(200).json({
            success: true,
            message: "Employee retrieved successfully",
            data: employee,
        });
    }
    catch (error) {
        const message = error instanceof Error
            ? error.message
            : "Unable to retrieve employee";
        const statusCode = message === "Employee not found"
            ? 404
            : 500;
        res.status(statusCode).json({
            success: false,
            message,
            error: statusCode === 404
                ? "EMPLOYEE_NOT_FOUND"
                : "INTERNAL_SERVER_ERROR",
        });
    }
}
/**
 * PATCH /api/v1/employees/:id
 */
export async function update(req, res) {
    try {
        const employeeId = getRouteParamId(req.params.id);
        const employee = await updateEmployee(employeeId, req.body);
        res.status(200).json({
            success: true,
            message: "Employee updated successfully",
            data: employee,
        });
    }
    catch (error) {
        const message = error instanceof Error
            ? error.message
            : "Unable to update employee";
        const statusCode = message === "Employee not found"
            ? 404
            : message.includes("already exists")
                ? 409
                : message.includes("not found")
                    ? 404
                    : message.includes("inactive")
                        ? 400
                        : 500;
        res.status(statusCode).json({
            success: false,
            message,
            error: statusCode === 500
                ? "INTERNAL_SERVER_ERROR"
                : "EMPLOYEE_UPDATE_ERROR",
        });
    }
}
/**
 * DELETE /api/v1/employees/:id
 */
export async function remove(req, res) {
    try {
        const employeeId = getRouteParamId(req.params.id);
        const result = await deleteEmployee(employeeId);
        res.status(200).json({
            success: true,
            message: "Employee deleted successfully",
            data: result,
        });
    }
    catch (error) {
        const message = error instanceof Error
            ? error.message
            : "Unable to delete employee";
        const statusCode = message === "Employee not found"
            ? 404
            : 500;
        res.status(statusCode).json({
            success: false,
            message,
            error: statusCode === 404
                ? "EMPLOYEE_NOT_FOUND"
                : "INTERNAL_SERVER_ERROR",
        });
    }
}
