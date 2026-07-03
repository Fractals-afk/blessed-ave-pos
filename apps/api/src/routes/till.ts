import { Router } from "express";
import { z } from "zod";
import { prisma } from "@blessed-ave/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

export const tillRouter = Router();

// Cash actually moved through the drawer during a session: CASH payments
// confirmed while it was open, minus CASH refunds issued while it was open.
async function computeExpectedCash(openingFloat: number, openedAt: Date, until: Date) {
  const [paid, refunded] = await Promise.all([
    prisma.payment.aggregate({
      where: { method: "CASH", status: "PAID", paidAt: { gte: openedAt, lte: until } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { method: "CASH", status: "REFUNDED", updatedAt: { gte: openedAt, lte: until } },
      _sum: { amount: true },
    }),
  ]);
  const cashIn = paid._sum.amount ?? 0;
  const cashOut = refunded._sum.amount ?? 0;
  return { expectedCash: openingFloat + cashIn - cashOut, cashIn, cashOut };
}

// POST /api/till/open
tillRouter.post("/open", requireAuth, async (req, res, next) => {
  try {
    const { openingFloat } = z.object({ openingFloat: z.number().int().nonnegative() }).parse(req.body);

    const existing = await prisma.tillSession.findFirst({ where: { status: "OPEN" } });
    if (existing) throw new AppError("A till session is already open");

    const session = await prisma.tillSession.create({
      data: { openedById: req.user!.userId, openingFloat },
      include: { openedBy: { select: { id: true, name: true } } },
    });
    res.status(201).json({ data: session });
  } catch (e) {
    next(e);
  }
});

// GET /api/till/current — the open session plus a live expected-cash preview
tillRouter.get("/current", requireAuth, async (_req, res, next) => {
  try {
    const session = await prisma.tillSession.findFirst({
      where: { status: "OPEN" },
      include: { openedBy: { select: { id: true, name: true } } },
    });
    if (!session) return res.json({ data: null });

    const preview = await computeExpectedCash(session.openingFloat, session.openedAt, new Date());
    res.json({ data: { ...session, ...preview } });
  } catch (e) {
    next(e);
  }
});

// POST /api/till/close
tillRouter.post("/close", requireAuth, async (req, res, next) => {
  try {
    const { actualCash, notes } = z
      .object({ actualCash: z.number().int().nonnegative(), notes: z.string().optional() })
      .parse(req.body);

    const session = await prisma.tillSession.findFirst({ where: { status: "OPEN" } });
    if (!session) throw new AppError("No till session is open", 404);

    const closedAt = new Date();
    const { expectedCash } = await computeExpectedCash(session.openingFloat, session.openedAt, closedAt);
    const variance = actualCash - expectedCash;

    const updated = await prisma.tillSession.update({
      where: { id: session.id },
      data: {
        status: "CLOSED",
        closedById: req.user!.userId,
        closedAt,
        expectedCash,
        actualCash,
        variance,
        notes,
      },
      include: {
        openedBy: { select: { id: true, name: true } },
        closedBy: { select: { id: true, name: true } },
      },
    });
    res.json({ data: updated });
  } catch (e) {
    next(e);
  }
});

// GET /api/till/history
tillRouter.get("/history", requireAuth, requireRole("OWNER", "MANAGER"), async (_req, res, next) => {
  try {
    const sessions = await prisma.tillSession.findMany({
      where: { status: "CLOSED" },
      include: {
        openedBy: { select: { id: true, name: true } },
        closedBy: { select: { id: true, name: true } },
      },
      orderBy: { closedAt: "desc" },
      take: 50,
    });
    res.json({ data: sessions });
  } catch (e) {
    next(e);
  }
});
