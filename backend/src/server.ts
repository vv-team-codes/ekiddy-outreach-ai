import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { queueManager } from './services/queue.service.js';
import { logger } from './utils/logger.js';
import { registerAllQueueHandlers } from './workers/registerWorkers.js';

async function bootstrap() {
  await connectDatabase();
  registerAllQueueHandlers();
  await queueManager.init(true);

  const app = createApp();
  const server = app.listen(env.port, () => {
    logger.info({ port: env.port, env: env.nodeEnv }, 'ekiddy Outreach AI API listening');
  });

  const shutdown = async () => {
    logger.info('Shutting down API server gracefully...');
    server.close();
    await queueManager.shutdown();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Fatal error during API startup');
  process.exit(1);
});
