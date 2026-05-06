"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
exports.uploadRouter = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            cb(new errorHandler_1.AppError("Only image files allowed"), false);
        }
        else {
            cb(null, true);
        }
    },
});
// POST /api/upload/image
exports.uploadRouter.post("/image", auth_1.requireAuth, (0, auth_1.requireRole)("OWNER", "MANAGER"), upload.single("file"), async (req, res, next) => {
    try {
        if (!req.file)
            throw new errorHandler_1.AppError("No file uploaded");
        // Upload to S3-compatible storage (Cloudflare R2 or AWS S3)
        const { S3Client, PutObjectCommand } = await Promise.resolve().then(() => __importStar(require("@aws-sdk/client-s3")));
        const { v4: uuidv4 } = await Promise.resolve().then(() => __importStar(require("uuid")));
        const client = new S3Client({
            region: process.env.S3_REGION ?? "auto",
            endpoint: process.env.S3_ENDPOINT,
            credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY,
                secretAccessKey: process.env.S3_SECRET_KEY,
            },
        });
        const ext = req.file.originalname.split(".").pop();
        const key = `menu/${uuidv4()}.${ext}`;
        await client.send(new PutObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: key,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
        }));
        const url = `${process.env.S3_PUBLIC_URL}/${key}`;
        res.json({ data: { url } });
    }
    catch (e) {
        next(e);
    }
});
//# sourceMappingURL=upload.js.map