import { connectDatabase, disconnectDatabase } from './config/database.js';
import { queueManager } from './services/queue.service.js';
import { logger } from './utils/logger.js';
import { registerAllQueueHandlers } from './workers/registerWorkers.js';

async function startWorker() {
  await connectDatabase();
  registerAllQueueHandlers();
  await queueManager.init(true);
  logger.info({ mode: queueManager.getMode() }, 'ekiddy Outreach AI Background Worker started');

  const shutdown = async () => {
    logger.info('Shutting down background worker...');
    await queueManager.shutdown();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startWorker().catch((err) => {
  logger.error({ err }, 'Fatal error starting background worker');
  process.exit(1);
});
