import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import type { AuthPayload } from "./middleware/auth";

// Rooms:
//   "kitchen"   — kitchen display, receives all new orders (staff-only: order details incl. customer info)
//   "order:{id}" — a specific order (customer tracking page, intentionally anonymous)
//   "admin"     — admin dashboard live stats (staff-only)

const KITCHEN_ROLES: AuthPayload["role"][] = ["OWNER", "MANAGER", "KITCHEN", "STAFF"];
const ADMIN_ROLES: AuthPayload["role"][] = ["OWNER", "MANAGER"];

export function registerSocketHandlers(io: Server) {
  // Order-tracking clients connect with no token (customer-facing, anonymous by
  // design) — only decode a token if one was sent; never reject the handshake here.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token === "string" && token) {
      try {
        socket.data.user = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
      } catch {
        // invalid/expired — treat as anonymous, don't block the connection
      }
    }
    next();
  });

  io.on("connection", (socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    socket.on("join:kitchen", () => {
      const user = socket.data.user as AuthPayload | undefined;
      if (!user || !KITCHEN_ROLES.includes(user.role)) return;
      socket.join("kitchen");
      console.log(`[socket] ${socket.id} joined kitchen`);
    });

    socket.on("join:admin", () => {
      const user = socket.data.user as AuthPayload | undefined;
      if (!user || !ADMIN_ROLES.includes(user.role)) return;
      socket.join("admin");
      console.log(`[socket] ${socket.id} joined admin`);
    });

    socket.on("join:order", (orderId: string) => {
      socket.join(`order:${orderId}`);
      console.log(`[socket] ${socket.id} joined order:${orderId}`);
    });

    socket.on("disconnect", () => {
      console.log(`[socket] disconnected: ${socket.id}`);
    });
  });
}

// Helpers — call these from route handlers to push events

export function emitNewOrder(io: Server, order: unknown) {
  io.to("kitchen").emit("order:new", order);
  io.to("admin").emit("order:new", order);
}

export function emitOrderStatusUpdate(
  io: Server,
  orderId: string,
  status: string,
  order: unknown
) {
  io.to("kitchen").emit("order:updated", { orderId, status, order });
  io.to("admin").emit("order:updated", { orderId, status, order });
  io.to(`order:${orderId}`).emit("order:updated", { orderId, status, order });
}
