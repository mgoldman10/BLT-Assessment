
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore/lite";

// PASTE YOUR FIREBASE CONFIGURATION HERE
// Replace this entire object with the one you copied from the Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyCqAYThJEIItNJ9qyb33AHJ9Xjun5AdwFQ",
  authDomain: "blt-assessment-4f1ae.firebaseapp.com",
  projectId: "blt-assessment-4f1ae",
  storageBucket: "blt-assessment-4f1ae.firebasestorage.app",
  messagingSenderId: "274087310674",
  appId: "1:274087310674:web:6298e1cdb1d50ef0d0368b"
};

// This function checks if you have actually replaced the placeholder text above.
export const isConfigured = (): boolean => {
  return firebaseConfig.apiKey !== "REPLACE_WITH_YOUR_API_KEY";
};

// Initialize Firebase only if configured (to avoid console errors if keys are missing)
const app = isConfigured() ? initializeApp(firebaseConfig) : undefined;
export const db = app ? getFirestore(app) : undefined;
