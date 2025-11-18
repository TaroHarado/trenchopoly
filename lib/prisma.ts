import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Check if DATABASE_URL is set and valid
const hasDatabase = process.env.DATABASE_URL && 
  process.env.DATABASE_URL !== "file:./prisma/dev.db" &&
  !process.env.DATABASE_URL.includes("undefined");

let prismaInstance: PrismaClient | null = null;

if (hasDatabase) {
  try {
    prismaInstance = globalForPrisma.prisma ?? new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    });
    if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prismaInstance;
  } catch (error) {
    console.warn("[PRISMA] Failed to initialize Prisma, running without database:", error);
    prismaInstance = null;
  }
} else {
  console.warn("[PRISMA] No DATABASE_URL configured, running without database");
}

// Export a proxy that handles missing database gracefully
export const prisma = new Proxy({} as PrismaClient, {
  get(target, prop) {
    if (!prismaInstance) {
      // Return mock functions that return empty results
      return () => Promise.resolve([]);
    }
    return (prismaInstance as any)[prop];
  },
}) as PrismaClient;

