import { Router } from "express";
import { z } from "zod";
import { prisma } from "@blessed-ave/db";
import { requireAuth, requireRole } from "../middleware/auth";

export const suppliersRouter = Router();

const supplierSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  notes: z.string().optional(),
});

suppliersRouter.get("/", requireAuth, async (_req, res, next) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });
    res.json({ data: suppliers });
  } catch (e) {
    next(e);
  }
});

suppliersRouter.post(
  "/",
  requireAuth,
  requireRole("OWNER", "MANAGER"),
  async (req, res, next) => {
    try {
      const data = supplierSchema.parse(req.body);
      const supplier = await prisma.supplier.create({ data });
      res.status(201).json({ data: supplier });
    } catch (e) {
      next(e);
    }
  }
);

suppliersRouter.patch(
  "/:id",
  requireAuth,
  requireRole("OWNER", "MANAGER"),
  async (req, res, next) => {
    try {
      const data = supplierSchema.partial().parse(req.body);
      const supplier = await prisma.supplier.update({
        where: { id: req.params.id },
        data,
      });
      res.json({ data: supplier });
    } catch (e) {
      next(e);
    }
  }
);

// ─── Purchase Orders ──────────────────────────────────────────────────────────

suppliersRouter.get("/purchase-orders", requireAuth, async (_req, res, next) => {
  try {
    const pos = await prisma.purchaseOrder.findMany({
      include: {
        supplier: true,
        items: { include: { inventoryItem: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ data: pos });
  } catch (e) {
    next(e);
  }
});

suppliersRouter.post(
  "/purchase-orders",
  requireAuth,
  requireRole("OWNER", "MANAGER"),
  async (req, res, next) => {
    try {
      const { supplierId, items, notes } = z
        .object({
          supplierId: z.string(),
          notes: z.string().optional(),
          items: z.array(
            z.object({
              inventoryItemId: z.string(),
              quantity: z.number().positive(),
              unitCost: z.number().int().positive(),
            })
          ),
        })
        .parse(req.body);

      const total = items.reduce((s, i) => s + i.quantity * i.unitCost, 0);

      const po = await prisma.purchaseOrder.create({
        data: {
          supplierId,
          notes,
          total,
          items: { create: items },
        },
        include: { supplier: true, items: { include: { inventoryItem: true } } },
      });

      res.status(201).json({ data: po });
    } catch (e) {
      next(e);
    }
  }
);

// PATCH /api/suppliers/purchase-orders/:id/receive — mark as received & update stock
suppliersRouter.patch(
  "/purchase-orders/:id/receive",
  requireAuth,
  requireRole("OWNER", "MANAGER"),
  async (req, res, next) => {
    try {
      const po = await prisma.purchaseOrder.findUnique({
        where: { id: req.params.id },
        include: { items: true },
      });
      if (!po) return res.status(404).json({ error: "Not found" });

      // Update stock for each item
      for (const item of po.items) {
        const inv = await prisma.inventoryItem.update({
          where: { id: item.inventoryItemId },
          data: { currentStock: { increment: item.quantity } },
        });
        await prisma.inventoryLog.create({
          data: {
            inventoryItemId: item.inventoryItemId,
            reason: "PURCHASE",
            quantityChange: item.quantity,
            stockAfter: inv.currentStock,
            notes: `PO ${po.id}`,
          },
        });
      }

      const updated = await prisma.purchaseOrder.update({
        where: { id: req.params.id },
        data: { receivedAt: new Date() },
        include: { supplier: true, items: { include: { inventoryItem: true } } },
      });

      res.json({ data: updated });
    } catch (e) {
      next(e);
    }
  }
);
