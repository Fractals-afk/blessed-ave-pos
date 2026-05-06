"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const socket_io_1 = require("socket.io");
const auth_1 = require("./routes/auth");
const menu_1 = require("./routes/menu");
const orders_1 = require("./routes/orders");
const payments_1 = require("./routes/payments");
const tables_1 = require("./routes/tables");
const inventory_1 = require("./routes/inventory");
const suppliers_1 = require("./routes/suppliers");
const staff_1 = require("./routes/staff");
const reports_1 = require("./routes/reports");
const upload_1 = require("./routes/upload");
const operating_costs_1 = require("./routes/operating-costs");
const pnl_1 = require("./routes/pnl");
const errorHandler_1 = require("./middleware/errorHandler");
const socket_1 = require("./socket");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
// ─── Socket.io ────────────────────────────────────────────────────────────────
exports.io = new socket_io_1.Server(server, {
    cors: {
        origin: [
            process.env.CLIENT_URL ?? "http://localhost:3000",
            process.env.ADMIN_URL ?? "http://localhost:3001",
        ],
        credentials: true,
    },
});
(0, socket_1.registerSocketHandlers)(exports.io);
// ─── Middleware ───────────────────────────────────────────────────────────────
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: [
        process.env.CLIENT_URL ?? "http://localhost:3000",
        process.env.ADMIN_URL ?? "http://localhost:3001",
    ],
    credentials: true,
}));
app.use((0, morgan_1.default)("dev"));
// Raw body for PayMongo webhook signature verification
app.use("/api/payments/webhook", express_1.default.raw({ type: "application/json" }));
app.use(express_1.default.json({ limit: "10mb" }));
app.use(express_1.default.urlencoded({ extended: true }));
// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth", auth_1.authRouter);
app.use("/api/menu", menu_1.menuRouter);
app.use("/api/orders", orders_1.ordersRouter);
app.use("/api/payments", payments_1.paymentsRouter);
app.use("/api/tables", tables_1.tablesRouter);
app.use("/api/inventory", inventory_1.inventoryRouter);
app.use("/api/suppliers", suppliers_1.suppliersRouter);
app.use("/api/staff", staff_1.staffRouter);
app.use("/api/reports", reports_1.reportsRouter);
app.use("/api/upload", upload_1.uploadRouter);
app.use("/api/operating-costs", operating_costs_1.operatingCostsRouter);
app.use("/api/pnl", pnl_1.pnlRouter);
app.get("/health", (_req, res) => res.json({ status: "ok", ts: new Date() }));
// ─── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler_1.errorHandler);
const PORT = process.env.PORT ?? 4000;
server.listen(PORT, () => {
    console.log(`🚀 Blessed Ave API running on http://localhost:${PORT}`);
});
exports.default = app;
//# sourceMappingURL=index.js.map