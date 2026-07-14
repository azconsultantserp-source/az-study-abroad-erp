import { PrismaClient } from "@prisma/client";
import { assertEnv } from "@/lib/env";

assertEnv();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Single PrismaClient per Node process (dev HMR + production VPS).
 *
 * Connection pooling is configured via DATABASE_URL query params, e.g.:
 *   postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20
 *
 * On the VPS Docker stack, postgres and the app share one host — keep
 * connection_limit modest (5–10) so multiple PM2/Docker workers do not
 * exhaust Postgres max_connections.
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;

export default prisma;
