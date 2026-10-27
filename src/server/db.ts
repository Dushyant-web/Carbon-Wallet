import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // printing every query slows the dev server down a lot; PRISMA_LOG_QUERIES=1 turns it back on
    log: process.env.PRISMA_LOG_QUERIES === "1" ? ["query", "error", "warn"] : ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
