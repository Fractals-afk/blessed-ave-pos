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
Object.defineProperty(exports, "__esModule", { value: true });
exports.tablesRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("@blessed-ave/db");
const auth_1 = require("../middleware/auth");
const errorHandler_1 = require("../middleware/errorHandler");
exports.tablesRouter = (0, express_1.Router)();
// GET /api/tables — admin: all tables
exports.tablesRouter.get("/", auth_1.requireAuth, async (_req, res, next) => {
    try {
        const tables = await db_1.prisma.cafeTable.findMany({ orderBy: { name: "asc" } });
        res.json({ data: tables });
    }
    catch (e) {
        next(e);
    }
});
// GET /api/tables/by-token/:token — public: resolve QR token to table info
exports.tablesRouter.get("/by-token/:token", async (req, res, next) => {
    try {
        const table = await db_1.prisma.cafeTable.findUnique({
            where: { qrToken: req.params.token },
        });
        if (!table || !table.active)
            throw new errorHandler_1.AppError("Table not found", 404);
        res.json({ data: { id: table.id, name: table.name } });
    }
    catch (e) {
        next(e);
    }
});
// POST /api/tables
exports.tablesRouter.post("/", auth_1.requireAuth, (0, auth_1.requireRole)("OWNER", "MANAGER"), async (req, res, next) => {
    try {
        const { name } = zod_1.z.object({ name: zod_1.z.string().min(1) }).parse(req.body);
        const table = await db_1.prisma.cafeTable.create({ data: { name } });
        res.status(201).json({ data: table });
    }
    catch (e) {
        next(e);
    }
});
// PATCH /api/tables/:id
exports.tablesRouter.patch("/:id", auth_1.requireAuth, (0, auth_1.requireRole)("OWNER", "MANAGER"), async (req, res, next) => {
    try {
        const data = zod_1.z
            .object({ name: zod_1.z.string().optional(), active: zod_1.z.boolean().optional() })
            .parse(req.body);
        const table = await db_1.prisma.cafeTable.update({
            where: { id: req.params.id },
            data,
        });
        res.json({ data: table });
    }
    catch (e) {
        next(e);
    }
});
// POST /api/tables/:id/regenerate-qr — generate a new QR token
exports.tablesRouter.post("/:id/regenerate-qr", auth_1.requireAuth, (0, auth_1.requireRole)("OWNER", "MANAGER"), async (req, res, next) => {
    try {
        const { v4: uuidv4 } = await Promise.resolve().then(() => __importStar(require("uuid")));
        const table = await db_1.prisma.cafeTable.update({
            where: { id: req.params.id },
            data: { qrToken: uuidv4() },
        });
        res.json({ data: table });
    }
    catch (e) {
        next(e);
    }
});
//# sourceMappingURL=tables.js.map