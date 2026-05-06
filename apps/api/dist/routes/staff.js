"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.staffRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = require("@blessed-ave/db");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
exports.staffRouter = (0, express_1.Router)();
// GET /api/staff
exports.staffRouter.get("/", auth_1.requireAuth, (0, auth_1.requireRole)("OWNER", "MANAGER"), async (_req, res, next) => {
    try {
        const staff = await db_1.prisma.user.findMany({
            select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
            orderBy: { name: "asc" },
        });
        res.json({ data: staff });
    }
    catch (e) {
        next(e);
    }
});
// POST /api/staff
exports.staffRouter.post("/", auth_1.requireAuth, (0, auth_1.requireRole)("OWNER", "MANAGER"), async (req, res, next) => {
    try {
        const { name, email, password, role } = zod_1.z
            .object({
            name: zod_1.z.string().min(1),
            email: zod_1.z.string().email(),
            password: zod_1.z.string().min(8),
            role: zod_1.z.enum(["OWNER", "MANAGER", "STAFF"]).default("STAFF"),
        })
            .parse(req.body);
        const existing = await db_1.prisma.user.findUnique({ where: { email } });
        if (existing)
            throw new errorHandler_1.AppError("Email already in use");
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        const user = await db_1.prisma.user.create({
            data: { name, email, passwordHash, role },
            select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
        });
        res.status(201).json({ data: user });
    }
    catch (e) {
        next(e);
    }
});
// PATCH /api/staff/:id
exports.staffRouter.patch("/:id", auth_1.requireAuth, (0, auth_1.requireRole)("OWNER", "MANAGER"), async (req, res, next) => {
    try {
        const data = zod_1.z
            .object({
            name: zod_1.z.string().optional(),
            role: zod_1.z.enum(["OWNER", "MANAGER", "STAFF"]).optional(),
            active: zod_1.z.boolean().optional(),
        })
            .parse(req.body);
        const user = await db_1.prisma.user.update({
            where: { id: req.params.id },
            data,
            select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
        });
        res.json({ data: user });
    }
    catch (e) {
        next(e);
    }
});
// POST /api/staff/:id/reset-password
exports.staffRouter.post("/:id/reset-password", auth_1.requireAuth, (0, auth_1.requireRole)("OWNER"), async (req, res, next) => {
    try {
        const { password } = zod_1.z.object({ password: zod_1.z.string().min(8) }).parse(req.body);
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        await db_1.prisma.user.update({
            where: { id: req.params.id },
            data: { passwordHash },
        });
        res.json({ data: { ok: true } });
    }
    catch (e) {
        next(e);
    }
});
// ─── Shifts ───────────────────────────────────────────────────────────────────
exports.staffRouter.get("/shifts", auth_1.requireAuth, async (req, res, next) => {
    try {
        const { from, to } = zod_1.z
            .object({ from: zod_1.z.string(), to: zod_1.z.string() })
            .parse(req.query);
        const shifts = await db_1.prisma.shift.findMany({
            where: {
                date: {
                    gte: new Date(from),
                    lte: new Date(to),
                },
            },
            include: { user: { select: { id: true, name: true } } },
            orderBy: [{ date: "asc" }, { startTime: "asc" }],
        });
        res.json({ data: shifts });
    }
    catch (e) {
        next(e);
    }
});
exports.staffRouter.post("/shifts", auth_1.requireAuth, (0, auth_1.requireRole)("OWNER", "MANAGER"), async (req, res, next) => {
    try {
        const data = zod_1.z
            .object({
            userId: zod_1.z.string(),
            date: zod_1.z.string(),
            startTime: zod_1.z.string(),
            endTime: zod_1.z.string(),
            notes: zod_1.z.string().optional(),
        })
            .parse(req.body);
        const shift = await db_1.prisma.shift.create({
            data: { ...data, date: new Date(data.date) },
            include: { user: { select: { id: true, name: true } } },
        });
        res.status(201).json({ data: shift });
    }
    catch (e) {
        next(e);
    }
});
exports.staffRouter.delete("/shifts/:id", auth_1.requireAuth, (0, auth_1.requireRole)("OWNER", "MANAGER"), async (req, res, next) => {
    try {
        await db_1.prisma.shift.delete({ where: { id: req.params.id } });
        res.json({ data: { ok: true } });
    }
    catch (e) {
        next(e);
    }
});
// ─── Clock in/out ─────────────────────────────────────────────────────────────
exports.staffRouter.post("/clock", auth_1.requireAuth, async (req, res, next) => {
    try {
        const { type } = zod_1.z.object({ type: zod_1.z.enum(["CLOCK_IN", "CLOCK_OUT"]) }).parse(req.body);
        const event = await db_1.prisma.clockEvent.create({
            data: { userId: req.user.userId, type },
        });
        res.status(201).json({ data: event });
    }
    catch (e) {
        next(e);
    }
});
exports.staffRouter.get("/clock/today", auth_1.requireAuth, async (req, res, next) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const events = await db_1.prisma.clockEvent.findMany({
            where: { userId: req.user.userId, timestamp: { gte: today } },
            orderBy: { timestamp: "asc" },
        });
        res.json({ data: events });
    }
    catch (e) {
        next(e);
    }
});
//# sourceMappingURL=staff.js.map