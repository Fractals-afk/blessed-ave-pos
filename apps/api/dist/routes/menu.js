"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.menuRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("@blessed-ave/db");
const auth_1 = require("../middleware/auth");
exports.menuRouter = (0, express_1.Router)();
const menuInclude = {
    items: {
        where: { available: true },
        include: { modifierGroups: { include: { options: true } } },
        orderBy: { name: "asc" },
    },
};
// GET /api/menu — public, returns full menu with categories
exports.menuRouter.get("/", async (_req, res, next) => {
    try {
        const categories = await db_1.prisma.menuCategory.findMany({
            where: { active: true },
            include: menuInclude,
            orderBy: { sortOrder: "asc" },
        });
        res.json({ data: categories });
    }
    catch (e) {
        next(e);
    }
});
// GET /api/menu/all — admin: includes unavailable items
exports.menuRouter.get("/all", auth_1.requireAuth, async (_req, res, next) => {
    try {
        const categories = await db_1.prisma.menuCategory.findMany({
            include: {
                items: {
                    include: { modifierGroups: { include: { options: true } } },
                    orderBy: { name: "asc" },
                },
            },
            orderBy: { sortOrder: "asc" },
        });
        res.json({ data: categories });
    }
    catch (e) {
        next(e);
    }
});
// ─── Categories ───────────────────────────────────────────────────────────────
const categorySchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    sortOrder: zod_1.z.number().optional(),
    active: zod_1.z.boolean().optional(),
});
exports.menuRouter.post("/categories", auth_1.requireAuth, (0, auth_1.requireRole)("OWNER", "MANAGER"), async (req, res, next) => {
    try {
        const data = categorySchema.parse(req.body);
        const category = await db_1.prisma.menuCategory.create({ data });
        res.status(201).json({ data: category });
    }
    catch (e) {
        next(e);
    }
});
exports.menuRouter.patch("/categories/:id", auth_1.requireAuth, (0, auth_1.requireRole)("OWNER", "MANAGER"), async (req, res, next) => {
    try {
        const data = categorySchema.partial().parse(req.body);
        const category = await db_1.prisma.menuCategory.update({
            where: { id: req.params.id },
            data,
        });
        res.json({ data: category });
    }
    catch (e) {
        next(e);
    }
});
exports.menuRouter.delete("/categories/:id", auth_1.requireAuth, (0, auth_1.requireRole)("OWNER"), async (req, res, next) => {
    try {
        await db_1.prisma.menuCategory.delete({ where: { id: req.params.id } });
        res.json({ data: { ok: true } });
    }
    catch (e) {
        next(e);
    }
});
// ─── Items ────────────────────────────────────────────────────────────────────
const itemSchema = zod_1.z.object({
    categoryId: zod_1.z.string(),
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    price: zod_1.z.number().int().positive(), // centavos
    imageUrl: zod_1.z.string().url().optional(),
    available: zod_1.z.boolean().optional(),
});
exports.menuRouter.post("/items", auth_1.requireAuth, (0, auth_1.requireRole)("OWNER", "MANAGER"), async (req, res, next) => {
    try {
        const data = itemSchema.parse(req.body);
        const item = await db_1.prisma.menuItem.create({
            data,
            include: { modifierGroups: { include: { options: true } } },
        });
        res.status(201).json({ data: item });
    }
    catch (e) {
        next(e);
    }
});
exports.menuRouter.patch("/items/:id", auth_1.requireAuth, (0, auth_1.requireRole)("OWNER", "MANAGER"), async (req, res, next) => {
    try {
        const data = itemSchema.partial().parse(req.body);
        const item = await db_1.prisma.menuItem.update({
            where: { id: req.params.id },
            data,
            include: { modifierGroups: { include: { options: true } } },
        });
        res.json({ data: item });
    }
    catch (e) {
        next(e);
    }
});
exports.menuRouter.delete("/items/:id", auth_1.requireAuth, (0, auth_1.requireRole)("OWNER"), async (req, res, next) => {
    try {
        await db_1.prisma.menuItem.delete({ where: { id: req.params.id } });
        res.json({ data: { ok: true } });
    }
    catch (e) {
        next(e);
    }
});
// ─── Modifier Groups ──────────────────────────────────────────────────────────
const modifierGroupSchema = zod_1.z.object({
    menuItemId: zod_1.z.string(),
    name: zod_1.z.string().min(1),
    required: zod_1.z.boolean().optional(),
    multiSelect: zod_1.z.boolean().optional(),
    sortOrder: zod_1.z.number().optional(),
    options: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string().min(1),
        priceAdjustment: zod_1.z.number().int().default(0),
    })),
});
exports.menuRouter.post("/modifier-groups", auth_1.requireAuth, (0, auth_1.requireRole)("OWNER", "MANAGER"), async (req, res, next) => {
    try {
        const { options, ...rest } = modifierGroupSchema.parse(req.body);
        const group = await db_1.prisma.modifierGroup.create({
            data: { ...rest, options: { create: options } },
            include: { options: true },
        });
        res.status(201).json({ data: group });
    }
    catch (e) {
        next(e);
    }
});
exports.menuRouter.delete("/modifier-groups/:id", auth_1.requireAuth, (0, auth_1.requireRole)("OWNER", "MANAGER"), async (req, res, next) => {
    try {
        await db_1.prisma.modifierGroup.delete({ where: { id: req.params.id } });
        res.json({ data: { ok: true } });
    }
    catch (e) {
        next(e);
    }
});
//# sourceMappingURL=menu.js.map