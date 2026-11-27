import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  verifyPasswordResetCode,
  type Auth,
  type User,
  type UserCredential
} from 'firebase/auth';

// Firebase web config comes only from build-time environment variables
// (GitHub Secrets mapped to VITE_FIREBASE_* in the Pages workflow).
// No Firebase value is ever hard-coded here.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId
);

export const firebaseApp: FirebaseApp = initializeApp(firebaseConfig);
export const auth: Auth = getAuth(firebaseApp);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

function isPopupBlockedError(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return (
    code === 'auth/popup-blocked' ||
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request' ||
    code === 'auth/operation-not-supported-in-this-environment'
  );
}

/**
 * Google sign-in. Returns the credential on a successful popup sign-in, or
 * null when the popup was blocked and the browser was redirected to Google
 * instead — in that case the page reloads and the result is picked up by
 * getGoogleRedirectResult() (called from the login page on mount).
 */
export async function signInWithGoogle(): Promise<UserCredential | null> {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (err) {
    if (isPopupBlockedError(err)) {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    throw err;
  }
}

/** Picks up a Google sign-in that completed via redirect after a page reload. */
export async function getGoogleRedirectResult(): Promise<UserCredential | null> {
  return getRedirectResult(auth);
}

export async function signUpWithEmail(email: string, password: string): Promise<UserCredential> {
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function signInWithEmail(email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function sendResetEmail(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

/** Verifies a Firebase reset code (oobCode), then sets the new password. */
export async function confirmReset(oobCode: string, newPassword: string): Promise<void> {
  await verifyPasswordResetCode(auth, oobCode);
  await confirmPasswordReset(auth, oobCode, newPassword);
}

/** Checks a Firebase reset code and returns the email it was issued for. */
export async function verifyResetCode(oobCode: string): Promise<string> {
  return verifyPasswordResetCode(auth, oobCode);
}

export async function sendVerificationEmail(user: User): Promise<void> {
  await sendEmailVerification(user);
}

export async function signOutFirebase(): Promise<void> {
  try {
    await signOut(auth);
  } catch {
    // Signing out is best-effort: the local session is cleared regardless.
  }
}

export function isNetworkError(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  if (code === 'auth/network-request-failed') return true;
  if (err instanceof TypeError && /network|fetch|failed to fetch/i.test(err.message)) return true;
  return false;
}

/** Human-readable message for a Firebase Auth error. Never surfaces raw codes. */
export function friendlyFirebaseError(err: unknown): string {
  const code = (err as { code?: string } | null)?.code;
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Please sign in.';
    case 'auth/weak-password':
      return 'Password must be at least 8 characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection and try again.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in was closed before completing. Please try again.';
    case 'auth/expired-action-code':
    case 'auth/invalid-action-code':
      return 'This link is invalid or has expired. Please request a new one.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/invalid-api-key':
      return 'Sign-in is not configured yet. Please try again later.';
    default:
      return err instanceof Error && err.message
        ? err.message
        : 'Something went wrong. Please try again.';
  }
}
