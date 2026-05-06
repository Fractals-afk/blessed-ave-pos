"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
exports.errorHandler = errorHandler;
class AppError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.message = message;
        this.statusCode = statusCode;
        this.name = "AppError";
    }
}
exports.AppError = AppError;
function errorHandler(err, _req, res, _next) {
    console.error("[error]", err);
    if (err.name === "AppError") {
        const appErr = err;
        return res.status(appErr.statusCode).json({ error: appErr.message });
    }
    if (err.name === "ZodError") {
        return res.status(422).json({ error: "Validation error", details: err });
    }
    return res.status(500).json({ error: "Internal server error" });
}
//# sourceMappingURL=errorHandler.js.map