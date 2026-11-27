import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

let memoryServer: { getUri: () => string; stop: () => Promise<unknown> } | null = null;
let databaseMode: 'external' | 'embedded-memory' = 'external';

export function getDatabaseMode(): 'external' | 'embedded-memory' {
  return databaseMode;
}

export async function connectDatabase(overrideUri?: string): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  let uri = overrideUri || env.mongodbUri;
  if (!uri) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const server = await MongoMemoryServer.create();
    memoryServer = server;
    uri = server.getUri();
    databaseMode = 'embedded-memory';
    logger.warn(
      { mode: databaseMode },
      'MONGODB_URI not configured; running with embedded MongoDB memory server (non-persistent across restarts)'
    );
  } else {
    databaseMode = 'external';
  }

  await mongoose.connect(uri);
  logger.info({ mode: databaseMode }, 'Connected to MongoDB');
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
