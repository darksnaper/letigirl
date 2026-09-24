import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Normalize prefixed environment variables from Vercel (e.g. girl_POSTGRES_PRISMA_URL)
for (const key of Object.keys(process.env)) {
  if (key.endsWith('POSTGRES_PRISMA_URL') || key.endsWith('DATABASE_URL')) {
    process.env.POSTGRES_PRISMA_URL = process.env.POSTGRES_PRISMA_URL || process.env[key];
    process.env.DATABASE_URL = process.env.DATABASE_URL || process.env[key];
  }
  if (key.endsWith('POSTGRES_URL_NON_POOLING') || key.endsWith('DATABASE_URL_UNPOOLED')) {
    process.env.POSTGRES_URL_NON_POOLING = process.env.POSTGRES_URL_NON_POOLING || process.env[key];
  }
}

const dbUrl =
  process.env.POSTGRES_PRISMA_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: dbUrl
      ? {
          db: {
            url: dbUrl,
          },
        }
      : undefined,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
