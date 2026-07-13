import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Remote Postgres: bulk importers run many statements per interactive
// transaction, so the 5s default is too tight over the network.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    transactionOptions: { timeout: 120_000, maxWait: 10_000 },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
