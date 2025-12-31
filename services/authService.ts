import { User, UserRole } from "../types";
import { auth } from "./firebaseConfig";
import {
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  User as FirebaseUser
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore/lite";
import { db } from "./firebaseConfig";

// Session timeout: 1 hour
const TIMEOUT_DURATION = 60 * 60 * 1000;
let timeoutId: NodeJS.Timeout | null = null;

// Login with Firebase Authentication
export const login = async (email: string, password: string): Promise<User | null> => {
  if (!auth) {
    console.error("Firebase Auth not configured");
    return null;
  }

  try {
    // Sign in with Firebase Auth
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    // Fetch user metadata from Firestore
    if (!db) return null;

    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      console.error("User metadata not found in Firestore");
      await signOut(auth);
      return null;
    }

    const userData = userDoc.data() as User;
    return {
      id: firebaseUser.uid,
      name: userData.name,
      email: firebaseUser.email || email,
      role: userData.role
    };
  } catch (error: any) {
    console.error("Login error:", error.message);
    return null;
  }
};

// Logout with Firebase Authentication
export const logout = async (): Promise<void> => {
  if (!auth) return;

  try {
    // Clear session timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    await signOut(auth);
  } catch (error) {
    console.error("Logout error:", error);
  }
};

// Get current authenticated user
export const getCurrentUser = (): User | null => {
  if (!auth || !auth.currentUser) return null;

  const firebaseUser = auth.currentUser;

  // Note: This returns basic info. Full user metadata should be fetched from Firestore separately
  return {
    id: firebaseUser.uid,
    name: firebaseUser.displayName || "",
    email: firebaseUser.email || "",
    role: 'ADMIN' as UserRole // Default, should be fetched from Firestore
  };
};

// Get Firebase user object
export const getFirebaseUser = (): FirebaseUser | null => {
  return auth?.currentUser || null;
};

// Check user permissions
export const hasPermission = (user: User | null, requiredRole: UserRole): boolean => {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  return user.role === requiredRole;
};

// Change user password (self-service)
export const changeUserPassword = async (currentPassword: string, newPassword: string): Promise<boolean> => {
  if (!auth || !auth.currentUser) {
    throw new Error("No user logged in");
  }

  const user = auth.currentUser;

  if (!user.email) {
    throw new Error("User email not found");
  }

  try {
    // Re-authenticate with current password
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);

    // Update to new password
    await updatePassword(user, newPassword);

    return true;
  } catch (error: any) {
    console.error("Password change error:", error.message);

    if (error.code === 'auth/wrong-password') {
      throw new Error("Current password is incorrect");
    }

    throw new Error("Failed to change password: " + error.message);
  }
};

// Verify password (for legacy compatibility)
export const verifyPassword = async (_user: User, inputPassword: string): Promise<boolean> => {
  if (!auth || !auth.currentUser) return false;

  try {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser.email) return false;

    const credential = EmailAuthProvider.credential(firebaseUser.email, inputPassword);
    await reauthenticateWithCredential(firebaseUser, credential);
    return true;
  } catch (error) {
    return false;
  }
};

// Session timeout functionality
export const setupSessionTimeout = (logoutCallback: () => void) => {
  const resetTimer = () => {
    if (timeoutId) clearTimeout(timeoutId);

    timeoutId = setTimeout(() => {
      alert('Session expired due to inactivity. Please log in again.');
      logoutCallback();
    }, TIMEOUT_DURATION);
  };

  // Reset timer on user activity
  const events = ['mousedown', 'keypress', 'scroll', 'touchstart'];
  events.forEach(event => {
    document.addEventListener(event, resetTimer, true);
  });

  // Start initial timer
  resetTimer();
};

// Clean up session timeout
export const cleanupSessionTimeout = () => {
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }

  const events = ['mousedown', 'keypress', 'scroll', 'touchstart'];
  const resetTimer = () => {}; // Dummy function for removal
  events.forEach(event => {
    document.removeEventListener(event, resetTimer, true);
  });
};
