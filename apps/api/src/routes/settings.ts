import { Router } from "express";
import { z } from "zod";
import { prisma } from "@blessed-ave/db";
import { requireAuth, requireRole } from "../middleware/auth";

export const settingsRouter = Router();

// GET /api/settings/vat — public: whether the business is VAT-registered.
// Read by the POS (order preview math) and customer-facing pages.
settingsRouter.get("/vat", async (_req, res, next) => {
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: "vat_enabled" } });
    res.json({ data: { vatEnabled: setting ? setting.value === "true" : true } });
  } catch (e) {
    next(e);
  }
});

// PUT /api/settings/vat — owner/manager: toggle VAT on or off.
// Only affects orders created/discounted after the change; stored vatAmount
// on past orders is untouched.
settingsRouter.put("/vat", requireAuth, requireRole("OWNER", "MANAGER"), async (req, res, next) => {
  try {
    const { vatEnabled } = z.object({ vatEnabled: z.boolean() }).parse(req.body);
    await prisma.appSetting.upsert({
      where: { key: "vat_enabled" },
      update: { value: String(vatEnabled) },
      create: { key: "vat_enabled", value: String(vatEnabled) },
    });
    res.json({ data: { vatEnabled } });
  } catch (e) {
    next(e);
  }
});
