import { Router } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { requireAuth, requireRole } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";
import { uploadImage } from "../lib/storage";

export const uploadRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new AppError("Only image files allowed") as any, false);
    } else {
      cb(null, true);
    }
  },
});

// POST /api/upload/image — used for menu item photos. Resizes/recompresses
// before storing so a full-res phone photo doesn't end up shipped to every
// POS/kitchen screen; matches the receipt-scan compression in
// operating-costs.ts and goes through the same storage helper (local disk
// fallback when S3 isn't configured, which is true in dev and today's prod).
uploadRouter.post(
  "/image",
  requireAuth,
  requireRole("OWNER", "MANAGER"),
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) throw new AppError("No file uploaded");

      const sharp = (await import("sharp")).default;
      const compressed = await sharp(req.file.buffer)
        .rotate() // respect EXIF orientation from phone cameras
        .resize({ width: 800, withoutEnlargement: true })
        .jpeg({ quality: 75 })
        .toBuffer();

      const url = await uploadImage(compressed, `menu/${uuidv4()}.jpg`, "image/jpeg");
      res.json({ data: { url } });
    } catch (e) {
      next(e);
    }
  }
);
