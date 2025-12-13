import { User, UserRole } from "../types";
import { getUsers } from "./storage";

const SESSION_KEY = 'breakthrough_auth_session';

export const login = async (email: string, password: string): Promise<User | null> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));

  try {
      // Get users from storage (DB or Local)
      const users = await getUsers();
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      
      if (user && user.password === password) {
          localStorage.setItem(SESSION_KEY, JSON.stringify(user));
          return user;
      }
  } catch (e) {
      console.error("Login error", e);
  }
  
  return null;
};

export const logout = (): void => {
  localStorage.removeItem(SESSION_KEY);
};

export const getCurrentUser = (): User | null => {
  try {
    const json = localStorage.getItem(SESSION_KEY);
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
};

export const hasPermission = (user: User | null, requiredRole: UserRole): boolean => {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  return user.role === requiredRole;
};

// New helper to verify password securely (conceptually)
export const verifyPassword = (user: User, inputPassword: string): boolean => {
    return user.password === inputPassword;
};
