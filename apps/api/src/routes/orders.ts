import { Router } from "express";
import { z } from "zod";
import { prisma } from "@blessed-ave/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { io } from "../index";
import { emitNewOrder, emitOrderStatusUpdate } from "../socket";

export const ordersRouter = Router();

const selectedOptionSchema = z.object({
  modifierOptionId: z.string(),
});

const orderItemSchema = z.object({
  menuItemId: z.string(),
  quantity: z.number().int().positive(),
  selectedOptions: z.array(selectedOptionSchema).default([]),
  notes: z.string().optional(),
});

const createOrderSchema = z.object({
  source: z.enum(["ONLINE", "QR_TABLE", "POS"]),
  tableId: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email().optional(),
  notes: z.string().optional(),
  items: z.array(orderItemSchema).min(1),
});

// POST /api/orders — create a new order (public for ONLINE & QR, auth for POS)
ordersRouter.post("/", async (req, res, next) => {
  try {
    const body = createOrderSchema.parse(req.body);

    // Fetch menu items + modifiers to compute prices
    const menuItemIds = body.items.map((i) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds }, available: true },
      include: { modifierGroups: { include: { options: true } } },
    });

    if (menuItems.length !== menuItemIds.length) {
      throw new AppError("One or more menu items not found or unavailable");
    }

    const menuMap = new Map(menuItems.map((m) => [m.id, m]));

    let subtotal = 0;
    const orderItemsData = await Promise.all(
      body.items.map(async (item) => {
        const menuItem = menuMap.get(item.menuItemId)!;
        let unitPrice = menuItem.price;

        // Fetch selected modifier options for snapshot + price
        const optionIds = item.selectedOptions.map((o) => o.modifierOptionId);
        const options = optionIds.length
          ? await prisma.modifierOption.findMany({
              where: { id: { in: optionIds } },
            })
          : [];

        const optionAdjustments = options.reduce(
          (sum, o) => sum + o.priceAdjustment,
          0
        );
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
      })
    );

    const order = await (prisma.order.create as any)({
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

    emitNewOrder(io, order);

    res.status(201).json({ data: order });
  } catch (e) {
    next(e);
  }
});

// GET /api/orders — admin: list orders with filters
ordersRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const { status, source, date, page = "1", pageSize = "30" } = req.query;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (source) where.source = source;
    if (date) {
      const d = new Date(date as string);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      where.createdAt = { gte: d, lt: next };
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
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
      prisma.order.count({ where }),
    ]);

    res.json({ data: orders, total, page: Number(page), pageSize: Number(pageSize) });
  } catch (e) {
    next(e);
  }
});

// GET /api/orders/kitchen — live kitchen queue (pending + confirmed + preparing)
ordersRouter.get("/kitchen", requireAuth, async (_req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { status: { in: ["PENDING", "CONFIRMED", "PREPARING"] } },
      include: {
        items: { include: { selectedOptions: true } },
        table: true,
      },
      orderBy: { createdAt: "asc" },
    });
    res.json({ data: orders });
  } catch (e) {
    next(e);
  }
});

// GET /api/orders/:id — single order (public for customer tracking)
ordersRouter.get("/:id", async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: { include: { selectedOptions: true } },
        table: true,
        payment: true,
      },
    });
    if (!order) throw new AppError("Order not found", 404);
    res.json({ data: order });
  } catch (e) {
    next(e);
  }
});

// PATCH /api/orders/:id/status — update order status
ordersRouter.patch("/:id/status", requireAuth, async (req, res, next) => {
  try {
    const { status } = z
      .object({
        status: z.enum([
          "CONFIRMED",
          "PREPARING",
          "READY",
          "COLLECTED",
          "CANCELLED",
        ]),
      })
      .parse(req.body);

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
      include: {
        items: { include: { selectedOptions: true } },
        table: true,
        payment: true,
      },
    });

    emitOrderStatusUpdate(io, order.id, status, order);

    // Auto-decrement inventory if order is CONFIRMED
    if (status === "CONFIRMED") {
      decrementInventory(order.id).catch(console.error);
    }

    res.json({ data: order });
  } catch (e) {
    next(e);
  }
});

// Background: decrement inventory based on recipes
async function decrementInventory(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) return;

  for (const item of order.items) {
    const recipes = await prisma.recipeItem.findMany({
      where: { menuItemId: item.menuItemId },
    });
    for (const recipe of recipes) {
      const qty = recipe.quantity * item.quantity;
      const inv = await prisma.inventoryItem.update({
        where: { id: recipe.inventoryItemId },
        data: { currentStock: { decrement: qty } },
      });
      await prisma.inventoryLog.create({
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
