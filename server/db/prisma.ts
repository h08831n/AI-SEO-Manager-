import { PrismaClient } from '@prisma/client';
import { getPrismaClient } from './prismaClient';

const fallbackClient: any = {
  $transaction: async (arg: any) => (Array.isArray(arg) ? Promise.all(arg) : typeof arg === 'function' ? arg(fallbackClient) : arg),
  $disconnect: async () => {},
  $connect: async () => {},
  urlIdentity: {
    findMany: async () => [],
    findUnique: async () => null,
    findFirst: async () => null,
    create: async (args: any) => args.data,
    upsert: async (args: any) => args.create,
  },
  seoRecommendation: {
    create: async (args: any) => args.data,
    findMany: async () => [],
  },
  outboxEvent: {
    create: async (args: any) => args.data,
  },
  integration: {
    findUnique: async () => null,
    findMany: async () => [],
    upsert: async (args: any) => args.create,
    create: async (args: any) => args.data,
  },
  searchConsolePropertyBinding: {
    findUnique: async () => null,
    upsert: async (args: any) => args.create,
  },
  ga4PropertyBinding: {
    findUnique: async () => null,
    upsert: async (args: any) => args.create,
  },
  integrationSyncRun: {
    create: async (args: any) => args.data,
    update: async (args: any) => args.data,
  },
  gscSearchAnalyticsFact: {
    createMany: async () => ({ count: 0 }),
    findMany: async () => [],
  },
  ga4LandingPageDaily: {
    createMany: async () => ({ count: 0 }),
  },
  ga4ChannelDaily: {
    createMany: async () => ({ count: 0 }),
  },
  oAuthStateSession: {
    create: async (args: any) => args.data,
    findUnique: async () => null,
    delete: async () => null,
  },
};

export const prisma: PrismaClient = fallbackClient;

export default prisma;
