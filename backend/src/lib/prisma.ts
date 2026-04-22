/**
 * Prisma client singleton
 *
 * Use this anywhere you need DB access:
 *   import { prisma } from '../lib/prisma';
 *   const users = await prisma.user.findMany();
 */
import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prismaClient: PrismaClient | undefined;
}

export const prisma =
  global.prismaClient ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prismaClient = prisma;
}

export async function connectPrisma(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('[Prisma] Connected to PostgreSQL');
  } catch (err) {
    console.error('[Prisma] Connection failed:', (err as Error).message);
    throw err;
  }
}

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
