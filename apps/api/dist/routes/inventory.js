"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inventoryRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("@blessed-ave/db");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
exports.inventoryRouter = (0, express_1.Router)();
// GET /api/inventory
exports.inventoryRouter.get("/", auth_1.requireAuth, async (_req, res, next) => {
    try {
        const items = await db_1.prisma.inventoryItem.findMany({
            include: { supplier: true },
            orderBy: { name: "asc" },
        });
        const itemsWithFlag = items.map((i) => ({
            ...i,
            isLow: i.currentStock <= i.lowStockThreshold,
        }));
        res.json({ data: itemsWithFlag });
    }
    catch (e) {
        next(e);
    }
});
// GET /api/inventory/low-stock
exports.inventoryRouter.get("/low-stock", auth_1.requireAuth, async (_req, res, next) => {
    try {
        const items = await db_1.prisma.inventoryItem.findMany({
            include: { supplier: true },
            orderBy: { name: "asc" },
        });
        const low = items.filter((i) => i.currentStock <= i.lowStockThreshold);
        res.json({ data: low });
    }
    catch (e) {
        next(e);
    }
});
const inventoryItemSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    unit: zod_1.z.enum(["KG", "G", "L", "ML", "PCS", "PACK", "BOTTLE"]),
    currentStock: zod_1.z.number().default(0),
    lowStockThreshold: zod_1.z.number().default(0),
    cost: zod_1.z.number().int().default(0),
    supplierId: zod_1.z.string().optional(),
});
// POST /api/inventory
exports.inventoryRouter.post("/", auth_1.requireAuth, (0, auth_1.requireRole)("OWNER", "MANAGER"), async (req, res, next) => {
    try {
        const data = inventoryItemSchema.parse(req.body);
        const item = await db_1.prisma.inventoryItem.create({
            data,
            include: { supplier: true },
        });
        // Log opening stock
        if (data.currentStock > 0) {
            await db_1.prisma.inventoryLog.create({
                data: {
                    inventoryItemId: item.id,
                    reason: "OPENING_STOCK",
                    quantityChange: data.currentStock,
                    stockAfter: data.currentStock,
                },
            });
        }
        res.status(201).json({ data: item });
    }
    catch (e) {
        next(e);
    }
});
// PATCH /api/inventory/:id
exports.inventoryRouter.patch("/:id", auth_1.requireAuth, (0, auth_1.requireRole)("OWNER", "MANAGER"), async (req, res, next) => {
    try {
        const data = inventoryItemSchema.partial().parse(req.body);
        const item = await db_1.prisma.inventoryItem.update({
            where: { id: req.params.id },
            data,
            include: { supplier: true },
        });
        res.json({ data: item });
    }
    catch (e) {
        next(e);
    }
});
// POST /api/inventory/:id/adjust — manual stock adjustment
exports.inventoryRouter.post("/:id/adjust", auth_1.requireAuth, (0, auth_1.requireRole)("OWNER", "MANAGER"), async (req, res, next) => {
    try {
        const { quantity, reason, notes } = zod_1.z
            .object({
            quantity: zod_1.z.number(), // positive = add, negative = remove
            reason: zod_1.z.enum(["PURCHASE", "WASTE", "ADJUSTMENT"]),
            notes: zod_1.z.string().optional(),
        })
            .parse(req.body);
        const item = await db_1.prisma.inventoryItem.findUnique({
            where: { id: req.params.id },
        });
        if (!item)
            throw new errorHandler_1.AppError("Item not found", 404);
        const newStock = item.currentStock + quantity;
        if (newStock < 0)
            throw new errorHandler_1.AppError("Stock cannot go below zero");
        const updated = await db_1.prisma.inventoryItem.update({
            where: { id: req.params.id },
            data: { currentStock: newStock },
            include: { supplier: true },
        });
        await db_1.prisma.inventoryLog.create({
            data: {
                inventoryItemId: item.id,
                reason,
                quantityChange: quantity,
                stockAfter: newStock,
                notes,
            },
        });
        res.json({ data: { ...updated, isLow: updated.currentStock <= updated.lowStockThreshold } });
    }
    catch (e) {
        next(e);
    }
});
// GET /api/inventory/:id/logs
exports.inventoryRouter.get("/:id/logs", auth_1.requireAuth, async (req, res, next) => {
    try {
        const logs = await db_1.prisma.inventoryLog.findMany({
            where: { inventoryItemId: req.params.id },
            orderBy: { createdAt: "desc" },
            take: 100,
        });
        res.json({ data: logs });
    }
    catch (e) {
        next(e);
    }
});
// ─── Recipe mapping ───────────────────────────────────────────────────────────
// POST /api/inventory/recipes — set recipes for a menu item
exports.inventoryRouter.post("/recipes", auth_1.requireAuth, (0, auth_1.requireRole)("OWNER", "MANAGER"), async (req, res, next) => {
    try {
        const { menuItemId, recipes } = zod_1.z
            .object({
            menuItemId: zod_1.z.string(),
            recipes: zod_1.z.array(zod_1.z.object({
                inventoryItemId: zod_1.z.string(),
                quantity: zod_1.z.number().positive(),
            })),
        })
            .parse(req.body);
        // Replace existing recipes for this menu item
        await db_1.prisma.recipeItem.deleteMany({ where: { menuItemId } });
        const created = await db_1.prisma.recipeItem.createMany({
            data: recipes.map((r) => ({ menuItemId, ...r })),
        });
        res.json({ data: { count: created.count } });
    }
    catch (e) {
        next(e);
    }
});
// GET /api/inventory/recipes/:menuItemId
exports.inventoryRouter.get("/recipes/:menuItemId", auth_1.requireAuth, async (req, res, next) => {
    try {
        const recipes = await db_1.prisma.recipeItem.findMany({
            where: { menuItemId: req.params.menuItemId },
            include: { inventoryItem: true },
        });
        res.json({ data: recipes });
    }
    catch (e) {
        next(e);
    }
});
//# sourceMappingURL=inventory.js.map