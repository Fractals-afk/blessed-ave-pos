import { Router } from "express";
import { z } from "zod";
import { prisma } from "@blessed-ave/db";
import { requireAuth, requireRole } from "../middleware/auth";

export const operatingCostsRouter = Router();

const costSchema = z.object({
  name: z.string().min(1),
  category: z.enum(["RENT", "UTILITIES", "WAGES", "PACKAGING", "MARKETING", "EQUIPMENT", "MAINTENANCE", "OTHER"]),
  frequency: z.enum(["ONE_TIME", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
  amount: z.number().int().positive(), // centavos
  date: z.string(), // ISO date string
  notes: z.string().optional(),
});

// GET /api/operating-costs?from=&to=
operatingCostsRouter.get("/", requireAuth, requireRole("OWNER", "MANAGER"), async (req, res, next) => {
  try {
    const { from, to } = z.object({ from: z.string().optional(), to: z.string().optional() }).parse(req.query);

    const where: Record<string, unknown> = {};
    if (from && to) {
      where.date = { gte: new Date(from), lte: new Date(to) };
    }

    const costs = await prisma.operatingCost.findMany({
      where,
      orderBy: { date: "desc" },
    });
    res.json({ data: costs });
  } catch (e) { next(e); }
});

// POST /api/operating-costs
operatingCostsRouter.post("/", requireAuth, requireRole("OWNER", "MANAGER"), async (req, res, next) => {
  try {
    const data = costSchema.parse(req.body);
    const cost = await prisma.operatingCost.create({
      data: { ...data, date: new Date(data.date) },
    });
    res.status(201).json({ data: cost });
  } catch (e) { next(e); }
});

// PATCH /api/operating-costs/:id
operatingCostsRouter.patch("/:id", requireAuth, requireRole("OWNER", "MANAGER"), async (req, res, next) => {
  try {
    const data = costSchema.partial().parse(req.body);
    const cost = await prisma.operatingCost.update({
      where: { id: req.params.id },
      data: { ...data, date: data.date ? new Date(data.date) : undefined },
    });
    res.json({ data: cost });
  } catch (e) { next(e); }
});

// DELETE /api/operating-costs/:id
operatingCostsRouter.delete("/:id", requireAuth, requireRole("OWNER", "MANAGER"), async (req, res, next) => {
  try {
    await prisma.operatingCost.delete({ where: { id: req.params.id } });
    res.json({ data: { ok: true } });
  } catch (e) { next(e); }
});
