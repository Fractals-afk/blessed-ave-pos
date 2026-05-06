"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ordersRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("@blessed-ave/db");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
const index_1 = require("../index");
const socket_1 = require("../socket");
exports.ordersRouter = (0, express_1.Router)();
const selectedOptionSchema = zod_1.z.object({
    modifierOptionId: zod_1.z.string(),
});
const orderItemSchema = zod_1.z.object({
    menuItemId: zod_1.z.string(),
    quantity: zod_1.z.number().int().positive(),
    selectedOptions: zod_1.z.array(selectedOptionSchema).default([]),
    notes: zod_1.z.string().optional(),
});
const createOrderSchema = zod_1.z.object({
    source: zod_1.z.enum(["ONLINE", "QR_TABLE", "POS"]),
    tableId: zod_1.z.string().optional(),
    customerName: zod_1.z.string().optional(),
    customerPhone: zod_1.z.string().optional(),
    customerEmail: zod_1.z.string().email().optional(),
    notes: zod_1.z.string().optional(),
    items: zod_1.z.array(orderItemSchema).min(1),
});
// POST /api/orders — create a new order (public for ONLINE & QR, auth for POS)
exports.ordersRouter.post("/", async (req, res, next) => {
    try {
        const body = createOrderSchema.parse(req.body);
        // Fetch menu items + modifiers to compute prices
        const menuItemIds = body.items.map((i) => i.menuItemId);
        const menuItems = await db_1.prisma.menuItem.findMany({
            where: { id: { in: menuItemIds }, available: true },
            include: { modifierGroups: { include: { options: true } } },
        });
        if (menuItems.length !== menuItemIds.length) {
            throw new errorHandler_1.AppError("One or more menu items not found or unavailable");
        }
        const menuMap = new Map(menuItems.map((m) => [m.id, m]));
        let subtotal = 0;
        const orderItemsData = await Promise.all(body.items.map(async (item) => {
            const menuItem = menuMap.get(item.menuItemId);
            let unitPrice = menuItem.price;
            // Fetch selected modifier options for snapshot + price
            const optionIds = item.selectedOptions.map((o) => o.modifierOptionId);
            const options = optionIds.length
                ? await db_1.prisma.modifierOption.findMany({
                    where: { id: { in: optionIds } },
                })
                : [];
            const optionAdjustments = options.reduce((sum, o) => sum + o.priceAdjustment, 0);
            unitPrice += optionAdjustments;
            const itemSubtotal = unitPrice * item.quantity;
            subtotal += itemSubtotal;
            return {
                menuItemId: menuItem.id,
                menuItemName: menuItem.name,
                quantity: item.quantity,
                unitPrice,
                subtotal: itemSubtotal,
                notes: item.notes,
                selectedOptions: {
                    create: options.map((o) => ({
                        modifierOptionId: o.id,
                        name: o.name,
                        priceAdjustment: o.priceAdjustment,
                    })),
                },
            };
        }));
        const order = await db_1.prisma.order.create({
            data: {
                source: body.source,
                tableId: body.tableId,
                customerName: body.customerName,
                customerPhone: body.customerPhone,
                customerEmail: body.customerEmail,
                notes: body.notes,
                subtotal,
                total: subtotal,
                items: { create: orderItemsData },
            },
            include: {
                items: { include: { selectedOptions: true } },
                table: true,
                payment: true,
            },
        });
        (0, socket_1.emitNewOrder)(index_1.io, order);
        res.status(201).json({ data: order });
    }
    catch (e) {
        next(e);
    }
});
// GET /api/orders — admin: list orders with filters
exports.ordersRouter.get("/", auth_1.requireAuth, async (req, res, next) => {
    try {
        const { status, source, date, page = "1", pageSize = "30" } = req.query;
        const where = {};
        if (status)
            where.status = status;
        if (source)
            where.source = source;
        if (date) {
            const d = new Date(date);
            const next = new Date(d);
            next.setDate(next.getDate() + 1);
            where.createdAt = { gte: d, lt: next };
        }
        const [orders, total] = await Promise.all([
            db_1.prisma.order.findMany({
                where,
                include: {
                    items: { include: { selectedOptions: true } },
                    table: true,
                    payment: true,
                },
                orderBy: { createdAt: "desc" },
                skip: (Number(page) - 1) * Number(pageSize),
                take: Number(pageSize),
            }),
            db_1.prisma.order.count({ where }),
        ]);
        res.json({ data: orders, total, page: Number(page), pageSize: Number(pageSize) });
    }
    catch (e) {
        next(e);
    }
});
// GET /api/orders/kitchen — live kitchen queue (pending + confirmed + preparing)
exports.ordersRouter.get("/kitchen", auth_1.requireAuth, async (_req, res, next) => {
    try {
        const orders = await db_1.prisma.order.findMany({
            where: { status: { in: ["PENDING", "CONFIRMED", "PREPARING"] } },
            include: {
                items: { include: { selectedOptions: true } },
                table: true,
            },
            orderBy: { createdAt: "asc" },
        });
        res.json({ data: orders });
    }
    catch (e) {
        next(e);
    }
});
// GET /api/orders/:id — single order (public for customer tracking)
exports.ordersRouter.get("/:id", async (req, res, next) => {
    try {
        const order = await db_1.prisma.order.findUnique({
            where: { id: req.params.id },
            include: {
                items: { include: { selectedOptions: true } },
                table: true,
                payment: true,
            },
        });
        if (!order)
            throw new errorHandler_1.AppError("Order not found", 404);
        res.json({ data: order });
    }
    catch (e) {
        next(e);
    }
});
// PATCH /api/orders/:id/status — update order status
exports.ordersRouter.patch("/:id/status", auth_1.requireAuth, async (req, res, next) => {
    try {
        const { status } = zod_1.z
            .object({
            status: zod_1.z.enum([
                "CONFIRMED",
                "PREPARING",
                "READY",
                "COLLECTED",
                "CANCELLED",
            ]),
        })
            .parse(req.body);
        const order = await db_1.prisma.order.update({
            where: { id: req.params.id },
            data: { status },
            include: {
                items: { include: { selectedOptions: true } },
                table: true,
                payment: true,
            },
        });
        (0, socket_1.emitOrderStatusUpdate)(index_1.io, order.id, status, order);
        // Auto-decrement inventory if order is CONFIRMED
        if (status === "CONFIRMED") {
            decrementInventory(order.id).catch(console.error);
        }
        res.json({ data: order });
    }
    catch (e) {
        next(e);
    }
});
// Background: decrement inventory based on recipes
async function decrementInventory(orderId) {
    const order = await db_1.prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
    });
    if (!order)
        return;
    for (const item of order.items) {
        const recipes = await db_1.prisma.recipeItem.findMany({
            where: { menuItemId: item.menuItemId },
        });
        for (const recipe of recipes) {
            const qty = recipe.quantity * item.quantity;
            const inv = await db_1.prisma.inventoryItem.update({
                where: { id: recipe.inventoryItemId },
                data: { currentStock: { decrement: qty } },
            });
            await db_1.prisma.inventoryLog.create({
                data: {
                    inventoryItemId: inv.id,
                    reason: "SALE",
                    quantityChange: -qty,
                    stockAfter: inv.currentStock,
                    notes: `Order ${orderId}`,
                },
            });
        }
    }
}
//# sourceMappingURL=orders.js.map