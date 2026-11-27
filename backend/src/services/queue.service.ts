import { Queue, Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { BackgroundJob, type IBackgroundJob } from '../models/index.js';
import { logger } from '../utils/logger.js';

export type QueueProcessor = (
  payload: Record<string, unknown>,
  helpers: { updateProgress: (progress: number) => Promise<void>; jobId: string }
) => Promise<Record<string, unknown> | void>;

class QueueManager {
  private redisConnection: Redis | null = null;
  private queues = new Map<string, Queue>();
  private workers = new Map<string, Worker>();
  private handlers = new Map<string, QueueProcessor>();
  private mode: 'bullmq-redis' | 'in-process-fallback' = 'in-process-fallback';
  private initialized = false;

  getMode(): 'bullmq-redis' | 'in-process-fallback' {
    return this.mode;
  }

  async init(startWorkers = false): Promise<void> {
    if (this.initialized) return;

    if (env.redisUrl) {
      try {
        const redis = new Redis(env.redisUrl, {
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
          lazyConnect: true
        });
        await redis.connect();
        this.redisConnection = redis;
        this.mode = 'bullmq-redis';
        logger.info({ mode: this.mode }, 'Connected to Redis for BullMQ queues');

        if (startWorkers) {
          for (const [queueName, handler] of this.handlers.entries()) {
            this.createBullWorker(queueName, handler);
          }
        }
      } catch (err) {
        logger.warn({ err }, 'Redis connection failed; falling back to in-process queue mode');
        this.mode = 'in-process-fallback';
      }
    } else {
      this.mode = 'in-process-fallback';
      logger.warn('REDIS_URL not configured; using in-process BullMQ-compatible fallback queue');
    }

    this.initialized = true;
  }

  registerHandler(queueName: string, handler: QueueProcessor): void {
    this.handlers.set(queueName, handler);
    if (this.mode === 'bullmq-redis' && this.redisConnection && !this.workers.has(queueName)) {
      this.createBullWorker(queueName, handler);
    }
  }

  private getOrCreateBullQueue(queueName: string): Queue {
    const existing = this.queues.get(queueName);
    if (existing) return existing;
    const queue = new Queue(queueName, {
      connection: this.redisConnection!,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 200
      }
    });
    this.queues.set(queueName, queue);
    return queue;
  }

  private createBullWorker(queueName: string, handler: QueueProcessor): void {
    if (!this.redisConnection || this.workers.has(queueName)) return;
    const worker = new Worker(
      queueName,
      async (job: Job) => {
        const recordId = job.data.__jobRecordId as string;
        await BackgroundJob.findByIdAndUpdate(recordId, {
          status: 'active',
          $inc: { attempts: 1 }
        });
        const updateProgress = async (progress: number) => {
          await job.updateProgress(progress);
          await BackgroundJob.findByIdAndUpdate(recordId, { progress });
        };
        try {
          const result = (await handler(job.data.payload, { updateProgress, jobId: recordId })) || {};
          await BackgroundJob.findByIdAndUpdate(recordId, {
            status: 'completed',
            progress: 100,
            result
          });
          return result;
        } catch (err) {
          await BackgroundJob.findByIdAndUpdate(recordId, {
            status: 'failed',
            errorMessage: err instanceof Error ? err.message : 'Job execution failed'
          });
          throw err;
        }
      },
      { connection: this.redisConnection, concurrency: 4 }
    );
    this.workers.set(queueName, worker);
  }

  async enqueue(params: {
    organizationId: string;
    createdBy?: string;
    queueName: string;
    jobKey: string;
    payload: Record<string, unknown>;
    runImmediatelyInTest?: boolean;
  }): Promise<IBackgroundJob> {
    const existing = await BackgroundJob.findOne({
      organizationId: params.organizationId,
      queueName: params.queueName,
      jobKey: params.jobKey
    });

    if (existing && existing.status !== 'failed' && existing.status !== 'cancelled') {
      return existing;
    }

    const jobRecord = existing
      ? await BackgroundJob.findByIdAndUpdate(
          existing._id,
          { status: 'queued', progress: 0, errorMessage: undefined, payload: params.payload },
          { new: true }
        )
      : await BackgroundJob.create({
          organizationId: params.organizationId,
          createdBy: params.createdBy,
          queueName: params.queueName,
          jobKey: params.jobKey,
          status: 'queued',
          progress: 0,
          payload: params.payload
        });

    if (!jobRecord) {
      throw new Error('Failed to create background job record');
    }

    if (this.mode === 'bullmq-redis' && this.redisConnection) {
      const queue = this.getOrCreateBullQueue(params.queueName);
      await queue.add(
        params.queueName,
        { __jobRecordId: jobRecord._id.toString(), payload: params.payload },
        { jobId: `${params.organizationId}:${params.queueName}:${params.jobKey}` }
      );
      return jobRecord;
    }

    // In-process fallback with retry handling
    const execute = async () => {
      const handler = this.handlers.get(params.queueName);
      if (!handler) return;

      const current = await BackgroundJob.findById(jobRecord._id);
      if (!current || current.status === 'cancelled') return;

      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const refreshed = await BackgroundJob.findById(jobRecord._id);
        if (!refreshed || refreshed.status === 'cancelled') return;

        await BackgroundJob.findByIdAndUpdate(jobRecord._id, {
          status: 'active',
          attempts: attempt
        });

        try {
          const result =
            (await handler(params.payload, {
              jobId: jobRecord._id.toString(),
              updateProgress: async (progress: number) => {
                await BackgroundJob.findByIdAndUpdate(jobRecord._id, { progress });
              }
            })) || {};
          await BackgroundJob.findByIdAndUpdate(jobRecord._id, {
            status: 'completed',
            progress: 100,
            result
          });
          return;
        } catch (err) {
          if (attempt >= maxAttempts) {
            await BackgroundJob.findByIdAndUpdate(jobRecord._id, {
              status: 'failed',
              errorMessage: err instanceof Error ? err.message : 'Job execution failed'
            });
          } else {
            await new Promise((r) => setTimeout(r, 150 * attempt));
          }
        }
      }
    };

    if (params.runImmediatelyInTest || env.nodeEnv === 'test') {
      await execute();
      return (await BackgroundJob.findById(jobRecord._id)) || jobRecord;
    }

    setImmediate(() => {
      void execute();
    });

    return jobRecord;
  }

  async cancelJob(organizationId: string, jobId: string): Promise<IBackgroundJob | null> {
    return BackgroundJob.findOneAndUpdate(
      { _id: jobId, organizationId, status: { $in: ['queued', 'active'] } },
      { status: 'cancelled' },
      { new: true }
    );
  }

  async shutdown(): Promise<void> {
    for (const worker of this.workers.values()) {
      await worker.close();
    }
    for (const queue of this.queues.values()) {
      await queue.close();
    }
    if (this.redisConnection) {
      await this.redisConnection.quit();
    }
    this.workers.clear();
    this.queues.clear();
    this.redisConnection = null;
    this.initialized = false;
  }
}

export const queueManager = new QueueManager();
