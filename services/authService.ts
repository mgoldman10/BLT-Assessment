import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from "firebase/auth";
import { auth } from "./firebase";
import { User, UserRole } from "../types";

// Map Firebase user -> app User
const mapFirebaseUser = (firebaseUser: FirebaseUser): User => {
  return {
    id: firebaseUser.uid,
    email: firebaseUser.email ?? "",
    name: firebaseUser.displayName ?? firebaseUser.email ?? "User",
    role: "ADMIN" as UserRole, // adjust if you have role claims or DB mapping
    password: "", // not used with Firebase auth
  };
};

export const login = async (email: string, password: string): Promise<User | null> => {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return mapFirebaseUser(credential.user);
};

export const logout = async (): Promise<void> => {
  await signOut(auth);
};

export const getCurrentUser = (): User | null> => {
  const current = auth.currentUser;
  return current ? mapFirebaseUser(current) : null;
};

const onAuthChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, (firebaseUser) => {
    callback(firebaseUser ? mapFirebaseUser(firebaseUser) : null);
  });
};

export { onAuthChange };

export const hasPermission = (user: User | null, requiredRole: UserRole): boolean => {
  if (!user) return false;
  if (user.role === "SUPER_ADMIN") return true;
  return user.role === requiredRole;
};
