"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.operatingCostsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("@blessed-ave/db");
const auth_1 = require("../middleware/auth");
exports.operatingCostsRouter = (0, express_1.Router)();
const costSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    category: zod_1.z.enum(["RENT", "UTILITIES", "WAGES", "PACKAGING", "MARKETING", "EQUIPMENT", "MAINTENANCE", "OTHER"]),
    frequency: zod_1.z.enum(["ONE_TIME", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
    amount: zod_1.z.number().int().positive(), // centavos
    date: zod_1.z.string(), // ISO date string
    notes: zod_1.z.string().optional(),
});
// GET /api/operating-costs?from=&to=
exports.operatingCostsRouter.get("/", auth_1.requireAuth, (0, auth_1.requireRole)("OWNER", "MANAGER"), async (req, res, next) => {
    try {
        const { from, to } = zod_1.z.object({ from: zod_1.z.string().optional(), to: zod_1.z.string().optional() }).parse(req.query);
        const where = {};
        if (from && to) {
            where.date = { gte: new Date(from), lte: new Date(to) };
        }
        const costs = await db_1.prisma.operatingCost.findMany({
            where,
            orderBy: { date: "desc" },
        });
        res.json({ data: costs });
    }
    catch (e) {
        next(e);
    }
});
// POST /api/operating-costs
exports.operatingCostsRouter.post("/", auth_1.requireAuth, (0, auth_1.requireRole)("OWNER", "MANAGER"), async (req, res, next) => {
    try {
        const data = costSchema.parse(req.body);
        const cost = await db_1.prisma.operatingCost.create({
            data: { ...data, date: new Date(data.date) },
        });
        res.status(201).json({ data: cost });
    }
    catch (e) {
        next(e);
    }
});
// PATCH /api/operating-costs/:id
exports.operatingCostsRouter.patch("/:id", auth_1.requireAuth, (0, auth_1.requireRole)("OWNER", "MANAGER"), async (req, res, next) => {
    try {
        const data = costSchema.partial().parse(req.body);
        const cost = await db_1.prisma.operatingCost.update({
            where: { id: req.params.id },
            data: { ...data, date: data.date ? new Date(data.date) : undefined },
        });
        res.json({ data: cost });
    }
    catch (e) {
        next(e);
    }
});
// DELETE /api/operating-costs/:id
exports.operatingCostsRouter.delete("/:id", auth_1.requireAuth, (0, auth_1.requireRole)("OWNER", "MANAGER"), async (req, res, next) => {
    try {
        await db_1.prisma.operatingCost.delete({ where: { id: req.params.id } });
        res.json({ data: { ok: true } });
    }
    catch (e) {
        next(e);
    }
});
//# sourceMappingURL=operating-costs.js.map