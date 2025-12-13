import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore/lite";

// Use Environment Variables instead of hardcoding keys
// This prevents Netlify "Secrets Scanning" errors
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const isConfigured = (): boolean => {
  // Check if the key exists and isn't the default placeholder
  return !!firebaseConfig.apiKey && firebaseConfig.apiKey !== "REPLACE_WITH_YOUR_API_KEY";
};

// Initialize Firebase only if configured
const app = isConfigured() ? initializeApp(firebaseConfig) : undefined;
export const db = app ? getFirestore(app) : undefined;
