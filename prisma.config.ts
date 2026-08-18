// @ts-ignore
import { defineConfig } from 'prisma/config';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || '',
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL || undefined,
  },
});
