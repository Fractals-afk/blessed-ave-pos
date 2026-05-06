import { Router } from "express";
import { z } from "zod";
import { prisma } from "@blessed-ave/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

export const menuRouter = Router();

const menuInclude = {
  items: {
    where: { available: true },
    include: { modifierGroups: { include: { options: true } } },
    orderBy: { name: "asc" as const },
  },
};

// GET /api/menu — public, returns full menu with categories
menuRouter.get("/", async (_req, res, next) => {
  try {
    const categories = await prisma.menuCategory.findMany({
      where: { active: true },
      include: menuInclude,
      orderBy: { sortOrder: "asc" },
    });
    res.json({ data: categories });
  } catch (e) {
    next(e);
  }
});

// GET /api/menu/all — admin: includes unavailable items
menuRouter.get("/all", requireAuth, async (_req, res, next) => {
  try {
    const categories = await prisma.menuCategory.findMany({
      include: {
        items: {
          include: { modifierGroups: { include: { options: true } } },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { sortOrder: "asc" },
    });
    res.json({ data: categories });
  } catch (e) {
    next(e);
  }
});

// ─── Categories ───────────────────────────────────────────────────────────────

const categorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  sortOrder: z.number().optional(),
  active: z.boolean().optional(),
});

menuRouter.post(
  "/categories",
  requireAuth,
  requireRole("OWNER", "MANAGER"),
  async (req, res, next) => {
    try {
      const data = categorySchema.parse(req.body);
      const category = await prisma.menuCategory.create({ data });
      res.status(201).json({ data: category });
    } catch (e) {
      next(e);
    }
  }
);

menuRouter.patch(
  "/categories/:id",
  requireAuth,
  requireRole("OWNER", "MANAGER"),
  async (req, res, next) => {
    try {
      const data = categorySchema.partial().parse(req.body);
      const category = await prisma.menuCategory.update({
        where: { id: req.params.id },
        data,
      });
      res.json({ data: category });
    } catch (e) {
      next(e);
    }
  }
);

menuRouter.delete(
  "/categories/:id",
  requireAuth,
  requireRole("OWNER"),
  async (req, res, next) => {
    try {
      await prisma.menuCategory.delete({ where: { id: req.params.id } });
      res.json({ data: { ok: true } });
    } catch (e) {
      next(e);
    }
  }
);

// ─── Items ────────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  categoryId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().int().positive(), // centavos
  imageUrl: z.string().url().optional(),
  available: z.boolean().optional(),
});

menuRouter.post(
  "/items",
  requireAuth,
  requireRole("OWNER", "MANAGER"),
  async (req, res, next) => {
    try {
      const data = itemSchema.parse(req.body);
      const item = await prisma.menuItem.create({
        data,
        include: { modifierGroups: { include: { options: true } } },
      });
      res.status(201).json({ data: item });
    } catch (e) {
      next(e);
    }
  }
);

menuRouter.patch(
  "/items/:id",
  requireAuth,
  requireRole("OWNER", "MANAGER"),
  async (req, res, next) => {
    try {
      const data = itemSchema.partial().parse(req.body);
      const item = await prisma.menuItem.update({
        where: { id: req.params.id },
        data,
        include: { modifierGroups: { include: { options: true } } },
      });
      res.json({ data: item });
    } catch (e) {
      next(e);
    }
  }
);

menuRouter.delete(
  "/items/:id",
  requireAuth,
  requireRole("OWNER"),
  async (req, res, next) => {
    try {
      await prisma.menuItem.delete({ where: { id: req.params.id } });
      res.json({ data: { ok: true } });
    } catch (e) {
      next(e);
    }
  }
);

// ─── Modifier Groups ──────────────────────────────────────────────────────────

const modifierGroupSchema = z.object({
  menuItemId: z.string(),
  name: z.string().min(1),
  required: z.boolean().optional(),
  multiSelect: z.boolean().optional(),
  sortOrder: z.number().optional(),
  options: z.array(
    z.object({
      name: z.string().min(1),
      priceAdjustment: z.number().int().default(0),
    })
  ),
});

menuRouter.post(
  "/modifier-groups",
  requireAuth,
  requireRole("OWNER", "MANAGER"),
  async (req, res, next) => {
    try {
      const { options, ...rest } = modifierGroupSchema.parse(req.body);
      const group = await prisma.modifierGroup.create({
        data: { ...rest, options: { create: options } },
        include: { options: true },
      });
      res.status(201).json({ data: group });
    } catch (e) {
      next(e);
    }
  }
);

menuRouter.delete(
  "/modifier-groups/:id",
  requireAuth,
  requireRole("OWNER", "MANAGER"),
  async (req, res, next) => {
    try {
      await prisma.modifierGroup.delete({ where: { id: req.params.id } });
      res.json({ data: { ok: true } });
    } catch (e) {
      next(e);
    }
  }
);
