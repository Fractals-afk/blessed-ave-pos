import { Server } from "socket.io";
export declare function registerSocketHandlers(io: Server): void;
export declare function emitNewOrder(io: Server, order: unknown): void;
export declare function emitOrderStatusUpdate(io: Server, orderId: string, status: string, order: unknown): void;
//# sourceMappingURL=socket.d.ts.map