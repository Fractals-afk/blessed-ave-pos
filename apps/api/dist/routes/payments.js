"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("@blessed-ave/db");
const errorHandler_1 = require("../middleware/errorHandler");
const index_1 = require("../index");
const socket_1 = require("../socket");
const mailer_1 = require("../mailer");
exports.paymentsRouter = (0, express_1.Router)();
// POST /api/payments/cash — mark a POS cash order as paid
exports.paymentsRouter.post("/cash", async (req, res, next) => {
    try {
        const { orderId } = zod_1.z.object({ orderId: zod_1.z.string() }).parse(req.body);
        const order = await db_1.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new errorHandler_1.AppError("Order not found", 404);
        const payment = await db_1.prisma.payment.upsert({
            where: { orderId },
            create: { orderId, method: "CASH", status: "PAID", amount: order.total, paidAt: new Date() },
            update: { method: "CASH", status: "PAID", paidAt: new Date() },
        });
        const confirmed = await db_1.prisma.order.update({
            where: { id: orderId },
            data: { status: "CONFIRMED" },
            include: { items: { include: { selectedOptions: true } }, table: true, payment: true },
        });
        (0, socket_1.emitOrderStatusUpdate)(index_1.io, confirmed.id, "CONFIRMED", confirmed);
        (0, mailer_1.sendOrderReceipt)({
            orderId,
            customerName: confirmed.customerName ?? undefined,
            customerEmail: confirmed.customerEmail ?? undefined,
            items: confirmed.items.map((i) => ({
                name: i.menuItemName,
                quantity: i.quantity,
                subtotal: i.subtotal,
                options: i.selectedOptions.map((o) => o.name).join(", ") || undefined,
            })),
            total: confirmed.total,
            paymentMethod: "Cash",
            source: confirmed.source,
        }).catch(console.error);
        res.json({ data: payment });
    }
    catch (e) {
        next(e);
    }
});
// POST /api/payments/qr-confirm — cashier confirms a GCash or Maya QR payment
exports.paymentsRouter.post("/qr-confirm", async (req, res, next) => {
    try {
        const { orderId, method } = zod_1.z
            .object({
            orderId: zod_1.z.string(),
            method: zod_1.z.enum(["GCASH", "MAYA"]),
        })
            .parse(req.body);
        const order = await db_1.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new errorHandler_1.AppError("Order not found", 404);
        const payment = await db_1.prisma.payment.upsert({
            where: { orderId },
            create: { orderId, method, status: "PAID", amount: order.total, paidAt: new Date() },
            update: { method, status: "PAID", paidAt: new Date() },
        });
        const confirmed = await db_1.prisma.order.update({
            where: { id: orderId },
            data: { status: "CONFIRMED" },
            include: { items: { include: { selectedOptions: true } }, table: true, payment: true },
        });
        (0, socket_1.emitOrderStatusUpdate)(index_1.io, confirmed.id, "CONFIRMED", confirmed);
        (0, mailer_1.sendOrderReceipt)({
            orderId,
            customerName: confirmed.customerName ?? undefined,
            customerEmail: confirmed.customerEmail ?? undefined,
            items: confirmed.items.map((i) => ({
                name: i.menuItemName,
                quantity: i.quantity,
                subtotal: i.subtotal,
                options: i.selectedOptions.map((o) => o.name).join(", ") || undefined,
            })),
            total: confirmed.total,
            paymentMethod: method === "GCASH" ? "GCash" : "Maya",
            source: confirmed.source,
        }).catch(console.error);
        res.json({ data: payment });
    }
    catch (e) {
        next(e);
    }
});
//# sourceMappingURL=payments.js.map