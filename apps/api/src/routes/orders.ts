import { Router } from "express";
import { z } from "zod";
import { prisma, Prisma } from "@blessed-ave/db";
import { requireAuth, requireRole, tryAuth } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { io } from "../index";
import { emitOrderStatusUpdate } from "../socket";
import { vatPortion, seniorPwdDiscount, isVatEnabled } from "../lib/vat";

export const ordersRouter = Router();

const selectedOptionSchema = z.object({
  modifierOptionId: z.string(),
});

// Discount lives per line, not per order — RA9994 (senior/PWD) covers only
// the senior's own items, and a manager can knock a custom peso amount off
// any individual line. discountAmount here is the *requested* peso amount
// for CUSTOM lines; SENIOR_PWD's amount is always computed server-side.
const orderItemSchema = z
  .object({
    menuItemId: z.string(),
    quantity: z.number().int().positive(),
    selectedOptions: z.array(selectedOptionSchema).default([]),
    notes: z.string().optional(),
    discountType: z.enum(["NONE", "SENIOR_PWD", "CUSTOM"]).default("NONE"),
    discountAmount: z.number().int().positive().optional(),
  })
  .refine((i) => i.discountType !== "CUSTOM" || (i.discountAmount ?? 0) > 0, {
    message: "Custom discount needs a positive amount",
    path: ["discountAmount"],
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

// Computes one line's total/discount/VAT given its (already-priced) subtotal
// and requested discount. SENIOR_PWD strips VAT first then takes 20% off
// (RA 9994 / RA 10754); CUSTOM takes a manual peso amount off and VAT still
// applies to what's left; NONE just passes the subtotal through.
function computeLineDiscount(
  itemSubtotal: number,
  discountType: "NONE" | "SENIOR_PWD" | "CUSTOM",
  requestedAmount: number | undefined,
  vatEnabled: boolean
) {
  if (discountType === "SENIOR_PWD") {
    const { total, discountAmount } = seniorPwdDiscount(itemSubtotal, vatEnabled);
    return { total, discountAmount, vatAmount: 0 };
  }
  if (discountType === "CUSTOM") {
    const discountAmount = Math.min(requestedAmount ?? 0, itemSubtotal);
    const total = itemSubtotal - discountAmount;
    return { total, discountAmount, vatAmount: vatPortion(total, vatEnabled) };
  }
  return { total: itemSubtotal, discountAmount: 0, vatAmount: vatPortion(itemSubtotal, vatEnabled) };
}

// Order.discountType is a display-only aggregate (the order-level badge) —
// all the actual math happens per line. SENIOR_PWD/CUSTOM if every
// discounted line shares that type, CUSTOM as the generic bucket when lines
// are mixed, NONE if nothing's discounted.
function aggregateDiscountType(items: { discountType: string }[]): "NONE" | "SENIOR_PWD" | "CUSTOM" {
  const types = new Set(items.map((i) => i.discountType).filter((t) => t !== "NONE"));
  if (types.size === 0) return "NONE";
  if (types.size === 1) return [...types][0] as "SENIOR_PWD" | "CUSTOM";
  return "CUSTOM";
}

function resolveOrderItems(
  items: z.infer<typeof orderItemSchema>[],
  menuMap: Map<string, MenuItemWithModifiers>,
  vatEnabled: boolean,
  isManager: boolean
) {
  let subtotal = 0;
  let total = 0;
  let discountAmount = 0;
  let vatAmount = 0;
  let needsSeniorId = false;

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

    if (item.discountType === "CUSTOM" && !isManager) {
      throw new AppError("Only managers can apply a custom discount", 403);
    }
    if (item.discountType === "SENIOR_PWD") needsSeniorId = true;

    const unitPrice =
      menuItem.price + options.reduce((sum, o) => sum + o.priceAdjustment, 0);
    const itemSubtotal = unitPrice * item.quantity;
    const line = computeLineDiscount(itemSubtotal, item.discountType, item.discountAmount, vatEnabled);
    subtotal += itemSubtotal;
    total += line.total;
    discountAmount += line.discountAmount;
    vatAmount += line.vatAmount;

    return {
      menuItemId: menuItem.id,
      menuItemName: menuItem.name,
      quantity: item.quantity,
      unitPrice,
      subtotal: itemSubtotal,
      notes: item.notes,
      discountType: item.discountType,
      discountAmount: line.discountAmount,
      selectedOptions: {
        create: options.map((o) => ({
          modifierOptionId: o.id,
          name: o.name,
          priceAdjustment: o.priceAdjustment,
        })),
      },
    };
  });

  return { orderItemsData, subtotal, total, discountAmount, vatAmount, needsSeniorId };
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
  // OSCA / PWD ID number — required if any item's discountType is SENIOR_PWD.
  discountIdNumber: z.string().optional(),
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
    const vatEnabled = await isVatEnabled();
    const isManager = !!req.user && ["OWNER", "MANAGER"].includes(req.user.role);
    const { orderItemsData, subtotal, total, discountAmount, vatAmount, needsSeniorId } =
      resolveOrderItems(body.items, menuMap, vatEnabled, isManager);

    if (needsSeniorId && !body.discountIdNumber?.trim()) {
      throw new AppError("Senior/PWD ID number is required");
    }

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
        total,
        discountType: aggregateDiscountType(orderItemsData),
        discountAmount,
        discountIdNumber: needsSeniorId ? body.discountIdNumber!.trim() : undefined,
        vatAmount,
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

// PATCH /api/orders/:id/items — cashier edits the item list of an order
// (add/remove/change quantity). Allowed any time before the order is
// collected or cancelled. If the order has already been paid, changing the
// items changes what's owed — the cashier must settle that difference (a
// refund or an extra collection) in the same request via `settlement`, or
// the request is rejected. This keeps payment.amount always equal to
// order.total, so reports stay accurate.
const settlementSchema = z.object({
  method: z.enum(["CASH", "GCASH", "MAYA"]),
  amount: z.number().int().positive(),
});
const updateItemsSchema = z.object({
  items: z.array(orderItemSchema).min(1),
  settlement: settlementSchema.optional(),
  // OSCA / PWD ID number — required if any item's discountType is SENIOR_PWD.
  discountIdNumber: z.string().optional(),
});
const EDITABLE_STATUSES = ["PENDING", "CONFIRMED", "PREPARING", "READY"];

ordersRouter.patch("/:id/items", requireAuth, async (req, res, next) => {
  try {
    const body = updateItemsSchema.parse(req.body);

    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: { payment: true } });
    if (!order) throw new AppError("Order not found", 404);
    if (!EDITABLE_STATUSES.includes(order.status)) {
      throw new AppError("This order can no longer be edited");
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
    const vatEnabled = await isVatEnabled();
    const isManager = ["OWNER", "MANAGER"].includes(req.user!.role);
    const { orderItemsData, subtotal, total, discountAmount, vatAmount, needsSeniorId } =
      resolveOrderItems(body.items, menuMap, vatEnabled, isManager);

    if (needsSeniorId && !body.discountIdNumber?.trim()) {
      throw new AppError("Senior/PWD ID number is required");
    }

    // Paid orders must have the refund/extra-owed delta settled in this
    // same request — the client shows the delta and collects it before
    // calling save, so a mismatch here means the client total drifted.
    let paymentUpdate: { method: "CASH" | "GCASH" | "MAYA" | "CARD" | "SPLIT"; amount: number; splitDetails: { method: string; amount: number }[] | typeof Prisma.JsonNull } | null = null;
    if (order.status !== "PENDING") {
      if (!order.payment || order.payment.status !== "PAID") {
        throw new AppError("No confirmed payment found for this order", 400);
      }
      const delta = total - order.payment.amount;
      if (delta !== 0) {
        if (!body.settlement) {
          throw new AppError(
            delta > 0
              ? `Collect ₱${(delta / 100).toFixed(2)} more before saving`
              : `Refund ₱${(-delta / 100).toFixed(2)} before saving`,
            400
          );
        }
        if (body.settlement.amount !== Math.abs(delta)) {
          throw new AppError("Settlement amount doesn't match the change in total — refresh and try again", 400);
        }
        const priorLines: { method: string; amount: number }[] =
          order.payment.method === "SPLIT" && Array.isArray(order.payment.splitDetails)
            ? (order.payment.splitDetails as { method: string; amount: number }[])
            : [{ method: order.payment.method, amount: order.payment.amount }];
        const lines = [...priorLines];
        const existing = lines.find((l) => l.method === body.settlement!.method);
        if (existing) existing.amount += delta;
        else lines.push({ method: body.settlement.method, amount: delta });
        const nonZeroLines = lines.filter((l) => l.amount !== 0);
        paymentUpdate =
          nonZeroLines.length > 1
            ? { method: "SPLIT", amount: total, splitDetails: nonZeroLines }
            : { method: nonZeroLines[0].method as "CASH" | "GCASH" | "MAYA", amount: total, splitDetails: Prisma.JsonNull };
      }
    }

    if (order.status !== "PENDING") await restoreInventory(order.id);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { orderId: order.id } });
      if (paymentUpdate) {
        await tx.payment.update({ where: { orderId: order.id }, data: paymentUpdate });
      }
      return tx.order.update({
        where: { id: order.id },
        data: {
          subtotal, total, vatAmount, discountAmount,
          discountType: aggregateDiscountType(orderItemsData),
          discountIdNumber: needsSeniorId ? body.discountIdNumber!.trim() : null,
          items: { create: orderItemsData },
        },
        include: { items: { include: { selectedOptions: true } }, table: true, payment: true },
      });
    });

    if (order.status !== "PENDING") await decrementInventory(order.id);

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
