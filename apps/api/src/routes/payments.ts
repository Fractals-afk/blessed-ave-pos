import { Router } from "express";
import { z } from "zod";
import { prisma } from "@blessed-ave/db";
import { AppError } from "../middleware/errorHandler";
import { io } from "../index";
import { emitNewOrder, emitOrderStatusUpdate } from "../socket";
import { sendOrderReceipt } from "../mailer";
import { decrementInventory, restoreInventory } from "./orders";
import { requireAuth, requireRole } from "../middleware/auth";

export const paymentsRouter = Router();

// POST /api/payments/cash — mark a POS cash order as paid
paymentsRouter.post("/cash", requireAuth, requireRole("OWNER", "MANAGER", "STAFF"), async (req, res, next) => {
  try {
    const { orderId } = z.object({ orderId: z.string() }).parse(req.body);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError("Order not found", 404);

    const payment = await prisma.payment.upsert({
      where: { orderId },
      create: { orderId, method: "CASH", status: "PAID", amount: order.total, paidAt: new Date() },
      update: { method: "CASH", status: "PAID", amount: order.total, paidAt: new Date() },
    });

    const confirmed = await prisma.order.update({
      where: { id: orderId },
      data: { status: "CONFIRMED" },
      include: { items: { include: { selectedOptions: true } }, table: true, payment: true },
    });

    emitOrderStatusUpdate(io, confirmed.id, "CONFIRMED", confirmed);
    emitNewOrder(io, confirmed); // payment confirmed — now safe to push to kitchen
    decrementInventory(confirmed.id).catch(console.error);

    sendOrderReceipt({
      orderId,
      customerName: confirmed.customerName ?? undefined,
      customerEmail: (confirmed as any).customerEmail ?? undefined,
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
  } catch (e) {
    next(e);
  }
});

// POST /api/payments/split — cashier splits one order's bill across multiple methods
paymentsRouter.post("/split", requireAuth, requireRole("OWNER", "MANAGER", "STAFF"), async (req, res, next) => {
  try {
    const { orderId, splits } = z
      .object({
        orderId: z.string(),
        splits: z
          .array(
            z.object({
              method: z.enum(["GCASH", "MAYA", "CARD", "CASH"]),
              amount: z.number().int().positive(),
            })
          )
          .min(2, "Split payment needs at least 2 methods"),
      })
      .parse(req.body);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError("Order not found", 404);

    const splitTotal = splits.reduce((s, l) => s + l.amount, 0);
    if (splitTotal !== order.total) throw new AppError(`Split amounts (₱${(splitTotal / 100).toFixed(2)}) must equal order total (₱${(order.total / 100).toFixed(2)})`, 400);

    const payment = await prisma.payment.upsert({
      where: { orderId },
      create: { orderId, method: "SPLIT", status: "PAID", amount: order.total, splitDetails: splits, paidAt: new Date() },
      update: { method: "SPLIT", status: "PAID", amount: order.total, splitDetails: splits, paidAt: new Date() },
    });

    const confirmed = await prisma.order.update({
      where: { id: orderId },
      data: { status: "CONFIRMED" },
      include: { items: { include: { selectedOptions: true } }, table: true, payment: true },
    });

    emitOrderStatusUpdate(io, confirmed.id, "CONFIRMED", confirmed);
    emitNewOrder(io, confirmed); // payment confirmed — now safe to push to kitchen
    decrementInventory(confirmed.id).catch(console.error);

    const methodLabel = (m: string) => (m === "GCASH" ? "QR" : m === "MAYA" ? "Credit Card" : m === "CARD" ? "Card" : "Cash");
    sendOrderReceipt({
      orderId,
      customerName: confirmed.customerName ?? undefined,
      customerEmail: (confirmed as any).customerEmail ?? undefined,
      items: confirmed.items.map((i) => ({
        name: i.menuItemName,
        quantity: i.quantity,
        subtotal: i.subtotal,
        options: i.selectedOptions.map((o) => o.name).join(", ") || undefined,
      })),
      total: confirmed.total,
      paymentMethod: `Split (${splits.map((l) => `${methodLabel(l.method)} ₱${(l.amount / 100).toFixed(2)}`).join(" + ")})`,
      source: confirmed.source,
    }).catch(console.error);

    res.json({ data: payment });
  } catch (e) {
    next(e);
  }
});

// POST /api/payments/refund — staff refunds a paid order and cancels it
paymentsRouter.post("/refund", requireAuth, requireRole("OWNER", "MANAGER", "STAFF"), async (req, res, next) => {
  try {
    const { orderId } = z.object({ orderId: z.string() }).parse(req.body);

    const payment = await prisma.payment.findUnique({ where: { orderId } });
    if (!payment) throw new AppError("No payment found for this order", 404);
    if (payment.status !== "PAID") throw new AppError("Only paid orders can be refunded", 400);

    const refunded = await prisma.payment.update({
      where: { orderId },
      data: { status: "REFUNDED" },
    });

    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status: "CANCELLED" },
      include: { items: { include: { selectedOptions: true } }, table: true, payment: true },
    });

    emitOrderStatusUpdate(io, order.id, "CANCELLED", order);
    // Stock was decremented when payment confirmed — put it back.
    restoreInventory(order.id).catch(console.error);

    res.json({ data: { payment: refunded, order } });
  } catch (e) {
    next(e);
  }
});

// POST /api/payments/qr-confirm — cashier confirms a GCash or Maya QR payment
paymentsRouter.post("/qr-confirm", requireAuth, requireRole("OWNER", "MANAGER", "STAFF"), async (req, res, next) => {
  try {
    const { orderId, method } = z
      .object({
        orderId: z.string(),
        method: z.enum(["GCASH", "MAYA"]),
      })
      .parse(req.body);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError("Order not found", 404);

    const payment = await prisma.payment.upsert({
      where: { orderId },
      create: { orderId, method, status: "PAID", amount: order.total, paidAt: new Date() },
      update: { method, status: "PAID", amount: order.total, paidAt: new Date() },
    });

    const confirmed = await prisma.order.update({
      where: { id: orderId },
      data: { status: "CONFIRMED" },
      include: { items: { include: { selectedOptions: true } }, table: true, payment: true },
    });

    emitOrderStatusUpdate(io, confirmed.id, "CONFIRMED", confirmed);
    emitNewOrder(io, confirmed); // payment confirmed — now safe to push to kitchen
    decrementInventory(confirmed.id).catch(console.error);

    sendOrderReceipt({
      orderId,
      customerName: confirmed.customerName ?? undefined,
      customerEmail: (confirmed as any).customerEmail ?? undefined,
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
  } catch (e) {
    next(e);
  }
});
