import { Server } from "socket.io";

// Rooms:
//   "kitchen"   — kitchen display, receives all new orders
//   "order:{id}" — a specific order (customer tracking page)
//   "admin"     — admin dashboard live stats

export function registerSocketHandlers(io: Server) {
  io.on("connection", (socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    socket.on("join:kitchen", () => {
      socket.join("kitchen");
      console.log(`[socket] ${socket.id} joined kitchen`);
    });

    socket.on("join:admin", () => {
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
