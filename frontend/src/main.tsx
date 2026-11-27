import React from 'react';
import ReactDOM from 'react-dom/client';
import { onAuthStateChanged } from 'firebase/auth';
import { App } from './App';
import './index.css';
import { auth } from './lib/firebase';
import { exchangeFirebaseSession } from './lib/firebaseSession';
import { useAppStore } from './stores/appStore';

// The backend JWT lives 7 days. When a Firebase user is signed in and the
// stored backend token is close to expiry (under 24h left), re-exchange a
// fresh Firebase ID token for a new backend JWT. The Firebase ID token
// itself is never stored and never sent as the API token — api.ts keeps
// sending the backend JWT.
function decodeJwtExpiry(token: string): number | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const payload = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: unknown };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function refreshBackendSessionIfExpiring(): Promise<void> {
  const { token, user } = useAppStore.getState();
  const firebaseUser = auth.currentUser;
  if (!token || !user || !firebaseUser) return;
  const expiresAt = decodeJwtExpiry(token);
  if (expiresAt === null) return; // Expiry unreadable — leave the session alone.
  if (expiresAt - Date.now() > 24 * 60 * 60 * 1000) return; // More than a day left.
  try {
    const freshIdToken = await firebaseUser.getIdToken(true);
    await exchangeFirebaseSession(freshIdToken);
  } catch {
    // A failed refresh must not sign the user out: the existing backend
    // session stays usable until it actually expires.
  }
}

try {
  onAuthStateChanged(auth, () => {
    void refreshBackendSessionIfExpiring();
  });
  setInterval(() => {
    void refreshBackendSessionIfExpiring();
  }, 60 * 60 * 1000);
} catch {
  // Firebase not configured yet (no build-time env vars): the app must
  // still boot and the password-login fallback keeps working.
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
