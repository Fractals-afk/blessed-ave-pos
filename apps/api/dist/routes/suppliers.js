"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.suppliersRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("@blessed-ave/db");
const auth_1 = require("../middleware/auth");
exports.suppliersRouter = (0, express_1.Router)();
const supplierSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    contactName: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    email: zod_1.z.string().email().optional(),
    notes: zod_1.z.string().optional(),
});
exports.suppliersRouter.get("/", auth_1.requireAuth, async (_req, res, next) => {
    try {
        const suppliers = await db_1.prisma.supplier.findMany({
            where: { active: true },
            orderBy: { name: "asc" },
        });
        res.json({ data: suppliers });
    }
    catch (e) {
        next(e);
    }
});
exports.suppliersRouter.post("/", auth_1.requireAuth, (0, auth_1.requireRole)("OWNER", "MANAGER"), async (req, res, next) => {
    try {
        const data = supplierSchema.parse(req.body);
        const supplier = await db_1.prisma.supplier.create({ data });
        res.status(201).json({ data: supplier });
    }
    catch (e) {
        next(e);
    }
});
exports.suppliersRouter.patch("/:id", auth_1.requireAuth, (0, auth_1.requireRole)("OWNER", "MANAGER"), async (req, res, next) => {
    try {
        const data = supplierSchema.partial().parse(req.body);
        const supplier = await db_1.prisma.supplier.update({
            where: { id: req.params.id },
            data,
        });
        res.json({ data: supplier });
    }
    catch (e) {
        next(e);
    }
});
// ─── Purchase Orders ──────────────────────────────────────────────────────────
exports.suppliersRouter.get("/purchase-orders", auth_1.requireAuth, async (_req, res, next) => {
    try {
        const pos = await db_1.prisma.purchaseOrder.findMany({
            include: {
                supplier: true,
                items: { include: { inventoryItem: true } },
            },
            orderBy: { createdAt: "desc" },
        });
        res.json({ data: pos });
    }
    catch (e) {
        next(e);
    }
});
exports.suppliersRouter.post("/purchase-orders", auth_1.requireAuth, (0, auth_1.requireRole)("OWNER", "MANAGER"), async (req, res, next) => {
    try {
        const { supplierId, items, notes } = zod_1.z
            .object({
            supplierId: zod_1.z.string(),
            notes: zod_1.z.string().optional(),
            items: zod_1.z.array(zod_1.z.object({
                inventoryItemId: zod_1.z.string(),
                quantity: zod_1.z.number().positive(),
                unitCost: zod_1.z.number().int().positive(),
            })),
        })
            .parse(req.body);
        const total = items.reduce((s, i) => s + i.quantity * i.unitCost, 0);
        const po = await db_1.prisma.purchaseOrder.create({
            data: {
                supplierId,
                notes,
                total,
                items: { create: items },
            },
            include: { supplier: true, items: { include: { inventoryItem: true } } },
        });
        res.status(201).json({ data: po });
    }
    catch (e) {
        next(e);
    }
});
// PATCH /api/suppliers/purchase-orders/:id/receive — mark as received & update stock
exports.suppliersRouter.patch("/purchase-orders/:id/receive", auth_1.requireAuth, (0, auth_1.requireRole)("OWNER", "MANAGER"), async (req, res, next) => {
    try {
        const po = await db_1.prisma.purchaseOrder.findUnique({
            where: { id: req.params.id },
            include: { items: true },
        });
        if (!po)
            return res.status(404).json({ error: "Not found" });
        // Update stock for each item
        for (const item of po.items) {
            const inv = await db_1.prisma.inventoryItem.update({
                where: { id: item.inventoryItemId },
                data: { currentStock: { increment: item.quantity } },
            });
            await db_1.prisma.inventoryLog.create({
                data: {
                    inventoryItemId: item.inventoryItemId,
                    reason: "PURCHASE",
                    quantityChange: item.quantity,
                    stockAfter: inv.currentStock,
                    notes: `PO ${po.id}`,
                },
            });
        }
        const updated = await db_1.prisma.purchaseOrder.update({
            where: { id: req.params.id },
            data: { receivedAt: new Date() },
            include: { supplier: true, items: { include: { inventoryItem: true } } },
        });
        res.json({ data: updated });
    }
    catch (e) {
        next(e);
    }
});
//# sourceMappingURL=suppliers.js.map