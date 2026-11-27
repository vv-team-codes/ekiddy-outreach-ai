import admin from 'firebase-admin';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Server-side Firebase Auth verification (firebase-admin v12).
 *
 * The Admin SDK is initialised exactly once, from server-only credentials:
 * - FIREBASE_SERVICE_ACCOUNT_JSON (full service-account JSON on one line), or
 * - GOOGLE_APPLICATION_CREDENTIALS / ambient GCP credentials (ADC).
 * No Firebase web apiKey or client config ever belongs here.
 */

export interface VerifiedFirebaseToken {
  uid: string;
  email?: string;
  emailVerified: boolean;
  signInProvider?: string;
  name?: string;
  picture?: string;
}

let adminApp: admin.app.App | null = null;
let initAttempted = false;

function getAdminApp(): admin.app.App {
  if (adminApp) return adminApp;
  if (initAttempted) {
    throw new Error('Firebase Admin SDK is not configured');
  }
  initAttempted = true;

  const serviceAccountJson = env.firebaseServiceAccountJson?.trim();
  if (serviceAccountJson) {
    let credential: admin.credential.Credential;
    try {
      credential = admin.credential.cert(JSON.parse(serviceAccountJson) as admin.ServiceAccount);
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON');
    }
    adminApp = admin.initializeApp({
      credential,
      ...(env.firebaseProjectId ? { projectId: env.firebaseProjectId } : {})
    });
  } else {
    // Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS or
    // ambient GCP credentials). Throws at first use when nothing is set.
    adminApp = admin.initializeApp(
      env.firebaseProjectId ? { projectId: env.firebaseProjectId } : undefined
    );
  }
  return adminApp;
}

export function isFirebaseAdminConfigured(): boolean {
  return Boolean(
    env.firebaseServiceAccountJson?.trim() ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      env.firebaseProjectId
  );
}

/**
 * Verifies a Firebase ID token with the Admin SDK. Checks the signature,
 * audience, issuer, expiry and revocation (checkRevoked = true).
 * Never trust the tokeninfo HTTPS endpoint or a client-supplied email.
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseToken> {
  let decoded: admin.auth.DecodedIdToken;
  try {
    decoded = await getAdminApp().auth().verifyIdToken(idToken, true);
  } catch (err) {
    logger.warn({ err }, 'Firebase ID token verification failed');
    throw new Error('Invalid Firebase ID token');
  }

  if (env.firebaseProjectId && decoded.aud !== env.firebaseProjectId) {
    throw new Error('Firebase token audience mismatch');
  }

  return {
    uid: decoded.uid,
    email: decoded.email,
    emailVerified: Boolean(decoded.email_verified),
    signInProvider: decoded.firebase?.sign_in_provider,
    name: decoded.name,
    picture: decoded.picture
  };
}
