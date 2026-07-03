import "dotenv/config";
import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { Server as SocketIOServer } from "socket.io";

import { authRouter } from "./routes/auth";
import { menuRouter } from "./routes/menu";
import { ordersRouter } from "./routes/orders";
import { paymentsRouter } from "./routes/payments";
import { tablesRouter } from "./routes/tables";
import { inventoryRouter } from "./routes/inventory";
import { suppliersRouter } from "./routes/suppliers";
import { staffRouter } from "./routes/staff";
import { reportsRouter } from "./routes/reports";
import { uploadRouter } from "./routes/upload";
import { operatingCostsRouter } from "./routes/operating-costs";
import { pnlRouter } from "./routes/pnl";
import { tillRouter } from "./routes/till";
import { settingsRouter } from "./routes/settings";
import { errorHandler } from "./middleware/errorHandler";
import { registerSocketHandlers } from "./socket";
import { scheduleLowStockAlertJob } from "./jobs/lowStockAlert";

const app = express();
const server = http.createServer(app);

// Dev servers get auto-assigned ports per session (see dev-servers/register-port.js),
// so the allowlist can't be a fixed pair — allow any localhost origin outside prod.
const allowedOrigins = [process.env.CLIENT_URL, process.env.ADMIN_URL].filter(
  (v): v is string => Boolean(v)
);
function corsOrigin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
  if (!origin) return callback(null, true);
  if (process.env.NODE_ENV !== "production" && /^https?:\/\/localhost:\d+$/.test(origin)) {
    return callback(null, true);
  }
  if (allowedOrigins.includes(origin)) return callback(null, true);
  callback(new Error("Not allowed by CORS"));
}

// ─── Socket.io ────────────────────────────────────────────────────────────────
export const io = new SocketIOServer(server, {
  cors: { origin: corsOrigin, credentials: true },
});
registerSocketHandlers(io);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(morgan("dev"));

// Raw body for PayMongo webhook signature verification
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth", authRouter);
app.use("/api/menu", menuRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/tables", tablesRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/suppliers", suppliersRouter);
app.use("/api/staff", staffRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/operating-costs", operatingCostsRouter);
app.use("/api/pnl", pnlRouter);
app.use("/api/till", tillRouter);
app.use("/api/settings", settingsRouter);

app.get("/health", (_req, res) => res.json({ status: "ok", ts: new Date() }));

// ─── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

const PORT = process.env.PORT ?? 4000;
server.listen(PORT, () => {
  console.log(`🚀 Blessed Ave API running on http://localhost:${PORT}`);
});

// ─── Scheduled jobs ─────────────────────────────────────────────────────────
scheduleLowStockAlertJob();

export default app;
