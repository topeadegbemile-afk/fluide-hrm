import { createPosition, getPositions, getPositionById, updatePosition, deletePosition, } from "../services/position.service.js";
export async function create(req, res) {
    try {
        const position = await createPosition(req.body);
        res.status(201).json({
            success: true,
            message: "Position created successfully",
            data: position,
        });
    }
    catch (error) {
        const message = error instanceof Error
            ? error.message
            : "Failed to create position";
        res.status(400).json({
            success: false,
            message,
            error: "POSITION_CREATE_FAILED",
        });
    }
}
export async function getAll(_req, res) {
    try {
        const positions = await getPositions();
        res.status(200).json({
            success: true,
            message: "Positions retrieved successfully",
            data: positions,
        });
    }
    catch (error) {
        const message = error instanceof Error
            ? error.message
            : "Failed to retrieve positions";
        res.status(500).json({
            success: false,
            message,
            error: "POSITION_FETCH_FAILED",
        });
    }
}
export async function getOne(req, res) {
    try {
        const positionId = Array.isArray(req.params.id)
            ? req.params.id[0]
            : req.params.id;
        const position = await getPositionById(positionId);
        res.status(200).json({
            success: true,
            message: "Position retrieved successfully",
            data: position,
        });
    }
    catch (error) {
        const message = error instanceof Error
            ? error.message
            : "Failed to retrieve position";
        const statusCode = message === "Position not found" ? 404 : 500;
        res.status(statusCode).json({
            success: false,
            message,
            error: "POSITION_FETCH_FAILED",
        });
    }
}
export async function update(req, res) {
    try {
        const positionId = Array.isArray(req.params.id)
            ? req.params.id[0]
            : req.params.id;
        const position = await updatePosition(positionId, req.body);
        res.status(200).json({
            success: true,
            message: "Position updated successfully",
            data: position,
        });
    }
    catch (error) {
        const message = error instanceof Error
            ? error.message
            : "Failed to update position";
        const statusCode = message === "Position not found" ? 404 : 400;
        res.status(statusCode).json({
            success: false,
            message,
            error: "POSITION_UPDATE_FAILED",
        });
    }
}
export async function remove(req, res) {
    try {
        const positionId = Array.isArray(req.params.id)
            ? req.params.id[0]
            : req.params.id;
        const result = await deletePosition(positionId);
        res.status(200).json({
            success: true,
            message: "Position deleted successfully",
            data: result,
        });
    }
    catch (error) {
        const message = error instanceof Error
            ? error.message
            : "Failed to delete position";
        const statusCode = message === "Position not found" ? 404 : 400;
        res.status(statusCode).json({
            success: false,
            message,
            error: "POSITION_DELETE_FAILED",
        });
    }
}
