import { defineConfig } from 'prisma/config';

const dbUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;
if (!dbUrl && process.env.NODE_ENV === 'production') {
  console.warn('[PrismaConfig] DATABASE_URL and DIRECT_URL are undefined in production.');
}

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
  },
  datasource: {
    url: dbUrl || '',
  },
});
