import mongoose from 'mongoose';

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms';
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('[MongoDB] Connected successfully');
  } catch (err) {
    console.warn('[MongoDB] Connection failed (non-fatal, using PostgreSQL):', (err as Error).message);
    // Do NOT exit — Prisma/PostgreSQL is the primary DB
  }
}
