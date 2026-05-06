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
import { errorHandler } from "./middleware/errorHandler";
import { registerSocketHandlers } from "./socket";

const app = express();
const server = http.createServer(app);

// ─── Socket.io ────────────────────────────────────────────────────────────────
export const io = new SocketIOServer(server, {
  cors: {
    origin: [
      process.env.CLIENT_URL ?? "http://localhost:3000",
      process.env.ADMIN_URL ?? "http://localhost:3001",
    ],
    credentials: true,
  },
});
registerSocketHandlers(io);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: [
      process.env.CLIENT_URL ?? "http://localhost:3000",
      process.env.ADMIN_URL ?? "http://localhost:3001",
    ],
    credentials: true,
  })
);
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

app.get("/health", (_req, res) => res.json({ status: "ok", ts: new Date() }));

// ─── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

const PORT = process.env.PORT ?? 4000;
server.listen(PORT, () => {
  console.log(`🚀 Blessed Ave API running on http://localhost:${PORT}`);
});

export default app;
