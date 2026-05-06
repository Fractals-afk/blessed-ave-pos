"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("@blessed-ave/db");
const auth_1 = require("../middleware/auth");
exports.reportsRouter = (0, express_1.Router)();
const rangeSchema = zod_1.z.object({
    from: zod_1.z.string(),
    to: zod_1.z.string(),
});
// GET /api/reports/sales?from=&to=
exports.reportsRouter.get("/sales", auth_1.requireAuth, (0, auth_1.requireRole)("OWNER", "MANAGER"), async (req, res, next) => {
    try {
        const { from, to } = rangeSchema.parse(req.query);
        const fromDate = new Date(from);
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        const [orders, payments] = await Promise.all([
            db_1.prisma.order.findMany({
                where: {
                    createdAt: { gte: fromDate, lte: toDate },
                    status: { notIn: ["CANCELLED", "PENDING"] },
                },
                include: {
                    items: true,
                    payment: true,
                },
            }),
            db_1.prisma.payment.findMany({
                where: {
                    status: "PAID",
                    paidAt: { gte: fromDate, lte: toDate },
                },
            }),
        ]);
        const totalRevenue = payments.reduce((s, p) => s + p.amount, 0);
        const totalOrders = orders.length;
        // Revenue by payment method
        const byPaymentMethod = {
            GCASH: 0,
            MAYA: 0,
            CARD: 0,
            CASH: 0,
        };
        for (const p of payments) {
            byPaymentMethod[p.method] = (byPaymentMethod[p.method] ?? 0) + p.amount;
        }
        // Revenue by order source
        const bySource = { ONLINE: 0, QR_TABLE: 0, POS: 0 };
        for (const o of orders) {
            bySource[o.source] = (bySource[o.source] ?? 0) + o.total;
        }
        // Top items
        const itemMap = {};
        for (const order of orders) {
            for (const item of order.items) {
                if (!itemMap[item.menuItemId]) {
                    itemMap[item.menuItemId] = {
                        name: item.menuItemName,
                        quantity: 0,
                        revenue: 0,
                    };
                }
                itemMap[item.menuItemId].quantity += item.quantity;
                itemMap[item.menuItemId].revenue += item.subtotal;
            }
        }
        const topItems = Object.values(itemMap)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);
        // Daily breakdown
        const dailyMap = {};
        for (const o of orders) {
            const day = o.createdAt.toISOString().slice(0, 10);
            if (!dailyMap[day])
                dailyMap[day] = { orders: 0, revenue: 0 };
            dailyMap[day].orders += 1;
            dailyMap[day].revenue += o.total;
        }
        const daily = Object.entries(dailyMap)
            .map(([date, v]) => ({ date, ...v }))
            .sort((a, b) => a.date.localeCompare(b.date));
        res.json({
            data: {
                from,
                to,
                totalOrders,
                totalRevenue,
                byPaymentMethod,
                bySource,
                topItems,
                daily,
            },
        });
    }
    catch (e) {
        next(e);
    }
});
// GET /api/reports/summary — quick dashboard numbers (today + this week)
exports.reportsRouter.get("/summary", auth_1.requireAuth, async (_req, res, next) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const [todayOrders, weekOrders, pendingOrders, lowStockCount] = await Promise.all([
            db_1.prisma.order.count({
                where: { createdAt: { gte: today }, status: { notIn: ["CANCELLED"] } },
            }),
            db_1.prisma.order.findMany({
                where: { createdAt: { gte: weekStart }, status: { notIn: ["CANCELLED", "PENDING"] } },
                select: { total: true },
            }),
            db_1.prisma.order.count({
                where: { status: { in: ["PENDING", "CONFIRMED", "PREPARING"] } },
            }),
            db_1.prisma.inventoryItem.count({
            // Prisma doesn't support column comparison directly, handled in JS
            }),
        ]);
        const weekRevenue = weekOrders.reduce((s, o) => s + o.total, 0);
        // Low stock: currentStock <= lowStockThreshold
        const allItems = await db_1.prisma.inventoryItem.findMany({
            select: { currentStock: true, lowStockThreshold: true },
        });
        const lowStockItems = allItems.filter((i) => i.currentStock <= i.lowStockThreshold).length;
        res.json({
            data: {
                todayOrders,
                weekRevenue,
                pendingOrders,
                lowStockItems,
            },
        });
    }
    catch (e) {
        next(e);
    }
});
//# sourceMappingURL=reports.js.map