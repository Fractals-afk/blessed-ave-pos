import { Router } from "express";
import type Anthropic from "@anthropic-ai/sdk";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { prisma } from "@blessed-ave/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { uploadImage } from "../lib/storage";

export const operatingCostsRouter = Router();

const CATEGORIES = ["RENT", "UTILITIES", "WAGES", "PACKAGING", "MARKETING", "EQUIPMENT", "MAINTENANCE", "OTHER"] as const;

const costSchema = z.object({
  name: z.string().min(1),
  category: z.enum(["RENT", "UTILITIES", "WAGES", "PACKAGING", "MARKETING", "EQUIPMENT", "MAINTENANCE", "OTHER"]),
  frequency: z.enum(["ONE_TIME", "DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
  amount: z.number().int().positive(), // centavos
  date: z.string(), // ISO date string
  vendor: z.string().optional(),
  notes: z.string().optional(),
  // Set when this expense was created from a scanned receipt rather than
  // manual entry (see TODO(ai-receipt-reader) in the Prisma schema — no
  // scanning flow exists yet, but this field is ready to receive it).
  receiptRef: z.string().optional(),
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

const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB — phone photos run bigger than menu images
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new AppError("Only image files allowed") as any, false);
    } else {
      cb(null, true);
    }
  },
});

const aiExtractSchema = z.object({
  name: z.string().min(1).optional(),
  vendor: z.string().nullable().optional(),
  amount: z.number().positive().nullable().optional(), // pesos, decimal
  date: z.string().nullable().optional(), // YYYY-MM-DD
  category: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const RECEIPT_PROMPT = `You are reading a photo of a receipt or invoice for a small cafe's operating-costs ledger (non-inventory expenses like rent, utilities, repairs, packaging, marketing). Extract these fields as strict JSON only — no markdown fences, no commentary, just the JSON object:
{
  "name": short description, e.g. "Electricity Bill" or "Plumbing Repair",
  "vendor": the store/company/payee name, or null if unreadable,
  "amount": the total amount paid, as a plain number in pesos (no currency symbol, no commas), or null if unreadable,
  "date": the transaction date as YYYY-MM-DD, or null if unreadable,
  "category": exactly one of RENT, UTILITIES, WAGES, PACKAGING, MARKETING, EQUIPMENT, MAINTENANCE, OTHER — pick the closest match,
  "notes": any other useful detail (e.g. invoice number), or null
}`;

// POST /api/operating-costs/scan-receipt
// Compresses the uploaded photo, stores it, and asks Claude's vision model to
// read the receipt and suggest name/vendor/amount/date/category. The caller
// still reviews and submits via POST / — this never writes to the DB itself.
operatingCostsRouter.post(
  "/scan-receipt",
  requireAuth,
  requireRole("OWNER", "MANAGER"),
  receiptUpload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) throw new AppError("No file uploaded");

      const sharp = (await import("sharp")).default;
      const compressed = await sharp(req.file.buffer)
        .rotate() // respect EXIF orientation from phone cameras
        .resize({ width: 1600, withoutEnlargement: true })
        .jpeg({ quality: 72 })
        .toBuffer();

      const receiptUrl = await uploadImage(compressed, `receipts/${uuidv4()}.jpg`, "image/jpeg");

      if (!process.env.ANTHROPIC_API_KEY) {
        return res.json({
          data: { receiptUrl, suggested: null, aiError: "AI scanning not configured — add ANTHROPIC_API_KEY to enable it. Fill in details manually below." },
        });
      }

      try {
        const AnthropicClient = (await import("@anthropic-ai/sdk")).default;
        const anthropic = new AnthropicClient({ apiKey: process.env.ANTHROPIC_API_KEY });
        const message = await anthropic.messages.create({
          model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
          max_tokens: 500,
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: "image/jpeg", data: compressed.toString("base64") } },
                { type: "text", text: RECEIPT_PROMPT },
              ],
            },
          ],
        });

        const textBlock = message.content.find((b): b is Anthropic.TextBlock => b.type === "text");
        const raw = (textBlock?.text ?? "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
        const parsed = aiExtractSchema.parse(JSON.parse(raw));

        const category = CATEGORIES.includes(parsed.category as any) ? (parsed.category as (typeof CATEGORIES)[number]) : "OTHER";
        const isValidDate = parsed.date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date);

        res.json({
          data: {
            receiptUrl,
            suggested: {
              name: parsed.name || "Scanned Receipt",
              vendor: parsed.vendor || "",
              amount: parsed.amount ? Math.round(parsed.amount * 100) : 0, // centavos
              date: isValidDate ? parsed.date : new Date().toISOString().slice(0, 10),
              category,
              notes: parsed.notes || "",
            },
            aiError: null,
          },
        });
      } catch (aiErr) {
        console.error("[scan-receipt] AI extraction failed", aiErr);
        res.json({
          data: { receiptUrl, suggested: null, aiError: "Couldn't read the receipt automatically — fill in details manually below." },
        });
      }
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
