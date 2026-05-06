import { Router } from "express";
import { z } from "zod";
import { prisma } from "@blessed-ave/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

export const tablesRouter = Router();

// GET /api/tables — admin: all tables
tablesRouter.get("/", requireAuth, async (_req, res, next) => {
  try {
    const tables = await prisma.cafeTable.findMany({ orderBy: { name: "asc" } });
    res.json({ data: tables });
  } catch (e) {
    next(e);
  }
});

// GET /api/tables/by-token/:token — public: resolve QR token to table info
tablesRouter.get("/by-token/:token", async (req, res, next) => {
  try {
    const table = await prisma.cafeTable.findUnique({
      where: { qrToken: req.params.token },
    });
    if (!table || !table.active) throw new AppError("Table not found", 404);
    res.json({ data: { id: table.id, name: table.name } });
  } catch (e) {
    next(e);
  }
});

// POST /api/tables
tablesRouter.post(
  "/",
  requireAuth,
  requireRole("OWNER", "MANAGER"),
  async (req, res, next) => {
    try {
      const { name } = z.object({ name: z.string().min(1) }).parse(req.body);
      const table = await prisma.cafeTable.create({ data: { name } });
      res.status(201).json({ data: table });
    } catch (e) {
      next(e);
    }
  }
);

// PATCH /api/tables/:id
tablesRouter.patch(
  "/:id",
  requireAuth,
  requireRole("OWNER", "MANAGER"),
  async (req, res, next) => {
    try {
      const data = z
        .object({ name: z.string().optional(), active: z.boolean().optional() })
        .parse(req.body);
      const table = await prisma.cafeTable.update({
        where: { id: req.params.id },
        data,
      });
      res.json({ data: table });
    } catch (e) {
      next(e);
    }
  }
);

// POST /api/tables/:id/regenerate-qr — generate a new QR token
tablesRouter.post(
  "/:id/regenerate-qr",
  requireAuth,
  requireRole("OWNER", "MANAGER"),
  async (req, res, next) => {
    try {
      const { v4: uuidv4 } = await import("uuid");
      const table = await prisma.cafeTable.update({
        where: { id: req.params.id },
        data: { qrToken: uuidv4() },
      });
      res.json({ data: table });
    } catch (e) {
      next(e);
    }
  }
);
