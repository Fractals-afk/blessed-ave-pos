"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pnlRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("@blessed-ave/db");
const auth_1 = require("../middleware/auth");
exports.pnlRouter = (0, express_1.Router)();
// GET /api/pnl?from=&to=
// Full P&L: revenue, COGS, gross profit, operating costs, net profit
exports.pnlRouter.get("/", auth_1.requireAuth, (0, auth_1.requireRole)("OWNER", "MANAGER"), async (req, res, next) => {
    try {
        const { from, to } = zod_1.z.object({ from: zod_1.z.string(), to: zod_1.z.string() }).parse(req.query);
        const fromDate = new Date(from);
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        // ── Revenue ──────────────────────────────────────────────────────────────
        const paidPayments = await db_1.prisma.payment.findMany({
            where: { status: "PAID", paidAt: { gte: fromDate, lte: toDate } },
        });
        const totalRevenue = paidPayments.reduce((s, p) => s + p.amount, 0);
        // Revenue by payment method
        const revenueByMethod = { GCASH: 0, MAYA: 0, CARD: 0, CASH: 0 };
        for (const p of paidPayments) {
            revenueByMethod[p.method] = (revenueByMethod[p.method] ?? 0) + p.amount;
        }
        // ── COGS ─────────────────────────────────────────────────────────────────
        // Get all confirmed/completed orders in period
        const orders = await db_1.prisma.order.findMany({
            where: {
                createdAt: { gte: fromDate, lte: toDate },
                status: { in: ["CONFIRMED", "PREPARING", "READY", "COLLECTED"] },
            },
            include: { items: true },
        });
        let totalCOGS = 0;
        const cogsByItem = {};
        for (const order of orders) {
            for (const orderItem of order.items) {
                // Get recipe for this menu item
                const recipes = await db_1.prisma.recipeItem.findMany({
                    where: { menuItemId: orderItem.menuItemId },
                    include: { inventoryItem: true },
                });
                // Cost per unit = sum of (ingredient qty × ingredient cost)
                const itemCOGS = recipes.reduce((s, r) => s + r.quantity * r.inventoryItem.cost, 0) * orderItem.quantity;
                totalCOGS += itemCOGS;
                if (!cogsByItem[orderItem.menuItemId]) {
                    cogsByItem[orderItem.menuItemId] = {
                        name: orderItem.menuItemName,
                        quantity: 0,
                        revenue: 0,
                        cogs: 0,
                        margin: 0,
                    };
                }
                cogsByItem[orderItem.menuItemId].quantity += orderItem.quantity;
                cogsByItem[orderItem.menuItemId].revenue += orderItem.subtotal;
                cogsByItem[orderItem.menuItemId].cogs += itemCOGS;
            }
        }
        // Calculate margin per item
        for (const item of Object.values(cogsByItem)) {
            item.margin = item.revenue > 0
                ? Math.round(((item.revenue - item.cogs) / item.revenue) * 100)
                : 0;
        }
        const grossProfit = totalRevenue - totalCOGS;
        const grossMargin = totalRevenue > 0
            ? Math.round((grossProfit / totalRevenue) * 100)
            : 0;
        // ── Operating Costs ───────────────────────────────────────────────────────
        const opCosts = await db_1.prisma.operatingCost.findMany({
            where: { date: { gte: fromDate, lte: toDate } },
            orderBy: { date: "asc" },
        });
        const totalOpCosts = opCosts.reduce((s, c) => s + c.amount, 0);
        // Operating costs by category
        const opCostsByCategory = {};
        for (const c of opCosts) {
            opCostsByCategory[c.category] = (opCostsByCategory[c.category] ?? 0) + c.amount;
        }
        // ── Net Profit ────────────────────────────────────────────────────────────
        const netProfit = grossProfit - totalOpCosts;
        const netMargin = totalRevenue > 0
            ? Math.round((netProfit / totalRevenue) * 100)
            : 0;
        // ── Daily breakdown ───────────────────────────────────────────────────────
        const dailyMap = {};
        for (const p of paidPayments) {
            const day = (p.paidAt ?? p.createdAt).toISOString().slice(0, 10);
            if (!dailyMap[day])
                dailyMap[day] = { revenue: 0, cogs: 0, opCosts: 0 };
            dailyMap[day].revenue += p.amount;
        }
        for (const c of opCosts) {
            const day = c.date.toISOString().slice(0, 10);
            if (!dailyMap[day])
                dailyMap[day] = { revenue: 0, cogs: 0, opCosts: 0 };
            dailyMap[day].opCosts += c.amount;
        }
        const daily = Object.entries(dailyMap)
            .map(([date, v]) => ({
            date,
            revenue: v.revenue,
            cogs: v.cogs,
            opCosts: v.opCosts,
            grossProfit: v.revenue - v.cogs,
            netProfit: v.revenue - v.cogs - v.opCosts,
        }))
            .sort((a, b) => a.date.localeCompare(b.date));
        res.json({
            data: {
                period: { from, to },
                // Revenue
                totalRevenue,
                revenueByMethod,
                totalOrders: orders.length,
                // COGS
                totalCOGS,
                grossProfit,
                grossMargin,
                // Operating costs
                totalOpCosts,
                opCostsByCategory,
                opCostsDetail: opCosts,
                // Net
                netProfit,
                netMargin,
                // Breakdowns
                itemBreakdown: Object.values(cogsByItem).sort((a, b) => b.revenue - a.revenue),
                daily,
            },
        });
    }
    catch (e) {
        next(e);
    }
});
//# sourceMappingURL=pnl.js.map