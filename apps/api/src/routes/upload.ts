import { Router } from "express";
import multer from "multer";
import { requireAuth, requireRole } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

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

// POST /api/upload/image
uploadRouter.post(
  "/image",
  requireAuth,
  requireRole("OWNER", "MANAGER"),
  upload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) throw new AppError("No file uploaded");

      // Upload to S3-compatible storage (Cloudflare R2 or AWS S3)
      const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
      const { v4: uuidv4 } = await import("uuid");

      const client = new S3Client({
        region: process.env.S3_REGION ?? "auto",
        endpoint: process.env.S3_ENDPOINT,
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY!,
          secretAccessKey: process.env.S3_SECRET_KEY!,
        },
      });

      const ext = req.file.originalname.split(".").pop();
      const key = `menu/${uuidv4()}.${ext}`;

      await client.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET!,
          Key: key,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
        })
      );

      const url = `${process.env.S3_PUBLIC_URL}/${key}`;
      res.json({ data: { url } });
    } catch (e) {
      next(e);
    }
  }
);
