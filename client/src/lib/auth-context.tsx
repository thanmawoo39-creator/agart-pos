import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { Staff, StaffRole, StaffSession } from "@shared/schema";
import { useBusinessMode } from "@/contexts/BusinessModeContext";

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
  isWaiter: boolean;
  isKitchen: boolean;
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
  const { setBusinessUnit } = useBusinessMode();

  // Ensure business unit context always matches the logged-in staff (including on refresh/session restore)
  useEffect(() => {
    if (currentStaff?.businessUnitId) {
      const alreadySelected = !!localStorage.getItem('activeBusinessUnitId');
      if (currentStaff.role === 'kitchen' || !alreadySelected) {
        setBusinessUnit(currentStaff.businessUnitId);
      }
    }
  }, [currentStaff?.businessUnitId, setBusinessUnit]);

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

      // Set business unit context based on staff's assigned businessUnitId
      if (data.staff.businessUnitId) {
        setBusinessUnit(data.staff.businessUnitId);
      }

      return true;
    } catch (error) {
      console.error("Login error:", error);
      return false;
    }
  }, [setBusinessUnit]);

  const logout = useCallback(async () => {
    try {
      // CRITICAL FIX: Add timeout to prevent hanging on broken shift close calls
      const logoutPromise = fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      // Add 5 second timeout - if server hangs, we still logout locally
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Logout timeout")), 5000);
      });

      await Promise.race([logoutPromise, timeoutPromise]);
    } catch (error) {
      console.warn("Logout request failed (continuing locally):", error);
      // Continue with local logout even if server request fails
    } finally {
      // Always clear local session regardless of server response
      setSession(null);
      localStorage.removeItem("staffSession");

      // Clear any ephemeral store/cart state to prevent cross-user data leakage
      try {
        setBusinessUnit(null);
      } catch {
        // ignore
      }
      localStorage.removeItem('businessUnit');
      localStorage.removeItem('activeBusinessUnitId');
      localStorage.removeItem('cart');
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('table_cart:')) {
          localStorage.removeItem(key);
        }
      }
    }
  }, [setBusinessUnit]);

  const canAccess = useCallback(
    (requiredRole: StaffRole | StaffRole[]): boolean => {
      if (!currentStaff) return false;

      const roleHierarchy: Record<StaffRole, number> = {
        owner: 4,
        manager: 3,
        cashier: 2,
        waiter: 1,
        kitchen: 0,
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
  const isWaiter = currentStaff?.role === "waiter";
  const isKitchen = currentStaff?.role === "kitchen";

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
        isWaiter,
        isKitchen,
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
