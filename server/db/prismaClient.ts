import { PrismaClient } from '@prisma/client';

let prismaInstance: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient | null {
  if (!prismaInstance && process.env.DATABASE_URL) {
    try {
      prismaInstance = new PrismaClient();
    } catch (err) {
      console.warn('PostgreSQL Prisma connection warning:', err);
    }
  }
  return prismaInstance;
}
