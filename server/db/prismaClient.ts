import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

let prismaInstance: PrismaClient | null = null;
let pgPoolInstance: pg.Pool | null = null;

export function getPrismaClient(): PrismaClient | null {
  if (!prismaInstance && process.env.DATABASE_URL) {
    try {
      const connectionString = process.env.DATABASE_URL;
      pgPoolInstance = new pg.Pool({
        connectionString,
        max: parseInt(process.env.PG_POOL_MAX || '10', 10),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      const adapter = new PrismaPg(pgPoolInstance);
      prismaInstance = new PrismaClient({ adapter });
    } catch (err) {
      console.warn('[PrismaClient] PostgreSQL Prisma adapter initialization warning:', err);
    }
  }
  return prismaInstance;
}

export async function closePrismaClient(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
  if (pgPoolInstance) {
    await pgPoolInstance.end();
    pgPoolInstance = null;
  }
}
