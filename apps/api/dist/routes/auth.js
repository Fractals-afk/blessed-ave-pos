"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const db_1 = require("@blessed-ave/db");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
exports.authRouter = (0, express_1.Router)();
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
});
// POST /api/auth/login
exports.authRouter.post("/login", async (req, res, next) => {
    try {
        const { email, password } = loginSchema.parse(req.body);
        const user = await db_1.prisma.user.findUnique({ where: { email } });
        if (!user || !user.active)
            throw new errorHandler_1.AppError("Invalid credentials", 401);
        const valid = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!valid)
            throw new errorHandler_1.AppError("Invalid credentials", 401);
        const payload = { userId: user.id, role: user.role };
        const accessToken = jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET, {
            expiresIn: (process.env.JWT_EXPIRES_IN ?? "15m"),
        });
        const refreshToken = jsonwebtoken_1.default.sign(payload, process.env.JWT_REFRESH_SECRET, {
            expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? "7d"),
        });
        // Store refresh token
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        await db_1.prisma.refreshToken.create({
            data: { userId: user.id, token: refreshToken, expiresAt },
        });
        res.json({
            data: {
                accessToken,
                refreshToken,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                },
            },
        });
    }
    catch (e) {
        next(e);
    }
});
// POST /api/auth/refresh
exports.authRouter.post("/refresh", async (req, res, next) => {
    try {
        const { refreshToken } = zod_1.z
            .object({ refreshToken: zod_1.z.string() })
            .parse(req.body);
        const stored = await db_1.prisma.refreshToken.findUnique({
            where: { token: refreshToken },
            include: { user: true },
        });
        if (!stored || stored.expiresAt < new Date()) {
            throw new errorHandler_1.AppError("Invalid refresh token", 401);
        }
        const payload = {
            userId: stored.user.id,
            role: stored.user.role,
        };
        const accessToken = jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET, {
            expiresIn: (process.env.JWT_EXPIRES_IN ?? "15m"),
        });
        res.json({ data: { accessToken } });
    }
    catch (e) {
        next(e);
    }
});
// POST /api/auth/logout
exports.authRouter.post("/logout", auth_1.requireAuth, async (req, res, next) => {
    try {
        const { refreshToken } = zod_1.z
            .object({ refreshToken: zod_1.z.string() })
            .parse(req.body);
        await db_1.prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
        res.json({ data: { ok: true } });
    }
    catch (e) {
        next(e);
    }
});
// GET /api/auth/me
exports.authRouter.get("/me", auth_1.requireAuth, async (req, res, next) => {
    try {
        const user = await db_1.prisma.user.findUnique({
            where: { id: req.user.userId },
            select: { id: true, name: true, email: true, role: true, createdAt: true },
        });
        if (!user)
            throw new errorHandler_1.AppError("User not found", 404);
        res.json({ data: user });
    }
    catch (e) {
        next(e);
    }
});
//# sourceMappingURL=auth.js.map