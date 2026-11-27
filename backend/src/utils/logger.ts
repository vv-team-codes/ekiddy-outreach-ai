import pino from 'pino';
import { env } from '../config/env.js';

export const logger = pino({
  level: env.nodeEnv === 'test' ? 'silent' : env.nodeEnv === 'production' ? 'info' : 'debug',
  redact: {
    paths: [
      'req.headers.authorization',
      'password',
      'passwordHash',
      'apiKey',
      'secret',
      'encryptedCredentials',
      'encryptedConfig',
      'token'
    ],
    censor: '[REDACTED]'
  },
  transport:
    env.nodeEnv === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
          }
        }
      : undefined
});
