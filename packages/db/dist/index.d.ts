import { PrismaClient } from "../generated/client";
declare global {
    var __prisma: PrismaClient | undefined;
}
declare const prisma: PrismaClient<import("../generated/client").Prisma.PrismaClientOptions, never, import("../generated/client/runtime/library").DefaultArgs>;
export { prisma };
export * from "../generated/client";
