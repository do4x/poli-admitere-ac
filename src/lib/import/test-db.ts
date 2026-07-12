import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

/**
 * Throwaway Postgres schema on the DIRECT_URL server, dropped on teardown —
 * the Postgres equivalent of the old temp-SQLite bootstrap. Needs network +
 * the credentials in .env; Prisma loads .env when the client module loads.
 */
export async function createTestDb(): Promise<{
  db: PrismaClient;
  drop: () => Promise<void>;
}> {
  const base = process.env.DIRECT_URL;
  if (!base) {
    throw new Error(
      "DIRECT_URL lipsește — testele de integrare au nevoie de conexiunea Postgres din .env",
    );
  }
  const schema = `test_${randomBytes(6).toString("hex")}`;
  const url = new URL(base);
  url.searchParams.set("schema", schema);
  const db = new PrismaClient({ datasourceUrl: url.toString() });

  await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  const sql = execSync(
    "npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script",
    { encoding: "utf8" },
  );
  for (const statement of sql.split(";")) {
    if (statement.trim()) {
      await db.$executeRawUnsafe(statement);
    }
  }

  return {
    db,
    drop: async () => {
      await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await db.$disconnect();
    },
  };
}
