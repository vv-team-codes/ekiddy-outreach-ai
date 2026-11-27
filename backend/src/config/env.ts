import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

export interface AppEnv {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  appUrl: string;
  apiUrl: string;
  corsOrigins: string[];
  mongodbUri: string;
  redisUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  encryptionKey: string;
  firebaseProjectId: string;
  geminiApiKey: string;
  geminiDefaultModel: string;
  openRouterApiKey: string;
  openRouterDefaultModel: string;
  emailProvider: 'sandbox' | 'smtp' | 'resend';
  emailProviderApiKey: string;
  emailFromDefault: string;
  emailWebhookSecret: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  dataProviderType: string;
  dataProviderApiKey: string;
  emailVerifierApiKey: string;
  googleClientId: string;
  googleClientSecret: string;
  googleRedirectUri: string;
  razorpayKeyId: string;
  razorpayKeySecret: string;
  razorpayWebhookSecret: string;
}

const rawNodeEnv = (process.env.NODE_ENV ?? 'development') as AppEnv['nodeEnv'];

export const env: AppEnv = {
  nodeEnv: rawNodeEnv,
  port: Number(process.env.PORT || 4000),
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  apiUrl: process.env.API_URL || 'http://localhost:4000',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:4173,https://app.ekiddy.com')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  mongodbUri: process.env.MONGODB_URI || '',
  redisUrl: process.env.REDIS_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'ekiddy-dev-jwt-secret-change-in-production-32chars',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  encryptionKey: process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'ekiddy-dev-encryption-key-change-in-prod',
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiDefaultModel: process.env.GEMINI_DEFAULT_MODEL || 'gemini-2.5-flash',
  openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
  openRouterDefaultModel: process.env.OPENROUTER_DEFAULT_MODEL || 'openai/gpt-4o-mini',
  emailProvider: (process.env.EMAIL_PROVIDER as AppEnv['emailProvider']) || 'sandbox',
  emailProviderApiKey: process.env.EMAIL_PROVIDER_API_KEY || '',
  emailFromDefault: process.env.EMAIL_FROM_DEFAULT || 'outreach@app.ekiddy.com',
  emailWebhookSecret: process.env.EMAIL_WEBHOOK_SECRET || 'ekiddy-dev-email-webhook-secret',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  dataProviderType: process.env.DATA_PROVIDER_TYPE || 'demo',
  dataProviderApiKey: process.env.DATA_PROVIDER_API_KEY || '',
  emailVerifierApiKey: process.env.EMAIL_VERIFIER_API_KEY || '',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/integrations/google-calendar/callback',
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || 'ekiddy-dev-razorpay-webhook-secret'
};
