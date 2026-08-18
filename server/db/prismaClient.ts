// @ts-ignore
import { PrismaClient } from '@prisma/client';

let prismaInstance: any = null;

export function getPrismaClient(): any {
  if (!prismaInstance && process.env.DATABASE_URL) {
    try {
      prismaInstance = new PrismaClient();
    } catch (err) {
      console.warn('PostgreSQL Prisma connection warning:', err);
    }
  }
  return prismaInstance;
}
