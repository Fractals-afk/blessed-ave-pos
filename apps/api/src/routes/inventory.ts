import { Router } from "express";
import { z } from "zod";
import { prisma } from "@blessed-ave/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

export const inventoryRouter = Router();

// GET /api/inventory
inventoryRouter.get("/", requireAuth, async (_req, res, next) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      include: { supplier: true },
      orderBy: { name: "asc" },
    });
    const itemsWithFlag = items.map((i) => ({
      ...i,
      isLow: i.currentStock <= i.lowStockThreshold,
    }));
    res.json({ data: itemsWithFlag });
  } catch (e) {
    next(e);
  }
});

// GET /api/inventory/low-stock
inventoryRouter.get("/low-stock", requireAuth, async (_req, res, next) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      include: { supplier: true },
      orderBy: { name: "asc" },
    });
    const low = items.filter((i) => i.currentStock <= i.lowStockThreshold);
    res.json({ data: low });
  } catch (e) {
    next(e);
  }
});

const inventoryItemSchema = z.object({
  name: z.string().min(1),
  unit: z.enum(["KG", "G", "L", "ML", "PCS", "PACK", "BOTTLE"]),
  currentStock: z.number().default(0),
  lowStockThreshold: z.number().default(0),
  cost: z.number().int().default(0),
  supplierId: z.string().optional(),
});

// POST /api/inventory
inventoryRouter.post(
  "/",
  requireAuth,
  requireRole("OWNER", "MANAGER"),
  async (req, res, next) => {
    try {
      const data = inventoryItemSchema.parse(req.body);
      const item = await prisma.inventoryItem.create({
        data,
        include: { supplier: true },
      });

      // Log opening stock
      if (data.currentStock > 0) {
        await prisma.inventoryLog.create({
          data: {
            inventoryItemId: item.id,
            reason: "OPENING_STOCK",
            quantityChange: data.currentStock,
            stockAfter: data.currentStock,
          },
        });
      }

      res.status(201).json({ data: item });
    } catch (e) {
      next(e);
    }
  }
);

// PATCH /api/inventory/:id
inventoryRouter.patch(
  "/:id",
  requireAuth,
  requireRole("OWNER", "MANAGER"),
  async (req, res, next) => {
    try {
      const data = inventoryItemSchema.partial().parse(req.body);
      const item = await prisma.inventoryItem.update({
        where: { id: req.params.id },
        data,
        include: { supplier: true },
      });
      res.json({ data: item });
    } catch (e) {
      next(e);
    }
  }
);

// POST /api/inventory/:id/adjust — manual stock adjustment
inventoryRouter.post(
  "/:id/adjust",
  requireAuth,
  requireRole("OWNER", "MANAGER"),
  async (req, res, next) => {
    try {
      const { quantity, reason, notes } = z
        .object({
          quantity: z.number(), // positive = add, negative = remove
          reason: z.enum(["PURCHASE", "WASTE", "ADJUSTMENT"]),
          notes: z.string().optional(),
        })
        .parse(req.body);

      const item = await prisma.inventoryItem.findUnique({
        where: { id: req.params.id },
      });
      if (!item) throw new AppError("Item not found", 404);

      const newStock = item.currentStock + quantity;
      if (newStock < 0) throw new AppError("Stock cannot go below zero");

      const updated = await prisma.inventoryItem.update({
        where: { id: req.params.id },
        data: { currentStock: newStock },
        include: { supplier: true },
      });

      await prisma.inventoryLog.create({
        data: {
          inventoryItemId: item.id,
          reason,
          quantityChange: quantity,
          stockAfter: newStock,
          notes,
        },
      });

      res.json({ data: { ...updated, isLow: updated.currentStock <= updated.lowStockThreshold } });
    } catch (e) {
      next(e);
    }
  }
);

// GET /api/inventory/:id/logs
inventoryRouter.get("/:id/logs", requireAuth, async (req, res, next) => {
  try {
    const logs = await prisma.inventoryLog.findMany({
      where: { inventoryItemId: req.params.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({ data: logs });
  } catch (e) {
    next(e);
  }
});

// ─── Recipe mapping ───────────────────────────────────────────────────────────

// POST /api/inventory/recipes — set recipes for a menu item
inventoryRouter.post(
  "/recipes",
  requireAuth,
  requireRole("OWNER", "MANAGER"),
  async (req, res, next) => {
    try {
      const { menuItemId, recipes } = z
        .object({
          menuItemId: z.string(),
          recipes: z.array(
            z.object({
              inventoryItemId: z.string(),
              quantity: z.number().positive(),
            })
          ),
        })
        .parse(req.body);

      // Replace existing recipes for this menu item
      await prisma.recipeItem.deleteMany({ where: { menuItemId } });
      const created = await prisma.recipeItem.createMany({
        data: recipes.map((r) => ({ menuItemId, ...r })),
      });

      res.json({ data: { count: created.count } });
    } catch (e) {
      next(e);
    }
  }
);

// GET /api/inventory/recipes/:menuItemId
inventoryRouter.get("/recipes/:menuItemId", requireAuth, async (req, res, next) => {
  try {
    const recipes = await prisma.recipeItem.findMany({
      where: { menuItemId: req.params.menuItemId },
      include: { inventoryItem: true },
    });
    res.json({ data: recipes });
  } catch (e) {
    next(e);
  }
});
