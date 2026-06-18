// Prisma client singleton. Prisma 7 uses a runtime driver adapter (no bundled
// engine); for local SQLite that's @prisma/adapter-better-sqlite3.
// Server-only — never import this from a Client Component.
import { PrismaClient } from "./generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

// Avoid exhausting connections during Next.js dev hot-reload.
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
