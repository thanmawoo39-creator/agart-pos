import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { Staff, StaffRole, StaffSession } from "@shared/schema";

interface AuthContextType {
  currentStaff: Staff | null;
  session: StaffSession | null;
  isLoggedIn: boolean;
  login: (pin?: string, barcode?: string) => Promise<boolean>;
  logout: () => void;
  canAccess: (requiredRole: StaffRole | StaffRole[]) => boolean;
  isOwner: boolean;
  isManager: boolean;
  isCashier: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StaffSession | null>(() => {
    const saved = localStorage.getItem("staffSession");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const currentStaff = session?.staff ?? null;
  const isLoggedIn = currentStaff !== null;

  useEffect(() => {
    if (session) {
      localStorage.setItem("staffSession", JSON.stringify(session));
    } else {
      localStorage.removeItem("staffSession");
    }
  }, [session]);

  const login = useCallback(async (pin?: string, barcode?: string): Promise<boolean> => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, barcode }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      setSession({
        staff: data.staff,
        loginTime: data.loginTime,
      });
      return true;
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    localStorage.removeItem("staffSession");
  }, []);

  const canAccess = useCallback(
    (requiredRole: StaffRole | StaffRole[]): boolean => {
      if (!currentStaff) return false;

      const roleHierarchy: Record<StaffRole, number> = {
        owner: 3,
        manager: 2,
        cashier: 1,
      };

      const userLevel = roleHierarchy[currentStaff.role];

      if (Array.isArray(requiredRole)) {
        return requiredRole.some((role) => userLevel >= roleHierarchy[role]);
      }

      return userLevel >= roleHierarchy[requiredRole];
    },
    [currentStaff]
  );

  const isOwner = currentStaff?.role === "owner";
  const isManager = currentStaff?.role === "manager" || isOwner;
  const isCashier = currentStaff?.role === "cashier";

  return (
    <AuthContext.Provider
      value={{
        currentStaff,
        session,
        isLoggedIn,
        login,
        logout,
        canAccess,
        isOwner,
        isManager,
        isCashier,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
