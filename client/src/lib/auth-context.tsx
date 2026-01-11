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
        const parsedSession = JSON.parse(saved);
        // Check if session is expired (24 hours)
        const loginTime = new Date(parsedSession.loginTime);
        const now = new Date();
        const hoursSinceLogin = (now.getTime() - loginTime.getTime()) / (1000 * 60 * 60);

        if (hoursSinceLogin > 24) {
          // Session expired, clear it
          localStorage.removeItem("staffSession");
          return null;
        }

        return parsedSession;
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

  // Verify session on mount
  useEffect(() => {
    const verifySession = async () => {
      if (session) {
        try {
          const response = await fetch("/api/auth/verify", {
            method: "GET",
            credentials: "include",
          });

          if (!response.ok) {
            // Session invalid, clear it
            console.warn("Session verification failed, clearing session");
            setSession(null);
          }
        } catch (error) {
          // Network error - in PWA mode, this might be expected
          // Don't clear session immediately, but log the issue
          console.warn("Failed to verify session (possible PWA network issue):", error);
          
          // If we're in standalone mode and verification fails, 
          // we should still allow the session but mark it for re-verification
          const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                              (window.navigator as any).standalone;
          
          if (!isStandalone) {
            // Only clear session in browser mode, not PWA mode
            setSession(null);
          }
        }
      }
    };

    verifySession();
  }, []);

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
