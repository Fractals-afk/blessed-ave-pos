import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@blessed-ave/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

export const staffRouter = Router();

// GET /api/staff
staffRouter.get("/", requireAuth, requireRole("OWNER", "MANAGER"), async (_req, res, next) => {
  try {
    const staff = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
      orderBy: { name: "asc" },
    });
    res.json({ data: staff });
  } catch (e) {
    next(e);
  }
});

// POST /api/staff
staffRouter.post(
  "/",
  requireAuth,
  requireRole("OWNER", "MANAGER"),
  async (req, res, next) => {
    try {
      const { name, email, password, role } = z
        .object({
          name: z.string().min(1),
          email: z.string().email(),
          password: z.string().min(8),
          role: z.enum(["OWNER", "MANAGER", "STAFF"]).default("STAFF"),
        })
        .parse(req.body);

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) throw new AppError("Email already in use");

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await prisma.user.create({
        data: { name, email, passwordHash, role },
        select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
      });
      res.status(201).json({ data: user });
    } catch (e) {
      next(e);
    }
  }
);

// PATCH /api/staff/:id
staffRouter.patch(
  "/:id",
  requireAuth,
  requireRole("OWNER", "MANAGER"),
  async (req, res, next) => {
    try {
      const data = z
        .object({
          name: z.string().optional(),
          role: z.enum(["OWNER", "MANAGER", "STAFF"]).optional(),
          active: z.boolean().optional(),
        })
        .parse(req.body);

      const user = await prisma.user.update({
        where: { id: req.params.id },
        data,
        select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
      });
      res.json({ data: user });
    } catch (e) {
      next(e);
    }
  }
);

// POST /api/staff/:id/reset-password
staffRouter.post(
  "/:id/reset-password",
  requireAuth,
  requireRole("OWNER"),
  async (req, res, next) => {
    try {
      const { password } = z.object({ password: z.string().min(8) }).parse(req.body);
      const passwordHash = await bcrypt.hash(password, 12);
      await prisma.user.update({
        where: { id: req.params.id },
        data: { passwordHash },
      });
      res.json({ data: { ok: true } });
    } catch (e) {
      next(e);
    }
  }
);

// ─── Shifts ───────────────────────────────────────────────────────────────────

staffRouter.get("/shifts", requireAuth, async (req, res, next) => {
  try {
    const { from, to } = z
      .object({ from: z.string(), to: z.string() })
      .parse(req.query);

    const shifts = await prisma.shift.findMany({
      where: {
        date: {
          gte: new Date(from),
          lte: new Date(to),
        },
      },
      include: { user: { select: { id: true, name: true } } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });
    res.json({ data: shifts });
  } catch (e) {
    next(e);
  }
});

staffRouter.post(
  "/shifts",
  requireAuth,
  requireRole("OWNER", "MANAGER"),
  async (req, res, next) => {
    try {
      const data = z
        .object({
          userId: z.string(),
          date: z.string(),
          startTime: z.string(),
          endTime: z.string(),
          notes: z.string().optional(),
        })
        .parse(req.body);

      const shift = await prisma.shift.create({
        data: { ...data, date: new Date(data.date) },
        include: { user: { select: { id: true, name: true } } },
      });
      res.status(201).json({ data: shift });
    } catch (e) {
      next(e);
    }
  }
);

staffRouter.delete(
  "/shifts/:id",
  requireAuth,
  requireRole("OWNER", "MANAGER"),
  async (req, res, next) => {
    try {
      await prisma.shift.delete({ where: { id: req.params.id } });
      res.json({ data: { ok: true } });
    } catch (e) {
      next(e);
    }
  }
);

// ─── Clock in/out ─────────────────────────────────────────────────────────────

staffRouter.post("/clock", requireAuth, async (req, res, next) => {
  try {
    const { type } = z.object({ type: z.enum(["CLOCK_IN", "CLOCK_OUT"]) }).parse(req.body);
    const event = await prisma.clockEvent.create({
      data: { userId: req.user!.userId, type },
    });
    res.status(201).json({ data: event });
  } catch (e) {
    next(e);
  }
});

staffRouter.get("/clock/today", requireAuth, async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const events = await prisma.clockEvent.findMany({
      where: { userId: req.user!.userId, timestamp: { gte: today } },
      orderBy: { timestamp: "asc" },
    });
    res.json({ data: events });
  } catch (e) {
    next(e);
  }
});
