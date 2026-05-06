import { Router } from "express";
import { z } from "zod";
import { prisma } from "@blessed-ave/db";
import { AppError } from "../middleware/errorHandler";
import { io } from "../index";
import { emitOrderStatusUpdate } from "../socket";
import { sendOrderReceipt } from "../mailer";

export const paymentsRouter = Router();

// POST /api/payments/cash — mark a POS cash order as paid
paymentsRouter.post("/cash", async (req, res, next) => {
  try {
    const { orderId } = z.object({ orderId: z.string() }).parse(req.body);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError("Order not found", 404);

    const payment = await prisma.payment.upsert({
      where: { orderId },
      create: { orderId, method: "CASH", status: "PAID", amount: order.total, paidAt: new Date() },
      update: { method: "CASH", status: "PAID", paidAt: new Date() },
    });

    const confirmed = await prisma.order.update({
      where: { id: orderId },
      data: { status: "CONFIRMED" },
      include: { items: { include: { selectedOptions: true } }, table: true, payment: true },
    });

    emitOrderStatusUpdate(io, confirmed.id, "CONFIRMED", confirmed);

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

// POST /api/payments/qr-confirm — cashier confirms a GCash or Maya QR payment
paymentsRouter.post("/qr-confirm", async (req, res, next) => {
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
      update: { method, status: "PAID", paidAt: new Date() },
    });

    const confirmed = await prisma.order.update({
      where: { id: orderId },
      data: { status: "CONFIRMED" },
      include: { items: { include: { selectedOptions: true } }, table: true, payment: true },
    });

    emitOrderStatusUpdate(io, confirmed.id, "CONFIRMED", confirmed);

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
