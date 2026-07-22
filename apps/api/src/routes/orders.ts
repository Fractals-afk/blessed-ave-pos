import { Router } from "express";
import { z } from "zod";
import { prisma } from "@blessed-ave/db";
import { requireAuth, requireRole, tryAuth } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { io } from "../index";
import { emitOrderStatusUpdate } from "../socket";
import { vatPortion, seniorPwdDiscount, isVatEnabled } from "../lib/vat";

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

// Shared by order creation and item edits — resolves each requested line
// against the menu server-side (never trusts client-supplied prices) and
// returns Prisma create-input for OrderItem rows plus the resulting subtotal.
interface MenuItemWithModifiers {
  id: string;
  name: string;
  price: number;
  modifierGroups: {
    id: string;
    name: string;
    required: boolean;
    multiSelect: boolean;
    options: { id: string; name: string; priceAdjustment: number }[];
  }[];
}

function resolveOrderItems(
  items: z.infer<typeof orderItemSchema>[],
  menuMap: Map<string, MenuItemWithModifiers>
) {
  let subtotal = 0;
  const orderItemsData = items.map((item) => {
    const menuItem = menuMap.get(item.menuItemId)!;

    // Selected options must come from this item's own modifier groups —
    // prices are resolved server-side, never trusted from the client.
    const validOptions = new Map(
      menuItem.modifierGroups.flatMap((g) => g.options.map((o) => [o.id, { option: o, group: g }] as const))
    );
    const selectedIds = [...new Set(item.selectedOptions.map((o) => o.modifierOptionId))];
    const selectedByGroup = new Map<string, number>();
    const options = selectedIds.map((id) => {
      const match = validOptions.get(id);
      if (!match) {
        throw new AppError(`Invalid option for ${menuItem.name}`);
      }
      const count = (selectedByGroup.get(match.group.id) ?? 0) + 1;
      if (count > 1 && !match.group.multiSelect) {
        throw new AppError(`Only one ${match.group.name} option allowed for ${menuItem.name}`);
      }
      selectedByGroup.set(match.group.id, count);
      return match.option;
    });

    for (const group of menuItem.modifierGroups) {
      if (group.required && !selectedByGroup.has(group.id)) {
        throw new AppError(`${group.name} is required for ${menuItem.name}`);
      }
    }

    const unitPrice =
      menuItem.price + options.reduce((sum, o) => sum + o.priceAdjustment, 0);
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
  });

  return { orderItemsData, subtotal };
}

const createOrderSchema = z.object({
  source: z.enum(["ONLINE", "QR_TABLE", "POS"]),
  tableId: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email().optional(),
  notes: z.string().optional(),
  items: z.array(orderItemSchema).min(1),
  // Client-generated UUID set by offline carts so a retried sync doesn't
  // create a duplicate order once connectivity returns.
  offlineId: z.string().optional(),
});

// POST /api/orders — create a new order (public for ONLINE & QR, auth for POS)
ordersRouter.post("/", tryAuth, async (req, res, next) => {
  try {
    const body = createOrderSchema.parse(req.body);

    if (body.source === "POS" && !req.user) {
      throw new AppError("Authentication required for POS orders", 401);
    }

    if (body.offlineId) {
      const existing = await prisma.order.findUnique({
        where: { offlineId: body.offlineId },
        include: { items: { include: { selectedOptions: true } }, table: true, payment: true },
      });
      if (existing) {
        res.status(200).json({ data: existing });
        return;
      }
    }

    if (body.source === "QR_TABLE" && !body.tableId) {
      throw new AppError("Table is required for QR orders");
    }
    if (body.tableId) {
      const table = await prisma.cafeTable.findUnique({ where: { id: body.tableId } });
      if (!table || !table.active) throw new AppError("Table not found");
    }

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
    const { orderItemsData, subtotal } = resolveOrderItems(body.items, menuMap);

    const order = await (prisma.order.create as any)({
      data: {
        source: body.source,
        tableId: body.tableId,
        offlineId: body.offlineId,
        staffId: body.source === "POS" ? req.user!.userId : undefined,
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        customerEmail: body.customerEmail,
        notes: body.notes,
        subtotal,
        total: subtotal,
        vatAmount: vatPortion(subtotal, await isVatEnabled()),
        items: { create: orderItemsData },
      },
      include: {
        items: { include: { selectedOptions: true } },
        table: true,
        payment: true,
      },
    });

    // Not pushed to the kitchen yet — that happens once payment is confirmed
    // (see payments.ts), so unpaid orders never reach the kitchen display.

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

// GET /api/orders/kitchen — live kitchen queue (paid orders only: confirmed + preparing + ready)
ordersRouter.get("/kitchen", requireAuth, async (_req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { status: { in: ["CONFIRMED", "PREPARING", "READY"] } },
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
// Note: CONFIRMED is intentionally excluded — only the payment routes
// (payments.ts) may move an order into CONFIRMED, so it can't be pushed to
// the kitchen without a recorded payment.
ordersRouter.patch("/:id/status", requireAuth, requireRole("OWNER", "MANAGER", "KITCHEN"), async (req, res, next) => {
  try {
    const { status } = z
      .object({
        status: z.enum([
          "PREPARING",
          "READY",
          "COLLECTED",
          "CANCELLED",
        ]),
      })
      .parse(req.body);

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        status,
        ...(status === "PREPARING" && { startedAt: new Date() }),
        ...(status === "READY" && { readyAt: new Date() }),
        ...(status === "COLLECTED" && { collectedAt: new Date() }),
      },
      include: {
        items: { include: { selectedOptions: true } },
        table: true,
        payment: true,
      },
    });

    emitOrderStatusUpdate(io, order.id, status, order);

    res.json({ data: order });
  } catch (e) {
    next(e);
  }
});

// PATCH /api/orders/:id/notes — staff adds/edits special instructions
ordersRouter.patch("/:id/notes", requireAuth, async (req, res, next) => {
  try {
    const { notes } = z.object({ notes: z.string() }).parse(req.body);

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { notes },
      include: {
        items: { include: { selectedOptions: true } },
        table: true,
        payment: true,
      },
    });

    emitOrderStatusUpdate(io, order.id, order.status, order);

    res.json({ data: order });
  } catch (e) {
    next(e);
  }
});

// PATCH /api/orders/:id/discount — apply or remove a discount before payment.
// SENIOR_PWD (RA 9994 / RA 10754): any staff member, requires an ID number.
// CUSTOM: manager/owner only, manual peso amount off.
const discountSchema = z.union([
  z.object({ discountType: z.literal("NONE") }),
  z.object({ discountType: z.literal("SENIOR_PWD"), discountIdNumber: z.string().min(1) }),
  z.object({ discountType: z.literal("CUSTOM"), amount: z.number().int().positive() }),
]);

ordersRouter.patch("/:id/discount", requireAuth, async (req, res, next) => {
  try {
    const body = discountSchema.parse(req.body);

    if (body.discountType === "CUSTOM" && !["OWNER", "MANAGER"].includes(req.user!.role)) {
      throw new AppError("Only managers can apply a custom discount", 403);
    }

    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) throw new AppError("Order not found", 404);
    if (order.status !== "PENDING") {
      throw new AppError("Discount can only be applied before payment is confirmed");
    }

    const vatEnabled = await isVatEnabled();

    let data: {
      discountType: "NONE" | "SENIOR_PWD" | "CUSTOM";
      discountAmount: number;
      discountIdNumber: string | null;
      total: number;
      vatAmount: number;
    };

    if (body.discountType === "NONE") {
      data = {
        discountType: "NONE",
        discountAmount: 0,
        discountIdNumber: null,
        total: order.subtotal,
        vatAmount: vatPortion(order.subtotal, vatEnabled),
      };
    } else if (body.discountType === "SENIOR_PWD") {
      const { total, discountAmount } = seniorPwdDiscount(order.subtotal, vatEnabled);
      data = {
        discountType: "SENIOR_PWD",
        discountAmount,
        discountIdNumber: body.discountIdNumber,
        total,
        vatAmount: 0, // VAT-exempt
      };
    } else {
      if (body.amount > order.subtotal) throw new AppError("Discount cannot exceed order subtotal");
      const total = order.subtotal - body.amount;
      data = {
        discountType: "CUSTOM",
        discountAmount: body.amount,
        discountIdNumber: null,
        total,
        vatAmount: vatPortion(total, vatEnabled),
      };
    }

    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data,
      include: { items: { include: { selectedOptions: true } }, table: true, payment: true },
    });

    emitOrderStatusUpdate(io, updated.id, updated.status, updated);

    res.json({ data: updated });
  } catch (e) {
    next(e);
  }
});

// PATCH /api/orders/:id/items — cashier edits the item list of an order that
// hasn't been paid yet (add/remove/change quantity). Only PENDING orders are
// editable — once payment is confirmed the order moves to CONFIRMED and is
// visible in the kitchen, so items are locked from that point on.
const updateItemsSchema = z.object({ items: z.array(orderItemSchema).min(1) });

ordersRouter.patch("/:id/items", requireAuth, async (req, res, next) => {
  try {
    const body = updateItemsSchema.parse(req.body);

    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) throw new AppError("Order not found", 404);
    if (order.status !== "PENDING") {
      throw new AppError("Items can only be edited before payment is confirmed");
    }

    const menuItemIds = body.items.map((i) => i.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: menuItemIds }, available: true },
      include: { modifierGroups: { include: { options: true } } },
    });
    if (menuItems.length !== new Set(menuItemIds).size) {
      throw new AppError("One or more menu items not found or unavailable");
    }

    const menuMap = new Map(menuItems.map((m) => [m.id, m]));
    const { orderItemsData, subtotal } = resolveOrderItems(body.items, menuMap);

    const vatEnabled = await isVatEnabled();
    let discountAmount = 0;
    let total = subtotal;
    let vatAmount = vatPortion(subtotal, vatEnabled);

    if (order.discountType === "SENIOR_PWD") {
      const discount = seniorPwdDiscount(subtotal, vatEnabled);
      total = discount.total;
      discountAmount = discount.discountAmount;
      vatAmount = 0;
    } else if (order.discountType === "CUSTOM") {
      discountAmount = Math.min(order.discountAmount, subtotal);
      total = subtotal - discountAmount;
      vatAmount = vatPortion(total, vatEnabled);
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { orderId: order.id } });
      return tx.order.update({
        where: { id: order.id },
        data: { subtotal, total, vatAmount, discountAmount, items: { create: orderItemsData } },
        include: { items: { include: { selectedOptions: true } }, table: true, payment: true },
      });
    });

    emitOrderStatusUpdate(io, updated.id, updated.status, updated);

    res.json({ data: updated });
  } catch (e) {
    next(e);
  }
});

// Background: decrement inventory based on recipes
export async function decrementInventory(orderId: string) {
  await adjustInventoryForOrder(orderId, -1, "SALE", `Order ${orderId}`);
}

// Reverse of decrementInventory — puts stock back when a paid order is refunded.
export async function restoreInventory(orderId: string) {
  await adjustInventoryForOrder(orderId, 1, "ADJUSTMENT", `Refund order ${orderId}`);
}

async function adjustInventoryForOrder(
  orderId: string,
  sign: 1 | -1,
  reason: "SALE" | "ADJUSTMENT",
  notes: string
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) return;

  const recipes = await prisma.recipeItem.findMany({
    where: { menuItemId: { in: order.items.map((i) => i.menuItemId) } },
  });
  const recipesByMenuItem = new Map<string, typeof recipes>();
  for (const r of recipes) {
    const list = recipesByMenuItem.get(r.menuItemId) ?? [];
    list.push(r);
    recipesByMenuItem.set(r.menuItemId, list);
  }

  await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      for (const recipe of recipesByMenuItem.get(item.menuItemId) ?? []) {
        const qty = recipe.quantity * item.quantity * sign;
        const inv = await tx.inventoryItem.update({
          where: { id: recipe.inventoryItemId },
          data: { currentStock: { increment: qty } },
        });
        await tx.inventoryLog.create({
          data: {
            inventoryItemId: inv.id,
            reason,
            quantityChange: qty,
            stockAfter: inv.currentStock,
            notes,
          },
        });
      }
    }
  });
}
