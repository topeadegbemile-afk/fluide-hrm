export const validate = (schema) => {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                error: "VALIDATION_ERROR",
                details: result.error.flatten(),
            });
        }
        req.body = result.data;
        next();
    };
};
